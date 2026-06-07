import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { config } from 'dotenv';
import { validateStartupRequirements } from '../infrastructure/startup-validator.js';

config();

const require = createRequire(import.meta.url);

export interface Config {
  discordToken: string;
  ytdlpCookiesPath: string;
  lavalinkHost: string;
  lavalinkPort: number;
  lavalinkPassword: string;
}

export async function loadConfig(): Promise<Config> {
  // Perform startup validation first
  await validateStartupRequirements();

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

  const lavalinkHost = process.env.LAVALINK_HOST || 'localhost';
  const lavalinkPort = Number(process.env.LAVALINK_PORT || 2333);
  const lavalinkPassword = process.env.LAVALINK_PASSWORD;

  if (!lavalinkPassword) {
    throw new Error('LAVALINK_PASSWORD environment variable is required');
  }

  return {
    discordToken,
    ytdlpCookiesPath,
    lavalinkHost,
    lavalinkPort,
    lavalinkPassword,
  };
}
