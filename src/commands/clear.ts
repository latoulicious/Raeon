import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';

const logger = appLogger.getLogger('command-clear');

const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear the music queue') as SlashCommandBuilder;

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
  if (queue.length === 0) {
    await interaction.followUp('The queue is already empty!');
    return;
  }

  try {
    services.music.clear(guildId);
    await interaction.followUp(`🗑️ Cleared ${queue.length} song${queue.length === 1 ? '' : 's'} from the queue.`);
  } catch (error) {
    logger.error({ guildId, error }, 'Error clearing queue');
    await interaction.followUp('Failed to clear the queue.');
  }
}

export const clearCommand: SlashCommand = {
  data,
  execute,
};
