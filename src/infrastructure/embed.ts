import { EmbedBuilder, User, Client, ColorResolvable } from 'discord.js';
import type { Track } from '../domain/track.js';

export class EmbedService {
  /** Single palette; helpers must not hardcode one-off colors. */
  private static readonly COLORS = {
    ACCENT: '#5865F2' as ColorResolvable,
    SUCCESS: '#57F287' as ColorResolvable,
    ERROR: '#ED4245' as ColorResolvable,
    WARNING: '#FEE75C' as ColorResolvable,
    INFO: '#3498DB' as ColorResolvable,
  };

  /**
   * Status icons live here only. The success/error/info helpers prefix
   * them; descriptions passed in must never carry their own.
   */
  private static readonly EMOJIS = {
    SUCCESS: '✅',
    ERROR: '❌',
    INFO: 'ℹ️',
    WARNING: '⚠️',
  };

  static createBaseEmbed(title: string, color: ColorResolvable = this.COLORS.ACCENT): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setTimestamp();
  }

  static createNowPlayingEmbed(
    track: Track,
    isPaused: boolean,
    queueLength: number,
    user: User
  ): EmbedBuilder {
    const embed = this.createBaseEmbed('Now Playing', isPaused ? this.COLORS.WARNING : this.COLORS.ACCENT)
      .setDescription(`**[${track.title}](${track.uri})**\nby ${track.author}`)
      .setURL(track.uri)
      .addFields(
        {
          name: 'Duration',
          value: this.formatTrackDuration(track),
          inline: true
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

    const thumbnailUrl = this.trackThumbnail(track);
    if (thumbnailUrl) {
      embed.setThumbnail(thumbnailUrl);
    }

    return embed;
  }

  static createQueueEmbed(
    queue: readonly Track[],
    currentTrack: Track | null,
    isPaused: boolean,
    isPlaying: boolean
  ): EmbedBuilder {
    const embed = this.createBaseEmbed('Music Queue');

    if ((isPlaying || isPaused) && currentTrack) {
      embed.addFields({
        name: 'Now Playing',
        value: `${isPaused ? 'Paused' : 'Playing'}\n${this.formatTrackLine(currentTrack)}`,
        inline: false
      });

      const thumbnailUrl = this.trackThumbnail(currentTrack);
      if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
      }
    }

    if (queue.length > 0) {
      const queueList = queue.slice(0, 10).map((track, index) => {
        return `${index + 1}. ${this.formatTrackLine(track)}`;
      }).join('\n');

      embed.addFields({
        name: `Up Next (${queue.length} song${queue.length === 1 ? '' : 's'})`,
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

  static createEmptyQueueEmbed(): EmbedBuilder {
    return this.createBaseEmbed('Nothing Playing', this.COLORS.INFO)
      .setDescription('Nothing is currently playing')
      .setFooter({ text: 'Use /play to start playing music' });
  }

  static createSuccessEmbed(title: string, description: string, user?: User): EmbedBuilder {
    const embed = this.createBaseEmbed(title, this.COLORS.SUCCESS)
      .setDescription(`${this.EMOJIS.SUCCESS} ${description}`);

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
      .setDescription(`${this.EMOJIS.ERROR} ${description}`);

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
      .setDescription(`${this.EMOJIS.INFO} ${description}`);

    if (user) {
      embed.setFooter({
        text: `Requested by ${user.tag}`,
        iconURL: user.displayAvatarURL()
      });
    }

    return embed;
  }

  static createPlayEmbed(
    track: Track,
    queueLength: number,
    user: User,
    playlistNotice?: string | null
  ): EmbedBuilder {
    const nowPlaying = queueLength === 0;
    const embed = this.createSuccessEmbed(
      nowPlaying ? 'Now Playing' : 'Queued',
      this.formatTrackLine(track),
      user
    ).setURL(track.uri);

    if (!nowPlaying) {
      embed.addFields({
        name: 'Position in Queue',
        value: `${queueLength}`,
        inline: true
      });
    }

    if (playlistNotice) {
      embed.addFields({
        name: 'Playlist',
        value: playlistNotice,
        inline: false
      });
    }

    const thumbnailUrl = this.trackThumbnail(track);
    if (thumbnailUrl) {
      embed.setThumbnail(thumbnailUrl);
    }

    return embed;
  }

  static createSkipEmbed(queueLength: number, user: User): EmbedBuilder {
    const description = `**Skipped current song!**\nQueue: ${queueLength > 0
      ? `${queueLength} song${queueLength === 1 ? '' : 's'} remaining`
      : 'Empty - add more songs with /play!'}`;

    return this.createSuccessEmbed('Skip', description, user);
  }

  static createPauseEmbed(currentTrack: Track | null, user: User): EmbedBuilder {
    const trackLine = currentTrack ? this.formatTrackLine(currentTrack) : 'Current track';
    const description = `**Playback has been paused**\n${trackLine}`;
    return this.createSuccessEmbed('Paused', description, user)
      .setColor(this.COLORS.WARNING);
  }

  static createResumeEmbed(currentTrack: Track | null, queueLength: number, user: User): EmbedBuilder {
    const trackLine = currentTrack ? this.formatTrackLine(currentTrack) : 'Current track';
    const description = `**Playback has been resumed**\n${trackLine}`;
    const embed = this.createSuccessEmbed('Resumed', description, user);

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

  static createRemoveEmbed(position: number, track: Track, newQueueSize: number, user: User): EmbedBuilder {
    return this.createSuccessEmbed('Removed', `Song removed from queue`, user)
      .addFields(
        {
          name: 'Removed Song',
          value: `Position ${position}: ${this.formatTrackLine(track)}`,
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
      .addFields({
        name: 'Queue Status',
        value: `${count} song${count === 1 ? '' : 's'} shuffled`,
        inline: true
      });
  }

  static createSearchEmbed(query: string, results: readonly Track[], limit: number, user: User): EmbedBuilder {
    const resultList = results
      .map((track, index) => `${index + 1}. ${this.formatTrackLine(track)}`)
      .join('\n');

    return this.createBaseEmbed(`Search Results for "${query}"`, this.COLORS.INFO)
      .setDescription(resultList)
      .setFooter({
        text: `${results.length}/${limit} results • Requested by ${user.tag}`,
        iconURL: user.displayAvatarURL()
      });
  }

  static createPingEmbed(latency: string): EmbedBuilder {
    return this.createBaseEmbed('Ping', this.COLORS.INFO)
      .addFields({ name: 'Status', value: latency, inline: true });
  }

  static createTimeoutEmbed(): EmbedBuilder {
    return this.createBaseEmbed('Idle Timeout', this.COLORS.WARNING)
      .setDescription('Disconnected from voice channel due to 5 minutes of inactivity.')
      .setFooter({ text: 'Use /play to start music again' });
  }

  static createPruneEmbed(count: number, user: User): EmbedBuilder {
    return this.createSuccessEmbed('Prune', `Successfully deleted ${count} bot messages.`, user);
  }

  static createHelpEmbed(client: Client): EmbedBuilder {
    const embed = this.createBaseEmbed('Raeon', this.COLORS.ACCENT)
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

  /** Shared track line: title link — author (duration). */
  private static formatTrackLine(track: Track): string {
    return `[${track.title}](${track.uri}) — ${track.author} (${this.formatTrackDuration(track)})`;
  }

  /** YouTube thumbnail for a track, or null when no video id is found. */
  private static trackThumbnail(track: Track): string | null {
    const videoId = this.extractVideoId(track.uri);
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
  }

  /** Track.duration is in milliseconds; live streams report no usable length. */
  private static formatTrackDuration(track: Track): string {
    if (track.duration <= 0) {
      return 'live/unknown';
    }
    return this.formatDuration(Math.floor(track.duration / 1000));
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

  private static extractVideoId(url: string): string | null {
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
}
