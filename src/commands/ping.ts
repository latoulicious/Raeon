import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency');

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  const response = services.ping.ping();
  await interaction.reply(`Ping: ${response.message} (Timestamp: ${response.timestamp})`);
}

export const pingCommand: SlashCommand = {
  data,
  execute,
};
