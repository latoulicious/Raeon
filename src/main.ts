import { loadConfig } from './config/index.js';
import { DiscordClient } from './infrastructure/discord-client.js';
import { YtdlpExtractor } from './infrastructure/yt-dlp.js';
import { FfmpegEncoder } from './infrastructure/ffmpeg.js';
import { VoiceGateway } from './infrastructure/voice-gateway.js';
import { PingService } from './application/services/ping.service.js';
import { MusicService } from './application/services/music.service.js';
import { handleSlashCommand } from './handler/slash.js';
import { handleMessage } from './handler/message.js';
import { handleReaction } from './handler/reaction.js';
import { pingCommand } from './commands/ping.js';
import { playCommand } from './commands/play.js';
import { stopCommand } from './commands/stop.js';
import { skipCommand } from './commands/skip.js';
import { queueCommand } from './commands/queue.js';
import { clearCommand } from './commands/clear.js';
import { commandsCommand } from './commands/commands.js';
import { updatePresence } from './presence/index.js';
import pino from 'pino';

const logger = pino();

class Application {
  private readonly discordClient: DiscordClient;
  private readonly pingService: PingService;
  private readonly musicService: MusicService;
  private readonly slashCommands = new Map<string, any>();
  private abortController: AbortController;

  constructor(config: any) {
    this.abortController = new AbortController();

    this.discordClient = new DiscordClient();
    
    const extractor = new YtdlpExtractor(config.ytdlpCookiesPath);
    const encoder = new FfmpegEncoder();
    const voiceGateway = new VoiceGateway();

    this.pingService = new PingService();
    this.musicService = new MusicService(voiceGateway, extractor, encoder);

    this.slashCommands.set(pingCommand.data.name, pingCommand);
    this.slashCommands.set(playCommand.data.name, playCommand);
    this.slashCommands.set(stopCommand.data.name, stopCommand);
    this.slashCommands.set(skipCommand.data.name, skipCommand);
    this.slashCommands.set(queueCommand.data.name, queueCommand);
    this.slashCommands.set(clearCommand.data.name, clearCommand);
    this.slashCommands.set(commandsCommand.data.name, commandsCommand);
  }

  async start(config: any): Promise<void> {
    (global as any).client = this.discordClient.raw;

    this.discordClient.once('ready', () => {
      logger.info('Bot is ready');
      updatePresence(this.discordClient.raw);
    });

    this.discordClient.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction, {
          ping: this.pingService,
          music: this.musicService,
        }, this.slashCommands);
      }
    });

    this.discordClient.on('messageCreate', async (message) => {
      await handleMessage(message, {});
    });

    this.discordClient.on('messageReactionAdd', async (reaction, user) => {
      await handleReaction(reaction, user, {});
    });

    await this.discordClient.login(config.discordToken);
    await this.registerCommands();

    this.setupGracefulShutdown();
  }

  private async registerCommands(): Promise<void> {
    const commands = Array.from(this.slashCommands.values()).map(cmd => cmd.data.toJSON());
    const commandNames = commands.map(cmd => cmd.name);
    logger.info(`Registering commands: ${commandNames.join(', ')}`);
    
    const application = this.discordClient.raw.application;
    if (application) {
      // Try guild-specific registration first (instant updates)
      const guild = this.discordClient.raw.guilds.cache.first();
      if (guild) {
        // Clear existing commands to prevent duplication
        await guild.commands.set([]);
        await guild.commands.set(commands);
        logger.info(`Registered ${commands.length} slash commands to guild: ${guild.name}`);
      } else {
        // Fallback to global registration
        await application.commands.set(commands);
        logger.info(`Registered ${commands.length} slash commands globally`);
      }
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      this.abortController.abort();
      
      try {
        await this.discordClient.destroy();
        logger.info('Bot shut down successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

async function bootstrap(): Promise<void> {
  try {
    const config = await loadConfig();
    const app = new Application(config);
    await app.start(config);
  } catch (error) {
    logger.error('Failed to start application:', error);
    console.error('Detailed error:', error);
    process.exit(1);
  }
}

bootstrap();
