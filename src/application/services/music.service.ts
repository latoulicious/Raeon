import { GuildPlayer, GuildPlayerError } from '../../domain/guild-player.js';
import type { LoopMode } from '../../domain/guild-player.js';
import type { ResolveResult, Track } from '../../domain/track.js';
import { LavalinkClient, LavalinkError } from '../../infrastructure/lavalink.js';
import { appLogger } from '../../infrastructure/logger.js';
import { QueueStore } from '../../infrastructure/queue-store.js';
import type { PersistedSession } from '../../infrastructure/queue-store.js';
import { TimeoutService } from '../../infrastructure/timeout.js';

const logger = appLogger.getLogger('music-service');

export class MusicServiceError extends Error {
  constructor(message: string, public readonly userFriendlyMessage: string, public readonly cause?: Error) {
    super(message);
    this.name = 'MusicServiceError';
  }
}

export type TimeoutNotificationCallback = (guildId: string, textChannelId: string) => Promise<void>;
export type PlaybackErrorNotificationCallback = (guildId: string, textChannelId: string, track: Track) => Promise<void>;

/** Minimum gap between playback-error embeds per guild, so cascading failures send one message. */
const ERROR_NOTIFY_THROTTLE_MS = 30_000;

/** Queue mutations within this window coalesce into one session upsert. */
const SNAPSHOT_DEBOUNCE_MS = 1_000;

/** Persisted sessions older than this are deleted at boot instead of staged. */
const PENDING_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Queue cap — product decision, change only when explicitly asked. */
const MAX_QUEUE_SIZE = 20;

export class MusicService {
  private readonly players = new Map<string, GuildPlayer>();
  private readonly timeoutService: TimeoutService;
  private readonly lastTextChannelIds = new Map<string, string>();
  private readonly lastVoiceChannelIds = new Map<string, string>();
  private readonly lastErrorNotifyAt = new Map<string, number>();
  private readonly snapshotTimers = new Map<string, NodeJS.Timeout>();
  /** Sessions loaded at boot, waiting for /play or /resume to revive them. */
  private readonly pendingSessions = new Map<string, PersistedSession>();
  /** Guilds with autoplay on. ponytail: in-memory only, resets on restart; persist alongside the session if that ever matters. */
  private readonly autoplayEnabled = new Set<string>();
  /** Per-guild set of recently autoplayed track URIs, so a radio mix doesn't loop the same songs. */
  private readonly recentAutoplay = new Map<string, Set<string>>();

