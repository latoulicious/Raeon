import pino, { Logger } from 'pino';

export interface Metrics {
  total_commands: number;
  active_players: number;
  stream_failures: number;
  yt_dlp_failures: number;
  ffmpeg_failures: number;
}

export class AppLogger {
  private static instance: AppLogger;
  private logger: Logger;
  private metrics: Metrics;

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
      stream_failures: 0,
      yt_dlp_failures: 0,
      ffmpeg_failures: 0
    };
  }

  static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  getLogger(module?: string): Logger {
    if (module) {
      return this.logger.child({ module });
    }
    return this.logger;
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

  incrementStreamFailures(): void {
    this.metrics.stream_failures++;
    this.logger.warn({ metric: 'stream_failures', value: this.metrics.stream_failures }, 'Stream failure recorded');
  }

  incrementYtdlpFailures(): void {
    this.metrics.yt_dlp_failures++;
    this.logger.warn({ metric: 'yt_dlp_failures', value: this.metrics.yt_dlp_failures }, 'yt-dlp failure recorded');
  }

  incrementFfmpegFailures(): void {
    this.metrics.ffmpeg_failures++;
    this.logger.warn({ metric: 'ffmpeg_failures', value: this.metrics.ffmpeg_failures }, 'FFmpeg failure recorded');
  }

  logMetrics(): void {
    this.logger.info(this.metrics, 'Current metrics');
  }
}

export const appLogger = AppLogger.getInstance();
