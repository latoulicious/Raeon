import { ActivityType, Guild } from 'discord.js';

export function updatePresence(client: any, musicService?: any): void {
  const currentTrack = musicService?.getAnyPlayingTrack();

  if (currentTrack) {
    // Track metadata arrives at resolve time; no subprocess needed
    client.user?.setActivity(`Listening to ${currentTrack.title}`, { type: ActivityType.Listening });
  } else {
    // Show server and channel stats when no music is playing
    const totalServers = client.guilds.cache.size;
    let totalChannels = 0;

    client.guilds.cache.forEach((guild: Guild) => {
      totalChannels += guild.channels.cache.size;
    });

    client.user?.setActivity(`Watching ${totalServers} servers with ${totalChannels} channels`, { type: ActivityType.Watching });
  }
}
