import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';

const logger = appLogger.getLogger('command-shuffle');

const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Shuffle the music queue') as SlashCommandBuilder;

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

  const queue = services.music.getQueue(guildId);
  const isPlaying = services.music.isPlaying(guildId);
  const isPaused = services.music.isPaused(guildId);

  if (queue.length === 0 && !isPlaying && !isPaused) {
    const embed = new EmbedBuilder()
      .setTitle('Shuffle')
      .setDescription('No songs in queue to shuffle')
      .setColor('#FF6B6B')
      .setFooter({ text: 'Use /play to add songs to the queue' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    return;
  }

  if (queue.length < 2) {
    const embed = new EmbedBuilder()
      .setTitle('Shuffle')
      .setDescription('Need at least 2 songs in queue to shuffle')
      .setColor('#FF6B6B')
      .addFields({
        name: 'Current Queue',
        value: queue.length === 1 ? '1 song in queue' : 'Only current song is playing',
        inline: false
      })
      .setFooter({ text: 'Add more songs to enable shuffling' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    services.music.shuffle(guildId);
    
    const embed = new EmbedBuilder()
      .setTitle('Shuffled')
      .setDescription('Queue has been shuffled')
      .setColor('#9B59B6')
      .addFields({
        name: 'Queue Status',
        value: `${queue.length} song${queue.length === 1 ? '' : 's'} shuffled`,
        inline: true
      })
      .addFields({
        name: 'Status',
        value: isPlaying ? 'Currently playing' : isPaused ? 'Paused' : 'Not playing',
        inline: true
      })
      .addFields({
        name: 'Tip',
        value: 'Use /queue to see the new order',
        inline: false
      })
      .setFooter({ 
        text: 'Requested by ' + interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    logger.info({ guildId, queueSize: queue.length }, 'Queue shuffled');
  } catch (error) {
    logger.error({ guildId, error }, 'Error shuffling queue');
    await interaction.followUp('Failed to shuffle queue.');
  }
}

export const shuffleCommand: SlashCommand = {
  data,
  execute,
};
