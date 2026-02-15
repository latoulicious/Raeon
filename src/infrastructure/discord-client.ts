import { Client, GatewayIntentBits } from 'discord.js';

export class DiscordClient {
  private readonly client: Client;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });
  }

  async login(token: string): Promise<void> {
    await this.client.login(token);
  }

  async destroy(): Promise<void> {
    this.client.destroy();
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.client.on(event, listener);
  }

  once(event: string, listener: (...args: any[]) => void): void {
    this.client.once(event, listener);
  }

  get raw(): Client {
    return this.client;
  }
}
