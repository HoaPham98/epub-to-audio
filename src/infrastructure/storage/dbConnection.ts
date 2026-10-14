import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { EpubBook } from '@/domain';

export interface EpubToAudioDB extends DBSchema {
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

export function getDatabase(): Promise<IDBPDatabase<EpubToAudioDB>> | null {
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
