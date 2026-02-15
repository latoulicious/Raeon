import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { PingService } from '../application/services/ping.service.js';
import type { MusicService } from '../application/services/music.service.js';
import { appLogger } from '../infrastructure/logger.js';

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
    await interaction.reply({ content: 'Unknown command', ephemeral: true });
    return;
  }

  appLogger.incrementTotalCommands();
  
  try {
    logger.debug({ command: interaction.commandName, user: interaction.user.id }, 'Executing slash command');
    await command.execute(interaction, services);
  } catch (error) {
    logger.error({ command: interaction.commandName, error }, 'Error executing slash command');
    const reply = interaction.replied || interaction.deferred
      ? { content: 'There was an error while executing this command!', ephemeral: true }
      : { content: 'There was an error while executing this command!', ephemeral: true };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}
