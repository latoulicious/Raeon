export interface Track {
  /** Base64 track blob Lavalink plays back */
  encoded: string;
  title: string;
  author: string;
  /** Duration in milliseconds */
  duration: number;
  uri: string;
}
