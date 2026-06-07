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
  /** `track` is the linked/selected video; `tracks` is the whole list. */
  | { kind: 'playlist'; track: Track; tracks: Track[]; playlistName: string }
  | { kind: 'search'; tracks: Track[] }
  | { kind: 'empty' };
