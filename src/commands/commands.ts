import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { EmbedService } from '../infrastructure/embed.js';

const data = new SlashCommandBuilder()
  .setName('commands')
  .setDescription('List all available commands') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  const embed = EmbedService.createHelpEmbed(interaction.client);

  await interaction.followUp({ embeds: [embed] });
}

export const commandsCommand: SlashCommand = {
  data,
  execute,
};
