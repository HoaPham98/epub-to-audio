import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:epub_to_audio/domain/domain.dart';
import 'package:epub_to_audio/infrastructure/parser/epub_parser_adapter.dart';
import 'package:epub_to_audio/infrastructure/storage/audio_cache_repository_io.dart';
import 'package:epub_to_audio/infrastructure/storage/book_repository_io.dart';
import 'package:epub_to_audio/infrastructure/tts/vieneu_stream_tts_client.dart';
import 'package:epub_to_audio/presentation/screens/home_screen.dart';
import 'package:epub_to_audio/presentation/widgets/widgets.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;
  late Directory cacheDir;
  late Directory booksDir;

  setUpAll(() async {
    tempDir = await Directory.systemTemp.createTemp('e2e_test_');
    cacheDir = Directory('${tempDir.path}/cache')..createSync(recursive: true);
    booksDir = Directory('${tempDir.path}/books')..createSync(recursive: true);
  });

  tearDownAll(() async {
    try {
      if (tempDir.existsSync()) {
        await tempDir.delete(recursive: true);
      }
    } catch (_) {}
  });

  group('End-to-End Pipeline & Integration Suite', () {
    testWidgets('Step 1: Verify EPUB Loading & Sentence Boundary Chunking',
        (tester) async {
      const parser = EpubParserAdapter();
      final bookFile = File('assets/sample-book.epub');
      expect(bookFile.existsSync(), isTrue,
          reason: 'assets/sample-book.epub must be present');

      final bytes = await bookFile.readAsBytes();
      final book = await parser.parse(bytes, fileName: 'sample-book.epub');

      expect(book.title.isNotEmpty, isTrue);
      expect(book.author.isNotEmpty, isTrue);
      expect(book.chapters.isNotEmpty, isTrue);
      expect(book.totalChunks, greaterThan(0));

      final firstChapter = book.chapters.first;
      expect(firstChapter.chunks.isNotEmpty, isTrue);

      for (final chunk in firstChapter.chunks) {
        expect(chunk.text.trim().isNotEmpty, isTrue);
        expect(chunk.charCount, equals(chunk.text.length));
      }
    });

    testWidgets('Step 2: Verify Audio Cache Repository with 24kHz WAV & LRU tracking',
        (tester) async {
      final cacheRepo = AudioCacheRepository(customDirectory: cacheDir);

      // Create synthetic 24kHz Mono 16-bit PCM audio (0.5 seconds = 12000 samples = 24000 bytes)
      final pcmBytes = Uint8List(24000);
      final wavBytes = pcmToWav(
        pcmBytes,
        sampleRate: 24000,
        channels: 1,
      );

      final key1 = cacheRepo.buildKey(
        bookId: 'book-1',
        chapterIndex: 0,
        chunkIndex: 0,
        voice: 'minh_quan_pro',
        model: 'vieneu-v3-turbo',
        sampleRate: 24000,
      );

      final item1 = AudioCacheItem(
        key: key1,
        bookId: 'book-1',
        chapterIndex: 0,
        chunkIndex: 0,
        bytes: wavBytes,
        duration: 0.5,
        timestamp: DateTime.now().millisecondsSinceEpoch,
        lastAccessedAt: DateTime.now().millisecondsSinceEpoch,
      );

      await cacheRepo.putAudioChunk(item1);

      // Verify retrieval
      final retrieved = await cacheRepo.getAudioChunk(key1);
      expect(retrieved, isNotNull);
      expect(retrieved!.bytes.length, equals(wavBytes.length));

      // Verify Total Size
      final totalSize = await cacheRepo.getTotalCacheSizeBytes();
      expect(totalSize, greaterThan(0));

      // Verify LRU cleanup
      final purged = await cacheRepo.cleanupLruAndTtl(
        maxSizeBytes: 100, // Small limit to trigger eviction
        maxAge: const Duration(days: 7),
      );
      expect(purged, equals(1));
    });

    testWidgets('Step 3: Verify Remote Direct SSE Streaming (24kHz Mono PCM)',
        (tester) async {
      // Spin up local mock SSE HTTP server
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      addTearDown(() async => await server.close(force: true));

      final syntheticPcm = Uint8List(2400); // 100ms at 24kHz Mono
      final base64Pcm = base64Encode(syntheticPcm);

      server.listen((HttpRequest request) async {
        await request.drain();
        request.response.headers.contentType = ContentType('text', 'event-stream');
        request.response.headers.set('Cache-Control', 'no-cache');
        request.response.write('event: message\n');
        request.response.write('data: {"type": "speech.audio.delta", "audio": "$base64Pcm"}\n\n');
        request.response.write('event: message\n');
        request.response.write('data: {"type": "speech.audio.done"}\n\n');
        request.response.write('data: [DONE]\n\n');
        await request.response.close();
      });

      const client = VieNeuStreamTTSClient();
      final settings = TTSSettings(
        ttsMode: TtsMode.remote,
        endpoint: 'http://${server.address.address}:${server.port}/v1/audio/speech',
      );

      final chunks = <AudioChunk>[];
      await for (final chunk in client.streamSpeech('Xin chào Việt Nam', settings)) {
        chunks.add(chunk);
      }

      expect(chunks.isNotEmpty, isTrue);
      expect(chunks.first.sampleRate, equals(24000));
      expect(chunks.first.channels, equals(1));
      expect(chunks.first.pcmBuffer.length, equals(syntheticPcm.length));
    });

    testWidgets('Step 4: Verify Full App UI Navigation & Keyboard Shortcuts',
        (tester) async {
      final bookRepo = BookRepository(customDirectory: booksDir);
      final cacheRepo = AudioCacheRepository(customDirectory: cacheDir);
      const parser = EpubParserAdapter();

      await tester.pumpWidget(
        MaterialApp(
          home: HomeScreen(
            bookRepository: bookRepo,
            cacheRepository: cacheRepo,
            epubParser: parser,
          ),
        ),
      );

      // Wait for sample book to load
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();

      // Verify Header rendered with actions
      expect(find.byType(Header), findsOneWidget);
      expect(find.text('Cài đặt'), findsOneWidget);
      expect(find.text('Bộ nhớ đệm'), findsOneWidget);

      // Verify Reader & Player bar rendered
      expect(find.byType(Reader), findsOneWidget);
      expect(find.byType(AudioPlayerBar), findsOneWidget);

      // Open Settings Modal
      await tester.tap(find.text('Cài đặt'));
      await tester.pumpAndSettle();

      expect(find.text('Cài đặt Giọng đọc & TTS'), findsOneWidget);
      expect(find.text('Offline On-Device'), findsOneWidget);

      // Close Settings Modal
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();

      // Open Cache Modal
      await tester.tap(find.text('Bộ nhớ đệm'));
      await tester.pumpAndSettle();

      expect(find.text('Bộ Nhớ Đệm Âm Thanh (Audio Cache)'), findsOneWidget);
      expect(find.text('Dọn dẹp LRU / TTL'), findsOneWidget);

      // Close Cache Modal by tapping close button inside CacheModal
      await tester.tap(
        find.descendant(
          of: find.byType(CacheModal),
          matching: find.byIcon(Icons.close),
        ),
      );
      await tester.pumpAndSettle();

      // Test Desktop Shortcuts: Space bar toggle
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();

      // Test seeking via ArrowRight & ArrowLeft
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      await tester.pump();
    });
  });
}
