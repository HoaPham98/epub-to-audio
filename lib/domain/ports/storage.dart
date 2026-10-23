import '../entities/audio.dart';
import '../entities/book.dart';
import '../entities/tts.dart';

abstract interface class IAudioCacheRepository {
  /// Builds a speed-independent cache key.
  /// Playback speed scaling is handled dynamically at runtime, so [speed] is excluded.
  String buildKey({
    required String bookId,
    required int chapterIndex,
    required int chunkIndex,
    required String voice,
    required String model,
    required int sampleRate,
  });

  Future<AudioCacheItem?> getAudioChunk(String key);

  Future<void> putAudioChunk(AudioCacheItem item);

  Future<void> deleteAudioChunk(String key);

  Future<void> clearBookCache(String bookId);

  Future<void> clearAllCache();

  Future<int> getTotalCacheSizeBytes();

  /// Enforces LRU quota and sliding TTL. Returns number of purged items.
  Future<int> cleanupLruAndTtl({
    required int maxSizeBytes,
    required Duration maxAge,
  });

  Future<List<AudioCacheItem>> listItemsForBook(String bookId);
}

abstract interface class IBookRepository {
  Future<List<EpubBook>> getBooks();

  Future<EpubBook?> getBook(String id);

  Future<void> saveBook(EpubBook book);

  Future<void> deleteBook(String id);

  Future<PlaybackProgress?> getLastProgress(String bookId);

  Future<void> saveProgress(String bookId, PlaybackProgress progress);

  Future<TTSSettings> getSettings();

  Future<void> saveSettings(TTSSettings settings);
}
