import { Readable } from 'node:stream';
import type { VoiceGateway, AudioExtractor, AudioEncoder } from './audio.js';

export class GuildPlayer {
  private queue: string[] = [];
  private currentAbortController: AbortController | null = null;
  private isPlaying = false;

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
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    this.isPlaying = true;
    this.currentAbortController = new AbortController();

    try {
      while (this.queue.length > 0 && !this.currentAbortController.signal.aborted) {
        const url = this.queue.shift()!;
        await this.playTrack(url, this.currentAbortController.signal);
      }
    } finally {
      this.isPlaying = false;
      this.currentAbortController = null;
    }
  }

  stop(): void {
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
    return this.isPlaying;
  }

  private async playTrack(url: string, signal: AbortSignal): Promise<void> {
    const extractStream = this.extractor.stream(url, signal);
    const encodedStream = this.encoder.encode(extractStream, signal);
    
    await this.voiceGateway.play(encodedStream);
  }
}
