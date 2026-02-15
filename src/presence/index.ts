import { ActivityType, Guild } from 'discord.js';
import { spawn, ChildProcess } from 'node:child_process';

export function updatePresence(client: any, musicService?: any): void {
  const currentMusic = musicService?.getAnyPlayingTrack();
  
  if (currentMusic) {
    // Get proper track title from metadata
    getTrackTitle(currentMusic).then(trackTitle => {
      client.user?.setActivity(`Listening to ${trackTitle}`, { type: ActivityType.Listening });
    }).catch(() => {
      // Fallback to simple extraction if metadata fetch fails
      const trackTitle = extractTrackTitle(currentMusic);
      client.user?.setActivity(`Listening to ${trackTitle}`, { type: ActivityType.Listening });
    });
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

async function getTrackTitle(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args: string[] = [
      '--cookies', process.env.YTDLP_COOKIES_PATH || '',
      '--get-title',
      '--no-playlist',
      '--quiet',
      '--no-warnings',
      url,
    ];

    const ytDlpProcess: ChildProcess = spawn('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let title = '';
    let error = '';

    ytDlpProcess.stdout?.on('data', (data: Buffer) => {
      title += data.toString();
    });

    ytDlpProcess.stderr?.on('data', (data: Buffer) => {
      error += data.toString();
    });

    ytDlpProcess.on('close', (code: number | null) => {
      if (code === 0 && title.trim()) {
        resolve(title.trim());
      } else {
        reject(new Error(`Failed to get title: ${error}`));
      }
    });

    ytDlpProcess.on('error', (error: Error) => {
      reject(error);
    });
  });
}

function extractTrackTitle(url: string): string {
  // Simple extraction - in a real implementation you might want to fetch metadata
  // For now, just return the URL or a simplified version
  if (url.includes('youtube.com/watch?v=')) {
    const videoId = url.split('v=')[1]?.split('&')[0];
    return videoId ? `YouTube video (${videoId})` : url;
  }
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    return videoId ? `YouTube video (${videoId})` : url;
  }
  // For other URLs, just return the URL itself or a generic name
  return url.length > 50 ? `${url.substring(0, 47)}...` : url;
}
