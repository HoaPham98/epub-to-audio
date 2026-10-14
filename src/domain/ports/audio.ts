export interface ChunkMeta {
  chapterIndex: number;
  chunkIndex: number;
}

export interface IAudioStreamPlayer {
  init(): Promise<void>;
  queuePcmChunk(pcmBuffer: ArrayBuffer, sampleRate?: number, meta?: ChunkMeta): void;
  play(): Promise<void>;
  pause(): Promise<void> | void;
  stop(): void;
  seek(seconds: number): void;
  setSpeed(speed: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getBufferedTime(): number;
  getRemainingBufferedTime(): number;
  isPlaying(): boolean;
  getPlayerState(): 'idle' | 'playing' | 'paused';
  clearQueue(): void;
  playCachedBlob(blob: Blob, speed?: number, append?: boolean, meta?: ChunkMeta): Promise<void>;
  setVolume?(volume: number): void;
  getAudioElement?(): HTMLAudioElement | null;
  ensureAudioElementPlaying?(): Promise<void>;
  getActiveChunkTime?(): number;
  getChunkDuration?(chapterIndex: number, chunkIndex: number): number | undefined;
  onPlaybackStateChange?(callback: (state: 'idle' | 'playing' | 'paused') => void): () => void;
  onTimeUpdate(callback: (currentTime: number) => void): () => void;
  onChunkChange(callback: (chapterIndex: number, chunkIndex: number) => void): () => void;
  onEnded(callback: () => void): () => void;
  onError(callback: (err: Error) => void): () => void;
}

export function estimateSpeechDuration(charCount: number, charsPerSecond = 16): number {
  return Math.max(1, charCount / charsPerSecond);
}
