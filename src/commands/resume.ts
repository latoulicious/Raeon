import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';

const logger = appLogger.getLogger('command-resume');

const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Resume paused playback') as SlashCommandBuilder;

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

  const queue = services.music.getQueue(guildId);
  const isPlaying = services.music.isPlaying(guildId);
  const isPaused = services.music.isPaused(guildId);
  const pausedTrack = services.music.getCurrentTrack(guildId);

  if (isPlaying) {
    const embed = new EmbedBuilder()
      .setTitle('Resume')
      .setDescription('Music is already playing!')
      .setColor('#FF6B6B')
      .setFooter({ text: 'Use /pause to pause the current song' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    return;
  }

  if (!isPaused) {
    const embed = new EmbedBuilder()
      .setTitle('Resume')
      .setDescription('No paused music to resume')
      .setColor('#FF6B6B')
      .addFields({
        name: 'Queue Status',
        value: queue.length > 0 ? `${queue.length} song${queue.length === 1 ? '' : 's'} in queue` : 'Queue is empty',
        inline: false
      })
      .addFields({
        name: 'Suggestion',
        value: queue.length > 0 ? 'Use /play to start music' : 'Use /play to add songs to the queue',
        inline: false
      })
      .setFooter({ text: 'Music must be paused before resuming' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    await services.music.resume(guildId);
    
    const embed = new EmbedBuilder()
      .setTitle('Resumed')
      .setDescription('Playback has been resumed')
      .setColor('#00FF00')
      .addFields({
        name: 'Song',
        value: `[Now playing](${pausedTrack || '#'})`,
        inline: false
      })
      .addFields({
        name: 'Queue Status',
        value: queue.length > 0 ? `${queue.length} song${queue.length === 1 ? '' : 's'} remaining` : 'Last song in queue',
        inline: true
      })
      .addFields({
        name: 'Status',
        value: 'Playing',
        inline: true
      })
      .setFooter({ 
        text: 'Requested by ' + interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    logger.info({ guildId, track: pausedTrack }, 'Music resumed');
  } catch (error) {
    logger.error({ guildId, error }, 'Error resuming music');
    await interaction.followUp('Failed to resume music.');
  }
}

export const resumeCommand: SlashCommand = {
  data,
  execute,
};
