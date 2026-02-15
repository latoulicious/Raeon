import { Readable } from 'node:stream';
import type { VoiceGateway, AudioExtractor, AudioEncoder } from './audio.js';

enum PlayerState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPING = 'stopping'
}

export class GuildPlayerError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'GuildPlayerError';
  }
}

export class GuildPlayer {
  private queue: string[] = [];
  private currentAbortController: AbortController | null = null;
  private state: PlayerState = PlayerState.IDLE;
  private currentTrack: string | null = null;
  private isProcessingQueue = false;
  private pausedTrack: string | null = null;

  constructor(
    private readonly guildId: string,
    private readonly voiceGateway: VoiceGateway,
    private readonly extractor: AudioExtractor,
    private readonly encoder: AudioEncoder,
  ) {}

  enqueue(url: string): void {
    this.queue.push(url);
  }

  async start(): Promise<void> {
    if (this.state === PlayerState.PLAYING) {
      return;
    }
    
    if (this.state === PlayerState.PAUSED) {
      // Resume from paused state
      return this.resume();
    }
    
    if (this.queue.length === 0) {
      return;
    }

    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    this.state = PlayerState.PLAYING;
    this.currentAbortController = new AbortController();

    try {
      while (this.queue.length > 0 && !this.currentAbortController.signal.aborted && this.state === PlayerState.PLAYING) {
        const url = this.queue.shift()!;
        this.currentTrack = url;
        await this.playTrack(url, this.currentAbortController.signal);
      }
    } catch (error) {
      if (error instanceof GuildPlayerError) {
        throw error;
      }
      throw new GuildPlayerError('Playback failed', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.state = PlayerState.IDLE;
      this.currentTrack = null;
      this.currentAbortController = null;
      this.isProcessingQueue = false;
    }
  }

  stop(): void {
    if (this.state === PlayerState.STOPPING) {
      return;
    }
    
    this.state = PlayerState.STOPPING;
    this.pausedTrack = null;
    
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  pause(): void {
    if (this.state === PlayerState.PLAYING) {
      this.state = PlayerState.PAUSED;
      this.pausedTrack = this.currentTrack;
      if (this.currentAbortController) {
        this.currentAbortController.abort();
      }
    }
  }

  async resume(): Promise<void> {
    if (this.state !== PlayerState.PAUSED || !this.pausedTrack) {
      return;
    }

    this.state = PlayerState.PLAYING;
    this.currentTrack = this.pausedTrack;
    this.currentAbortController = new AbortController();
    this.isProcessingQueue = true;

    try {
      await this.playTrack(this.pausedTrack, this.currentAbortController.signal);
      
      // After resuming, continue with the rest of the queue
      while (this.queue.length > 0 && !this.currentAbortController.signal.aborted && this.state === PlayerState.PLAYING) {
        const url = this.queue.shift()!;
        this.currentTrack = url;
        await this.playTrack(url, this.currentAbortController.signal);
      }
    } catch (error) {
      if (error instanceof GuildPlayerError) {
        throw error;
      }
      throw new GuildPlayerError('Resume failed', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.state = PlayerState.IDLE;
      this.currentTrack = null;
      this.pausedTrack = null;
      this.currentAbortController = null;
      this.isProcessingQueue = false;
    }
  }

  clear(): void {
    this.stop();
    this.queue = [];
    this.pausedTrack = null;
  }

  getQueue(): readonly string[] {
    return this.queue;
  }

  getIsPlaying(): boolean {
    return this.state === PlayerState.PLAYING;
  }

  getIsPaused(): boolean {
    return this.state === PlayerState.PAUSED;
  }

  getState(): PlayerState {
    return this.state;
  }

  getPausedTrack(): string | null {
    return this.pausedTrack;
  }

  getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  private async playTrack(url: string, signal: AbortSignal): Promise<void> {
    const extractStream = this.extractor.stream(url, signal);
    const encodedStream = this.encoder.encode(extractStream, signal);
    
    await this.voiceGateway.play(encodedStream);
  }

  shuffle(): void {
    if (this.queue.length < 2) {
      return;
    }

    // Fisher-Yates shuffle algorithm
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = this.queue[i];
      this.queue[i] = this.queue[j]!;
      this.queue[j] = temp!;
    }
  }

  remove(position: number): string | null {
    if (position < 1 || position > this.queue.length) {
      return null;
    }

    return this.queue.splice(position - 1, 1)[0] || null;
  }
}
