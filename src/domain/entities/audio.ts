export type ChunkStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'error';

export interface AudioTrack {
  id: string;
  bookId: string;
  chapterIndex: number;
  chunkIndex: number;
  duration?: number;
  blob?: Blob;
}

export interface AudioChunk {
  pcmBuffer: ArrayBuffer;
  sampleRate: number;
  channels: number;
  isLast?: boolean;
}

export interface AudioCacheItem {
  key: string;
  blob: Blob;
  duration?: number;
  timestamp: number;
}

export interface PlaybackProgress {
  chapterIndex: number;
  chunkIndex: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLoading: boolean;
  autoNext: boolean;
  chunkStatuses: Record<number, ChunkStatus>;
  errorMessage: string | null;
}
