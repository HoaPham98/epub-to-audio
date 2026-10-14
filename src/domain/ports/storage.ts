import { EpubBook } from '../entities';

export interface IAudioCacheRepository {
  buildKey(
    bookId: string,
    chapterIndex: number,
    chunkIndex: number,
    model: string,
    voice: string,
    speed: number,
    format?: string
  ): string;
  get(key: string): Promise<Blob | null>;
  set(key: string, blob: Blob, duration?: number): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<{ count: number; estimatedSizeMB: number }>;
}

export interface IBookRepository {
  saveBook(book: EpubBook): Promise<void>;
  getSavedBook(): Promise<EpubBook | null>;
}
