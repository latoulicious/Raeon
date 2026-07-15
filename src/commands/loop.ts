import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import type { LoopMode } from '../domain/guild-player.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('command-loop');

const MODE_DESCRIPTION: Record<LoopMode, string> = {
  off: 'Loop **off** — playback advances normally.',
  track: 'Loop **track** — the current song repeats until you change it.',
  queue: 'Loop **queue** — finished songs cycle to the back of the queue.',
};

const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Loop the current track or the whole queue (off by default)')
  .addStringOption(option =>
    option.setName('mode')
      .setDescription('What to loop')
      .setRequired(true)
      .addChoices(
        { name: 'off', value: 'off' },
        { name: 'track', value: 'track' },
        { name: 'queue', value: 'queue' },
      ),
  ) as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    const embed = EmbedService.createErrorEmbed('Loop', 'This command can only be used in a server.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  const mode = interaction.options.getString('mode', true) as LoopMode;
  const applied = services.music.setLoop(guildId, mode);

  if (!applied) {
    const embed = EmbedService.createErrorEmbed('Loop', 'Nothing is playing to loop.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  logger.info({ guildId, mode, userId: interaction.user.id, commandName: 'loop' }, 'Loop mode changed');
  const embed = EmbedService.createSuccessEmbed('Loop', MODE_DESCRIPTION[mode], interaction.user);
  await interaction.reply({ embeds: [embed] });
}

export const loopCommand: SlashCommand = {
  data,
  execute,
};
