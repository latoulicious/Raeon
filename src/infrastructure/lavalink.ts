import { Client } from 'discord.js';
import { Connectors, Shoukaku } from 'shoukaku';
import { appLogger } from './logger.js';

const logger = appLogger.getLogger('lavalink');

export interface LavalinkConfig {
  host: string;
  port: number;
  password: string;
}

export class LavalinkClient {
  private readonly shoukaku: Shoukaku;

  constructor(client: Client, config: LavalinkConfig) {
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

  get raw(): Shoukaku {
    return this.shoukaku;
  }
}
