import { Readable } from 'node:stream';
import type { VoiceGateway, AudioExtractor, AudioEncoder } from './audio.js';

enum PlayerState {
  IDLE = 'idle',
  PLAYING = 'playing',
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
    
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  clear(): void {
    this.stop();
    this.queue = [];
  }

  getQueue(): readonly string[] {
    return this.queue;
  }

  getIsPlaying(): boolean {
    return this.state === PlayerState.PLAYING;
  }

  getState(): PlayerState {
    return this.state;
  }

  getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  private async playTrack(url: string, signal: AbortSignal): Promise<void> {
    const extractStream = this.extractor.stream(url, signal);
    const encodedStream = this.encoder.encode(extractStream, signal);
    
    await this.voiceGateway.play(encodedStream);
  }
}
