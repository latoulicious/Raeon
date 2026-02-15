import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';

const logger = appLogger.getLogger('command-stop');

const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop playing music and disconnect from voice channel') as SlashCommandBuilder;

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

  try {
    await services.music.disconnect(guildId);
    await interaction.followUp('⏹️ Stopped playing music and disconnected from voice channel.');
  } catch (error) {
    logger.error({ guildId, error }, 'Error stopping music');
    await interaction.followUp('Failed to stop music.');
  }
}

export const stopCommand: SlashCommand = {
  data,
  execute,
};