  constructor(
    private readonly lavalink: LavalinkClient,
    private readonly queueStore: QueueStore,
    private readonly onTimeoutNotification?: TimeoutNotificationCallback,
    private readonly onPlaybackErrorNotification?: PlaybackErrorNotificationCallback,
  ) {
    this.timeoutService = new TimeoutService(async (guildId) => {
      const player = this.players.get(guildId);
      if (player && (player.getIsPlaying() || player.getQueue().length > 0)) {
        // Still playing, or tracks pending (covers the auto-advance microtask
        // gap where state briefly leaves PLAYING). Not idle — reset activity.
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

  /**
   * Boot: stage persisted sessions for lazy revive. Stale (>24h) and
   * empty rows are deleted instead of staged.
   */
  async loadPendingSessions(): Promise<void> {
    const sessions = await this.queueStore.loadAll();
    const now = Date.now();
    for (const session of sessions) {
      const isStale = now - session.updatedAt.getTime() > PENDING_SESSION_MAX_AGE_MS;
      const isEmpty = !session.currentTrack && session.queue.length === 0;
      if (isStale || isEmpty) {
        void this.queueStore.delete(session.guildId);
        continue;
      }
      this.pendingSessions.set(session.guildId, session);
    }
    if (this.pendingSessions.size > 0) {
      logger.info({ count: this.pendingSessions.size }, 'Staged persisted sessions for lazy restore');
    }
  }

  hasPendingSession(guildId: string): boolean {
    return this.pendingSessions.has(guildId);
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

  async play(guildId: string, voiceChannelId: string, textChannelId: string, track: Track): Promise<{ restoredCount: number }> {
    try {
      this.timeoutService.updateActivity(guildId);
      this.lastTextChannelIds.set(guildId, textChannelId);
      this.lastVoiceChannelIds.set(guildId, voiceChannelId);

      // A pending session revives first: its tracks take the head of the
      // queue, the requested track appends after them.
      const restoredCount = await this.restorePendingSession(guildId, voiceChannelId);

      let player = this.players.get(guildId);

      // Check queue limit
      if (player && player.getQueue().length >= MAX_QUEUE_SIZE) {
        throw new MusicServiceError(
          'Queue is full',
          `The queue has reached its maximum limit of ${MAX_QUEUE_SIZE} songs. Use /clear to remove all songs or wait for some to finish playing.`
        );
      }

      if (!player) {
        player = await this.createPlayer(guildId, voiceChannelId);
      }

      player.enqueue(track);
      logger.debug({ guildId, title: track.title, queueSize: player.getQueue().length }, 'Added track to queue');

      // Start playback without waiting for it to complete
      player.start().catch(error => {
        this.handlePlaybackError(guildId, error);
      });

      return { restoredCount };
    } catch (error) {
      throw this.handleServiceError(error);
    }
  }

  /**
   * Bulk enqueue (playlists): fills the queue up to the cap and reports
   * honest counts. A pending session revives first and counts against
   * the cap, same as play(); a queue with no room throws the normal
   * queue-full error.
   */
  async playMany(guildId: string, voiceChannelId: string, textChannelId: string, tracks: Track[]): Promise<{ queued: number; dropped: number; restoredCount: number }> {
    try {
      this.timeoutService.updateActivity(guildId);
      this.lastTextChannelIds.set(guildId, textChannelId);
      this.lastVoiceChannelIds.set(guildId, voiceChannelId);

      const restoredCount = await this.restorePendingSession(guildId, voiceChannelId);

      let player = this.players.get(guildId);

      const room = MAX_QUEUE_SIZE - (player?.getQueue().length ?? 0);
      if (room <= 0) {
        throw new MusicServiceError(
          'Queue is full',
          `The queue has reached its maximum limit of ${MAX_QUEUE_SIZE} songs. Use /clear to remove all songs or wait for some to finish playing.`
        );
      }

      if (!player) {
        player = await this.createPlayer(guildId, voiceChannelId);
      }

      const toQueue = tracks.slice(0, room);
      for (const track of toQueue) {
        player.enqueue(track);
      }
      logger.debug({ guildId, queued: toQueue.length, dropped: tracks.length - toQueue.length, queueSize: player.getQueue().length }, 'Bulk added tracks to queue');

      // Start playback without waiting for it to complete
      player.start().catch(error => {
        this.handlePlaybackError(guildId, error);
      });

      return { queued: toQueue.length, dropped: tracks.length - toQueue.length, restoredCount };
    } catch (error) {
      throw this.handleServiceError(error);
    }
  }

  /**
   * /resume with no live player: revive the pending session in the
   * requester's current voice channel (not the stale saved one).
   * Returns the restored track count.
   */
  async revive(guildId: string, voiceChannelId: string, textChannelId: string): Promise<number> {
    try {
      this.timeoutService.updateActivity(guildId);
      this.lastTextChannelIds.set(guildId, textChannelId);
      this.lastVoiceChannelIds.set(guildId, voiceChannelId);
      return await this.restorePendingSession(guildId, voiceChannelId);
    } catch (error) {
      throw this.handleServiceError(error);
    }
  }

  /**
   * Consume the guild's pending session into a fresh player and start
   * playback (the interrupted track replays from 0:00). No-op when a
   * live player exists or nothing is pending.
   */
  private async restorePendingSession(guildId: string, voiceChannelId: string): Promise<number> {
    if (this.players.has(guildId)) {
      return 0;
    }
    const session = this.pendingSessions.get(guildId);
    if (!session) {
      return 0;
    }
    this.pendingSessions.delete(guildId);

    const tracks = [session.currentTrack, ...session.queue].filter((t): t is Track => t !== null);
    if (tracks.length === 0) {
      return 0;
    }

    const player = await this.createPlayer(guildId, voiceChannelId);
    for (const track of tracks) {
      player.enqueue(track);
    }
    logger.info({ guildId, count: tracks.length }, 'Restored persisted session');

    player.start().catch(error => {
      this.handlePlaybackError(guildId, error);
    });
    return tracks.length;
  }

  private async createPlayer(guildId: string, voiceChannelId: string): Promise<GuildPlayer> {
    const port = await this.lavalink.join(guildId, voiceChannelId);
    const player = new GuildPlayer(
      guildId,
      port,
      (error) => this.handlePlaybackError(guildId, error),
      (failedTrack) => this.notifyTrackFailure(guildId, failedTrack),
      () => this.scheduleSnapshot(guildId),
      () => this.timeoutService.updateActivity(guildId),
      (endedTrack) => this.handleAutoplay(guildId, endedTrack),
    );
    this.players.set(guildId, player);
    logger.info({ guildId }, 'Created new guild player');
    return player;
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

  /** User intent (/stop) or idle timeout: tear down AND drop the persisted session. */
  async disconnect(guildId: string): Promise<void> {
    this.pendingSessions.delete(guildId);
    await this.teardownPlayer(guildId);
    void this.queueStore.delete(guildId);
  }

  /**
   * Graceful shutdown: flush pending snapshots so the persisted rows are
   * current, then tear players down WITHOUT deleting their sessions —
   * deploys and restarts must keep the queue (only /stop and the idle
   * timeout clear it).
   */
  async cleanup(): Promise<void> {
    this.timeoutService.stopMonitoring();
    for (const guildId of Array.from(this.snapshotTimers.keys())) {
      this.cancelSnapshot(guildId);
      await this.writeSnapshot(guildId);
    }
    const guildIds = Array.from(this.players.keys());
    logger.info({ count: guildIds.length }, 'Cleaning up all active music players');
    for (const guildId of guildIds) {
      try {
        await this.teardownPlayer(guildId);
      } catch (error) {
        logger.error({ guildId, error }, 'Error disconnecting player during cleanup');
      }
    }
  }

  /** Shared teardown: stops playback and forgets the guild in memory only. */
  private async teardownPlayer(guildId: string): Promise<void> {
    this.timeoutService.removeGuild(guildId);
    this.cancelSnapshot(guildId);
    this.lastTextChannelIds.delete(guildId);
    this.lastVoiceChannelIds.delete(guildId);
    this.lastErrorNotifyAt.delete(guildId);
    this.autoplayEnabled.delete(guildId);
    this.recentAutoplay.delete(guildId);
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

  move(guildId: string, from: number, to: number): Track | null {
    this.timeoutService.updateActivity(guildId);
    const player = this.players.get(guildId);
    return player?.move(from, to) ?? null;
  }

  /** Set loop mode; false when no active player exists to loop. */
  setLoop(guildId: string, mode: LoopMode): boolean {
    this.timeoutService.updateActivity(guildId);
    const player = this.players.get(guildId);
    if (!player) {
      return false;
    }
    player.setLoop(mode);
    return true;
  }

  getLoop(guildId: string): LoopMode {
    return this.players.get(guildId)?.getLoop() ?? 'off';
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

  /** Turn autoplay on/off for a guild. */
  setAutoplay(guildId: string, enabled: boolean): void {
    if (enabled) {
      this.autoplayEnabled.add(guildId);
    } else {
      this.autoplayEnabled.delete(guildId);
    }
  }

  isAutoplayEnabled(guildId: string): boolean {
    return this.autoplayEnabled.has(guildId);
  }

  /**
   * Queue-exhausted hook: when a track finishes with nothing queued and
   * autoplay is on, resolve the finished track's YouTube radio mix and
   * enqueue a fresh similar track. Fire-and-forget — failures leave the
   * player idle and the normal idle-timeout takes over.
   */
  private handleAutoplay(guildId: string, endedTrack: Track): void {
    if (!this.autoplayEnabled.has(guildId)) {
      return;
    }
    const seed = this.buildRadioSeed(endedTrack.uri);
    if (!seed) {
      logger.debug({ guildId, uri: endedTrack.uri }, 'Autoplay: no YouTube radio seed for this track, staying idle');
      return;
    }
    // Hold off the idle timeout while the async resolve is in flight.
    this.timeoutService.updateActivity(guildId);
    void this.autoplayNext(guildId, endedTrack, seed);
  }

  private async autoplayNext(guildId: string, endedTrack: Track, seed: string): Promise<void> {
    const player = this.players.get(guildId);
    // A user /play between end and now already refilled the queue — leave it be.
    if (!player || player.getIsPlaying() || player.getQueue().length > 0) {
      return;
    }
    try {
      const result = await this.lavalink.resolve(seed);
      if (result.kind !== 'playlist') {
        return;
      }
      // Re-check after the await: the user may have queued something meanwhile.
      if (player.getIsPlaying() || player.getQueue().length > 0) {
        return;
      }

      const recent = this.getRecentAutoplay(guildId);
      const isFresh = (t: Track): boolean => t.uri !== endedTrack.uri && !recent.has(t.uri);
      // Prefer an unseen track; fall back to any non-seed track if the mix is exhausted.
      const next = result.tracks.find(isFresh) ?? result.tracks.find(t => t.uri !== endedTrack.uri);
      if (!next) {
        return;
      }

      this.rememberAutoplay(guildId, endedTrack.uri);
      this.rememberAutoplay(guildId, next.uri);
      player.enqueue(next);
      this.timeoutService.updateActivity(guildId);
      logger.info({ guildId, title: next.title, uri: next.uri }, 'Autoplay enqueued similar track');
      player.start().catch(error => this.handlePlaybackError(guildId, error));
    } catch (error) {
      logger.warn({ guildId, error }, 'Autoplay failed to enqueue next track');
    }
  }

  private getRecentAutoplay(guildId: string): Set<string> {
    let recent = this.recentAutoplay.get(guildId);
    if (!recent) {
      recent = new Set();
      this.recentAutoplay.set(guildId, recent);
    }
    return recent;
  }

  private rememberAutoplay(guildId: string, uri: string): void {
    const recent = this.getRecentAutoplay(guildId);
    recent.add(uri);
    // ponytail: crude cap — dump the whole set past 50 rather than track LRU.
    // A YouTube mix is ~25 tracks, so this only ever forgets stale history.
    if (recent.size > 50) {
      recent.clear();
    }
  }

  /**
   * Build a YouTube radio-mix identifier (list=RD<id>) from a track URI so
   * resolve() returns YouTube's "up next" recommendations for that video.
   * Returns null for non-YouTube URIs (no recommendation source available).
   * ponytail: mirrors the video-id extraction in commands/play.ts; a shared
   * helper isn't worth a cross-layer import for ~8 lines.
   */
  private buildRadioSeed(uri: string): string | null {
    let videoId: string | null = null;
    try {
      const u = new URL(uri);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        videoId = u.pathname.slice(1) || null;
      } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        if (u.pathname === '/watch') videoId = u.searchParams.get('v');
        else if (u.pathname.startsWith('/shorts/')) videoId = u.pathname.split('/')[2] ?? null;
      }
    } catch {
      return null;
    }
    if (!videoId) {
      return null;
    }
    return `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}&start_radio=1`;
  }

  private handlePlaybackError(guildId: string, error: unknown): void {
    logger.error({ guildId, error }, 'Error during playback');
    appLogger.incrementPlayerErrors();
  }

  /** Debounce queue mutations into one write-through session upsert. */
  private scheduleSnapshot(guildId: string): void {
    this.cancelSnapshot(guildId);
    this.snapshotTimers.set(
      guildId,
      setTimeout(() => {
        this.snapshotTimers.delete(guildId);
        void this.writeSnapshot(guildId);
      }, SNAPSHOT_DEBOUNCE_MS),
    );
  }

  private cancelSnapshot(guildId: string): void {
    const timer = this.snapshotTimers.get(guildId);
    if (timer) {
      clearTimeout(timer);
      this.snapshotTimers.delete(guildId);
    }
  }

  /**
   * Persist the guild's [currentTrack, queue] snapshot. Fire-and-forget:
   * the store swallows DB failures, so a dead DB can never block playback.
   */
  private async writeSnapshot(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    const voiceChannelId = this.lastVoiceChannelIds.get(guildId);
    const textChannelId = this.lastTextChannelIds.get(guildId);
    if (!player || !voiceChannelId || !textChannelId) {
      return;
    }

    await this.queueStore.upsert({
      guildId,
      voiceChannelId,
      textChannelId,
      currentTrack: player.getCurrentTrack(),
      queue: [...player.getQueue()],
    });
  }

  /**
   * Tell the guild's last text channel a track died. Throttled per guild
   * and fire-and-forget so a dead channel can never break advancement.
   */
  private notifyTrackFailure(guildId: string, track: Track): void {
    const textChannelId = this.lastTextChannelIds.get(guildId);
    if (!textChannelId || !this.onPlaybackErrorNotification) {
      return;
    }

    const now = Date.now();
    const last = this.lastErrorNotifyAt.get(guildId) ?? 0;
    if (now - last < ERROR_NOTIFY_THROTTLE_MS) {
      return;
    }
    this.lastErrorNotifyAt.set(guildId, now);

    this.onPlaybackErrorNotification(guildId, textChannelId, track).catch((error) => {
      logger.error({ guildId, textChannelId, error }, 'Failed to send playback error notification');
    });
  }

  private handleServiceError(error: unknown): MusicServiceError {
    if (error instanceof MusicServiceError) {
      return error;
    }

    if (error instanceof LavalinkError) {
      return new MusicServiceError(
        'Lavalink request failed',
        'The audio service could not load that track. Please try again in a moment.',
        error
      );
    }

    if (error instanceof GuildPlayerError) {
      return new MusicServiceError(
        'Guild player error',
        'An error occurred during playback. Please try stopping and starting again.',
        error
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('voice')) {
        return new MusicServiceError(
          'Voice connection error',
          'Unable to connect to the voice channel. Make sure I have permission to join and speak in the channel.',
          error
        );
      }
    }

    return new MusicServiceError(
      'Unknown error',
      'An unexpected error occurred. Please try again later.',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
