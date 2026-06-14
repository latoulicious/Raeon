import { Client, Message } from 'discord.js';
import { EmbedService } from '../infrastructure/embed.js';

export interface MessageCommandServices {
  client: Client;
}

export async function handleMessage(
  message: Message,
  services: MessageCommandServices,
): Promise<void> {
  if (message.author.bot) return;

  const clientUser = services.client.user;
  if (!clientUser) return;

  // Direct @mention only: skip @everyone / @role / reply pings so the bot
  // does not answer every broad mention.
  const mentioned = message.mentions.has(clientUser, {
    ignoreEveryone: true,
    ignoreRoles: true,
    ignoreRepliedUser: true,
  });
  if (!mentioned) return;

  const embed = EmbedService.createInfoEmbed(
    'Hey there!',
    'Thanks for the ping! Use `/commands` to see everything I can do.',
  );

  await message.reply({ embeds: [embed] });
}
