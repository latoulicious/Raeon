export interface PingResponse {
  message: string;
  timestamp: number;
}

export class PingService {
  ping(): PingResponse {
    return {
      message: 'Pong!',
      timestamp: Date.now(),
    };
  }
}
