import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';

const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current music queue') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.followUp('This command can only be used in a server!');
    return;
  }

  const queue = services.music.getQueue(guildId);
  const isPlaying = services.music.isPlaying(guildId);

  if (queue.length === 0 && !isPlaying) {
    await interaction.followUp('The queue is empty!');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎵 Music Queue')
    .setColor('#1DB954')
    .setThumbnail('https://cdn.discordapp.com/avatars/1234567890/1234567890abcdef.png')
    .setTimestamp();

  if (isPlaying) {
    const currentTrack = services.music.getCurrentTrack(guildId);
    const videoId = currentTrack ? extractVideoId(currentTrack) : null;
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
    
    embed.addFields({ 
      name: '🎵 **Now Playing**', 
      value: `▶️ **Currently Streaming**\n🔗 [Open in YouTube](${currentTrack || '#'})`,
      inline: false 
    });
    
    if (thumbnailUrl) {
      embed.setThumbnail(thumbnailUrl);
    }
  }

  if (queue.length > 0) {
    const queueList = queue.slice(0, 10).map((url, index) => {
      const videoId = extractVideoId(url);
      const shortUrl = videoId ? `https://youtu.be/${videoId}` : url;
      return `${index + 1}. [Open](${shortUrl})`;
    }).join('\n');

    embed.addFields({ 
      name: `📋 **Up Next (${queue.length} song${queue.length === 1 ? '' : 's'})**`, 
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
    embed.setDescription('📋 The queue is empty! Use `/play` to add songs.');
    embed.setFooter({ text: 'Queue is empty' });
  }

  await interaction.followUp({ embeds: [embed] });
}

function extractVideoId(url: string): string | null {
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

export const queueCommand: SlashCommand = {
  data,
  execute,
};
