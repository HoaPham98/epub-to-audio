export interface TextChunk {
  id: string;
  index: number;
  text: string;
  charCount: number;
}

export interface EpubChapter {
  id: string;
  index: number;
  title: string;
  href: string;
  contentHtml: string;
  rawText: string;
  chunks: TextChunk[];
}

export interface EpubBook {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  chapters: EpubChapter[];
  totalChunks: number;
  fileName: string;
  fileSize: number;
  uploadedAt: number;
}

export interface TTSSettings {
  endpoint: string;
  apiKey: string;
  model: string;
  voice: string;
  responseFormat: string;
  speed: number;
  useProxy: boolean;
}

export interface AudioCacheItem {
  key: string;
  blob: Blob;
  duration?: number;
  timestamp: number;
}

export type ChunkStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'error';
