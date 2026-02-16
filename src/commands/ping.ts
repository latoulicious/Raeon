import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { EmbedService } from '../infrastructure/embed.js';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency');

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  const response = services.ping.ping();
  const embed = EmbedService.createPingEmbed(response.message, response.timestamp);
  await interaction.reply({ embeds: [embed] });
}

export const pingCommand: SlashCommand = {
  data,
  execute,
};
