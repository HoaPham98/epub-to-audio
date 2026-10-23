import 'dart:io';
import 'dart:typed_data';
import 'package:epub_to_audio/domain/domain.dart';
import 'package:epub_to_audio/infrastructure/storage/audio_cache_repository_io.dart';
import 'package:epub_to_audio/infrastructure/storage/book_repository_io.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;
  late AudioCacheRepository audioCache;
  late BookRepository bookRepo;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    tempDir = await Directory.systemTemp.createTemp('epub_storage_test_');
    audioCache = AudioCacheRepository(
      customDirectory: Directory('${tempDir.path}/audio_cache'),
    );
    bookRepo = BookRepository(
      customDirectory: Directory('${tempDir.path}/books'),
    );
  });

  tearDown(() async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('AudioCacheRepository (Native IO)', () {
    test('buildKey excludes speed to allow dynamic runtime speed scaling', () {
      final key1 = audioCache.buildKey(
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 0,
        voice: 'Mai Anh',
        model: 'turbo',
        sampleRate: 24000,
      );

      final key2 = audioCache.buildKey(
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 0,
        voice: 'Mai Anh',
        model: 'turbo',
        sampleRate: 24000,
      );

      expect(key1, equals(key2));
      expect(key1.contains('1.0'), isFalse);
      expect(key1.contains('1.5'), isFalse);
    });

    test('puts, retrieves, and checks size of cached audio chunks', () async {
      final chunkBytes = Uint8List.fromList([1, 2, 3, 4, 5]);
      final item = AudioCacheItem(
        key: 'b1-0-0-mai_anh-turbo-24000',
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 0,
        bytes: chunkBytes,
        duration: 2.5,
        timestamp: DateTime.now().millisecondsSinceEpoch,
        lastAccessedAt: DateTime.now().millisecondsSinceEpoch,
      );

      await audioCache.putAudioChunk(item);

      final retrieved = await audioCache.getAudioChunk(item.key);
      expect(retrieved, isNotNull);
      expect(retrieved!.bytes, equals(chunkBytes));
      expect(retrieved.duration, equals(2.5));

      final totalSize = await audioCache.getTotalCacheSizeBytes();
      expect(totalSize, equals(5));

      final bookItems = await audioCache.listItemsForBook('b1');
      expect(bookItems.length, equals(1));
    });

    test('deleting a book or clearing cache removes discrete files from disk',
        () async {
      final item1 = AudioCacheItem(
        key: 'bookA-0-0-v-m-24000',
        bookId: 'bookA',
        chapterIndex: 0,
        chunkIndex: 0,
        bytes: Uint8List(100),
        timestamp: 1000,
        lastAccessedAt: 1000,
      );
      final item2 = AudioCacheItem(
        key: 'bookB-0-0-v-m-24000',
        bookId: 'bookB',
        chapterIndex: 0,
        chunkIndex: 0,
        bytes: Uint8List(200),
        timestamp: 1000,
        lastAccessedAt: 1000,
      );

      await audioCache.putAudioChunk(item1);
      await audioCache.putAudioChunk(item2);

      expect(await audioCache.getTotalCacheSizeBytes(), equals(300));

      await audioCache.clearBookCache('bookA');
      expect(await audioCache.getTotalCacheSizeBytes(), equals(200));
      expect(await audioCache.getAudioChunk(item1.key), isNull);
      expect(await audioCache.getAudioChunk(item2.key), isNotNull);

      await audioCache.clearAllCache();
      expect(await audioCache.getTotalCacheSizeBytes(), equals(0));
      expect(await audioCache.getAudioChunk(item2.key), isNull);
    });

    test('enforces sliding TTL (7 days) and LRU quota eviction', () async {
      final now = DateTime.now().millisecondsSinceEpoch;
      final eightDaysAgo =
          DateTime.now().subtract(const Duration(days: 8)).millisecondsSinceEpoch;

      // Item 1: Expired (8 days old)
      final expiredItem = AudioCacheItem(
        key: 'expired',
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 0,
        bytes: Uint8List(50),
        timestamp: eightDaysAgo,
        lastAccessedAt: eightDaysAgo,
      );

      // Item 2: Older accessed (1 hour ago)
      final olderItem = AudioCacheItem(
        key: 'older',
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 1,
        bytes: Uint8List(60),
        timestamp: now - 3600000,
        lastAccessedAt: now - 3600000,
      );

      // Item 3: Recently accessed (now)
      final recentItem = AudioCacheItem(
        key: 'recent',
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 2,
        bytes: Uint8List(60),
        timestamp: now,
        lastAccessedAt: now,
      );

      await audioCache.putAudioChunk(expiredItem);
      await audioCache.putAudioChunk(olderItem);
      await audioCache.putAudioChunk(recentItem);

      expect(await audioCache.getTotalCacheSizeBytes(), equals(170));

      // Cleanup with max 7 days TTL and max 80 bytes quota
      final purged = await audioCache.cleanupLruAndTtl(
        maxSizeBytes: 80,
        maxAge: const Duration(days: 7),
      );

      // expired (50B) was purged by TTL.
      // Remaining: older (60B) + recent (60B) = 120B > 80B quota.
      // LRU must evict older (60B) leaving recent (60B <= 80B).
      // Total purged = 2 items!
      expect(purged, equals(2));
      expect(await audioCache.getAudioChunk('expired'), isNull);
      expect(await audioCache.getAudioChunk('older'), isNull);
      expect(await audioCache.getAudioChunk('recent'), isNotNull);
      expect(await audioCache.getTotalCacheSizeBytes(), equals(60));
    });
  });

  group('BookRepository (Native IO)', () {
    test('saves, retrieves, lists, and deletes books', () async {
      final book = EpubBook(
        id: 'book-123',
        title: 'Truyện Kiều',
        author: 'Nguyễn Du',
        chapters: const [
          EpubChapter(
            id: 'c1',
            index: 0,
            title: 'Chương 1',
            href: 'ch1.html',
            contentHtml: '<p>Trăm năm trong cõi người ta</p>',
            rawText: 'Trăm năm trong cõi người ta',
            chunks: [],
          ),
        ],
        totalChunks: 1,
        fileName: 'kieu.epub',
        fileSize: 50000,
        uploadedAt: DateTime.now().millisecondsSinceEpoch,
      );

      await bookRepo.saveBook(book);

      final retrieved = await bookRepo.getBook('book-123');
      expect(retrieved, isNotNull);
      expect(retrieved!.title, equals('Truyện Kiều'));
      expect(retrieved.author, equals('Nguyễn Du'));

      final list = await bookRepo.getBooks();
      expect(list.length, equals(1));

      await bookRepo.deleteBook('book-123');
      expect(await bookRepo.getBook('book-123'), isNull);
      expect((await bookRepo.getBooks()).isEmpty, isTrue);
    });

    test('saves and restores playback progress and TTS settings', () async {
      const settings = TTSSettings(
        voice: 'thuy_dung',
        speed: 1.25,
        threads: 6,
      );
      await bookRepo.saveSettings(settings);

      final restoredSettings = await bookRepo.getSettings();
      expect(restoredSettings.voice, equals('thuy_dung'));
      expect(restoredSettings.speed, equals(1.25));
      expect(restoredSettings.threads, equals(6));

      const progress = PlaybackProgress(
        chapterIndex: 2,
        chunkIndex: 5,
        currentTime: 12.4,
        duration: 30.0,
        isPlaying: false,
        isLoading: false,
        autoNext: true,
        chunkStatuses: {5: ChunkStatus.ready},
      );
      await bookRepo.saveProgress('book-123', progress);

      final restoredProgress = await bookRepo.getLastProgress('book-123');
      expect(restoredProgress, isNotNull);
      expect(restoredProgress!.chapterIndex, equals(2));
      expect(restoredProgress.chunkIndex, equals(5));
      expect(restoredProgress.currentTime, equals(12.4));
      expect(restoredProgress.chunkStatuses[5], equals(ChunkStatus.ready));
    });
  });
}
