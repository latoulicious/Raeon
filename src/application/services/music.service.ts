import { GuildPlayer, GuildPlayerError } from '../../domain/guild-player.js';
import type { ResolveResult, Track } from '../../domain/track.js';
import { LavalinkClient, LavalinkError } from '../../infrastructure/lavalink.js';
import { appLogger } from '../../infrastructure/logger.js';
import { TimeoutService } from '../../infrastructure/timeout.js';

const logger = appLogger.getLogger('music-service');

export class MusicServiceError extends Error {
  constructor(message: string, public readonly userFriendlyMessage: string, public readonly cause?: Error) {
    super(message);
    this.name = 'MusicServiceError';
  }
}

export type TimeoutNotificationCallback = (guildId: string, textChannelId: string) => Promise<void>;

export class MusicService {
  private readonly players = new Map<string, GuildPlayer>();
  private readonly timeoutService: TimeoutService;
  private readonly lastTextChannelIds = new Map<string, string>();

  constructor(
    private readonly lavalink: LavalinkClient,
    private readonly onTimeoutNotification?: TimeoutNotificationCallback,
  ) {
    this.timeoutService = new TimeoutService(async (guildId) => {
      const player = this.players.get(guildId);
      if (player && player.getIsPlaying()) {
        // If still playing, it's not idle. Reset activity.
        this.timeoutService.updateActivity(guildId);
        return;
      }

      logger.info({ guildId }, 'Idle timeout reached, disconnecting');

      // Send notification if we have a text channel ID
      const textChannelId = this.lastTextChannelIds.get(guildId);
      if (textChannelId && this.onTimeoutNotification) {
        try {
          await this.onTimeoutNotification(guildId, textChannelId);
        } catch (error) {
          logger.error({ guildId, error }, 'Failed to send timeout notification');
        }
      }

      await this.disconnect(guildId);
    });
    this.timeoutService.startMonitoring();
  }

  /** Resolve a URL or `ytsearch:` identifier; errors map to user-friendly messages. */
  async resolve(identifier: string): Promise<ResolveResult> {
    try {
      return await this.lavalink.resolve(identifier);
    } catch (error) {
      appLogger.incrementTrackLoadFailures();
      throw this.handleServiceError(error);
    }
  }

  async play(guildId: string, voiceChannelId: string, textChannelId: string, track: Track): Promise<void> {
    try {
      this.timeoutService.updateActivity(guildId);
      this.lastTextChannelIds.set(guildId, textChannelId);

      let player = this.players.get(guildId);

      // Check queue limit (20 songs max)
      const maxQueueSize = 20;
      if (player && player.getQueue().length >= maxQueueSize) {
        throw new MusicServiceError(
          'Queue is full',
          `🎵 **Queue Full**: The queue has reached its maximum limit of ${maxQueueSize} songs. Use /clear to remove all songs or wait for some to finish playing.`
        );
      }

      if (!player) {
        const port = await this.lavalink.join(guildId, voiceChannelId);
        player = new GuildPlayer(guildId, port, (error) => this.handlePlaybackError(guildId, error));
        this.players.set(guildId, player);
        logger.info({ guildId }, 'Created new guild player');
      }

      player.enqueue(track);
      logger.debug({ guildId, title: track.title, queueSize: player.getQueue().length }, 'Added track to queue');

      // Start playback without waiting for it to complete
      player.start().catch(error => {
        this.handlePlaybackError(guildId, error);
      });
    } catch (error) {
      throw this.handleServiceError(error);
    }
  }

  stop(guildId: string): void {
    this.timeoutService.updateActivity(guildId);
    const player = this.players.get(guildId);
    if (player) {
      player.stop().catch(error => {
        this.handlePlaybackError(guildId, error);
      });
    }
  }

  async skip(guildId: string): Promise<void> {
    this.timeoutService.updateActivity(guildId);
    const player = this.players.get(guildId);
    if (player) {
      await player.skip();
    }
  }

