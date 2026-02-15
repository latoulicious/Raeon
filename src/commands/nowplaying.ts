import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';

const logger = appLogger.getLogger('command-nowplaying');

const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show the currently playing song') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.followUp('This command can only be used in a server!');
    return;
  }

  const isPlaying = services.music.isPlaying(guildId);
  const currentTrack = services.music.getCurrentTrack(guildId);
  const queue = services.music.getQueue(guildId);

  if (!isPlaying || !currentTrack) {
    const embed = new EmbedBuilder()
      .setTitle('🎵 Now Playing')
      .setDescription('❌ Nothing is currently playing')
      .setColor('#FF6B6B')
      .addFields({
        name: 'Queue Status',
        value: queue.length > 0 ? `📋 ${queue.length} song${queue.length === 1 ? '' : 's'} in queue` : '📋 Queue is empty',
        inline: false
      })
      .setFooter({ text: 'Use /play to start playing music' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    return;
  }

  // Extract video ID from YouTube URL for thumbnail
  const videoId = extractVideoId(currentTrack);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

  const embed = new EmbedBuilder()
    .setTitle('🎵 Now Playing')
    .setDescription(`▶️ **Currently Streaming**`)
    .setColor('#1DB954')
    .setURL(currentTrack)
    .addFields(
      {
        name: '🔗 URL',
        value: `[Click to open](${currentTrack})`,
        inline: false
      },
      {
        name: '📊 Queue Status',
        value: queue.length > 0 
          ? `📋 ${queue.length} song${queue.length === 1 ? '' : 's'} waiting` 
          : '📋 Queue is empty',
        inline: true
      },
      {
        name: '⚙️ Status',
        value: '🟢 Playing',
        inline: true
      }
    )
    .setFooter({ 
      text: 'Requested by ' + interaction.user.tag,
      iconURL: interaction.user.displayAvatarURL()
    })
    .setTimestamp();

  if (thumbnailUrl) {
    embed.setThumbnail(thumbnailUrl);
  }

  await interaction.followUp({ embeds: [embed] });
  logger.info({ guildId, track: currentTrack }, 'Now playing command executed');
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([^&\n?#]+)$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export const nowplayingCommand: SlashCommand = {
  data,
  execute,
};
