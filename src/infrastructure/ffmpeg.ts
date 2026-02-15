import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import type { AudioEncoder } from '../domain/audio.js';

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
      console.error(`ffmpeg error: ${data}`);
    });

    process.on('error', (error) => {
      if (!signal.aborted) {
        console.error('ffmpeg process error:', error);
      }
    });

    if (!process.stdout) {
      throw new Error('Failed to create ffmpeg stdout stream');
    }

    return process.stdout;
  }
}
