import pino, { Logger } from 'pino';
import { DatabaseLogger, LogEntry } from './database-logger.js';

export interface Metrics {
  total_commands: number;
  active_players: number;
  track_load_failures: number;
  player_errors: number;
}

export class AppLogger {
  private static instance: AppLogger;
  private logger: Logger;
  private metrics: Metrics;
  private dbLogger: DatabaseLogger | null = null;

  private constructor() {
    const loggerOptions: any = {
      level: process.env.LOG_LEVEL || 'info'
    };

    if (process.env.NODE_ENV !== 'production') {
      loggerOptions.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      };
    }

    this.logger = pino(loggerOptions);

    this.metrics = {
      total_commands: 0,
      active_players: 0,
      track_load_failures: 0,
      player_errors: 0
    };
  }

  static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  async initializeDatabaseLogger(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn('DATABASE_URL not provided, database logging disabled');
      return;
    }

    try {
      this.dbLogger = new DatabaseLogger(databaseUrl);
      await this.dbLogger.createLogsTable();
      console.log('Database logger initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database logger:', error);
      this.dbLogger = null;
    }
  }

  getLogger(module?: string): Logger {
    if (module) {
      const childLogger = this.logger.child({ module });
      
      // Override log methods to also save to database
      const originalMethods = {
        info: childLogger.info.bind(childLogger),
        warn: childLogger.warn.bind(childLogger),
        error: childLogger.error.bind(childLogger),
        debug: childLogger.debug.bind(childLogger)
      };

      childLogger.info = (obj: any, msg?: string, ...args: any[]) => {
        originalMethods.info(obj, msg, ...args);
        const { guildId, userId, commandName, ...rest } = obj || {};
        this.logToDatabase('info', msg || '', module, rest, guildId, userId, commandName);
      };

      childLogger.warn = (obj: any, msg?: string, ...args: any[]) => {
        originalMethods.warn(obj, msg, ...args);
        const { guildId, userId, commandName, ...rest } = obj || {};
        this.logToDatabase('warn', msg || '', module, rest, guildId, userId, commandName);
      };

      childLogger.error = (obj: any, msg?: string, ...args: any[]) => {
        originalMethods.error(obj, msg, ...args);
        const { guildId, userId, commandName, ...rest } = obj || {};
        this.logToDatabase('error', msg || '', module, rest, guildId, userId, commandName);
      };

      childLogger.debug = (obj: any, msg?: string, ...args: any[]) => {
        originalMethods.debug(obj, msg, ...args);
        const { guildId, userId, commandName, ...rest } = obj || {};
        this.logToDatabase('debug', msg || '', module, rest, guildId, userId, commandName);
      };

      return childLogger;
    }
    return this.logger;
  }

  private logToDatabase(
    level: string, 
    message: string, 
    module?: string, 
    metadata?: any,
    guildId?: string,
    userId?: string,
    commandName?: string
  ): void {
    if (this.dbLogger && this.dbLogger.isReady()) {
      const logEntry: LogEntry = {
        level,
        message,
        timestamp: new Date()
      };

      // Only add optional properties if they have values
      if (module !== undefined) logEntry.module = module;
      if (metadata !== undefined) logEntry.metadata = metadata;
      if (guildId !== undefined) logEntry.guild_id = guildId;
      if (userId !== undefined) logEntry.user_id = userId;
      if (commandName !== undefined) logEntry.command_name = commandName;

      this.dbLogger.logAsync(logEntry);
    }
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  incrementTotalCommands(): void {
    this.metrics.total_commands++;
    this.logger.debug({ metric: 'total_commands', value: this.metrics.total_commands }, 'Command executed');
  }

  incrementActivePlayers(): void {
    this.metrics.active_players++;
    this.logger.debug({ metric: 'active_players', value: this.metrics.active_players }, 'Active player added');
  }

  decrementActivePlayers(): void {
    this.metrics.active_players = Math.max(0, this.metrics.active_players - 1);
    this.logger.debug({ metric: 'active_players', value: this.metrics.active_players }, 'Active player removed');
  }

  incrementTrackLoadFailures(): void {
    this.metrics.track_load_failures++;
    this.logger.warn({ metric: 'track_load_failures', value: this.metrics.track_load_failures }, 'Track load failure recorded');
  }

  incrementPlayerErrors(): void {
    this.metrics.player_errors++;
    this.logger.warn({ metric: 'player_errors', value: this.metrics.player_errors }, 'Player error recorded');
  }

  logMetrics(): void {
    this.logger.info(this.metrics, 'Current metrics');
  }

  logWithContext(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    module: string,
    context: {
      guildId?: string;
      userId?: string;
      commandName?: string;
      metadata?: any;
    }
  ): void {
    this.logToDatabase(
      level,
      message,
      module,
      context.metadata,
      context.guildId,
      context.userId,
      context.commandName
    );

    // Also log to console
    this.logger[level]({
      ...context.metadata,
      guild_id: context.guildId,
      user_id: context.userId,
      command_name: context.commandName
    }, message);
  }

  async cleanup(): Promise<void> {
    if (this.dbLogger) {
      await this.dbLogger.close();
    }
  }
}

export const appLogger = AppLogger.getInstance();
