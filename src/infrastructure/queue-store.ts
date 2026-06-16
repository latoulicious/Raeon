import { Pool } from 'pg';
import type { Track } from '../domain/track.js';
import { appLogger } from './logger.js';

const logger = appLogger.getLogger('queue-store');

/** One guild's persisted playback session (current track + queue). */
export interface PersistedSession {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  currentTrack: Track | null;
  queue: Track[];
  updatedAt: Date;
}

/**
 * Persists guild queues in PostgreSQL so they survive a bot death.
 * Separate small pool from DatabaseLogger; raw SQL, table auto-created
 * at boot like the logs table. Without DATABASE_URL every operation is
 * a no-op (logged once) — a missing or dead DB can never block playback,
 * so write/delete failures are logged and swallowed.
 */
export class QueueStore {
  private readonly pool: Pool | null;

  constructor(connectionString: string | undefined) {
    this.pool = connectionString
      ? new Pool({
          connectionString,
          max: 2,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        })
      : null;
  }

  get isEnabled(): boolean {
    return this.pool !== null;
  }

  /** Create the guild_sessions table; logs and continues on failure. */
  async init(): Promise<void> {
    if (!this.pool) {
      logger.warn('DATABASE_URL not provided, queue persistence disabled');
      return;
    }

    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS guild_sessions (
          guild_id         VARCHAR(50) PRIMARY KEY,
          voice_channel_id VARCHAR(50) NOT NULL,
          text_channel_id  VARCHAR(50) NOT NULL,
          current_track    JSONB,
          queue            JSONB NOT NULL DEFAULT '[]',
          updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      logger.info('Guild sessions table created/verified');
    } catch (error) {
      logger.error({ error }, 'Failed to create guild_sessions table');
    }
  }

  /** Upsert a guild's whole session snapshot. Fire-and-forget safe. */
  async upsert(session: Omit<PersistedSession, 'updatedAt'>): Promise<void> {
    if (!this.pool) {
      return;
    }

    try {
      await this.pool.query(
        `
        INSERT INTO guild_sessions (guild_id, voice_channel_id, text_channel_id, current_track, queue, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (guild_id) DO UPDATE SET
          voice_channel_id = EXCLUDED.voice_channel_id,
          text_channel_id  = EXCLUDED.text_channel_id,
          current_track    = EXCLUDED.current_track,
          queue            = EXCLUDED.queue,
          updated_at       = NOW()
        `,
        [
          session.guildId,
          session.voiceChannelId,
          session.textChannelId,
          // Explicit JSON for JSONB: pg would otherwise serialize a JS
          // array as a Postgres array literal, which JSONB rejects.
          session.currentTrack ? JSON.stringify(session.currentTrack) : null,
          JSON.stringify(session.queue),
        ],
      );
    } catch (error) {
      logger.error({ guildId: session.guildId, error }, 'Failed to persist guild session');
    }
  }

  /** All persisted sessions; an unreachable DB yields an empty list. */
  async loadAll(): Promise<PersistedSession[]> {
    if (!this.pool) {
      return [];
    }

    try {
      const result = await this.pool.query(
        'SELECT guild_id, voice_channel_id, text_channel_id, current_track, queue, updated_at FROM guild_sessions',
      );
      return result.rows.map((row) => ({
        guildId: row.guild_id,
        voiceChannelId: row.voice_channel_id,
        textChannelId: row.text_channel_id,
        currentTrack: row.current_track,
        queue: row.queue,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to load guild sessions');
      return [];
    }
  }

  /** Remove a guild's session. Fire-and-forget safe. */
  async delete(guildId: string): Promise<void> {
    if (!this.pool) {
      return;
    }

    try {
      await this.pool.query('DELETE FROM guild_sessions WHERE guild_id = $1', [guildId]);
    } catch (error) {
      logger.error({ guildId, error }, 'Failed to delete guild session');
    }
  }

  /**
   * Liveness probe. Resolves ok when persistence is disabled (DB is
   * optional) or a `SELECT 1` succeeds; false only when an enabled pool
   * fails to answer.
   */
  async ping(): Promise<boolean> {
    if (!this.pool) {
      return true;
    }

    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error({ error }, 'Database health ping failed');
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
