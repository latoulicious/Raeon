import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-clear');

const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear the music queue') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    const embed = EmbedService.createErrorEmbed('Clear', 'This command can only be used in a server.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  const queue = services.music.getQueue(guildId);
  if (queue.length === 0) {
    const embed = EmbedService.createErrorEmbed('Clear', 'The queue is already empty!', interaction.user);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    const count = queue.length;
    services.music.clear(guildId);
    const embed = EmbedService.createClearEmbed(count, interaction.user);
    await interaction.followUp({ embeds: [embed] });
  } catch (error) {
    logger.error({ guildId, error }, 'Error clearing queue');
    const embed = EmbedService.createErrorEmbed('Clear', 'Failed to clear the queue.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

export const clearCommand: SlashCommand = {
  data,
  execute,
};
