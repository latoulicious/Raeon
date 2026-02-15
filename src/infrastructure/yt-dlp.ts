import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import type { AudioExtractor } from '../domain/audio.js';
import { appLogger } from './logger.js';

const logger = appLogger.getLogger('yt-dlp');

export class YtdlpExtractor implements AudioExtractor {
  constructor(private readonly cookiesPath: string) {}

  stream(url: string, signal: AbortSignal): Readable {
    const args = [
      '--cookies', this.cookiesPath,
      '-o', '-',
      '--format', 'bestaudio',
      '--no-playlist',
      '--quiet',
      '--no-warnings',
      '--buffer-size', '16K',
      '--no-part',
      '--no-cache-dir',
      url,
    ];

    const process = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    logger.debug({ url }, 'Started yt-dlp extraction');

    if (signal.aborted) {
      process.kill();
      throw new Error('Aborted before stream started');
    }

    signal.addEventListener('abort', () => {
      process.kill();
    });

    process.stderr?.on('data', (data) => {
      logger.error({ data: data.toString() }, 'yt-dlp stderr output');
    });

    process.on('error', (error) => {
      if (!signal.aborted) {
        logger.error({ error }, 'yt-dlp process error');
        appLogger.incrementYtdlpFailures();
      }
    });

    if (!process.stdout) {
      throw new Error('Failed to create yt-dlp stdout stream');
    }

    process.stdout.once('data', () => {
      logger.debug({ url }, 'Received first chunk of data');
    });

    return process.stdout;
  }
}
