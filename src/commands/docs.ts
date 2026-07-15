import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { EmbedService } from '../infrastructure/embed.js';

const DOCS_URL = 'https://raeon.sanctuary.my.id/';

const data = new SlashCommandBuilder()
  .setName('docs')
  .setDescription('Show a link to the documentation') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  _services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  const embed = EmbedService.createBaseEmbed('Documentation')
    .setURL(DOCS_URL)
    .setDescription(`Read the docs at ${DOCS_URL}`);

  await interaction.followUp({ embeds: [embed] });
}

export const docsCommand: SlashCommand = {
  data,
  execute,
};
