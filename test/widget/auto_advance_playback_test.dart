import 'dart:async';
import 'dart:typed_data';
import 'package:epub_to_audio/domain/domain.dart';
import 'package:epub_to_audio/presentation/screens/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class MockAudioPlayer implements IAudioStreamPlayer {
  final _progressCtrl = StreamController<PlaybackProgress>.broadcast();
  bool isPlaying = false;
  double currentTime = 0.0;
  double duration = 0.0;
  int currentChapterIndex = 0;
  int currentChunkIndex = 0;
  final Map<int, ChunkStatus> statuses = {};
  final List<({int chapterIndex, int chunkIndex})> playedChunks = [];

  void emitProgress(PlaybackProgress p) {
    _progressCtrl.add(p);
  }

  @override
  PlaybackProgress get currentProgress => PlaybackProgress(
        chapterIndex: currentChapterIndex,
        chunkIndex: currentChunkIndex,
        currentTime: currentTime,
        duration: duration,
        isPlaying: isPlaying,
        isLoading: false,
        autoNext: true,
        chunkStatuses: statuses,
      );

  @override
  Stream<PlaybackProgress> get progressStream => _progressCtrl.stream;

  @override
  Future<void> clearQueue() async {}

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
    playedChunks.add((chapterIndex: chapterIndex, chunkIndex: chunkIndex));
  }

  @override
  Future<void> seek(double seconds) async {
    currentTime = seconds;
  }

  @override
  Future<void> setChunkStatus(int chapterIndex, int chunkIndex, ChunkStatus status) async {
    statuses[chunkIndex] = status;
  }

  @override
  Future<void> setSpeed(double speed) async {}

  @override
  Future<void> setVolume(double volume) async {}

  @override
  Future<void> stop() async {
    isPlaying = false;
    currentTime = 0.0;
  }

  @override
  Future<void> updateMetadata({
    required String title,
    required String author,
    String? coverUrl,
    required String chapterTitle,
  }) async {}
}

class MockBookRepo implements IBookRepository {
  final EpubBook book;
  TTSSettings settings = const TTSSettings();
  PlaybackProgress? savedProgress;

  MockBookRepo(this.book);

  @override
  Future<void> deleteBook(String id) async {}

  @override
  Future<EpubBook?> getBook(String id) async => book;

  @override
  Future<List<EpubBook>> getBooks() async => [book];

  @override
  Future<PlaybackProgress?> getLastProgress(String bookId) async => savedProgress;

  @override
  Future<TTSSettings> getSettings() async => settings;

  @override
  Future<void> saveBook(EpubBook book) async {}

  @override
  Future<void> saveProgress(String bookId, PlaybackProgress progress) async {
    savedProgress = progress;
  }

  @override
  Future<void> saveSettings(TTSSettings settings) async {
    this.settings = settings;
  }
}

class MockCacheRepo implements IAudioCacheRepository {
  final Map<String, AudioCacheItem> cache = {};

  @override
  String buildKey({
    required String bookId,
    required int chapterIndex,
    required int chunkIndex,
    required String voice,
    required String model,
    required int sampleRate,
  }) => '$bookId-$chapterIndex-$chunkIndex';

  @override
  Future<void> clearAllCache() async => cache.clear();

  @override
  Future<void> clearBookCache(String bookId) async => cache.clear();

  @override
  Future<int> cleanupLruAndTtl({required int maxSizeBytes, required Duration maxAge}) async => 0;

  @override
  Future<void> deleteAudioChunk(String key) async => cache.remove(key);

  @override
  Future<AudioCacheItem?> getAudioChunk(String key) async => cache[key];

  @override
  Future<int> getTotalCacheSizeBytes() async => 0;

  @override
  Future<List<AudioCacheItem>> listItemsForBook(String bookId) async => cache.values.toList();

  @override
  Future<void> putAudioChunk(AudioCacheItem item) async => cache[item.key] = item;
}

class MockTTSService implements ITTSStreamingService {
  @override
  Future<Uint8List> fetchAudioBytes(String text, TTSSettings settings) async {
    return Uint8List(4800);
  }

  @override
  Future<List<ModelOption>> fetchModels(String endpoint, String apiKey,
      {bool useCorsProxy = false, String corsProxyUrl = ''}) async => [];

  @override
  Future<List<VoiceOption>> fetchVoices(String endpoint, String apiKey,
      {bool useCorsProxy = false, String corsProxyUrl = ''}) async => [];

  @override
  Future<({bool success, String message})> testConnection(
    TTSSettings settings,
  ) async => (success: true, message: 'Connected');

  @override
  Stream<AudioChunk> streamSpeech(String text, TTSSettings settings,
      {void Function()? onCancel}) async* {
    yield AudioChunk(
      pcmBuffer: Uint8List(4800),
      sampleRate: 24000,
      channels: 1,
      isLast: true,
    );
  }
}

void main() {
  const testBook = EpubBook(
    id: 'test-book-1',
    title: 'Test Book',
    author: 'Author',
    chapters: [
      EpubChapter(
        id: 'c0',
        index: 0,
        title: 'Chương 1',
        href: '1.html',
        contentHtml: '<p>c1</p>',
        rawText: 'c1',
        chunks: [
          TextChunk(id: 'c0-0', index: 0, text: 'Đoạn một', charCount: 8),
          TextChunk(id: 'c0-1', index: 1, text: 'Đoạn hai', charCount: 8),
        ],
      ),
      EpubChapter(
        id: 'c1',
        index: 1,
        title: 'Chương 2',
        href: '2.html',
        contentHtml: '<p>c2</p>',
        rawText: 'c2',
        chunks: [
          TextChunk(id: 'c1-0', index: 0, text: 'Đoạn chương hai', charCount: 15),
        ],
      ),
    ],
    totalChunks: 3,
    fileName: 'test.epub',
    fileSize: 100,
    uploadedAt: 0,
  );

  testWidgets('HomeScreen automatically advances to next chunk when chunk finishes with autoNext enabled',
      (tester) async {
    final mockPlayer = MockAudioPlayer();
    final mockBookRepo = MockBookRepo(testBook);
    final mockCacheRepo = MockCacheRepo();
    final mockTts = MockTTSService();

    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(
          bookRepository: mockBookRepo,
          cacheRepository: mockCacheRepo,
          audioPlayer: mockPlayer,
          ttsService: mockTts,
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Tap play button to play chunk 0
    await tester.tap(find.byTooltip('Phát'));
    await tester.pumpAndSettle();

    expect(mockPlayer.playedChunks, contains((chapterIndex: 0, chunkIndex: 0)));

    // Emit playing progress for chunk 0
    mockPlayer.emitProgress(const PlaybackProgress(
      chapterIndex: 0,
      chunkIndex: 0,
      currentTime: 1.0,
      duration: 3.0,
      isPlaying: true,
      isLoading: false,
      autoNext: true,
      chunkStatuses: {},
    ));
    await tester.pumpAndSettle();

    // Now chunk 0 completes: isPlaying becomes false at duration
    mockPlayer.emitProgress(const PlaybackProgress(
      chapterIndex: 0,
      chunkIndex: 0,
      currentTime: 3.0,
      duration: 3.0,
      isPlaying: false,
      isLoading: false,
      autoNext: true,
      chunkStatuses: {},
    ));
    await tester.pumpAndSettle();

    // Verify chunk 1 was automatically queued and played!
    expect(mockPlayer.playedChunks, contains((chapterIndex: 0, chunkIndex: 1)));
  });
}
