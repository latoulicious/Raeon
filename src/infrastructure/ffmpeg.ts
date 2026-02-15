import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import type { AudioEncoder } from '../domain/audio.js';
import { appLogger } from './logger.js';

const logger = appLogger.getLogger('ffmpeg');

export class FfmpegEncoder implements AudioEncoder {
  encode(input: Readable, signal: AbortSignal): Readable {
    const args = [
      '-i', 'pipe:0',
      '-f', 'opus',
      '-c:a', 'libopus',
      '-ar', '48000',
      '-ac', '2',
      '-b:a', '128k',
      '-loglevel', 'error',
      'pipe:1',
    ];

    const process = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (signal.aborted) {
      process.kill();
      throw new Error('Aborted before encoding started');
    }

    signal.addEventListener('abort', () => {
      process.kill();
    });

    input.pipe(process.stdin!);

    process.stderr?.on('data', (data) => {
      logger.error({ data: data.toString() }, 'ffmpeg stderr output');
    });

    process.on('error', (error) => {
      if (!signal.aborted) {
        logger.error({ error }, 'ffmpeg process error');
        appLogger.incrementFfmpegFailures();
      }
    });

    if (!process.stdout) {
      throw new Error('Failed to create ffmpeg stdout stream');
    }

    return process.stdout;
  }
}
