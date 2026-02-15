import { MessageReaction, User } from 'discord.js';

export interface ReactionCommandServices {}

export async function handleReaction(
  reaction: MessageReaction,
  user: User,
  services: ReactionCommandServices,
): Promise<void> {
  if (user.bot) return;
  
}
