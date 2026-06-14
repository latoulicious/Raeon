import { readFileSync } from 'node:fs';
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { EmbedService } from '../infrastructure/embed.js';

// package.json sits outside rootDir (./src), so a static JSON import would
// trip tsc (TS6059). Read it at runtime relative to this module instead.
const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
) as { version: string };

const data = new SlashCommandBuilder()
  .setName('about')
  .setDescription('Show bot info and metadata') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  _services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  const embed = EmbedService.createAboutEmbed(interaction.client, pkg.version);

  await interaction.followUp({ embeds: [embed] });
}

export const aboutCommand: SlashCommand = {
  data,
  execute,
};
