import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';

const data = new SlashCommandBuilder()
  .setName('commands')
  .setDescription('List all available commands') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  const embed = new EmbedBuilder()
    .setTitle('🎵 Raeon Music Bot')
    .setURL('https://github.com/your-repo/raeon')
    .setDescription('A powerful Discord music bot with clean architecture and stability features.')
    .setColor('#1DB954')
    .setThumbnail('https://cdn.discordapp.com/avatars/1234567890/1234567890abcdef.png')
    .addFields(
      { 
        name: '🎵 **Music Commands**', 
        value: 
          '`/play <url>` - Play a song from YouTube\n' +
          '`/stop` - Stop playing and disconnect\n' +
          '`/skip` - Skip the current song\n' +
          '`/nowplaying` - Show currently playing song\n' +
          '`/queue` - Show the music queue\n' +
          '`/clear` - Clear the queue\n' +
          '`/search <query>` - Search for songs',
        inline: false 
      },
      { 
        name: '⚙️ **Utility Commands**', 
        value: 
          '`/ping` - Check bot latency\n' +
          '`/commands` - Show this help message',
        inline: false 
      },
      {
        name: '✨ **Features**',
        value: '• 🛡️ Stable playback with error handling\n' +
               '• 📊 Queue management (20 songs max)\n' +
               '• 🔍 YouTube search functionality\n' +
               '• 🎵 High-quality audio streaming\n' +
               '• ⚡ Fast response times',
        inline: false
      },
      {
        name: '📋 **Requirements**',
        value: '• Must be in a voice channel\n' +
               '• Bot needs join/speak permissions\n' +
               '• Valid YouTube URLs only',
        inline: false
      }
    )
    .setFooter({ 
      text: 'Made with ❤️ using TypeScript + Discord.js', 
      iconURL: 'https://cdn.discordapp.com/avatars/1234567890/1234567890abcdef.png' 
    })
    .setTimestamp();

  await interaction.followUp({ embeds: [embed] });
}

export const commandsCommand: SlashCommand = {
  data,
  execute,
};
