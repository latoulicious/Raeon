import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-shuffle');

const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Shuffle the music queue') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    const embed = EmbedService.createErrorEmbed('Shuffle', 'This command can only be used in a server.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  const queue = services.music.getQueue(guildId);
  const isPlaying = services.music.isPlaying(guildId);
  const isPaused = services.music.isPaused(guildId);

  if (queue.length === 0 && !isPlaying && !isPaused) {
    const embed = EmbedService.createErrorEmbed('Shuffle', 'No songs in queue to shuffle', interaction.user);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  if (queue.length < 2) {
    const embed = EmbedService.createErrorEmbed('Shuffle', 'Need at least 2 songs in queue to shuffle', interaction.user);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    services.music.shuffle(guildId);
    
    const embed = EmbedService.createShuffleEmbed(queue.length, interaction.user);

    await interaction.followUp({ embeds: [embed] });
    logger.info({ guildId, queueSize: queue.length }, 'Queue shuffled');
  } catch (error) {
    logger.error({ guildId, error }, 'Error shuffling queue');
    const embed = EmbedService.createErrorEmbed('Shuffle', 'Failed to shuffle queue.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

export const shuffleCommand: SlashCommand = {
  data,
  execute,
};
