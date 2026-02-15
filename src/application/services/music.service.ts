import type { VoiceGateway, AudioExtractor, AudioEncoder } from '../../domain/audio.js';
import { GuildPlayer } from '../../domain/guild-player.js';

export class MusicService {
  private readonly players = new Map<string, GuildPlayer>();

  constructor(
    private readonly voiceGateway: VoiceGateway,
    private readonly extractor: AudioExtractor,
    private readonly encoder: AudioEncoder,
  ) {}

  async play(guildId: string, channelId: string, url: string): Promise<void> {
    let player = this.players.get(guildId);
    
    if (!player) {
      player = new GuildPlayer(guildId, this.voiceGateway, this.extractor, this.encoder);
      this.players.set(guildId, player);
    }

    await this.voiceGateway.join(guildId, channelId);
    player.enqueue(url);
    await player.start();
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
}
