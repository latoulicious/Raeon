import { Message } from 'discord.js';

export interface MessageCommandServices {}

export async function handleMessage(
  message: Message,
  services: MessageCommandServices,
): Promise<void> {
  if (message.author.bot) return;
  
}
