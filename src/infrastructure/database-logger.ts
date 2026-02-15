import { Pool, PoolClient } from 'pg';

export interface LogEntry {
  level: string;
  message: string;
  timestamp: Date;
  module?: string;
  metadata?: any;
  guild_id?: string;
  user_id?: string;
  command_name?: string;
}

export class DatabaseLogger {
  private pool: Pool;
  private isConnected: boolean = false;
  private retryAttempts: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 5000; // 5 seconds

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10, // Maximum number of connections in the pool
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
    });

    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      this.isConnected = true;
      this.retryAttempts = 0;
      console.log('Database logger connected successfully');
    } catch (error) {
      this.isConnected = false;
      console.error('Failed to connect to database for logging:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.retryAttempts < this.maxRetries) {
      this.retryAttempts++;
      console.log(`Attempting to reconnect database logger (${this.retryAttempts}/${this.maxRetries}) in ${this.retryDelay}ms`);
      
      setTimeout(() => {
        this.initializeConnection();
      }, this.retryDelay);
      
      // Exponential backoff
      this.retryDelay = Math.min(this.retryDelay * 2, 60000); // Max 60 seconds
    } else {
      console.error('Max reconnection attempts reached for database logger');
    }
  }

  async logAsync(entry: LogEntry): Promise<void> {
    if (!this.isConnected) {
      // Silently fail if database is not connected to avoid blocking the application
      return;
    }

    // Use fire-and-forget approach for non-blocking behavior
    this.persistLog(entry).catch(error => {
      console.error('Failed to persist log to database:', error);
    });
  }

  private async persistLog(entry: LogEntry): Promise<void> {
    let client: PoolClient | null = null;
    
    try {
      client = await this.pool.connect();
      
      const query = `
        INSERT INTO logs (level, message, module, timestamp, metadata, guild_id, user_id, command_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      const values = [
        entry.level,
        entry.message,
        entry.module || null,
        entry.timestamp,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.guild_id || null,
        entry.user_id || null,
        entry.command_name || null
      ];

      await client.query(query, values);
    } catch (error) {
      console.error('Error persisting log to database:', error);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async createLogsTable(): Promise<void> {
    let client: PoolClient | null = null;
    
    try {
      client = await this.pool.connect();
      
      const query = `
        CREATE TABLE IF NOT EXISTS logs (
          id SERIAL PRIMARY KEY,
          level VARCHAR(10) NOT NULL,
          message TEXT NOT NULL,
          module VARCHAR(100),
          timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          metadata JSONB,
          guild_id VARCHAR(50),
          user_id VARCHAR(50),
          command_name VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
        CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_logs_module ON logs(module);
        CREATE INDEX IF NOT EXISTS idx_logs_guild_id ON logs(guild_id);
        CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_logs_command_name ON logs(command_name);
      `;
      
      await client.query(query);
      console.log('Logs table created/verified successfully');
    } catch (error) {
      console.error('Error creating logs table:', error);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    let client: PoolClient | null = null;
    
    try {
      client = await this.pool.connect();
      
      const query = `
        DELETE FROM logs 
        WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
      `;
      
      const result = await client.query(query);
      console.log(`Cleaned up ${result.rowCount} old log entries`);
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    console.log('Database logger connection closed');
  }

  isReady(): boolean {
    return this.isConnected;
  }
}
