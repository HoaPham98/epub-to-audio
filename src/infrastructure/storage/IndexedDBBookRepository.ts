import { EpubBook, IBookRepository } from '@/domain';
import { getDatabase } from './dbConnection';

export class IndexedDBBookRepository implements IBookRepository {
  async saveBook(book: EpubBook): Promise<void> {
    const db = await getDatabase();
    if (!db) return;
    try {
      const tx = db.transaction('books', 'readwrite');
      await tx.store.clear();
      await tx.store.put(book);
      await tx.done;
    } catch (error) {
      console.error('Lỗi khi lưu sách vào IndexedDB:', error);
    }
  }

  async getSavedBook(): Promise<EpubBook | null> {
    const db = await getDatabase();
    if (!db) return null;
    try {
      const books = await db.getAll('books');
      return books.length > 0 ? books[0] : null;
    } catch {
      return null;
    }
  }
}
