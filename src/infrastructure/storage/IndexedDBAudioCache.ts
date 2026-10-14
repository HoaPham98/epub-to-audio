import { IAudioCacheRepository } from '@/domain';
import { getDatabase } from './dbConnection';

export class IndexedDBAudioCache implements IAudioCacheRepository {
  buildKey(
    bookId: string,
    chapterIndex: number,
    chunkIndex: number,
    model: string,
    voice: string,
    speed: number,
    format = 'wav'
  ): string {
    return `${bookId}_c${chapterIndex}_k${chunkIndex}_${model}_${voice}_${format}_${speed.toFixed(2)}`;
  }

  async get(key: string): Promise<Blob | null> {
    const db = await getDatabase();
    if (!db) return null;
    try {
      const item = await db.get('audio-cache', key);
      return item ? item.blob : null;
    } catch (error) {
      console.error('Lỗi khi đọc cache audio từ IndexedDB:', error);
      return null;
    }
  }

  async set(key: string, blob: Blob, duration?: number): Promise<void> {
    const db = await getDatabase();
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

  async clear(): Promise<void> {
    const db = await getDatabase();
    if (!db) return;
    try {
      await db.clear('audio-cache');
    } catch (error) {
      console.error('Lỗi khi xóa cache audio:', error);
    }
  }

  async getStats(): Promise<{ count: number; estimatedSizeMB: number }> {
    const db = await getDatabase();
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
}
