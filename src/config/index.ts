import { createRequire } from 'node:module';
import { config } from 'dotenv';
import { validateStartupRequirements } from '../infrastructure/startup-validator.js';

config();

const require = createRequire(import.meta.url);

export interface Config {
  discordToken: string;
  lavalinkHost: string;
  lavalinkPort: number;
  lavalinkPassword: string;
}

export async function loadConfig(): Promise<Config> {
  // Perform startup validation first
  await validateStartupRequirements();

  const discordToken = process.env.DISCORD_TOKEN;

  if (!discordToken) {
    throw new Error('DISCORD_TOKEN environment variable is required');
  }

  const lavalinkHost = process.env.LAVALINK_HOST || 'localhost';
  const lavalinkPort = Number(process.env.LAVALINK_PORT || 2333);
  const lavalinkPassword = process.env.LAVALINK_PASSWORD;

  if (!lavalinkPassword) {
    throw new Error('LAVALINK_PASSWORD environment variable is required');
  }

  return {
    discordToken,
    lavalinkHost,
    lavalinkPort,
    lavalinkPassword,
  };
}
