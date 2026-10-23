import 'dart:async';
import 'package:epub_to_audio/application/application.dart';
import 'package:epub_to_audio/domain/domain.dart';
import 'package:epub_to_audio/presentation/widgets/cache_modal.dart';
import 'package:epub_to_audio/presentation/widgets/desktop_shortcuts_wrapper.dart';
import 'package:epub_to_audio/presentation/widgets/offline_model_download_modal.dart';
import 'package:epub_to_audio/presentation/widgets/settings_modal.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeModelManager implements IOfflineModelManager {
  bool modelDownloaded = false;
  bool dictDownloaded = false;
  bool engineReady = false;
  bool deleted = false;

  @override
  Future<bool> isModelDownloaded() async => modelDownloaded;

  @override
  Future<bool> isDictionaryDownloaded() async => dictDownloaded;

  @override
  Future<bool> isEngineInitialized() async => engineReady;

  @override
  Future<String> getModelPath() async => '/path/to/model.gguf';

  @override
  Future<String> getDictionaryPath() async => '/path/to/sea_g2p.bin';

  @override
  Stream<ModelDownloadProgress> downloadModel({
    String? customUrl,
    void Function()? onCancel,
  }) async* {
    yield const ModelDownloadProgress(
      fileName: 'model.gguf',
      progress: 0.5,
      bytesDownloaded: 94 * 1024 * 1024,
      totalBytes: 188 * 1024 * 1024,
    );
    yield const ModelDownloadProgress(
      fileName: 'model.gguf',
      progress: 1.0,
      bytesDownloaded: 188 * 1024 * 1024,
      totalBytes: 188 * 1024 * 1024,
      isCompleted: true,
    );
    modelDownloaded = true;
  }

  @override
  Stream<ModelDownloadProgress> downloadDictionary({
    String? customUrl,
    void Function()? onCancel,
  }) async* {
    yield const ModelDownloadProgress(
      fileName: 'sea_g2p.bin',
      progress: 1.0,
      bytesDownloaded: 60 * 1024 * 1024,
      totalBytes: 60 * 1024 * 1024,
      isCompleted: true,
    );
    dictDownloaded = true;
  }

  @override
  Future<void> initializeEngine({int threads = 4}) async {
    engineReady = true;
  }

  @override
  Future<void> disposeEngine() async {
    engineReady = false;
  }

  @override
  Future<void> deleteModelFiles() async {
    modelDownloaded = false;
    dictDownloaded = false;
    engineReady = false;
    deleted = true;
  }
}

class FakeAudioCacheRepo implements IAudioCacheRepository {
  int totalBytes = 25 * 1024 * 1024;
  bool allCleared = false;
  bool bookCleared = false;
  int purgedCount = 0;

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
  Future<void> clearAllCache() async {
    allCleared = true;
    totalBytes = 0;
  }

  @override
  Future<void> clearBookCache(String bookId) async {
    bookCleared = true;
    totalBytes = 0;
  }

  @override
  Future<int> cleanupLruAndTtl({
    required int maxSizeBytes,
    required Duration maxAge,
  }) async {
    purgedCount = 3;
    totalBytes = 10 * 1024 * 1024;
    return purgedCount;
  }

  @override
  Future<void> deleteAudioChunk(String key) async {}

  @override
  Future<AudioCacheItem?> getAudioChunk(String key) async => null;

  @override
  Future<int> getTotalCacheSizeBytes() async => totalBytes;

  @override
  Future<List<AudioCacheItem>> listItemsForBook(String bookId) async {
    return [
      AudioCacheItem(
        key: 'k1',
        bookId: bookId,
        chapterIndex: 0,
        chunkIndex: 0,
        bytes: Uint8List(100),
        timestamp: DateTime.now().millisecondsSinceEpoch,
        lastAccessedAt: DateTime.now().millisecondsSinceEpoch,
      ),
    ];
  }

  @override
  Future<void> putAudioChunk(AudioCacheItem item) async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SettingsModal Widget Test', () {
    testWidgets('renders modal with dual-mode toggle and saves settings', (tester) async {
      TTSSettings? saved;

      const initialSettings = TTSSettings(
        ttsMode: TtsMode.offline,
        voice: 'minh_quan_pro',
        threads: 4,
        temperature: 0.7,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SettingsModal(
              settings: initialSettings,
              onSave: (updated) => saved = updated,
              onOpenModelDownload: () {},
            ),
          ),
        ),
      );

