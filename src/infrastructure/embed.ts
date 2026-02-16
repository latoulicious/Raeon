import { EmbedBuilder, User, Client, ColorResolvable } from 'discord.js';

export class EmbedService {
  private static readonly COLORS = {
    PRIMARY: '#1DB954' as ColorResolvable, // Spotify green
    SUCCESS: '#00FF00' as ColorResolvable,
    ERROR: '#FF6B6B' as ColorResolvable,
    WARNING: '#FFA500' as ColorResolvable,
    INFO: '#0099FF' as ColorResolvable,
    PAUSED: '#FFA500' as ColorResolvable,
    PLAYING: '#1DB954' as ColorResolvable,
  };

  private static readonly EMojis = {
    PLAY: '▶️',
    PAUSE: '⏸️',
    SKIP: '⏭️',
    STOP: '⏹️',
    QUEUE: '📋',
    SEARCH: '🔍',
    ERROR: '❌',
    SUCCESS: '✅',
    INFO: 'ℹ️',
    WARNING: '⚠️',
  };

  static createBaseEmbed(title: string, color: ColorResolvable = this.COLORS.PRIMARY): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setTimestamp();
  }

  static createMusicEmbed(title: string, client: Client): EmbedBuilder {
    const embed = this.createBaseEmbed(title, this.COLORS.PRIMARY);
    if (client.user) {
      embed.setThumbnail(client.user.displayAvatarURL());
    }
    return embed;
  }

  static createNowPlayingEmbed(
    trackUrl: string,
    isPaused: boolean,
    queueLength: number,
    user: User,
    client: Client
  ): EmbedBuilder {
    const videoId = this.extractVideoId(trackUrl);
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

    const embed = this.createMusicEmbed('Now Playing', client)
      .setDescription(isPaused ? 'Currently Paused' : 'Currently Streaming')
      .setColor(isPaused ? this.COLORS.PAUSED : this.COLORS.PLAYING)
      .setURL(trackUrl)
      .addFields(
        {
          name: 'URL',
          value: `[Click to open](${trackUrl})`,
          inline: false
        },
        {
          name: 'Queue Status',
          value: queueLength > 0 
            ? `${queueLength} song${queueLength === 1 ? '' : 's'} waiting` 
            : 'Queue is empty',
          inline: true
        },
        {
          name: 'Status',
          value: isPaused ? 'Paused' : 'Playing',
          inline: true
        }
      )
      .setFooter({ 
        text: `Requested by ${user.tag}`,
        iconURL: user.displayAvatarURL()
      });

    if (thumbnailUrl) {
      embed.setThumbnail(thumbnailUrl);
    }

    return embed;
  }

  static createQueueEmbed(
    queue: readonly string[],
    currentTrack: string | null,
    isPaused: boolean,
    isPlaying: boolean,
    client: Client
  ): EmbedBuilder {
    const embed = this.createMusicEmbed('Music Queue', client);

    if (isPlaying || isPaused) {
      const videoId = currentTrack ? this.extractVideoId(currentTrack) : null;
      const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
      
      embed.addFields({ 
        name: 'Now Playing', 
        value: `${isPaused ? '⏸️ Currently Paused' : '▶️ Currently Streaming'}\n[Open in YouTube](${currentTrack || '#'})`,
        inline: false 
      });
      
      if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
      }
    }

    if (queue.length > 0) {
      const queueList = queue.slice(0, 10).map((url, index) => {
        const videoId = this.extractVideoId(url);
        const shortUrl = videoId ? `https://youtu.be/${videoId}` : url;
        return `${index + 1}. [Open](${shortUrl})`;
      }).join('\n');

      embed.addFields({ 
        name: `📋 Up Next (${queue.length} song${queue.length === 1 ? '' : 's'})`, 
        value: queueList || 'No songs in queue',
        inline: false 
      });

      if (queue.length > 10) {
        embed.setFooter({ 
          text: `...and ${queue.length - 10} more songs • Total: ${queue.length} songs` 
        });
      } else {
        embed.setFooter({ 
          text: `Total: ${queue.length} song${queue.length === 1 ? '' : 's'} in queue` 
        });
      }
    } else {
      embed.setDescription('The queue is empty! Use /play to add songs.');
      embed.setFooter({ text: 'Queue is empty' });
    }

    return embed;
  }

  static createEmptyQueueEmbed(client: Client): EmbedBuilder {
    return this.createMusicEmbed('Now Playing', client)
      .setDescription('Nothing is currently playing')
      .setColor(this.COLORS.ERROR)
      .setFooter({ text: 'Use /play to start playing music' });
  }

  static createSuccessEmbed(title: string, description: string, user?: User): EmbedBuilder {
    const embed = this.createBaseEmbed(title, this.COLORS.SUCCESS)
      .setDescription(`${this.EMojis.SUCCESS} ${description}`);

    if (user) {
      embed.setFooter({ 
        text: `Requested by ${user.tag}`,
        iconURL: user.displayAvatarURL()
      });
    }

    return embed;
  }

  static createErrorEmbed(title: string, description: string, user?: User): EmbedBuilder {
    const embed = this.createBaseEmbed(title, this.COLORS.ERROR)
      .setDescription(`${this.EMojis.ERROR} ${description}`);

    if (user) {
      embed.setFooter({ 
        text: `Requested by ${user.tag}`,
        iconURL: user.displayAvatarURL()
      });
    }

    return embed;
  }

  static createInfoEmbed(title: string, description: string, user?: User): EmbedBuilder {
    const embed = this.createBaseEmbed(title, this.COLORS.INFO)
      .setDescription(`${this.EMojis.INFO} ${description}`);

    if (user) {
      embed.setFooter({ 
        text: `Requested by ${user.tag}`,
        iconURL: user.displayAvatarURL()
      });
    }

    return embed;
  }

  static createPlayEmbed(
    trackUrl: string,
    queueLength: number,
    user: User,
    client: Client
  ): EmbedBuilder {
    const videoId = this.extractVideoId(trackUrl);
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

    const description = queueLength === 0 
      ? `▶️ **Now playing**\n[Open in YouTube](${trackUrl})`
      : `✅ **Song added to queue!**\n📋 Queue: ${queueLength} song${queueLength === 1 ? '' : 's'} remaining\n⏭️ Next up: [Open](${trackUrl})`;

    const embed = this.createSuccessEmbed('Music Player', description, user)
      .setURL(trackUrl);

    if (thumbnailUrl) {
      embed.setThumbnail(thumbnailUrl);
    }

    return embed;
  }

  static createSkipEmbed(queueLength: number, user: User): EmbedBuilder {
    const description = `⏭️ **Skipped current song!**\n📋 Queue: ${queueLength > 0 
      ? `${queueLength} song${queueLength === 1 ? '' : 's'} remaining` 
      : 'Empty - add more songs with /play!'}`;

    return this.createSuccessEmbed('Skip', description, user);
  }

  static createPauseEmbed(currentTrack: string | null, user: User): EmbedBuilder {
    const description = `⏸️ **Playback has been paused**\n[Currently playing](${currentTrack || '#'})`;
    return this.createSuccessEmbed('Paused', description, user)
      .setColor(this.COLORS.PAUSED);
  }

  static createResumeEmbed(currentTrack: string | null, queueLength: number, user: User): EmbedBuilder {
    const description = `▶️ **Playback has been resumed**\n[Now playing](${currentTrack || '#'})`;
    const embed = this.createSuccessEmbed('Resumed', description, user)
      .setColor(this.COLORS.PLAYING);

    if (queueLength > 0) {
      embed.addFields({
        name: 'Queue Status',
        value: `${queueLength} song${queueLength === 1 ? '' : 's'} remaining`,
        inline: true
      });
    }

    return embed;
  }

  static createStopEmbed(user: User): EmbedBuilder {
    return this.createSuccessEmbed('Stopped', 'Stopped playing music and disconnected from voice channel.', user);
  }

  static createClearEmbed(count: number, user: User): EmbedBuilder {
    return this.createSuccessEmbed('Queue Cleared', `Cleared ${count} song${count === 1 ? '' : 's'} from the queue.`, user);
  }

  static createRemoveEmbed(position: number, songUrl: string, newQueueSize: number, user: User): EmbedBuilder {
    const videoId = this.extractVideoId(songUrl);
    const shortUrl = videoId ? `https://youtu.be/${videoId}` : songUrl;
    
    return this.createSuccessEmbed('Removed', `Song removed from queue`, user)
      .setColor('#E74C3C')
      .addFields(
        {
          name: 'Removed Song',
          value: `Position ${position}: [Open](${shortUrl})`,
          inline: false
        },
        {
          name: 'Queue Status',
          value: `${newQueueSize} song${newQueueSize === 1 ? '' : 's'} remaining`,
          inline: true
        }
      );
  }

  static createShuffleEmbed(count: number, user: User): EmbedBuilder {
    return this.createSuccessEmbed('Shuffled', `Queue has been shuffled`, user)
      .setColor('#9B59B6')
      .addFields({
        name: 'Queue Status',
        value: `${count} song${count === 1 ? '' : 's'} shuffled`,
        inline: true
      });
  }

  static createSearchEmbed(query: string, results: any[], limit: number, client: Client): EmbedBuilder {
    const embed = this.createBaseEmbed(`Search Results for "${query}"`, '#FF0000')
      .setDescription(`Found ${results.length} result${results.length === 1 ? '' : 's'} for your search`)
      .setFooter({ 
        text: `Use /play with the URL or try /play ytsearch1:"song name" for direct search • Results: ${results.length}/${limit}` 
      });

    if (client.user) {
      embed.setThumbnail(client.user.displayAvatarURL());
    }

    results.forEach((result, index) => {
      const duration = typeof result.duration === 'number' ? this.formatDuration(result.duration) : result.duration;
      
      embed.addFields({
        name: `${index + 1}. ${result.title}`,
        value: `**${result.uploader}** | **${duration}**\n[Click to play](${result.url})\n\`/play ${result.url}\``,
        inline: false
      });
    });

    return embed;
  }

  static createPingEmbed(latency: string, timestamp: number): EmbedBuilder {
    return this.createBaseEmbed('Pong! 🏓', this.COLORS.INFO)
      .addFields(
        { name: 'Status', value: latency, inline: true },
        { name: 'Timestamp', value: new Date(timestamp).toLocaleString(), inline: true }
      );
  }

  static createTimeoutEmbed(): EmbedBuilder {
    return this.createBaseEmbed('Idle Timeout', this.COLORS.WARNING)
      .setDescription('Disconnected from voice channel due to 5 minutes of inactivity.')
      .setFooter({ text: 'Use /play to start music again' });
  }

  static createPruneEmbed(count: number, user: User): EmbedBuilder {
    return this.createSuccessEmbed('Prune', `Successfully deleted ${count} bot messages.`, user)
      .setColor(this.COLORS.INFO);
  }

  static createHelpEmbed(client: Client): EmbedBuilder {
    const embed = this.createBaseEmbed('Raeon', this.COLORS.PRIMARY)
      .setURL('https://github.com/latoulicious/Raeon')
      .setDescription('A powerful Discord music bot with clean architecture and stability features.');

    if (client.user) {
      embed.setThumbnail(client.user.displayAvatarURL());
    }

    embed.addFields(
      { 
        name: 'Music Commands', 
        value: 
          '`/play <url>` - Play a song from YouTube\n' +
          '`/stop` - Stop playing and disconnect\n' +
          '`/skip` - Skip the current song\n' +
          '`/pause` - Pause the current song\n' +
          '`/resume` - Resume paused playback\n' +
          '`/nowplaying` - Show currently playing song\n' +
          '`/queue` - Show the music queue\n' +
          '`/shuffle` - Shuffle the music queue\n' +
          '`/remove <position>` - Remove song from queue\n' +
          '`/clear` - Clear the queue\n' +
          '`/search <query>` - Search for songs',
        inline: false 
      },
      { 
        name: 'Utility Commands', 
        value: 
          '`/ping` - Check bot latency\n' +
          '`/commands` - Show this help message\n' +
          '`/prune [amount]` - Delete bot messages',
        inline: false 
      },
      {
        name: 'Features',
        value: '• Stable playback with error handling\n' +
               '• Queue management\n' +
               '• YouTube search functionality\n' +
               '• High-quality audio streaming',
        inline: false
      }
    )
    .setFooter({ 
      text: 'Made with TypeScript + Discord.js'
    });

    return embed;
  }

  private static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  static extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([^&\n?#]+)$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  static createYouTubeThumbnail(url: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'maxres'): string | null {
    const videoId = this.extractVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/${quality}.jpg` : null;
  }

  static createShortYouTubeUrl(url: string): string | null {
    const videoId = this.extractVideoId(url);
    return videoId ? `https://youtu.be/${videoId}` : null;
  }
}