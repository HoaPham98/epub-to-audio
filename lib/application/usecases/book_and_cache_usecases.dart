import 'dart:typed_data';
import '../../domain/domain.dart';

class ParseAndLoadBookUseCase {
  final IBookRepository bookRepo;
  final IEpubParser parser;

  const ParseAndLoadBookUseCase({
    required this.bookRepo,
    required this.parser,
  });

  Future<EpubBook> execute(Uint8List fileBytes, {String? fileName}) async {
    final book = await parser.parse(fileBytes, fileName: fileName);
    await bookRepo.saveBook(book);
    return book;
  }
}

class ManageAudioCacheUseCase {
  final IAudioCacheRepository cacheRepo;

  const ManageAudioCacheUseCase({
    required this.cacheRepo,
  });

  Future<int> getTotalSizeBytes() => cacheRepo.getTotalCacheSizeBytes();

  Future<void> clearAll() => cacheRepo.clearAllCache();

  Future<void> clearBook(String bookId) => cacheRepo.clearBookCache(bookId);

  Future<AudioCacheItem?> get(String key) => cacheRepo.getAudioChunk(key);

  Future<void> put(AudioCacheItem item) => cacheRepo.putAudioChunk(item);

  Future<int> cleanup({
    int maxSizeBytes = 200 * 1024 * 1024, // 200 MB default
    Duration maxAge = const Duration(days: 7), // 7 days sliding TTL
  }) {
    return cacheRepo.cleanupLruAndTtl(
      maxSizeBytes: maxSizeBytes,
      maxAge: maxAge,
    );
  }

  Future<List<AudioCacheItem>> listBookItems(String bookId) {
    return cacheRepo.listItemsForBook(bookId);
  }
}
