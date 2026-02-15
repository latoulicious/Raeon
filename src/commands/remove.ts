import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';

const logger = appLogger.getLogger('command-remove');

const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Remove a song from the queue')
  .addIntegerOption(option =>
    option.setName('position')
      .setDescription('Position of the song to remove (1 = first in queue)')
      .setMinValue(1)
      .setRequired(true),
  ) as SlashCommandBuilder;

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

  const position = interaction.options.getInteger('position', true);
  const queue = services.music.getQueue(guildId);

  if (queue.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('🗑️ Remove')
      .setDescription('❌ No songs in queue to remove')
      .setColor('#FF6B6B')
      .setFooter({ text: 'Use /play to add songs to the queue' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    return;
  }

  if (position > queue.length) {
    const embed = new EmbedBuilder()
      .setTitle('Remove')
      .setDescription(`Invalid position! Queue only has ${queue.length} song${queue.length === 1 ? '' : 's'}`)
      .setColor('#FF6B6B')
      .addFields({
        name: 'Valid Positions',
        value: `1-${queue.length}`,
        inline: false
      })
      .addFields({
        name: 'Tip',
        value: 'Use /queue to see all songs in the queue',
        inline: false
      })
      .setFooter({ text: 'Position must be within queue range' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    const removedSong = services.music.remove(guildId, position);
    
    if (!removedSong) {
      await interaction.followUp('Error: Failed to remove song from queue.');
      return;
    }

    const videoId = extractVideoId(removedSong);
    const shortUrl = videoId ? `https://youtu.be/${videoId}` : removedSong;
    const newQueueSize = services.music.getQueue(guildId).length;

    const embed = new EmbedBuilder()
      .setTitle('Removed')
      .setDescription('Song removed from queue')
      .setColor('#E74C3C')
      .addFields({
        name: 'Removed Song',
        value: `Position ${position}: [Open](${shortUrl})`,
        inline: false
      })
      .addFields({
        name: 'Queue Status',
        value: `${newQueueSize} song${newQueueSize === 1 ? '' : 's'} remaining`,
        inline: true
      })
      .addFields({
        name: 'Status',
        value: services.music.isPlaying(guildId) ? 'Playing' : services.music.isPaused(guildId) ? 'Paused' : 'Not playing',
        inline: true
      })
      .setFooter({ 
        text: 'Requested by ' + interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    logger.info({ guildId, position, removedSong, newQueueSize }, 'Song removed from queue');
  } catch (error) {
    logger.error({ guildId, error }, 'Error removing song from queue');
    await interaction.followUp('Failed to remove song from queue.');
  }
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

export const removeCommand: SlashCommand = {
  data,
  execute,
};
