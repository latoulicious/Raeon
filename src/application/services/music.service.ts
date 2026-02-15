import type { VoiceGateway, AudioExtractor, AudioEncoder } from '../../domain/audio.js';
import { GuildPlayer, GuildPlayerError } from '../../domain/guild-player.js';
import { YtdlpExtractorError } from '../../infrastructure/yt-dlp.js';
import { FfmpegEncoderError } from '../../infrastructure/ffmpeg.js';
import { appLogger } from '../../infrastructure/logger.js';

const logger = appLogger.getLogger('music-service');

export class MusicServiceError extends Error {
  constructor(message: string, public readonly userFriendlyMessage: string, public readonly cause?: Error) {
    super(message);
    this.name = 'MusicServiceError';
  }
}

export class MusicService {
  private readonly players = new Map<string, GuildPlayer>();

  constructor(
    private readonly voiceGateway: VoiceGateway,
    private readonly extractor: AudioExtractor,
    private readonly encoder: AudioEncoder,
  ) {}

  getExtractor(): AudioExtractor {
    return this.extractor;
  }

  async play(guildId: string, channelId: string, url: string): Promise<void> {
    try {
      let player = this.players.get(guildId);
      
      if (!player) {
        player = new GuildPlayer(guildId, this.voiceGateway, this.extractor, this.encoder);
        this.players.set(guildId, player);
        logger.info({ guildId }, 'Created new guild player');
      }

      // Check queue limit (20 songs max)
      const currentQueue = player.getQueue();
      const maxQueueSize = 20;
      
      if (currentQueue.length >= maxQueueSize) {
        throw new MusicServiceError(
          'Queue is full',
          `🎵 **Queue Full**: The queue has reached its maximum limit of ${maxQueueSize} songs. Use /clear to remove all songs or wait for some to finish playing.`
        );
      }

      await this.voiceGateway.join(guildId, channelId);
      player.enqueue(url);
      logger.debug({ guildId, url, queueSize: currentQueue.length + 1 }, 'Added track to queue');
      
      // Start playback without waiting for it to complete
      player.start().catch(error => {
        this.handlePlaybackError(guildId, error);
      });
    } catch (error) {
      throw this.handleServiceError(error);
    }
  }

  stop(guildId: string): void {
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
    }
  }

  clear(guildId: string): void {
    const player = this.players.get(guildId);
    if (player) {
      player.clear();
    }
  }

  async disconnect(guildId: string): Promise<void> {
    this.clear(guildId);
    await this.voiceGateway.disconnect(guildId);
    this.players.delete(guildId);
  }

  getQueue(guildId: string): readonly string[] {
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
    const player = this.players.get(guildId);
    if (player) {
      player.pause();
    }
  }

  async resume(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (player) {
      await player.resume();
    }
  }

  shuffle(guildId: string): void {
    const player = this.players.get(guildId);
    if (player) {
      player.shuffle();
    }
  }

  remove(guildId: string, position: number): string | null {
    const player = this.players.get(guildId);
    return player?.remove(position) ?? null;
  }

  getCurrentTrack(guildId: string): string | null {
    const player = this.players.get(guildId);
    return player?.getCurrentTrack() ?? null;
  }

  getAnyPlayingTrack(): string | null {
    for (const player of this.players.values()) {
      if (player.getIsPlaying()) {
        return player.getCurrentTrack();
      }
    }
    return null;
  }

  private handlePlaybackError(guildId: string, error: unknown): void {
    logger.error({ guildId, error }, 'Error during playback');
    appLogger.incrementStreamFailures();
    
    // Clean up player on critical errors
    if (error instanceof YtdlpExtractorError || error instanceof FfmpegEncoderError) {
      this.players.delete(guildId);
      logger.info({ guildId }, 'Removed player due to critical error');
    }
  }

  private handleServiceError(error: unknown): MusicServiceError {
    if (error instanceof MusicServiceError) {
      return error;
    }
    
    if (error instanceof YtdlpExtractorError) {
      return new MusicServiceError(
        'yt-dlp extraction failed',
        '🎵 **Download Failed**: Unable to download the audio from the provided URL. This could be due to:\n' +
        '• The video is private or unavailable\n' +
        '• YouTube is blocking access (try again later)\n' +
        '• The URL is invalid or not supported\n' +
        'Please check the URL and try again.',
        error
      );
    }
    
    if (error instanceof FfmpegEncoderError) {
      return new MusicServiceError(
        'FFmpeg encoding failed',
        '🎵 **Processing Failed**: Unable to process the audio file. This is usually a temporary issue. Please try again.',
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
