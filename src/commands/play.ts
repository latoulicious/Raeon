import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { SlashCommand, SlashCommandServices } from '../handler/slash.js';
import { appLogger } from '../infrastructure/logger.js';

const logger = appLogger.getLogger('command-play');

const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song from YouTube')
  .addStringOption(option =>
    option.setName('url')
      .setDescription('YouTube URL to play')
      .setRequired(true),
  ) as SlashCommandBuilder;

async function execute(
  interaction: ChatInputCommandInteraction,
  services: SlashCommandServices,
): Promise<void> {
  await interaction.deferReply();

  if (!interaction.inGuild()) {
    await interaction.followUp('This command can only be used in a server!');
    return;
  }

  const member = await interaction.guild?.members.fetch(interaction.user.id);
  const voiceChannel = member?.voice.channel;
  
  if (!voiceChannel) {
    await interaction.followUp('You must be in a voice channel to use this command!');
    return;
  }

  const url = interaction.options.getString('url', true);
  const guildId = interaction.guildId;
  const channelId = voiceChannel.id;

  try {
    await services.music.play(guildId, channelId, url);
    await interaction.followUp(`🎵 Now playing: ${url}`);
  } catch (error) {
    logger.error({ guildId, url, error }, 'Error playing music');
    const errorMessage = error instanceof Error ? error.message : 'Failed to play the song. Please check the URL and try again.';
    await interaction.followUp(errorMessage);
  }
}

export const playCommand: SlashCommand = {
  data,
  execute,
};
