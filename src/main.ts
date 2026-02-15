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
    const application = this.discordClient.raw.application;
    if (application) {
      await application.commands.set(commands);
      logger.info(`Registered ${commands.length} slash commands`);
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
    process.exit(1);
  }
}

bootstrap();
