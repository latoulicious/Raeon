import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

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
    logger.info({ guildId, userId: interaction.user.id, commandName: 'stop' }, 'Stop command executed successfully');
    const embed = EmbedService.createStopEmbed(interaction.user);
    await interaction.followUp({ embeds: [embed] });
  } catch (error) {
    logger.error({ guildId, error, userId: interaction.user.id, commandName: 'stop' }, 'Error stopping music');
    const embed = EmbedService.createErrorEmbed('Stop', 'Failed to stop music.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

export const stopCommand: SlashCommand = {
  data,
  execute,
};
