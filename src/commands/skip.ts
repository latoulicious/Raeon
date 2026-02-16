import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

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
    const embed = EmbedService.createErrorEmbed('Skip', 'Nothing is currently playing!', interaction.user);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    const queue = services.music.getQueue(guildId);
    services.music.stop(guildId);
    
    const embed = EmbedService.createSkipEmbed(queue.length, interaction.user);
    
    logger.info({ guildId, userId: interaction.user.id, commandName: 'skip' }, 'Skip command executed successfully');
    await interaction.followUp({ embeds: [embed] });
  } catch (error) {
    logger.error({ guildId, error, userId: interaction.user.id, commandName: 'skip' }, 'Error skipping music');
    const embed = EmbedService.createErrorEmbed('Skip', 'Failed to skip song.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

export const skipCommand: SlashCommand = {
  data,
  execute,
};
