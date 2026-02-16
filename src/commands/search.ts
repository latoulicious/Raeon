import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';

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
    logger.debug({ query, limit, user: interaction.user.id }, 'Executing search command');

    // Get the extractor from the music service
    const extractor = services.music.getExtractor();
    if (!extractor || typeof (extractor as any).search !== 'function') {
      await interaction.followUp('Search functionality is not available.');
      return;
    }

    const results = await (extractor as any).search(query, limit);

    if (results.length === 0) {
      await interaction.followUp('No results found for your search query.');
      return;
    }

    // Create embed for search results
    const embed = new EmbedBuilder()
      .setTitle(`Search Results for "${query}"`)
      .setColor('#FF0000')
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setDescription(`Found ${results.length} result${results.length === 1 ? '' : 's'} for your search`)
      .setTimestamp();

    results.forEach((result: any, index: number) => {
      const duration = result.duration === 'Unknown' ? 'Unknown' : 
        typeof result.duration === 'number' ? formatDuration(result.duration) : result.duration;
      
      embed.addFields({
        name: `${index + 1}. ${result.title}`,
        value: `**${result.uploader}** | **${duration}**\n[Click to play](${result.url})\n\`/play ${result.url}\``,
        inline: false
      });
    });

    embed.setFooter({ 
      text: `Use /play with the URL or try /play ytsearch1:"song name" for direct search • Results: ${results.length}/${limit}` 
    });

    await interaction.followUp({ embeds: [embed] });
    logger.info({ query, resultCount: results.length, user: interaction.user.id }, 'Search completed successfully');

  } catch (error) {
    logger.error({ query, limit, error, user: interaction.user.id }, 'Error during search');
    await interaction.followUp('Failed to search for songs. Please try again later.');
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export const searchCommand: SlashCommand = {
  data,
  execute,
};
