import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { Readable } from 'node:stream';
import type { VoiceGateway as IVoiceGateway } from '../domain/audio.js';

export class VoiceGateway implements IVoiceGateway {
  private connections = new Map<string, any>();
  private players = new Map<string, any>();

  async join(guildId: string, channelId: string): Promise<void> {
    const client = (global as any).client;
    const guild = client.guilds.cache.get(guildId);
    
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Ensure the guild has a voice adapter
    if (!guild.voiceAdapterCreator) {
      throw new Error('Voice adapter not available for this guild');
    }

    const connection = joinVoiceChannel({
      channelId,
      guildId,
      adapterCreator: guild.voiceAdapterCreator,
    });

    // Add error handling for voice connection
    connection.on('error', (error: any) => {
      console.error('Voice connection error:', error);
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    this.connections.set(guildId, connection);
    this.players.set(guildId, player);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Voice connection timeout'));
      }, 15000);

      connection.on(VoiceConnectionStatus.Ready, () => {
        clearTimeout(timeout);
        resolve();
      });

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        clearTimeout(timeout);
        this.connections.delete(guildId);
        this.players.delete(guildId);
      });
    });
  }

  async play(stream: Readable): Promise<void> {
    const guildId = this.getCurrentGuildId();
    if (!guildId) {
      throw new Error('No active voice connection');
    }

    const player = this.players.get(guildId);
    if (!player) {
      throw new Error('No audio player found');
    }

    const resource = createAudioResource(stream);
    player.play(resource);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Audio playback timeout'));
      }, 300000);

      player.once(AudioPlayerStatus.Idle, () => {
        clearTimeout(timeout);
        resolve();
      });

      player.once('error', (error: any) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async disconnect(guildId: string): Promise<void> {
    const connection = this.connections.get(guildId);
    if (connection) {
      connection.destroy();
      this.connections.delete(guildId);
      this.players.delete(guildId);
    }
  }

  private getCurrentGuildId(): string | null {
    for (const [guildId, connection] of this.connections) {
      if (connection.state.status !== VoiceConnectionStatus.Disconnected) {
        return guildId;
      }
    }
    return null;
  }
}
