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
    .setColor(0x00AE86);

  if (isPlaying) {
    embed.addFields({ name: 'Now Playing', value: '▶️ Currently streaming...' });
  }

  if (queue.length > 0) {
    const queueList = queue.slice(0, 10).map((url, index) => 
      `${index + 1}. ${url}`
    ).join('\n');

    embed.addFields({ 
      name: `Up Next (${queue.length} song${queue.length === 1 ? '' : 's'})`, 
      value: queueList || 'No songs in queue' 
    });

    if (queue.length > 10) {
      embed.setFooter({ text: `...and ${queue.length - 10} more songs` });
    }
  }

  await interaction.followUp({ embeds: [embed] });
}

export const queueCommand: SlashCommand = {
  data,
  execute,
};
