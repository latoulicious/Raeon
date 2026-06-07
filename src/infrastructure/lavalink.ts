import { Client } from 'discord.js';
import { Connectors, LoadType, Shoukaku } from 'shoukaku';
import type { Player, Track as ShoukakuTrack } from 'shoukaku';
import type { PlayerPort, TrackEndReason } from '../domain/guild-player.js';
import type { ResolveResult, Track } from '../domain/track.js';
import { appLogger } from './logger.js';

const logger = appLogger.getLogger('lavalink');

export interface LavalinkConfig {
  host: string;
  port: number;
  password: string;
}

export class LavalinkError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'LavalinkError';
  }
}

/** Adapts a Shoukaku Player to the domain PlayerPort. */
class ShoukakuPlayerAdapter implements PlayerPort {
  constructor(private readonly player: Player) {
    this.player.on('exception', (event) => {
      appLogger.incrementPlayerErrors();
      logger.error({ guildId: player.guildId, exception: event.exception }, 'Track exception');
    });
    this.player.on('stuck', (event) => {
      appLogger.incrementPlayerErrors();
      logger.warn({ guildId: player.guildId, thresholdMs: event.thresholdMs }, 'Track stuck');
    });
    this.player.on('closed', (event) => {
      logger.warn({ guildId: player.guildId, code: event.code, reason: event.reason }, 'Voice websocket closed');
    });
  }

  async playTrack(encoded: string): Promise<void> {
    await this.player.playTrack({ track: { encoded } });
  }

  async stopTrack(): Promise<void> {
    await this.player.stopTrack();
  }

  async setPaused(paused: boolean): Promise<void> {
    await this.player.setPaused(paused);
  }

  onTrackEnd(listener: (reason: TrackEndReason) => void): void {
    this.player.on('end', (event) => listener(event.reason));
  }

  onTrackStuck(listener: () => void): void {
    this.player.on('stuck', () => listener());
  }
}

export class LavalinkClient {
  private readonly shoukaku: Shoukaku;

  constructor(private readonly client: Client, config: LavalinkConfig) {
    this.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), [
      {
        name: 'main',
        url: `${config.host}:${config.port}`,
        auth: config.password,
      },
    ]);

    this.shoukaku.on('ready', (name, lavalinkResume, libraryResume) => {
      logger.info({ node: name, lavalinkResume, libraryResume }, 'Lavalink node ready');
    });

    this.shoukaku.on('error', (name, error) => {
      logger.error({ node: name, error }, 'Lavalink node error');
    });

    this.shoukaku.on('close', (name, code, reason) => {
      logger.warn({ node: name, code, reason }, 'Lavalink node connection closed');
    });

    this.shoukaku.on('reconnecting', (name, reconnectsLeft, reconnectInterval) => {
      logger.warn({ node: name, reconnectsLeft, reconnectInterval }, 'Reconnecting to Lavalink node');
    });

    this.shoukaku.on('disconnect', (name, count) => {
      logger.warn({ node: name, count }, 'Lavalink node disconnected');
    });
  }

  async join(guildId: string, voiceChannelId: string): Promise<PlayerPort> {
    const shardId = this.client.guilds.cache.get(guildId)?.shardId ?? 0;
    const player = await this.shoukaku.joinVoiceChannel({
      guildId,
      channelId: voiceChannelId,
      shardId,
      deaf: true,
    });
    logger.info({ guildId, voiceChannelId }, 'Joined voice channel');
    return new ShoukakuPlayerAdapter(player);
  }

  async leave(guildId: string): Promise<void> {
    await this.shoukaku.leaveVoiceChannel(guildId);
    logger.info({ guildId }, 'Left voice channel');
  }

  /** Resolve a URL or `ytsearch:` identifier against the node's REST API. */
  async resolve(identifier: string): Promise<ResolveResult> {
    const node = this.shoukaku.getIdealNode();
    if (!node) {
      throw new LavalinkError('No Lavalink node is connected');
    }

    const result = await node.rest.resolve(identifier);
    if (!result) {
      return { kind: 'empty' };
    }

    switch (result.loadType) {
      case LoadType.TRACK:
        return { kind: 'track', track: toDomainTrack(result.data) };
      case LoadType.SEARCH:
        return { kind: 'search', tracks: result.data.map(toDomainTrack) };
      case LoadType.PLAYLIST: {
        // A watch URL with a &list= param resolves as a playlist. Prefer, in
        // order: selectedTrack (set when the URL has index=), the track whose
        // id matches the v= param (matches the old --no-playlist behavior),
        // then the playlist head.
        const selected = result.data.info.selectedTrack;
        const linkedVideoId = identifier.match(/[?&]v=([^&]+)/)?.[1];
        const track =
          (selected >= 0 ? result.data.tracks[selected] : undefined) ??
          (linkedVideoId ? result.data.tracks.find(t => t.info.identifier === linkedVideoId) : undefined) ??
          result.data.tracks[0];
        if (!track) {
          return { kind: 'empty' };
        }
        return {
          kind: 'playlist',
          track: toDomainTrack(track),
          tracks: result.data.tracks.map(toDomainTrack),
          playlistName: result.data.info.name,
        };
      }
      case LoadType.ERROR:
        throw new LavalinkError(`Track load failed: ${result.data.message ?? 'unknown error'}`);
      case LoadType.EMPTY:
      default:
        return { kind: 'empty' };
    }
  }

  get raw(): Shoukaku {
    return this.shoukaku;
  }
}

function toDomainTrack(track: ShoukakuTrack): Track {
  return {
    encoded: track.encoded,
    title: track.info.title,
    author: track.info.author,
    duration: track.info.length,
    uri: track.info.uri ?? track.info.identifier,
  };
}
