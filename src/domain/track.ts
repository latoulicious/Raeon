export interface Track {
  /** Base64 track blob Lavalink plays back */
  encoded: string;
  title: string;
  author: string;
  /** Duration in milliseconds */
  duration: number;
  uri: string;
}

/** Outcome of resolving a URL or search identifier against Lavalink. */
export type ResolveResult =
  | { kind: 'track'; track: Track }
  | { kind: 'playlist'; track: Track; playlistName: string; totalTracks: number }
  | { kind: 'search'; tracks: Track[] }
  | { kind: 'empty' };
