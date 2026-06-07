import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
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
  await interaction.deferReply();

  if (!interaction.inGuild()) {
    await interaction.followUp('This command can only be used in a server!');
    return;
  }

  const member = await interaction.guild?.members.fetch(interaction.user.id);
  const voiceChannel = member?.voice.channel;
  
  if (!voiceChannel) {
    await interaction.followUp('You must be in a voice channel to use this command!');
    return;
  }

  const url = interaction.options.getString('url', true);
  const guildId = interaction.guildId;
  const voiceChannelId = voiceChannel.id;
  const textChannelId = interaction.channelId;

  try {
    // Keep the old yt-dlp ytsearchN: syntax working; Lavalink only knows
    // the unnumbered ytsearch: prefix and /play takes the first hit anyway.
    let identifier = url;
    const searchMatch = url.match(/^ytsearch(\d*):(.+)$/);
    if (searchMatch) {
      identifier = `ytsearch:${searchMatch[2]}`;
    }

    const result = await services.music.resolve(identifier);

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
        playlistNotice = `Playlist "${result.playlistName}" detected (${result.totalTracks} tracks) — queued the linked track only. Playlists are not supported yet.`;
        break;
      case 'empty':
        break;
    }

    if (!track) {
      const embed = EmbedService.createErrorEmbed('Play', 'No playable track was found for that URL or query.', interaction.user);
      await interaction.followUp({ embeds: [embed] });
      return;
    }

    await services.music.play(guildId, voiceChannelId, textChannelId, track);
    const queue = services.music.getQueue(guildId);

    const embed = EmbedService.createPlayEmbed(track, queue.length, interaction.user, playlistNotice);

    logger.info({ guildId, title: track.title, uri: track.uri, userId: interaction.user.id, commandName: 'play' }, 'Play command executed successfully');
    await interaction.followUp({ embeds: [embed] });
  } catch (error) {
    logger.error({ guildId, url, error, userId: interaction.user.id, commandName: 'play' }, 'Error playing music');
    
    if (error instanceof MusicServiceError) {
      const embed = EmbedService.createErrorEmbed('Error', error.userFriendlyMessage, interaction.user);
      await interaction.followUp({ embeds: [embed] });
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Failed to play the song. Please check the URL and try again.';
      const embed = EmbedService.createErrorEmbed('Error', errorMessage, interaction.user);
      await interaction.followUp({ embeds: [embed] });
    }
  }
}

export const playCommand: SlashCommand = {
  data,
  execute,
};
