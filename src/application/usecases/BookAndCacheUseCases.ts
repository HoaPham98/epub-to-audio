import { EpubBook, IAudioCacheRepository, IBookRepository } from '@/domain';
import { EpubParserAdapter, IndexedDBAudioCache, IndexedDBBookRepository } from '@/infrastructure';

export class ParseAndLoadBookUseCase {
  constructor(
    private readonly bookRepo: IBookRepository = new IndexedDBBookRepository(),
    private readonly parser: EpubParserAdapter = new EpubParserAdapter()
  ) {}

  async execute(file: File | Blob, fileName?: string): Promise<EpubBook> {
    const book = await this.parser.parse(file, fileName);
    await this.bookRepo.saveBook(book);
    return book;
  }
}

export class ManageAudioCacheUseCase {
  constructor(
    private readonly cacheRepo: IAudioCacheRepository = new IndexedDBAudioCache()
  ) {}

  async getStats(): Promise<{ count: number; estimatedSizeMB: number }> {
    return this.cacheRepo.getStats();
  }

  async clear(): Promise<void> {
    return this.cacheRepo.clear();
  }

  async get(key: string): Promise<Blob | null> {
    return this.cacheRepo.get(key);
  }
}
