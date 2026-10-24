import 'dart:async';
import 'dart:typed_data';
import 'package:epub_to_audio/application/application.dart';
import 'package:epub_to_audio/domain/domain.dart';
import 'package:flutter_test/flutter_test.dart';

// --- FAKES / MOCKS ---

class FakeBookRepository implements IBookRepository {
  final Map<String, EpubBook> books = {};
  PlaybackProgress? lastProgress;
  TTSSettings settings = const TTSSettings();

  @override
  Future<void> deleteBook(String id) async => books.remove(id);

  @override
  Future<EpubBook?> getBook(String id) async => books[id];

  @override
  Future<List<EpubBook>> getBooks() async => books.values.toList();

  @override
  Future<PlaybackProgress?> getLastProgress(String bookId) async =>
      lastProgress;

  @override
  Future<TTSSettings> getSettings() async => settings;

  @override
  Future<void> saveBook(EpubBook book) async => books[book.id] = book;

  @override
  Future<void> saveProgress(
          String bookId, PlaybackProgress progress) async =>
      lastProgress = progress;

  @override
  Future<void> saveSettings(TTSSettings settings) async =>
      this.settings = settings;
}

class FakeEpubParser implements IEpubParser {
  @override
  Future<EpubBook> parse(Uint8List bytes, {String? fileName}) async {
    return EpubBook(
      id: 'test-book-1',
      title: 'Sample Test Book',
      author: 'Author Name',
      chapters: [
        const EpubChapter(
          id: 'ch-0',
          index: 0,
          title: 'Chương 1',
          href: 'ch1.html',
          contentHtml: '<p>Content</p>',
          rawText: 'Content',
          chunks: [
            TextChunk(
              id: 'ch-0-ck-0',
              index: 0,
              text: 'Câu mở đầu chương 1 rất hay.',
              charCount: 28,
              isParagraphEnd: true,
            ),
          ],
        )
      ],
      totalChunks: 1,
      fileName: fileName ?? 'sample.epub',
      fileSize: bytes.length,
      uploadedAt: 12345678,
    );
  }
}

class FakeAudioCacheRepository implements IAudioCacheRepository {
  final Map<String, AudioCacheItem> storage = {};

  @override
  String buildKey({
    required String bookId,
    required int chapterIndex,
    required int chunkIndex,
    required String voice,
    required String model,
    required int sampleRate,
  }) {
    return '$bookId-$chapterIndex-$chunkIndex-$voice-$model-$sampleRate';
  }

  @override
  Future<void> clearAllCache() async => storage.clear();

  @override
  Future<void> clearBookCache(String bookId) async {
    storage.removeWhere((_, item) => item.bookId == bookId);
  }

  @override
  Future<int> cleanupLruAndTtl({
    required int maxSizeBytes,
    required Duration maxAge,
  }) async {
    final initialCount = storage.length;
    final cutoff =
        DateTime.now().subtract(maxAge).millisecondsSinceEpoch;
    storage.removeWhere((_, item) => item.lastAccessedAt < cutoff);
    return initialCount - storage.length;
  }

  @override
  Future<void> deleteAudioChunk(String key) async => storage.remove(key);

  @override
  Future<AudioCacheItem?> getAudioChunk(String key) async => storage[key];

  @override
  Future<int> getTotalCacheSizeBytes() async {
    return storage.values.fold<int>(0, (sum, i) => sum + i.bytes.length);
  }

  @override
  Future<List<AudioCacheItem>> listItemsForBook(String bookId) async {
    return storage.values.where((i) => i.bookId == bookId).toList();
  }

  @override
  Future<void> putAudioChunk(AudioCacheItem item) async {
    storage[item.key] = item;
  }
}

class FakeAudioStreamPlayer implements IAudioStreamPlayer {
  final List<Uint8List> queuedChunks = [];
  final Map<int, ChunkStatus> statuses = {};
  bool isPlaying = false;
  bool isStopped = false;

  final _progressCtrl = StreamController<PlaybackProgress>.broadcast();

  @override
  PlaybackProgress get currentProgress => PlaybackProgress(
        chapterIndex: 0,
        chunkIndex: 0,
        currentTime: 0.0,
        duration: 10.0,
        isPlaying: isPlaying,
        isLoading: false,
        autoNext: true,
        chunkStatuses: statuses,
      );

