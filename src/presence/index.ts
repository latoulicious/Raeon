import { ActivityType } from 'discord.js';

export function updatePresence(client: any): void {
  client.user?.setActivity('music', { type: ActivityType.Listening });
}
