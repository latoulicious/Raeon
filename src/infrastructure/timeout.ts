import { appLogger } from './logger.js';

const logger = appLogger.getLogger('timeout-service');

export type TimeoutCallback = (guildId: string) => Promise<void>;

export class TimeoutService {
  private lastActivityTime = new Map<string, number>();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly TIMEOUT_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly CHECK_INTERVAL = 30 * 1000; // 30 seconds

  constructor(private readonly onTimeout: TimeoutCallback) {}

  startMonitoring(): void {
    if (this.checkInterval) return;

    logger.info('Starting idle timeout monitoring');
    this.checkInterval = setInterval(() => {
      this.checkForTimeouts().catch(err => {
        logger.error({ err }, 'Error during timeout check');
      });
    }, this.CHECK_INTERVAL);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  updateActivity(guildId: string): void {
    this.lastActivityTime.set(guildId, Date.now());
    logger.debug({ guildId }, 'Updated activity for guild');
  }

  removeGuild(guildId: string): void {
    this.lastActivityTime.delete(guildId);
    logger.debug({ guildId }, 'Removed guild from timeout tracking');
  }

  private async checkForTimeouts(): Promise<void> {
    const now = Date.now();
    const guildsToTimeout: string[] = [];

    for (const [guildId, lastActivity] of this.lastActivityTime.entries()) {
      if (now - lastActivity > this.TIMEOUT_DURATION) {
        guildsToTimeout.push(guildId);
      }
    }

    for (const guildId of guildsToTimeout) {
      logger.info({ guildId }, 'Executing idle timeout for guild');
      await this.onTimeout(guildId);
      this.removeGuild(guildId);
    }
  }
}