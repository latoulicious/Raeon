import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { appLogger } from './logger.js';

const logger = appLogger.getLogger('startup-validator');

export class StartupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StartupValidationError';
  }
}

async function checkCommandExists(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use appropriate version flag for each command
    const versionFlag = command === 'ffmpeg' ? '-version' : '--version';
    
    const process = spawn(command, [versionFlag], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('error', (error) => {
      reject(new StartupValidationError(`Failed to start ${command}: ${error.message}`));
    });

    process.on('close', (code) => {
      if (code === 0) {
        logger.info({ command }, `Dependency check passed: ${command} is available`);
        resolve();
      } else {
        reject(new StartupValidationError(
          `${command} is not installed or not working correctly${stderr ? `: ${stderr.trim()}` : ''}`
        ));
      }
    });
  });
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
      name: 'YTDLP_COOKIES_PATH',
      check: async () => {
        const cookiesPath = process.env.YTDLP_COOKIES_PATH;
        if (!cookiesPath || cookiesPath.trim() === '') {
          throw new StartupValidationError('YTDLP_COOKIES_PATH environment variable is required and cannot be empty');
        }
        
        try {
          const { readFile } = await import('node:fs/promises');
          await readFile(cookiesPath, 'utf-8');
          logger.info({ cookiesPath }, 'YTDLP_COOKIES_PATH validation passed');
        } catch (error) {
          throw new StartupValidationError(`Cookies file not found or not readable at: ${cookiesPath}`);
        }
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
    },
    {
      name: 'yt-dlp',
      check: () => checkCommandExists('yt-dlp')
    },
    {
      name: 'ffmpeg',
      check: () => checkCommandExists('ffmpeg')
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
    
    case 'YTDLP_COOKIES_PATH':
      return '❌ **YouTube Cookies Missing**: Please set the YTDLP_COOKIES_PATH environment variable pointing to a valid cookies.txt file. This is required for accessing YouTube content.';
    
    case 'LAVALINK_PASSWORD':
      return '❌ **Lavalink Password Missing**: Please set the LAVALINK_PASSWORD environment variable. It must match the password configured on the Lavalink node (lavalink/application.yml).';

    case 'LAVALINK_PORT':
      return `❌ **Lavalink Port Invalid**: ${technicalError}`;

    case 'yt-dlp':
      return '❌ **yt-dlp Not Found**: Please install yt-dlp to download audio from YouTube. Run: `pip install yt-dlp` or visit https://github.com/yt-dlp/yt-dlp for installation instructions.';
    
    case 'ffmpeg':
      return '❌ **FFmpeg Not Found**: Please install FFmpeg to process audio files. Run: `sudo apt install ffmpeg` (Ubuntu/Debian) or visit https://ffmpeg.org/download.html for other platforms.';
    
    default:
      return `❌ **${dependency} Error**: ${technicalError}`;
  }
}
