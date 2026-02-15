import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';

const logger = appLogger.getLogger('command-pause');

const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pause the currently playing song') as SlashCommandBuilder;

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

  if (!isPlaying && !isPaused) {
    const embed = new EmbedBuilder()
      .setTitle('Pause')
      .setDescription('Nothing is currently playing to pause')
      .setColor('#FF6B6B')
      .setFooter({ text: 'Use /play to start playing music' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    return;
  }

  if (isPaused) {
    const embed = new EmbedBuilder()
      .setTitle('Pause')
      .setDescription('Music is already paused!')
      .setColor('#FF6B6B')
      .setFooter({ text: 'Use /resume to continue playback' })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    services.music.pause(guildId);
    
    const embed = new EmbedBuilder()
      .setTitle('Paused')
      .setDescription('Playback has been paused')
      .setColor('#FFA500')
      .addFields({
        name: 'Song',
        value: `[Currently playing](${currentTrack || '#'})`,
        inline: false
      })
      .addFields({
        name: 'Status',
        value: 'Paused - Use /resume to continue',
        inline: true
      })
      .setFooter({ 
        text: 'Requested by ' + interaction.user.tag,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    await interaction.followUp({ embeds: [embed] });
    logger.info({ guildId, track: currentTrack }, 'Music paused');
  } catch (error) {
    logger.error({ guildId, error }, 'Error pausing music');
    await interaction.followUp('Failed to pause music.');
  }
}

export const pauseCommand: SlashCommand = {
  data,
  execute,
};
