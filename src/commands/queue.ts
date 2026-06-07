import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { EmbedService } from '../infrastructure/embed.js';

const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current music queue') as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    const embed = EmbedService.createErrorEmbed('Queue', 'This command can only be used in a server.', interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  const queue = services.music.getQueue(guildId);
  const isPlaying = services.music.isPlaying(guildId);
  const isPaused = services.music.isPaused(guildId);
  const currentTrack = services.music.getCurrentTrack(guildId);

  const embed = EmbedService.createQueueEmbed(
    queue,
    currentTrack,
    isPaused,
    isPlaying
  );

  await interaction.followUp({ embeds: [embed] });
}

export const queueCommand: SlashCommand = {
  data,
  execute,
};
