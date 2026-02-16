import { Client, REST, Routes, ApplicationCommandDataResolvable } from 'discord.js';
import { appLogger } from './logger.js';

const logger = appLogger.getLogger('command-manager');

export interface CommandRegistrationOptions {
  guildId?: string;
  clearGlobal?: boolean;
}

export class CommandManager {
  constructor(private readonly client: Client) {}

  /**
   * Syncs slash commands with Discord.
   * If guildId is provided, it registers commands to that guild.
   * Otherwise, it registers commands globally.
   */
  async syncCommands(commands: ApplicationCommandDataResolvable[], options: CommandRegistrationOptions = {}): Promise<void> {
    const { guildId, clearGlobal = false } = options;
    const token = this.client.token;
    const clientId = this.client.user?.id;

    if (!token || !clientId) {
      throw new Error('Client token or ID is missing. Ensure the client is logged in.');
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
      if (clearGlobal) {
        logger.info('Clearing global commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        logger.info('Global commands cleared.');
      }

      if (guildId) {
        logger.info(`Syncing commands for guild: ${guildId}`);
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commands },
        );
        logger.info(`Successfully registered ${commands.length} guild commands.`);
      } else {
        logger.info('Syncing commands globally...');
        await rest.put(
          Routes.applicationCommands(clientId),
          { body: commands },
        );
        logger.info(`Successfully registered ${commands.length} global commands.`);
      }
    } catch (error) {
      logger.error({ error, guildId }, 'Failed to sync slash commands');
      throw error;
    }
  }

  /**
   * Clears all registered commands (global and guild-specific if guildId provided).
   */
  async clearCommands(guildId?: string): Promise<void> {
    const token = this.client.token;
    const clientId = this.client.user?.id;

    if (!token || !clientId) {
      throw new Error('Client token or ID is missing.');
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
      if (guildId) {
        logger.info(`Clearing commands for guild: ${guildId}`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      } else {
        logger.info('Clearing global commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
      }
      logger.info('Commands cleared successfully.');
    } catch (error) {
      logger.error({ error, guildId }, 'Failed to clear commands');
      throw error;
    }
  }

  /**
   * Clears guild commands from all guilds the bot is currently in.
   * Useful for cleaning up duplicate commands when moving to global registration.
   */
  async clearAllGuildCommands(): Promise<void> {
    const guilds = await this.client.guilds.fetch();
    logger.info(`Cleaning up guild commands for ${guilds.size} guilds...`);
    
    for (const [guildId, guild] of guilds) {
      try {
        await this.clearCommands(guildId);
        logger.info(`Cleared commands for guild: ${guild.name} (${guildId})`);
      } catch (error) {
        logger.warn({ error, guildId }, `Could not clear commands for guild: ${guildId}`);
      }
    }
  }
}
