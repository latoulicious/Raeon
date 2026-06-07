import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-search');

const data = new SlashCommandBuilder()
  .setName('search')
  .setDescription('Search for songs on YouTube')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('Search query for YouTube')
      .setRequired(true),
  )
  .addIntegerOption(option =>
    option.setName('limit')
      .setDescription('Number of results to return (1-20)')
      .setMinValue(1)
      .setMaxValue(20)
      .setRequired(false),
  ) as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  const query = interaction.options.getString('query', true);
  const limit = interaction.options.getInteger('limit') ?? 10;

  try {
    logger.debug({ query, limit, userId: interaction.user.id, guildId: interaction.guildId, commandName: 'search' }, 'Executing search command');

    const result = await services.music.resolve(`ytsearch:${query}`);
    const results = result.kind === 'search' ? result.tracks.slice(0, limit) : [];

    if (results.length === 0) {
      const embed = EmbedService.createErrorEmbed('Search', `No results found for "${query}"`, interaction.user);
      await interaction.followUp({ embeds: [embed] });
      return;
    }

    const embed = EmbedService.createSearchEmbed(query, results, limit, interaction.client);

    await interaction.followUp({ embeds: [embed] });
    logger.info({ query, resultCount: results.length, userId: interaction.user.id, guildId: interaction.guildId, commandName: 'search' }, 'Search completed successfully');

  } catch (error) {
    logger.error({ query, limit, error, userId: interaction.user.id, guildId: interaction.guildId, commandName: 'search' }, 'Error during search');
    const embed = EmbedService.createErrorEmbed('Search', 'Failed to search for songs. Please try again later.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

export const searchCommand: SlashCommand = {
  data,
  execute,
};
