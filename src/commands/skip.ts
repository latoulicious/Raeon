import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';

const logger = appLogger.getLogger('command-skip');

const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current song') as SlashCommandBuilder;

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

  if (!services.music.isPlaying(guildId)) {
    await interaction.followUp('Nothing is currently playing!');
    return;
  }

  try {
    services.music.stop(guildId);
    await interaction.followUp('⏭️ Skipped current song!');
  } catch (error) {
    logger.error({ guildId, error }, 'Error skipping music');
    await interaction.followUp('Failed to skip song.');
  }
}

export const skipCommand: SlashCommand = {
  data,
  execute,
};
