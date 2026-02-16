import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-remove');

const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Remove a song from the queue')
  .addIntegerOption(option =>
    option.setName('position')
      .setDescription('Position of the song to remove (1 = first in queue)')
      .setMinValue(1)
      .setRequired(true),
  ) as SlashCommandBuilder;

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

  const position = interaction.options.getInteger('position', true);
  const queue = services.music.getQueue(guildId);

  if (queue.length === 0) {
    const embed = EmbedService.createErrorEmbed('Remove', 'No songs in queue to remove', interaction.user);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  if (position > queue.length) {
    const embed = EmbedService.createErrorEmbed('Remove', `Invalid position! Queue only has ${queue.length} song${queue.length === 1 ? '' : 's'}`, interaction.user);
    embed.addFields({
      name: 'Valid Positions',
      value: `1-${queue.length}`,
      inline: false
    });
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    const removedSong = services.music.remove(guildId, position);
    
    if (!removedSong) {
      const embed = EmbedService.createErrorEmbed('Remove', 'Failed to remove song from queue.', interaction.user);
      await interaction.followUp({ embeds: [embed] });
      return;
    }

    const newQueueSize = services.music.getQueue(guildId).length;
    const embed = EmbedService.createRemoveEmbed(position, removedSong, newQueueSize, interaction.user);

    await interaction.followUp({ embeds: [embed] });
    logger.info({ guildId, position, removedSong, newQueueSize }, 'Song removed from queue');
  } catch (error) {
    logger.error({ guildId, error }, 'Error removing song from queue');
    const embed = EmbedService.createErrorEmbed('Remove', 'Failed to remove song from queue.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

export const removeCommand: SlashCommand = {
  data,
  execute,
};
