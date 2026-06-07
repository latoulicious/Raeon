import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-pause');

const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pause the currently playing song') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    const embed = EmbedService.createErrorEmbed('Pause', 'This command can only be used in a server.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  const isPlaying = services.music.isPlaying(guildId);
  const isPaused = services.music.isPaused(guildId);
  const currentTrack = services.music.getCurrentTrack(guildId);

  if (!isPlaying && !isPaused) {
    const embed = EmbedService.createErrorEmbed('Pause', 'Nothing is currently playing to pause', interaction.user);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  if (isPaused) {
    const embed = EmbedService.createErrorEmbed('Pause', 'Music is already paused!', interaction.user);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    services.music.pause(guildId);
    
    const embed = EmbedService.createPauseEmbed(currentTrack, interaction.user);

    await interaction.followUp({ embeds: [embed] });
    logger.info({ guildId, track: currentTrack }, 'Music paused');
  } catch (error) {
    logger.error({ guildId, error }, 'Error pausing music');
    const embed = EmbedService.createErrorEmbed('Pause', 'Failed to pause music.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

export const pauseCommand: SlashCommand = {
  data,
  execute,
};
