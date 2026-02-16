import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { MusicServiceError } from '../application/services/music.service.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-play');

const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song from YouTube')
  .addStringOption(option =>
    option.setName('url')
      .setDescription('YouTube URL or search query (e.g., ytsearch10:song name)')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  if (!interaction.inGuild()) {
    await interaction.followUp('This command can only be used in a server!');
    return;
  }

  const member = await interaction.guild?.members.fetch(interaction.user.id);
  const voiceChannel = member?.voice.channel;
  
  if (!voiceChannel) {
    await interaction.followUp('You must be in a voice channel to use this command!');
    return;
  }

  const url = interaction.options.getString('url', true);
  const guildId = interaction.guildId;
  const channelId = voiceChannel.id;

  try {
    // Handle search queries (ytsearch format)
    let finalUrl = url;
    if (url.startsWith('ytsearch')) {
      // This is a search query, get the first result
      const extractor = services.music.getExtractor();
      if (!extractor || typeof (extractor as any).search !== 'function') {
        await interaction.followUp('Search functionality is not available.');
        return;
      }

      // Extract search query from ytsearch format
      const searchMatch = url.match(/ytsearch(\d+):(.+)/);
      if (!searchMatch) {
        await interaction.followUp('Invalid search format. Use: ytsearch10:your query');
        return;
      }

      const [, limit, query] = searchMatch;
      const results = await (extractor as any).search(query, parseInt(limit || '10'));
      
      if (results.length === 0) {
        await interaction.followUp('No results found for your search query.');
        return;
      }

      // Use the first search result
      finalUrl = results[0].url;
      logger.debug({ originalQuery: url, finalUrl, resultCount: results.length }, 'Resolved search query to URL');
    }

    await services.music.play(guildId, channelId, finalUrl);
    const queue = services.music.getQueue(guildId);
    
    const embed = EmbedService.createPlayEmbed(finalUrl, queue.length, interaction.user, interaction.client);
    
    logger.info({ guildId, url: finalUrl, userId: interaction.user.id, commandName: 'play' }, 'Play command executed successfully');
    await interaction.followUp({ embeds: [embed] });
  } catch (error) {
    logger.error({ guildId, url, error, userId: interaction.user.id, commandName: 'play' }, 'Error playing music');
    
    if (error instanceof MusicServiceError) {
      const embed = EmbedService.createErrorEmbed('Error', error.userFriendlyMessage, interaction.user);
      await interaction.followUp({ embeds: [embed] });
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Failed to play the song. Please check the URL and try again.';
      const embed = EmbedService.createErrorEmbed('Error', errorMessage, interaction.user);
      await interaction.followUp({ embeds: [embed] });
    }
  }
}

export const playCommand: SlashCommand = {
  data,
  execute,
};
