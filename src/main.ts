import { loadConfig } from './config/index.js';
import { DiscordClient } from './infrastructure/discord-client.js';
import { CommandManager } from './infrastructure/command-manager.js';
import { LavalinkClient } from './infrastructure/lavalink.js';
import { QueueStore } from './infrastructure/queue-store.js';
import { PingService } from './application/services/ping.service.js';
import { MusicService } from './application/services/music.service.js';
import { handleSlashCommand } from './handler/slash.js';
import { handleMessage } from './handler/message.js';
import { handleReaction } from './handler/reaction.js';
import { pingCommand } from './commands/ping.js';
import { playCommand } from './commands/play.js';
import { stopCommand } from './commands/stop.js';
import { skipCommand } from './commands/skip.js';
import { autoplayCommand } from './commands/autoplay.js';
import { queueCommand } from './commands/queue.js';
import { clearCommand } from './commands/clear.js';
import { commandsCommand } from './commands/commands.js';
import { nowplayingCommand } from './commands/nowplaying.js';
import { pauseCommand } from './commands/pause.js';
import { resumeCommand } from './commands/resume.js';
import { shuffleCommand } from './commands/shuffle.js';
import { removeCommand } from './commands/remove.js';
import { pruneCommand } from './commands/prune.js';
import { aboutCommand } from './commands/about.js';
import { usageCommand } from './commands/usage.js';
import { updatePresence } from './presence/index.js';
import { appLogger } from './infrastructure/logger.js';
import { StartupValidationError } from './infrastructure/startup-validator.js';
import { EmbedService } from './infrastructure/embed.js';
import { startHealthServer } from './infrastructure/health-server.js';
import type { Server } from 'node:http';

const logger = appLogger.getLogger('main');

class Application {
  private readonly discordClient: DiscordClient;
  private readonly lavalinkClient: LavalinkClient;
  private readonly queueStore: QueueStore;
  private readonly pingService: PingService;
  private readonly musicService: MusicService;
  private readonly commandManager: CommandManager;
  private readonly slashCommands = new Map<string, any>();
  private abortController: AbortController;
  private presenceInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private healthServer: Server | null = null;

  constructor(config: any) {
    this.abortController = new AbortController();

    this.discordClient = new DiscordClient();
    // Must be constructed before login so the connector hooks gateway events
    this.lavalinkClient = new LavalinkClient(this.discordClient.raw, {
      host: config.lavalinkHost,
      port: config.lavalinkPort,
      password: config.lavalinkPassword,
    });
    this.commandManager = new CommandManager(this.discordClient.raw);

    this.queueStore = new QueueStore(process.env.DATABASE_URL);

    this.pingService = new PingService();
    this.musicService = new MusicService(
      this.lavalinkClient,
      this.queueStore,
      async (guildId, textChannelId) => {
        try {
          const channel = await this.discordClient.raw.channels.fetch(textChannelId);
          if (channel?.isTextBased()) {
            const embed = EmbedService.createTimeoutEmbed();
            await (channel as any).send({ embeds: [embed] });
          }
        } catch (error) {
          logger.error({ guildId, textChannelId, error }, 'Failed to send timeout notification');
        }
      },
      async (guildId, textChannelId, track) => {
        try {
          const channel = await this.discordClient.raw.channels.fetch(textChannelId);
          if (channel?.isTextBased()) {
            const embed = EmbedService.createTrackFailedEmbed(track);
            await (channel as any).send({ embeds: [embed] });
          }
        } catch (error) {
          logger.error({ guildId, textChannelId, error }, 'Failed to send playback error notification');
        }
      }
    );

    this.slashCommands.set(pingCommand.data.name, pingCommand);
    this.slashCommands.set(playCommand.data.name, playCommand);
    this.slashCommands.set(stopCommand.data.name, stopCommand);
    this.slashCommands.set(skipCommand.data.name, skipCommand);
    this.slashCommands.set(autoplayCommand.data.name, autoplayCommand);
    this.slashCommands.set(queueCommand.data.name, queueCommand);
    this.slashCommands.set(clearCommand.data.name, clearCommand);
    this.slashCommands.set(commandsCommand.data.name, commandsCommand);
    this.slashCommands.set(nowplayingCommand.data.name, nowplayingCommand);
    this.slashCommands.set(pauseCommand.data.name, pauseCommand);
    this.slashCommands.set(resumeCommand.data.name, resumeCommand);
    this.slashCommands.set(shuffleCommand.data.name, shuffleCommand);
    this.slashCommands.set(removeCommand.data.name, removeCommand);
    this.slashCommands.set(pruneCommand.data.name, pruneCommand);
    this.slashCommands.set(aboutCommand.data.name, aboutCommand);
    this.slashCommands.set(usageCommand.data.name, usageCommand);
  }