  clear(guildId: string): void {
    this.timeoutService.updateActivity(guildId);
    const player = this.players.get(guildId);
    if (player) {
      player.clear().catch(error => {
        this.handlePlaybackError(guildId, error);
      });
    }
  }

  async disconnect(guildId: string): Promise<void> {
    this.timeoutService.removeGuild(guildId);
    this.lastTextChannelIds.delete(guildId);
    const player = this.players.get(guildId);
    if (player) {
      try {
        await player.clear();
      } catch (error) {
        logger.warn({ guildId, error }, 'Error clearing player during disconnect');
      }
      this.players.delete(guildId);
    }
    try {
      await this.lavalink.leave(guildId);
    } catch (error) {
      logger.warn({ guildId, error }, 'Error leaving voice channel during disconnect');
    }
  }

  async cleanup(): Promise<void> {
    this.timeoutService.stopMonitoring();
    const guildIds = Array.from(this.players.keys());
    logger.info({ count: guildIds.length }, 'Cleaning up all active music players');
    for (const guildId of guildIds) {
      try {
        await this.disconnect(guildId);
      } catch (error) {
        logger.error({ guildId, error }, 'Error disconnecting player during cleanup');
      }
    }
  }

  getQueue(guildId: string): readonly Track[] {
    const player = this.players.get(guildId);
    return player?.getQueue() ?? [];
  }

  isPlaying(guildId: string): boolean {
    const player = this.players.get(guildId);
    return player?.getIsPlaying() ?? false;
  }

  isPaused(guildId: string): boolean {
    const player = this.players.get(guildId);
    return player?.getIsPaused() ?? false;
  }

  pause(guildId: string): void {
    this.timeoutService.updateActivity(guildId);
    const player = this.players.get(guildId);
    if (player) {
      player.pause().catch(error => {
        this.handlePlaybackError(guildId, error);
      });
    }
  }

  async resume(guildId: string): Promise<void> {
    this.timeoutService.updateActivity(guildId);
    const player = this.players.get(guildId);
    if (player) {
      await player.resume();
    }
  }

  shuffle(guildId: string): void {
    this.timeoutService.updateActivity(guildId);
    const player = this.players.get(guildId);
    if (player) {
      player.shuffle();
    }
  }

  remove(guildId: string, position: number): Track | null {
    this.timeoutService.updateActivity(guildId);
    const player = this.players.get(guildId);
    return player?.remove(position) ?? null;
  }

  getCurrentTrack(guildId: string): Track | null {
    const player = this.players.get(guildId);
    return player?.getCurrentTrack() ?? null;
  }

  getAnyPlayingTrack(): Track | null {
    for (const player of this.players.values()) {
      if (player.getIsPlaying()) {
        return player.getCurrentTrack();
      }
    }
    return null;
  }

  private handlePlaybackError(guildId: string, error: unknown): void {
    logger.error({ guildId, error }, 'Error during playback');
    appLogger.incrementPlayerErrors();
  }

  private handleServiceError(error: unknown): MusicServiceError {
    if (error instanceof MusicServiceError) {
      return error;
    }

    if (error instanceof LavalinkError) {
      return new MusicServiceError(
        'Lavalink request failed',
        '🎵 **Playback Service Error**: The audio service could not load that track. Please try again in a moment.',
        error
      );
    }

    if (error instanceof GuildPlayerError) {
      return new MusicServiceError(
        'Guild player error',
        '🎵 **Playback Error**: An error occurred during playback. Please try stopping and starting again.',
        error
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('voice')) {
        return new MusicServiceError(
          'Voice connection error',
          '🔊 **Voice Connection Failed**: Unable to connect to the voice channel. Make sure I have permission to join and speak in the channel.',
          error
        );
      }
    }

    return new MusicServiceError(
      'Unknown error',
      '❌ **Unexpected Error**: An unexpected error occurred. Please try again later.',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
