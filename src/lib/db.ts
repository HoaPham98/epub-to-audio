import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { EpubBook } from '@/types';

interface EpubToAudioDB extends DBSchema {
  'audio-cache': {
    key: string;
    value: {
      key: string;
      blob: Blob;
      timestamp: number;
      duration?: number;
    };
    indexes: { 'by-timestamp': number };
  };
  'books': {
    key: string;
    value: EpubBook;
  };
}

const DB_NAME = 'epub_to_audio_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<EpubToAudioDB>> | null = null;

function getDB() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<EpubToAudioDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('audio-cache')) {
          const store = db.createObjectStore('audio-cache', { keyPath: 'key' });
          store.createIndex('by-timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export function buildAudioCacheKey(
  bookId: string,
  chapterIndex: number,
  chunkIndex: number,
  model: string,
  voice: string,
  speed: number,
  responseFormat?: string
): string {
  // Hash or join attributes to form a unique key
  return `${bookId}_c${chapterIndex}_k${chunkIndex}_${model}_${voice}_${responseFormat || 'wav'}_${speed.toFixed(2)}`;
}

export async function getCachedAudio(key: string): Promise<Blob | null> {
  const db = await getDB();
  if (!db) return null;
  try {
    const item = await db.get('audio-cache', key);
    return item ? item.blob : null;
  } catch (error) {
    console.error('Lỗi khi đọc cache audio từ IndexedDB:', error);
    return null;
  }
}

export async function setCachedAudio(key: string, blob: Blob, duration?: number): Promise<void> {
  const db = await getDB();
  if (!db) return;
  try {
    await db.put('audio-cache', {
      key,
      blob,
      timestamp: Date.now(),
      duration,
    });
  } catch (error) {
    console.error('Lỗi khi lưu cache audio vào IndexedDB:', error);
  }
}

export async function clearAllAudioCache(): Promise<void> {
  const db = await getDB();
  if (!db) return;
  try {
    await db.clear('audio-cache');
  } catch (error) {
    console.error('Lỗi khi xóa cache audio:', error);
  }
}

export async function getCacheStats(): Promise<{ count: number; estimatedSizeMB: number }> {
  const db = await getDB();
  if (!db) return { count: 0, estimatedSizeMB: 0 };
  try {
    const all = await db.getAll('audio-cache');
    let totalBytes = 0;
    all.forEach(item => {
      totalBytes += item.blob?.size || 0;
    });
    return {
      count: all.length,
      estimatedSizeMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    };
  } catch {
    return { count: 0, estimatedSizeMB: 0 };
  }
}

export async function saveCurrentBook(book: EpubBook): Promise<void> {
  const db = await getDB();
  if (!db) return;
  try {
    // Keep only the most recent book to save storage space
    const tx = db.transaction('books', 'readwrite');
    await tx.store.clear();
    await tx.store.put(book);
    await tx.done;
  } catch (error) {
    console.error('Lỗi khi lưu sách vào IndexedDB:', error);
  }
}

export async function getSavedBook(): Promise<EpubBook | null> {
  const db = await getDB();
  if (!db) return null;
  try {
    const books = await db.getAll('books');
    return books.length > 0 ? books[0] : null;
  } catch {
    return null;
  }
}