  async start(config: any): Promise<void> {
    await this.queueStore.init();
    await this.musicService.loadPendingSessions();

    this.discordClient.once('ready', () => {
      logger.info('Bot is ready');
      updatePresence(this.discordClient.raw, this.musicService);
      
      // Update presence every 30 seconds
      this.presenceInterval = setInterval(() => {
        updatePresence(this.discordClient.raw, this.musicService);
      }, 30000);
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
      await handleMessage(message, { client: this.discordClient.raw });
    });

    this.discordClient.on('messageReactionAdd', async (reaction, user) => {
      await handleReaction(reaction, user, {});
    });

    await this.discordClient.login(config.discordToken);
    await this.registerCommands();

    this.setupGracefulShutdown();
    this.setupMetricsLogging();

    const healthPort = Number(process.env.HEALTH_PORT || 3000);
    this.healthServer = startHealthServer(healthPort, {
      discord: this.discordClient.raw,
      lavalink: this.lavalinkClient,
      queueStore: this.queueStore,
    });
  }

  private setupMetricsLogging(): void {
    // Log metrics every 5 minutes
    this.metricsInterval = setInterval(() => {
      appLogger.logMetrics();
    }, 5 * 60 * 1000);
  }

  private async registerCommands(): Promise<void> {
    const commands = Array.from(this.slashCommands.values()).map(cmd => cmd.data.toJSON());
    const isDev = process.env.NODE_ENV === 'development';
    const devGuildId = process.env.DEV_GUILD_ID;
    const shouldClearGuilds = process.env.CLEAR_GUILDS === 'true';

    if (shouldClearGuilds) {
      logger.info('CLEAR_GUILDS flag detected. Cleaning up all guild-specific commands...');
      await this.commandManager.clearAllGuildCommands();
      logger.info('Guild command cleanup finished.');
    }

    if (isDev && devGuildId) {
      logger.info(`Development mode detected. Syncing commands to guild: ${devGuildId}`);
      await this.commandManager.syncCommands(commands, { 
        guildId: devGuildId,
        clearGlobal: true // Clear global commands to avoid duplicates in dev
      });
    } else {
      logger.info('Syncing commands globally...');
      await this.commandManager.syncCommands(commands);
    }
  }

  private setupGracefulShutdown(): void {
    let shuttingDown = false;

    const shutdown = async (signal: string, error?: Error) => {
      if (shuttingDown) return;
      shuttingDown = true;

      if (error) {
        logger.error({ error, signal }, 'Bot encountered a critical error, shutting down');
      } else {
        logger.info({ signal }, 'Received signal, shutting down gracefully');
      }

      this.abortController.abort();

      const forceExit = setTimeout(() => {
        logger.error('Graceful shutdown timed out, force exiting...');
        process.exit(1);
      }, 10000);
      forceExit.unref();
      
      try {
        if (this.presenceInterval) {
          clearInterval(this.presenceInterval);
          logger.debug('Presence interval cleared');
        }
        if (this.metricsInterval) {
          clearInterval(this.metricsInterval);
          logger.debug('Metrics interval cleared');
        }
        if (this.healthServer) {
          await new Promise<void>((resolve) => this.healthServer!.close(() => resolve()));
          logger.debug('Health server closed');
        }

        await this.musicService.cleanup();
        logger.debug('Music service cleaned up');

        await this.discordClient.raw.destroy();
        logger.debug('Discord client destroyed');
        
        await appLogger.cleanup();
        // Console log here because the logger is now closed
        console.log('Database logger connection closed');

        await this.queueStore.close();
        console.log('Queue store connection closed');
        
        clearTimeout(forceExit);
        logger.info('Bot shut down successfully');
        process.exit(error ? 1 : 0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      shutdown('unhandledRejection', error);
    });

    process.on('uncaughtException', (error) => {
      shutdown('uncaughtException', error);
    });
  }
}

async function bootstrap(): Promise<void> {
  try {
    // Initialize database logger first
    await appLogger.initializeDatabaseLogger();
    
    const config = await loadConfig();
    const app = new Application(config);
    await app.start(config);
  } catch (error) {
    if (error instanceof StartupValidationError) {
      console.error('\n' + error.message);
      console.error('\nPlease fix the above issues and restart the bot.\n');
      process.exit(1);
    }
    
    logger.error({ error }, 'Failed to start application');
    console.error('\n❌ Failed to start application. Check logs for details.\n');
    process.exit(1);
  }
}

bootstrap();
