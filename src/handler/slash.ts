import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { PingService } from '../application/services/ping.service.js';
import type { MusicService } from '../application/services/music.service.js';
import { appLogger } from '../infrastructure/logger.js';
import { EmbedService } from '../infrastructure/embed.js';

const logger = appLogger.getLogger('slash-handler');

export interface SlashCommand {
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction, services: SlashCommandServices): Promise<void>;
}

export interface SlashCommandServices {
  ping: PingService;
  music: MusicService;
}

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
  commands: Map<string, SlashCommand>,
): Promise<void> {
  const command = commands.get(interaction.commandName);
  if (!command) {
    const embed = EmbedService.createErrorEmbed('Unknown Command', 'That command does not exist.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  appLogger.incrementTotalCommands();

  try {
    logger.debug({ command: interaction.commandName, user: interaction.user.id }, 'Executing slash command');
    await command.execute(interaction, services);
  } catch (error) {
    logger.error({ command: interaction.commandName, error }, 'Error executing slash command');
    const embed = EmbedService.createErrorEmbed('Command Failed', 'There was an error while executing this command.', interaction.user);
    const reply = { embeds: [embed], flags: MessageFlags.Ephemeral } as const;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}