  @override
  Stream<PlaybackProgress> get progressStream => _progressCtrl.stream;

  @override
  Future<void> clearQueue() async {
    queuedChunks.clear();
  }

  @override
  Future<void> dispose() async {
    await _progressCtrl.close();
  }

  @override
  Future<void> pause() async {
    isPlaying = false;
  }

  @override
  Future<void> play() async {
    isPlaying = true;
  }

  @override
  Future<void> queueAudioChunk(
    int chapterIndex,
    int chunkIndex,
    Uint8List audioBytes, {
    bool isLastChunk = false,
    ChunkMeta? meta,
    int? sampleRate,
  }) async {
    queuedChunks.add(audioBytes);
  }

  @override
  Future<void> seek(double seconds) async {}

  @override
  Future<void> setChunkStatus(
      int chapterIndex, int chunkIndex, ChunkStatus status) async {
    statuses[chunkIndex] = status;
  }

  @override
  Future<void> setSpeed(double speed) async {}

  @override
  Future<void> setVolume(double volume) async {}

  @override
  Future<void> stop() async {
    isPlaying = false;
    isStopped = true;
  }

  @override
  Future<void> updateMetadata({
    required String title,
    required String author,
    String? coverUrl,
    required String chapterTitle,
  }) async {}
}

class FakeTTSStreamingService implements ITTSStreamingService {
  int streamCalls = 0;
  int fetchCalls = 0;

  @override
  Stream<AudioChunk> streamSpeech(
    String text,
    TTSSettings settings, {
    void Function()? onCancel,
  }) async* {
    streamCalls++;
    yield AudioChunk(
      pcmBuffer: Uint8List.fromList([0, 1, 2, 3]),
      sampleRate: settings.sampleRate,
      channels: settings.channels,
    );
    yield AudioChunk(
      pcmBuffer: Uint8List.fromList([4, 5, 6, 7]),
      sampleRate: settings.sampleRate,
      channels: settings.channels,
      isLast: true,
    );
  }

  @override
  Future<Uint8List> fetchAudioBytes(
      String text, TTSSettings settings) async {
    fetchCalls++;
    return Uint8List.fromList([10, 20, 30, 40]);
  }

  @override
  Future<List<ModelOption>> fetchModels(
          String endpoint, String apiKey) async =>
      const [ModelOption(id: 'model-1', name: 'Model 1')];

  @override
  Future<List<VoiceOption>> fetchVoices(
          String endpoint, String apiKey) async =>
      const [VoiceOption(id: 'mai_anh', name: 'Mai Anh')];

  @override
  Future<({String message, bool success})> testConnection(
          TTSSettings settings) async =>
      (success: true, message: 'Connected');
}

class FakeOfflineModelManager implements IOfflineModelManager {
  bool modelDownloaded = false;
  bool dictDownloaded = false;
  bool engineInit = false;

  @override
  Future<void> deleteModelFiles() async {
    modelDownloaded = false;
    dictDownloaded = false;
  }

  @override
  Future<void> disposeEngine() async {
    engineInit = false;
  }

  @override
  Stream<ModelDownloadProgress> downloadDictionary({
    String? customUrl,
    void Function()? onCancel,
  }) async* {
    yield const ModelDownloadProgress(
      fileName: 'sea_g2p.bin',
      progress: 0.5,
      bytesDownloaded: 30000000,
      totalBytes: 60000000,
    );
    dictDownloaded = true;
    yield const ModelDownloadProgress(
      fileName: 'sea_g2p.bin',
      progress: 1.0,
      bytesDownloaded: 60000000,
      totalBytes: 60000000,
      isCompleted: true,
    );
  }

  @override
  Stream<ModelDownloadProgress> downloadModel({
    String? customUrl,
    void Function()? onCancel,
  }) async* {
    yield const ModelDownloadProgress(
      fileName: 'model.gguf',
      progress: 0.5,
      bytesDownloaded: 90000000,
      totalBytes: 180000000,
    );
    modelDownloaded = true;
    yield const ModelDownloadProgress(
      fileName: 'model.gguf',
      progress: 1.0,
      bytesDownloaded: 180000000,
      totalBytes: 180000000,
      isCompleted: true,
    );
  }

