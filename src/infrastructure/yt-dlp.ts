import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import type { AudioExtractor } from '../domain/audio.js';

export class YtdlpExtractor implements AudioExtractor {
  constructor(private readonly cookiesPath: string) {}

  stream(url: string, signal: AbortSignal): Readable {
    const args = [
      '--cookies', this.cookiesPath,
      '--format', 'bestaudio',
      '--no-playlist',
      '--quiet',
      '--no-warnings',
      url,
    ];

    const process = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (signal.aborted) {
      process.kill();
      throw new Error('Aborted before stream started');
    }

    signal.addEventListener('abort', () => {
      process.kill();
    });

    process.stderr?.on('data', (data) => {
      console.error(`yt-dlp error: ${data}`);
    });

    process.on('error', (error) => {
      if (!signal.aborted) {
        console.error('yt-dlp process error:', error);
      }
    });

    if (!process.stdout) {
      throw new Error('Failed to create yt-dlp stdout stream');
    }

    return process.stdout;
  }
}
