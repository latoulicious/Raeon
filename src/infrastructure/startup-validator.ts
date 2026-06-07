import { appLogger } from './logger.js';

const logger = appLogger.getLogger('startup-validator');

export class StartupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StartupValidationError';
  }
}

export async function validateStartupRequirements(): Promise<void> {
  logger.info('Performing startup validation checks...');

  const checks = [
    {
      name: 'DISCORD_TOKEN',
      check: () => {
        const token = process.env.DISCORD_TOKEN;
        if (!token || token.trim() === '') {
          throw new StartupValidationError('DISCORD_TOKEN environment variable is required and cannot be empty');
        }
        if (token.length < 50) {
          throw new StartupValidationError('DISCORD_TOKEN appears to be invalid (too short)');
        }
        logger.info('DISCORD_TOKEN validation passed');
      }
    },
    {
      name: 'LAVALINK_PASSWORD',
      check: () => {
        const password = process.env.LAVALINK_PASSWORD;
        if (!password || password.trim() === '') {
          throw new StartupValidationError('LAVALINK_PASSWORD environment variable is required and cannot be empty');
        }
        logger.info('LAVALINK_PASSWORD validation passed');
      }
    },
    {
      name: 'LAVALINK_PORT',
      check: () => {
        const port = process.env.LAVALINK_PORT;
        if (port === undefined || port.trim() === '') {
          return; // optional, defaults to 2333 in loadConfig
        }
        const parsed = Number(port);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
          throw new StartupValidationError(`LAVALINK_PORT must be a port number (1-65535), got: ${port}`);
        }
        logger.info('LAVALINK_PORT validation passed');
      }
    }
  ];

  for (const { name, check } of checks) {
    try {
      await check();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const userFriendlyMessage = getUserFriendlyErrorMessage(name, errorMessage);
      
      logger.error({ name, error: errorMessage }, 'Startup validation failed');
      throw new StartupValidationError(userFriendlyMessage);
    }
  }

  logger.info('All startup validation checks passed successfully!');
}

function getUserFriendlyErrorMessage(dependency: string, technicalError: string): string {
  switch (dependency) {
    case 'DISCORD_TOKEN':
      return '❌ **Discord Token Missing**: Please set the DISCORD_TOKEN environment variable with a valid bot token. You can get this from the Discord Developer Portal.';
    
    case 'LAVALINK_PASSWORD':
      return '❌ **Lavalink Password Missing**: Please set the LAVALINK_PASSWORD environment variable. It must match the password configured on the Lavalink node (lavalink/application.yml).';

    case 'LAVALINK_PORT':
      return `❌ **Lavalink Port Invalid**: ${technicalError}`;

    default:
      return `❌ **${dependency} Error**: ${technicalError}`;
  }
}
