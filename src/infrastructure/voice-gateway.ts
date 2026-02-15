import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
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

    if (!guild.voiceAdapterCreator) {
      throw new Error('Voice adapter not available for this guild');
    }

    let connection = this.connections.get(guildId);
    
    if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
      connection = joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      connection.on('stateChange', (oldState: any, newState: any) => {
        console.log(`Voice connection state change: ${oldState.status} -> ${newState.status}`);
      });

      connection.on('error', (error: any) => {
        console.error('Voice connection error:', error);
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch (e) {
          connection.destroy();
          this.connections.delete(guildId);
          this.players.delete(guildId);
        }
      });

      this.connections.set(guildId, connection);
    }

    let player = this.players.get(guildId);
    if (!player) {
      player = createAudioPlayer();
      connection.subscribe(player);
      this.players.set(guildId, player);
    }

    try {
      console.log(`[VoiceGateway] Waiting for connection to be Ready for guild ${guildId}...`);
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      console.log(`[VoiceGateway] Connection Ready for guild ${guildId}`);
    } catch (error) {
      console.error(`[VoiceGateway] Connection failed to reach Ready state for guild ${guildId}:`, error);
      connection.destroy();
      this.connections.delete(guildId);
      this.players.delete(guildId);
      throw new Error('Voice connection timeout');
    }
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
