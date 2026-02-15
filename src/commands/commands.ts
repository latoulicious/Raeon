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
    .setTitle('🎵 Raeon Music Bot Commands')
    .setColor(0x00AE86)
    .addFields(
      { name: 'Music Commands', value: 
        '`/play <url>` - Play a song from YouTube\n' +
        '`/stop` - Stop playing and disconnect\n' +
        '`/skip` - Skip the current song\n' +
        '`/queue` - Show the music queue\n' +
        '`/clear` - Clear the queue'
      },
      { name: 'Utility Commands', value: 
        '`/ping` - Check bot latency\n' +
        '`/commands` - Show this help message'
      }
    )
    .setFooter({ text: 'You must be in a voice channel to use music commands' });

  await interaction.followUp({ embeds: [embed] });
}

export const commandsCommand: SlashCommand = {
  data,
  execute,
};
