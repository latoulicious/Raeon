import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import type { AudioExtractor } from '../domain/audio.js';
import { appLogger } from './logger.js';

const logger = appLogger.getLogger('yt-dlp');

export interface SearchResult {
  title: string;
  url: string;
  duration: string;
  uploader: string;
}

export class YtdlpExtractorError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'YtdlpExtractorError';
  }
}

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
      process.kill('SIGTERM');
      throw new YtdlpExtractorError('Aborted before stream started');
    }

    // Drain stderr to prevent blocking
    let stderrOutput = '';
    process.stderr?.on('data', (data) => {
      stderrOutput += data.toString();
    });

    process.stderr?.on('end', () => {
      if (stderrOutput && !signal.aborted) {
        logger.error({ stderr: stderrOutput, url }, 'yt-dlp stderr output');
      }
    });

    signal.addEventListener('abort', () => {
      logger.debug({ url }, 'Aborting yt-dlp process');
      process.kill('SIGTERM');
    });

    process.on('error', (error) => {
      if (!signal.aborted) {
        logger.error({ error, url }, 'yt-dlp process error');
        appLogger.incrementYtdlpFailures();
      }
    });

    process.on('close', (code) => {
      if (code !== 0 && !signal.aborted) {
        const errorMsg = `yt-dlp exited with code ${code}${stderrOutput ? `: ${stderrOutput.trim()}` : ''}`;
        logger.error({ code, stderr: stderrOutput, url }, 'yt-dlp process failed');
        appLogger.incrementYtdlpFailures();
      }
    });

    if (!process.stdout) {
      throw new YtdlpExtractorError('Failed to create yt-dlp stdout stream');
    }

    process.stdout.once('data', () => {
      logger.debug({ url }, 'Received first chunk of data');
    });

    return process.stdout;
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const args = [
        '--cookies', this.cookiesPath,
        '--format', 'bestaudio',
        '--no-playlist',
        '--quiet',
        '--no-warnings',
        '--no-cache-dir',
        '--dump-single-json',
        '--playlist-end', limit.toString(),
        `ytsearch${limit}:${query}`,
      ];

      const process = spawn('yt-dlp', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      logger.debug({ query, limit }, 'Started yt-dlp search');

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', (error) => {
        logger.error({ error, query }, 'yt-dlp search process error');
        appLogger.incrementYtdlpFailures();
        reject(new YtdlpExtractorError('yt-dlp search process failed', error));
      });

      process.on('close', (code) => {
        if (code !== 0) {
          const errorMsg = `yt-dlp search failed with code ${code}${stderr ? `: ${stderr}` : ''}`;
          logger.error({ code, stderr, query }, 'yt-dlp search failed');
          appLogger.incrementYtdlpFailures();
          reject(new YtdlpExtractorError(errorMsg));
          return;
        }

        try {
          const results = JSON.parse(stdout);
          const searchResults: any[] = Array.isArray(results) ? results : [results];
          
          const formattedResults = searchResults.map((item: any) => ({
            title: item.title || 'Unknown Title',
            url: item.webpage_url && !item.webpage_url.startsWith('ytsearch') ? item.webpage_url : 
                 item.url && !item.url.startsWith('ytsearch') ? item.url :
                 item.id ? `https://www.youtube.com/watch?v=${item.id}` : '',
            duration: item.duration || 'Unknown',
            uploader: item.uploader || item.channel || item.uploader_name || 'Unknown Uploader'
          }));

          logger.info({ query, resultCount: formattedResults.length }, 'Search completed successfully');
          resolve(formattedResults);
        } catch (error) {
          logger.error({ error, stdout, query }, 'Failed to parse yt-dlp search results');
          appLogger.incrementYtdlpFailures();
          reject(new YtdlpExtractorError('Failed to parse search results', error instanceof Error ? error : new Error(String(error))));
        }
      });
    });
  }
}
