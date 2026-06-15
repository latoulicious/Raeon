import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { MusicServiceError } from '../application/services/music.service.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-play');

const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song from YouTube')
  .addStringOption(option =>
    option.setName('url')
      .setDescription('YouTube URL or search query (e.g., ytsearch10:song name)')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    const embed = EmbedService.createErrorEmbed('Play', 'This command can only be used in a server.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  // Voice state is cached via the GuildVoiceStates intent; no member fetch needed.
  const voiceChannel = interaction.guild.voiceStates.cache.get(interaction.user.id)?.channel;

  if (!voiceChannel) {
    const embed = EmbedService.createErrorEmbed('Play', 'You must be in a voice channel to use this command.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  const url = interaction.options.getString('url', true);
  const guildId = interaction.guildId;
  const voiceChannelId = voiceChannel.id;
  const textChannelId = interaction.channelId;

  try {
    // Normalize input onto a path that works on a flagged datacenter IP:
    // plain text becomes a search, bare video URLs are routed through the
    // radio/mix form so the login-gated single-video resolve path is avoided,
    // and real playlist/mix URLs pass through untouched.
    const identifier = normalizeIdentifier(url);

    const result = await services.music.resolve(identifier);

    // Pure playlist URLs queue the whole list; watch URLs that merely
    // carry a &list= param fall through to the single-track path.
    if (result.kind === 'playlist' && isPurePlaylistUrl(identifier)) {
      const { queued, dropped, restoredCount } = await services.music.playMany(guildId, voiceChannelId, textChannelId, result.tracks);
      const embed = EmbedService.createPlaylistEmbed(result.playlistName, queued, result.tracks.length, interaction.user);

      logger.info({ guildId, playlist: result.playlistName, queued, dropped, userId: interaction.user.id, commandName: 'play' }, 'Playlist queued');
      await interaction.followUp({ embeds: [embed] });

      if (restoredCount > 0) {
        const restoredEmbed = EmbedService.createSessionRestoredEmbed(restoredCount, interaction.user);
        await interaction.followUp({ embeds: [restoredEmbed] });
      }
      return;
    }

    let track;
    let playlistNotice: string | null = null;
    switch (result.kind) {
      case 'track':
        track = result.track;
        break;
      case 'search':
        track = result.tracks[0];
        break;
      case 'playlist':
        track = result.track;
        // Synthetic radio mixes (list=RD...) we generate for bare video URLs
        // resolve to the single requested track — no playlist notice needed.
        if (!/[?&]list=RD/.test(identifier)) {
          playlistNotice = `Playlist "${result.playlistName}" detected (${result.tracks.length} tracks) — queued the linked track only. To queue the entire playlist, use the playlist URL (youtube.com/playlist?list=...) instead of a video URL.`;
        }
        break;
      case 'empty':
        break;
    }

    if (!track) {
      const embed = EmbedService.createErrorEmbed('Play', 'No playable track was found for that URL or query.', interaction.user);
      await interaction.followUp({ embeds: [embed] });
      return;
    }

    const { restoredCount } = await services.music.play(guildId, voiceChannelId, textChannelId, track);
    const queue = services.music.getQueue(guildId);

    const embed = EmbedService.createPlayEmbed(track, queue.length, interaction.user, playlistNotice);

    logger.info({ guildId, title: track.title, uri: track.uri, userId: interaction.user.id, commandName: 'play' }, 'Play command executed successfully');
    await interaction.followUp({ embeds: [embed] });

    if (restoredCount > 0) {
      const restoredEmbed = EmbedService.createSessionRestoredEmbed(restoredCount, interaction.user);
      await interaction.followUp({ embeds: [restoredEmbed] });
    }
  } catch (error) {
    logger.error({ guildId, url, error, userId: interaction.user.id, commandName: 'play' }, 'Error playing music');
    
    // Unknown errors stay in the logs; the channel only sees a generic message.
    const message = error instanceof MusicServiceError
      ? error.userFriendlyMessage
      : 'Failed to play the song. Please try again later.';
    const embed = EmbedService.createErrorEmbed('Play', message, interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

/**
 * Only real playlist links (path /playlist) queue the whole list;
 * casually-copied watch URLs with a &list= param (incl. youtu.be) and
 * YouTube mixes stay on the single-track path.
 */
function isPurePlaylistUrl(input: string): boolean {
  try {
    return new URL(input).pathname.includes('/playlist');
  } catch {
    return false;
  }
}

/**
 * Extract a YouTube video ID from a watch / youtu.be / shorts URL, or null if
 * the URL is not a recognizable single-video link.
 */
function extractVideoId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    return u.pathname.slice(1) || null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] ?? null;
  }
  return null;
}

/**
 * Map any /play input onto a Lavalink identifier that resolves on a flagged
 * datacenter IP:
 *   - ytsearchN: / ytsearch:  -> unnumbered ytsearch: (takes the first hit)
 *   - plain text              -> ytsearch: query
 *   - bare video URL          -> radio/mix form (avoids login-gated resolve)
 *   - playlist / mix URLs     -> unchanged
 */
function normalizeIdentifier(raw: string): string {
  const input = raw.trim();

  const searchMatch = input.match(/^ytsearch(\d*):(.+)$/);
  if (searchMatch) {
    return `ytsearch:${searchMatch[2]}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    // Not a URL and not an explicit search prefix — treat it as a search query.
    return `ytsearch:${input}`;
  }

  // A bare single video (no playlist context) would hit the login-gated
  // routeFromVideoId path. Route it through the video's radio mix instead,
  // which returns the requested track via the working playlist path.
  const videoId = extractVideoId(parsed);
  if (videoId && !parsed.searchParams.has('list')) {
    return `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}&start_radio=1`;
  }

  return input;
}

export const playCommand: SlashCommand = {
  data,
  execute,
};
