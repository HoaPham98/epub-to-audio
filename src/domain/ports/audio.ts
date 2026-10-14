export interface ChunkMeta {
  chapterIndex: number;
  chunkIndex: number;
}

export interface IAudioStreamPlayer {
  init(): Promise<void>;
  queuePcmChunk(pcmBuffer: ArrayBuffer, sampleRate?: number, meta?: ChunkMeta): void;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  setSpeed(speed: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getRemainingBufferedTime(): number;
  isPlaying(): boolean;
  clearQueue(): void;
  playCachedBlob(blob: Blob, speed?: number, append?: boolean, meta?: ChunkMeta): Promise<void>;
  onTimeUpdate(callback: (currentTime: number) => void): () => void;
  onChunkChange(callback: (chapterIndex: number, chunkIndex: number) => void): () => void;
  onEnded(callback: () => void): () => void;
  onError(callback: (err: Error) => void): () => void;
}
