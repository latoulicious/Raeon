import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-prune');

const data = new SlashCommandBuilder()
  .setName('prune')
  .setDescription('Delete bot messages in the current channel')
  .addIntegerOption(option =>
    option.setName('amount')
      .setDescription('Number of bot messages to search for (max 100)')
      .setMinValue(1)
      .setMaxValue(100)
      .setRequired(false),
  ) as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const amount = interaction.options.getInteger('amount') ?? 50;
  const channel = interaction.channel;

  if (!channel || !channel.isTextBased()) {
    await interaction.followUp('This command can only be used in text channels!');
    return;
  }

  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const botMessages = messages.filter(m => m.author.id === interaction.client.user.id);
    
    // Slice to the requested amount
    const toDelete = botMessages.first(amount);

    if (toDelete.length === 0) {
      await interaction.followUp('No bot messages found to delete.');
      return;
    }

    // Filter messages older than 14 days (Discord bulk delete limit)
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const deletable = toDelete.filter(m => m.createdTimestamp > fourteenDaysAgo);
    const nonDeletable = toDelete.filter(m => m.createdTimestamp <= fourteenDaysAgo);

    let deletedCount = 0;
    if (deletable.length > 0) {
      if (channel instanceof TextChannel) {
          await channel.bulkDelete(deletable);
          deletedCount += deletable.length;
      } else {
          for (const msg of deletable) {
              await msg.delete();
              deletedCount++;
          }
      }
    }

    // Handle older messages individually
    for (const msg of nonDeletable) {
      try {
        await msg.delete();
        deletedCount++;
      } catch (e) {
        logger.error({ error: e, messageId: msg.id }, 'Failed to delete old bot message');
      }
    }

    const embed = EmbedService.createPruneEmbed(deletedCount, interaction.user);
    await interaction.followUp({ embeds: [embed] });
    logger.info({ guildId: interaction.guildId, deletedCount }, 'Prune command executed successfully');

  } catch (error) {
    logger.error({ guildId: interaction.guildId, error }, 'Error pruning bot messages');
    const embed = EmbedService.createErrorEmbed('Prune', 'Failed to prune messages.', interaction.user);
    await interaction.followUp({ embeds: [embed] });
  }
}

export const pruneCommand: SlashCommand = {
  data,
  execute,
};
