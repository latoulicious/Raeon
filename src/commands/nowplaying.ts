import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-nowplaying');

const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show the currently playing song') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.followUp('This command can only be used in a server!');
    return;
  }

  const isPlaying = services.music.isPlaying(guildId);
  const isPaused = services.music.isPaused(guildId);
  const currentTrack = services.music.getCurrentTrack(guildId);
  const queue = services.music.getQueue(guildId);

  if (!isPlaying && !isPaused) {
    const embed = EmbedService.createEmptyQueueEmbed(interaction.client);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  if (!currentTrack) {
    const embed = EmbedService.createEmptyQueueEmbed(interaction.client);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  const embed = EmbedService.createNowPlayingEmbed(
    currentTrack,
    isPaused,
    queue.length,
    interaction.user,
    interaction.client
  );

  await interaction.followUp({ embeds: [embed] });
  logger.info({ guildId, track: currentTrack }, 'Now playing command executed');
}

export const nowplayingCommand: SlashCommand = {
  data,
  execute,
};
