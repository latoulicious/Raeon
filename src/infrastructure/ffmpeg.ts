import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import type { AudioEncoder } from '../domain/audio.js';
import { appLogger } from './logger.js';

const logger = appLogger.getLogger('ffmpeg');

export class FfmpegEncoderError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'FfmpegEncoderError';
  }
}

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
      process.kill('SIGTERM');
      throw new FfmpegEncoderError('Aborted before encoding started');
    }

    // Drain stderr to prevent blocking
    let stderrOutput = '';
    process.stderr?.on('data', (data) => {
      stderrOutput += data.toString();
    });

    process.stderr?.on('end', () => {
      if (stderrOutput && !signal.aborted) {
        logger.error({ stderr: stderrOutput }, 'ffmpeg stderr output');
      }
    });

    signal.addEventListener('abort', () => {
      logger.debug('Aborting ffmpeg process');
      process.kill('SIGTERM');
    });

    input.pipe(process.stdin!);

    process.on('error', (error) => {
      if (!signal.aborted) {
        logger.error({ error }, 'ffmpeg process error');
        appLogger.incrementFfmpegFailures();
      }
    });

    process.on('close', (code) => {
      if (code !== 0 && !signal.aborted) {
        const errorMsg = `ffmpeg exited with code ${code}${stderrOutput ? `: ${stderrOutput.trim()}` : ''}`;
        logger.error({ code, stderr: stderrOutput }, 'ffmpeg process failed');
        appLogger.incrementFfmpegFailures();
      }
    });

    if (!process.stdout) {
      throw new FfmpegEncoderError('Failed to create ffmpeg stdout stream');
    }

    return process.stdout;
  }
}