  @override
  Future<String> getDictionaryPath() async => '/mock/sea_g2p.bin';

  @override
  Future<String> getModelPath() async => '/mock/model.gguf';

  @override
  Future<void> initializeEngine({int threads = 4}) async {
    engineInit = true;
  }

  @override
  Future<bool> isDictionaryDownloaded() async => dictDownloaded;

  @override
  Future<bool> isEngineInitialized() async => engineInit;

  @override
  Future<bool> isModelDownloaded() async => modelDownloaded;
}

// --- TESTS ---

void main() {
  group('ParseAndLoadBookUseCase', () {
    test('parses file bytes, saves book to repository, and returns book',
        () async {
      final bookRepo = FakeBookRepository();
      final parser = FakeEpubParser();
      final useCase = ParseAndLoadBookUseCase(
        bookRepo: bookRepo,
        parser: parser,
      );

      final dummyBytes = Uint8List.fromList([1, 2, 3, 4]);
      final book = await useCase.execute(dummyBytes, fileName: 'demo.epub');

      expect(book.id, equals('test-book-1'));
      expect(book.title, equals('Sample Test Book'));
      expect(bookRepo.books.containsKey('test-book-1'), isTrue);
    });
  });

  group('ManageAudioCacheUseCase', () {
    test('correctly handles CRUD and cleanup stats', () async {
      final cacheRepo = FakeAudioCacheRepository();
      final useCase = ManageAudioCacheUseCase(cacheRepo: cacheRepo);

      expect(await useCase.getTotalSizeBytes(), equals(0));

      final item = AudioCacheItem(
        key: 'k1',
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 0,
        bytes: Uint8List.fromList([10, 20]),
        timestamp: DateTime.now().millisecondsSinceEpoch,
        lastAccessedAt: DateTime.now().millisecondsSinceEpoch,
      );

      await useCase.put(item);
      expect(await useCase.getTotalSizeBytes(), equals(2));
      expect(await useCase.get('k1'), isNotNull);

      await useCase.clearBook('b1');
      expect(await useCase.getTotalSizeBytes(), equals(0));
    });
  });

  group('StreamAndPlayChunkUseCase', () {
    test('plays from cache without invoking TTS stream if cached', () async {
      final audioPlayer = FakeAudioStreamPlayer();
      final audioCache = FakeAudioCacheRepository();
      final ttsService = FakeTTSStreamingService();
      final useCase = StreamAndPlayChunkUseCase(
        audioPlayer: audioPlayer,
        audioCache: audioCache,
      );

      const settings = TTSSettings(voice: 'mai_anh', model: 'turbo');
      final cacheKey = audioCache.buildKey(
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 0,
        voice: settings.voice,
        model: settings.model,
        sampleRate: settings.sampleRate,
      );

      // Pre-seed cache
      await audioCache.putAudioChunk(AudioCacheItem(
        key: cacheKey,
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 0,
        bytes: Uint8List.fromList([1, 2, 3, 4]),
        timestamp: 1000,
        lastAccessedAt: 1000,
      ));

      final result = await useCase.execute(StreamAndPlayParams(
        text: 'Hello world',
        settings: settings,
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 0,
        ttsService: ttsService,
      ));

      expect(result.fromCache, isTrue);
      expect(ttsService.streamCalls, equals(0));
      expect(audioPlayer.queuedChunks.length, equals(1));
      expect(audioPlayer.statuses[0], equals(ChunkStatus.ready));
    });

    test(
        'streams from TTS service on cache miss, enqueues PCM chunks, and saves WAV to cache',
        () async {
      final audioPlayer = FakeAudioStreamPlayer();
      final audioCache = FakeAudioCacheRepository();
      final ttsService = FakeTTSStreamingService();
      final useCase = StreamAndPlayChunkUseCase(
        audioPlayer: audioPlayer,
        audioCache: audioCache,
      );

      const settings = TTSSettings(voice: 'mai_anh', model: 'turbo');

      final result = await useCase.execute(StreamAndPlayParams(
        text: 'Hello world',
        settings: settings,
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 0,
        ttsService: ttsService,
      ));

      expect(result.fromCache, isFalse);
      expect(ttsService.streamCalls, equals(1));
      expect(audioPlayer.queuedChunks.length, equals(2));
      expect(isWavBytes(result.audioBytes!), isTrue);

      final cacheKey = audioCache.buildKey(
        bookId: 'b1',
        chapterIndex: 0,
        chunkIndex: 0,
        voice: settings.voice,
        model: settings.model,
        sampleRate: settings.sampleRate,
      );
      final cachedItem = await audioCache.getAudioChunk(cacheKey);
      expect(cachedItem, isNotNull);
      expect(isWavBytes(cachedItem!.bytes), isTrue);
    });
  });

  group('SlidingWindowPrefetchUseCase & Cross-Chapter Continuity', () {
    test(
        'prefetches 800-1200 chars ahead and transitions across chapter boundary',
        () async {
      final audioCache = FakeAudioCacheRepository();
      final audioPlayer = FakeAudioStreamPlayer();
      final ttsService = FakeTTSStreamingService();
      final prefetcher = SlidingWindowPrefetchUseCase(
        audioCache: audioCache,
        audioPlayer: audioPlayer,
      );

      // Chapter 0: 2 chunks of 300 chars each (total 600 chars)
      // Chapter 1: 3 chunks of 300 chars each (total 900 chars)
      final book = EpubBook(
        id: 'book-cross',
        title: 'Cross Chapter Book',
        author: 'Author',
        chapters: [
          EpubChapter(
            id: 'ch-0',
            index: 0,
            title: 'Ch 0',
            href: '0.html',
            contentHtml: '',
            rawText: '',
            chunks: List.generate(
              2,
              (i) => TextChunk(
                id: 'ch-0-ck-$i',
                index: i,
                text: 'A' * 300,
                charCount: 300,
              ),
            ),
          ),
          EpubChapter(
            id: 'ch-1',
            index: 1,
            title: 'Ch 1',
            href: '1.html',
            contentHtml: '',
            rawText: '',
            chunks: List.generate(
              3,
              (i) => TextChunk(
                id: 'ch-1-ck-$i',
                index: i,
                text: 'B' * 300,
                charCount: 300,
              ),
            ),
          ),
        ],
        totalChunks: 5,
        fileName: 'cross.epub',
        fileSize: 1000,
        uploadedAt: 0,
      );

      // Current playing: Chapter 0, Chunk 0 (which is 300 chars)
      // Prefetch window ahead: Chapter 0 Chunk 1 (300 chars) -> not enough for 800 chars
      // -> must transition into Chapter 1 Chunk 0 (300 chars) + Chapter 1 Chunk 1 (300 chars) = 900 chars total!
      final candidates = prefetcher.planPrefetchWindow(
        book: book,
        currentChapterIndex: 0,
        currentChunkIndex: 0,
        minChars: 800,
        maxChars: 1200,
      );

      expect(candidates.length, equals(3));
      expect(candidates[0].chapterIndex, equals(0));
      expect(candidates[0].chunkIndex, equals(1));
      expect(candidates[1].chapterIndex, equals(1));
      expect(candidates[1].chunkIndex, equals(0));
      expect(candidates[2].chapterIndex, equals(1));
      expect(candidates[2].chunkIndex, equals(1));

      // Execute prefetching
      const settings = TTSSettings();
      final count = await prefetcher.execute(
        book: book,
        currentChapterIndex: 0,
        currentChunkIndex: 0,
        settings: settings,
        ttsService: ttsService,
      );

      expect(count, equals(3));
      expect(ttsService.fetchCalls, equals(3));
    });
  });

  group('ManageOfflineModelUseCase', () {
    test('checks readiness, downloads model and dict, and initializes engine',
        () async {
      final modelMgr = FakeOfflineModelManager();
      final useCase = ManageOfflineModelUseCase(modelManager: modelMgr);

      expect(await useCase.isModelReady(), isFalse);
      expect(await useCase.areFilesDownloaded(), isFalse);

      final updates = await useCase.downloadAllFiles().toList();
      expect(updates.length, equals(4)); // 2 for model, 2 for dict
      expect(await useCase.areFilesDownloaded(), isTrue);

      await useCase.initializeEngine(threads: 4);
      expect(await useCase.isModelReady(), isTrue);
    });
  });
}
