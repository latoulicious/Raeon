import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-autoplay');

const data = new SlashCommandBuilder()
  .setName('autoplay')
  .setDescription('Toggle autoplay: queue a similar song when the queue runs out')
  .addBooleanOption(option =>
    option.setName('enabled')
      .setDescription('Turn autoplay on or off (omit to toggle)')
      .setRequired(false),
  ) as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    const embed = EmbedService.createErrorEmbed('Autoplay', 'This command can only be used in a server.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  // Explicit value wins; omitted flips the current state.
  const requested = interaction.options.getBoolean('enabled');
  const enabled = requested ?? !services.music.isAutoplayEnabled(guildId);
  services.music.setAutoplay(guildId, enabled);

  logger.info({ guildId, enabled, userId: interaction.user.id, commandName: 'autoplay' }, 'Autoplay toggled');
  const embed = EmbedService.createSuccessEmbed(
    'Autoplay',
    enabled
      ? "Autoplay **on** — I'll queue a similar song when the queue runs out. (YouTube tracks only.)"
      : 'Autoplay **off** — playback stops when the queue ends.',
    interaction.user,
  );
  await interaction.reply({ embeds: [embed] });
}

export const autoplayCommand: SlashCommand = {
  data,
  execute,
};
