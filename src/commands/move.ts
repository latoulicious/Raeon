import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-move');

const data = new SlashCommandBuilder()
  .setName('move')
  .setDescription('Move a song to a different position in the queue')
  .addIntegerOption(option =>
    option.setName('from')
      .setDescription('Current position of the song (1 = first in queue)')
      .setMinValue(1)
      .setRequired(true),
  )
  .addIntegerOption(option =>
    option.setName('to')
      .setDescription('Position to move it to (1 = first in queue)')
      .setMinValue(1)
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    const embed = EmbedService.createErrorEmbed('Move', 'This command can only be used in a server.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  const from = interaction.options.getInteger('from', true);
  const to = interaction.options.getInteger('to', true);
  const queue = services.music.getQueue(guildId);

  if (queue.length === 0) {
    const embed = EmbedService.createErrorEmbed('Move', 'No songs in queue to move.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  if (from > queue.length || to > queue.length) {
    const embed = EmbedService.createErrorEmbed('Move', `Invalid position! Queue only has ${queue.length} song${queue.length === 1 ? '' : 's'}`, interaction.user);
    embed.addFields({ name: 'Valid Positions', value: `1-${queue.length}`, inline: false });
    await interaction.followUp({ embeds: [embed] });
    return;
  }

  try {
    const moved = services.music.move(guildId, from, to);
    if (!moved) {
      const embed = EmbedService.createErrorEmbed('Move', 'Failed to move song in queue.', interaction.user);
      await interaction.followUp({ embeds: [embed] });
      return;
    }

    const embed = EmbedService.createSuccessEmbed(
      'Move',
      `Moved **${moved.title}** from position ${from} to ${to}.`,
      interaction.user,
    );
    await interaction.followUp({ embeds: [embed] });
    logger.info({ guildId, from, to, title: moved.title }, 'Song moved in queue');
  } catch (error) {
    logger.error({ guildId, error }, 'Error moving song in queue');
    const embed = EmbedService.createErrorEmbed('Move', 'Failed to move song in queue.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

export const moveCommand: SlashCommand = {
  data,
  execute,
};