      expect(find.text('Cài đặt Giọng đọc & TTS'), findsOneWidget);

      // Verify offline mode and remote mode segments
      expect(find.text('Offline On-Device'), findsOneWidget);
      expect(find.text('Máy chủ từ xa (API)'), findsOneWidget);

      // Switch mode to Remote
      await tester.tap(find.text('Máy chủ từ xa (API)'));
      await tester.pumpAndSettle();

      // Tap Save
      await tester.tap(find.text('Lưu cài đặt'));
      await tester.pumpAndSettle();

      expect(saved, isNotNull);
      expect(saved!.ttsMode, equals(TtsMode.remote));
    });
  });

  group('OfflineModelDownloadModal Widget Test', () {
    testWidgets('shows download status and triggers download + initialization', (tester) async {
      final fakeManager = FakeModelManager();
      final useCase = ManageOfflineModelUseCase(modelManager: fakeManager);
      bool readyCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OfflineModelDownloadModal(
              modelUseCase: useCase,
              threads: 4,
              onReady: () => readyCalled = true,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Initially files not downloaded
      expect(find.text('VieNeu-TTS Model (model.gguf)'), findsOneWidget);
      expect(find.text('SEA-G2P Dict (sea_g2p.bin)'), findsOneWidget);
      expect(find.text('Tải xuống toàn bộ (~248 MB)'), findsOneWidget);

      // Trigger download
      await tester.tap(find.text('Tải xuống toàn bộ (~248 MB)'));
      await tester.pump();
      await tester.pumpAndSettle();

      expect(fakeManager.modelDownloaded, isTrue);
      expect(fakeManager.dictDownloaded, isTrue);
      expect(fakeManager.engineReady, isTrue);
      expect(readyCalled, isTrue);
      expect(find.text('Động cơ TTS ngoại tuyến đã sẵn sàng hoạt động (24 kHz Mono).'), findsOneWidget);
    });

    testWidgets('allows deleting files with confirmation dialog', (tester) async {
      final fakeManager = FakeModelManager()
        ..modelDownloaded = true
        ..dictDownloaded = true
        ..engineReady = true;

      final useCase = ManageOfflineModelUseCase(modelManager: fakeManager);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OfflineModelDownloadModal(
              modelUseCase: useCase,
              threads: 4,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Xóa tệp'), findsOneWidget);
      await tester.tap(find.text('Xóa tệp'));
      await tester.pumpAndSettle();

      // Confirmation dialog
      expect(find.text('Xác nhận xóa mô hình'), findsOneWidget);
      await tester.tap(find.text('Xóa'));
      await tester.pumpAndSettle();

      expect(fakeManager.deleted, isTrue);
      expect(find.text('Tải xuống toàn bộ (~248 MB)'), findsOneWidget);
    });
  });

  group('CacheModal Widget Test', () {
    testWidgets('shows storage gauge and handles LRU cleanup and clear actions', (tester) async {
      final fakeRepo = FakeAudioCacheRepo();
      final useCase = ManageAudioCacheUseCase(cacheRepo: fakeRepo);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CacheModal(
              cacheUseCase: useCase,
              currentBookId: 'b1',
              currentBookTitle: 'Test Book',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Bộ Nhớ Đệm Âm Thanh (Audio Cache)'), findsOneWidget);
      expect(find.text('Dung lượng đã sử dụng'), findsOneWidget);
      expect(find.text('Dọn dẹp LRU / TTL'), findsOneWidget);

      // Trigger cleanup
      await tester.tap(find.text('Dọn dẹp LRU / TTL'));
      await tester.pumpAndSettle();

      expect(fakeRepo.purgedCount, equals(3));
      expect(find.textContaining('Đã dọn dẹp 3 đoạn âm thanh cũ'), findsOneWidget);

      // Trigger Clear All
      await tester.tap(find.text('Xóa tất cả'));
      await tester.pumpAndSettle();

      expect(find.text('Xóa toàn bộ bộ nhớ đệm'), findsOneWidget);
      await tester.tap(find.text('Xóa toàn bộ'));
      await tester.pumpAndSettle();

      expect(fakeRepo.allCleared, isTrue);
      expect(find.textContaining('Đã xóa toàn bộ bộ nhớ đệm thành công'), findsOneWidget);
    });
  });

  group('DesktopShortcutsWrapper & Focus Isolation Test', () {
    testWidgets('triggers playback shortcuts when not typing in inputs', (tester) async {
      bool playPauseCalled = false;
      bool seekBackwardCalled = false;
      bool seekForwardCalled = false;
      bool volumeUpCalled = false;
      bool volumeDownCalled = false;
      bool muteCalled = false;
      bool speedDownCalled = false;
      bool speedUpCalled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DesktopShortcutsWrapper(
              onTogglePlayPause: () => playPauseCalled = true,
              onSeekBackward: () => seekBackwardCalled = true,
              onSeekForward: () => seekForwardCalled = true,
              onVolumeUp: () => volumeUpCalled = true,
              onVolumeDown: () => volumeDownCalled = true,
              onToggleMute: () => muteCalled = true,
              onSpeedDown: () => speedDownCalled = true,
              onSpeedUp: () => speedUpCalled = true,
              child: const Text('Playback Content'),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Test Space
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      expect(playPauseCalled, isTrue);

      // Test Left / Right
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      expect(seekBackwardCalled, isTrue);

      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      expect(seekForwardCalled, isTrue);

      // Test Up / Down
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
      expect(volumeUpCalled, isTrue);

      await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
      expect(volumeDownCalled, isTrue);

      // Test Mute
      await tester.sendKeyEvent(LogicalKeyboardKey.keyM);
      expect(muteCalled, isTrue);

      // Test Speed Down / Up
      await tester.sendKeyEvent(LogicalKeyboardKey.bracketLeft);
      expect(speedDownCalled, isTrue);

      await tester.sendKeyEvent(LogicalKeyboardKey.bracketRight);
      expect(speedUpCalled, isTrue);
    });

    testWidgets('isolates input: suppresses shortcuts when user focuses inside TextField', (tester) async {
      bool playPauseCalled = false;
      bool muteCalled = false;
      bool speedDownCalled = false;

      final textController = TextEditingController();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DesktopShortcutsWrapper(
              onTogglePlayPause: () => playPauseCalled = true,
              onToggleMute: () => muteCalled = true,
              onSpeedDown: () => speedDownCalled = true,
              child: Column(
                children: [
                  TextField(
                    controller: textController,
                    key: const Key('input_field'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Focus on TextField
      await tester.tap(find.byKey(const Key('input_field')));
      await tester.pumpAndSettle();

      // Verify input is focused
      expect(FocusManager.instance.primaryFocus, isNotNull);

      // Send keys while focused in text input
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.sendKeyEvent(LogicalKeyboardKey.keyM);
      await tester.sendKeyEvent(LogicalKeyboardKey.bracketLeft);

      // Callbacks must NOT have been called!
      expect(playPauseCalled, isFalse, reason: 'Space should be suppressed when typing');
      expect(muteCalled, isFalse, reason: 'Key M should be suppressed when typing');
      expect(speedDownCalled, isFalse, reason: 'Bracket should be suppressed when typing');
    });

    testWidgets('SettingsModal.show and CacheModal.show present as bottom sheets on mobile',
        (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      late BuildContext testContext;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (ctx) {
                testContext = ctx;
                return const SizedBox();
              },
            ),
          ),
        ),
      );

      // Open SettingsModal on mobile
      SettingsModal.show(
        testContext,
        settings: const TTSSettings(endpoint: 'http://test.api'),
        onSave: (_) {},
        onOpenModelDownload: () {},
      );
      await tester.pumpAndSettle();

      // Verify it's presented in a BottomSheet
      expect(find.byType(BottomSheet), findsOneWidget);
      expect(find.text('Cài đặt Giọng đọc & TTS'), findsOneWidget);

      // Close settings modal
      await tester.tap(find.byIcon(Icons.close));
      await tester.pumpAndSettle();

      // Open CacheModal on mobile
      final fakeCacheRepo = FakeAudioCacheRepo();
      final cacheUseCase = ManageAudioCacheUseCase(cacheRepo: fakeCacheRepo);
      CacheModal.show(testContext, cacheUseCase: cacheUseCase);
      await tester.pumpAndSettle();

      expect(find.byType(BottomSheet), findsOneWidget);
      expect(find.text('Bộ Nhớ Đệm Âm Thanh (Audio Cache)'), findsOneWidget);
    });
  });
}
