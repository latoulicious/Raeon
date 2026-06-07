import type { Track } from './track.js';

export type TrackEndReason = 'finished' | 'loadFailed' | 'stopped' | 'replaced' | 'cleanup';

/**
 * Minimal playback surface the domain needs from a Lavalink player.
 * Implemented by the Shoukaku adapter in infrastructure/lavalink.ts so
 * no library types leak into the domain layer.
 */
export interface PlayerPort {
  playTrack(encoded: string): Promise<void>;
  stopTrack(): Promise<void>;
  setPaused(paused: boolean): Promise<void>;
  onTrackEnd(listener: (reason: TrackEndReason) => void): void;
  /**
   * Stuck tracks emit no `end` event, so the orchestrator must force-stop.
   * Exceptions are NOT surfaced here: fatal ones are followed by
   * `end(loadFailed)` (which auto-advances) and non-fatal ones leave the
   * track playing, so advancing on `exception` would either double-advance
   * or skip a live track. A track hung by a non-fatal failure surfaces as
   * `stuck`. The adapter logs/counts exceptions.
   */
  onTrackStuck(listener: () => void): void;
}

enum PlayerState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
}

export class GuildPlayerError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'GuildPlayerError';
  }
}

/**
 * Queue orchestrator around a Lavalink player. The node streams audio;
 * this class only decides what plays next. The track `end` event drives
 * auto-advance: finished/loadFailed/skip all advance, a user stop halts
 * with the queue intact, pause/resume are native (position preserved).
 */
export class GuildPlayer {
  private queue: Track[] = [];
  private state: PlayerState = PlayerState.IDLE;
  private currentTrack: Track | null = null;
  /** Set by stop() so the resulting `end` event does not auto-advance */
  private suppressAdvance = false;

  constructor(
    private readonly guildId: string,
    private readonly player: PlayerPort,
    private readonly onError?: (error: Error) => void,
    /** Fired when a track dies (loadFailed/stuck); advancement is unaffected. */
    private readonly onTrackFailed?: (track: Track) => void,
    /** Fired after any queue/current-track mutation (incl. the auto-advance shift); notification only. */
    private readonly onChange?: () => void,
  ) {
    this.player.onTrackEnd((reason) => this.handleTrackEnd(reason));
    this.player.onTrackStuck(() => this.advanceAfterFailure());
  }

  enqueue(track: Track): void {
    this.queue.push(track);
    this.onChange?.();
  }

  async start(): Promise<void> {
    if (this.state === PlayerState.PAUSED) {
      return this.resume();
    }
    if (this.state === PlayerState.PLAYING || this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift();
    if (!next) {
      return;
    }

    this.currentTrack = next;
    this.state = PlayerState.PLAYING;
    this.onChange?.();

    try {
      await this.player.playTrack(next.encoded);
    } catch (error) {
      this.currentTrack = null;
      this.state = PlayerState.IDLE;
      this.onChange?.();
      throw new GuildPlayerError('Playback failed', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Stop the current track; the queue survives and does not auto-advance. */
  async stop(): Promise<void> {
    if (this.state === PlayerState.IDLE) {
      return;
    }
    this.suppressAdvance = true;
    await this.player.stopTrack();
  }

  /** Stop the current track and let the `end` event start the next one. */
  async skip(): Promise<void> {
    if (this.state === PlayerState.IDLE) {
      return;
    }
    await this.player.stopTrack();
  }

  async pause(): Promise<void> {
    if (this.state !== PlayerState.PLAYING) {
      return;
    }
    await this.player.setPaused(true);
    this.state = PlayerState.PAUSED;
  }

  async resume(): Promise<void> {
    if (this.state !== PlayerState.PAUSED) {
      return;
    }
    await this.player.setPaused(false);
    this.state = PlayerState.PLAYING;
  }

  async clear(): Promise<void> {
    this.queue = [];
    this.onChange?.();
    await this.stop();
  }

  getQueue(): readonly Track[] {
    return this.queue;
  }

  getIsPlaying(): boolean {
    return this.state === PlayerState.PLAYING;
  }

  getIsPaused(): boolean {
    return this.state === PlayerState.PAUSED;
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  shuffle(): void {
    if (this.queue.length < 2) {
      return;
    }

    // Fisher-Yates shuffle algorithm
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = this.queue[i]!;
      this.queue[i] = this.queue[j]!;
      this.queue[j] = temp;
    }
    this.onChange?.();
  }

  remove(position: number): Track | null {
    if (position < 1 || position > this.queue.length) {
      return null;
    }

    const removed = this.queue.splice(position - 1, 1)[0] ?? null;
    if (removed) {
      this.onChange?.();
    }
    return removed;
  }

  private handleTrackEnd(reason: TrackEndReason): void {
    if (reason === 'replaced') {
      return;
    }

    const endedTrack = this.currentTrack;
    this.currentTrack = null;
    this.state = PlayerState.IDLE;
    this.onChange?.();

    if (reason === 'loadFailed' && endedTrack) {
      this.onTrackFailed?.(endedTrack);
    }

    if (this.suppressAdvance || reason === 'cleanup') {
      this.suppressAdvance = false;
      return;
    }

    this.start().catch((error) => {
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
    });
  }

  /** A stuck track would hang the player forever; force the next track. */
  private advanceAfterFailure(): void {
    if (this.state === PlayerState.IDLE) {
      return;
    }
    if (this.currentTrack) {
      this.onTrackFailed?.(this.currentTrack);
    }
    this.player.stopTrack().catch((error) => {
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
    });
  }
}
