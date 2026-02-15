import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface Config {
  discordToken: string;
  ytdlpCookiesPath: string;
}

export async function loadConfig(): Promise<Config> {
  const discordToken = process.env.DISCORD_TOKEN;
  const ytdlpCookiesPath = process.env.YTDLP_COOKIES_PATH;

  if (!discordToken) {
    throw new Error('DISCORD_TOKEN environment variable is required');
  }

  if (!ytdlpCookiesPath) {
    throw new Error('YTDLP_COOKIES_PATH environment variable is required');
  }

  try {
    await readFile(ytdlpCookiesPath, 'utf-8');
  } catch {
    throw new Error(`Cookies file not found at: ${ytdlpCookiesPath}`);
  }

  return {
    discordToken,
    ytdlpCookiesPath,
  };
}
