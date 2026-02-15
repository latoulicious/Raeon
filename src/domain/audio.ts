import { Readable } from 'node:stream';

export interface AudioExtractor {
  stream(url: string, signal: AbortSignal): Readable;
}

export interface AudioEncoder {
  encode(input: Readable, signal: AbortSignal): Readable;
}

export interface VoiceGateway {
  join(guildId: string, channelId: string): Promise<void>;
  play(stream: Readable): Promise<void>;
  disconnect(guildId: string): Promise<void>;
}
