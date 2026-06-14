import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { EmbedService } from '../infrastructure/embed.js';

const data = new SlashCommandBuilder()
  .setName('usage')
  .setDescription('Show bot resource usage') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  _services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  const embed = EmbedService.createUsageEmbed();

  await interaction.followUp({ embeds: [embed] });
}

export const usageCommand: SlashCommand = {
  data,
  execute,
};
