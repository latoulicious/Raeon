import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-resume');

const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Resume paused playback') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId || !interaction.guild) {
    const embed = EmbedService.createErrorEmbed('Resume', 'This command can only be used in a server.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  // No live player but a persisted session pending: revive it instead of
  // unpausing. Joins the requester's current voice channel.
  const hasLivePlayer = services.music.isPlaying(guildId) || services.music.isPaused(guildId) || services.music.getCurrentTrack(guildId) !== null;
  if (!hasLivePlayer && services.music.hasPendingSession(guildId)) {
    const voiceChannel = interaction.guild.voiceStates.cache.get(interaction.user.id)?.channel;
    if (!voiceChannel) {
      const embed = EmbedService.createErrorEmbed('Resume', 'You must be in a voice channel to restore the previous session.', interaction.user);
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    try {
      const restoredCount = await services.music.revive(guildId, voiceChannel.id, interaction.channelId);
      const embed = EmbedService.createSessionRestoredEmbed(restoredCount, interaction.user);
      await interaction.followUp({ embeds: [embed] });
      logger.info({ guildId, restoredCount, userId: interaction.user.id, commandName: 'resume' }, 'Session revived');
    } catch (error) {
      logger.error({ guildId, error }, 'Error reviving session');
      const embed = EmbedService.createErrorEmbed('Resume', 'Failed to restore the previous session.', interaction.user);
      await interaction.followUp({ embeds: [embed] });
    }
    return;
  }

  await interaction.deferReply();

  const queue = services.music.getQueue(guildId);
  const isPlaying = services.music.isPlaying(guildId);
  const isPaused = services.music.isPaused(guildId);
  const pausedTrack = services.music.getCurrentTrack(guildId);

  if (isPlaying) {
    const embed = EmbedService.createErrorEmbed('Resume', 'Music is already playing!', interaction.user);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  if (!isPaused) {
    const embed = EmbedService.createErrorEmbed('Resume', 'No paused music to resume', interaction.user);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    await services.music.resume(guildId);
    
    const embed = EmbedService.createResumeEmbed(pausedTrack, queue.length, interaction.user);

    await interaction.followUp({ embeds: [embed] });
    logger.info({ guildId, track: pausedTrack }, 'Music resumed');
  } catch (error) {
    logger.error({ guildId, error }, 'Error resuming music');
    const embed = EmbedService.createErrorEmbed('Resume', 'Failed to resume music.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

export const resumeCommand: SlashCommand = {
  data,
  execute,
};
