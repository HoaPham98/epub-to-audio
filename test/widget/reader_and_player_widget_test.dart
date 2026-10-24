import 'package:epub_to_audio/domain/domain.dart';
import 'package:epub_to_audio/presentation/widgets/audio_player_bar.dart';
import 'package:epub_to_audio/presentation/widgets/header.dart';
import 'package:epub_to_audio/presentation/widgets/reader.dart';
import 'package:epub_to_audio/presentation/widgets/sidebar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const dummyBook = EpubBook(
    id: 'b1',
    title: 'Hoàng Tử Bé',
    author: 'Antoine de Saint-Exupéry',
    chapters: [
      EpubChapter(
        id: 'c0',
        index: 0,
        title: 'Chương 1: Mở đầu',
        href: '1.html',
        contentHtml: '<p>Nội dung</p>',
        rawText: 'Nội dung',
        chunks: [
          TextChunk(
            id: 'c0-0',
            index: 0,
            text: 'Đoạn thứ nhất của chương.',
            charCount: 26,
          ),
          TextChunk(
            id: 'c0-1',
            index: 1,
            text: 'Đoạn thứ hai tiếp theo.',
            charCount: 23,
          ),
        ],
      ),
    ],
    totalChunks: 2,
    fileName: 'sample.epub',
    fileSize: 1000,
    uploadedAt: 0,
  );

  group('Header Widget Test', () {
    testWidgets('renders book title, author breadcrumb, and action buttons',
        (tester) async {
      bool openedSettings = false;
      bool openedCache = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            appBar: Header(
              book: dummyBook,
              cacheCount: 3,
              isSidebarOpen: false,
              onOpenSettings: () => openedSettings = true,
              onOpenCache: () => openedCache = true,
              onToggleSidebar: () {},
            ),
          ),
        ),
      );

      expect(find.text('Hoàng Tử Bé'), findsOneWidget);
      expect(find.text('Antoine de Saint-Exupéry'), findsOneWidget);
      expect(find.text('Bộ nhớ đệm'), findsOneWidget);
      expect(find.text('3'), findsOneWidget); // cache count badge
      expect(find.text('Cài đặt'), findsOneWidget);

      await tester.tap(find.text('Cài đặt'));
      expect(openedSettings, isTrue);

      await tester.tap(find.text('Bộ nhớ đệm'));
      expect(openedCache, isTrue);
    });
  });

  group('Sidebar Widget Test', () {
    testWidgets('renders chapters list and reacts to chapter selection',
        (tester) async {
      int? selectedChapter;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Sidebar(
              book: dummyBook,
              currentChapterIndex: 0,
              isPlaying: false,
              onSelectChapter: (idx) => selectedChapter = idx,
              onUploadFile: (_) {},
              onClose: () {},
            ),
          ),
        ),
      );

      expect(find.text('Mục lục sách'), findsOneWidget);
      expect(find.text('Chương 1: Mở đầu'), findsOneWidget);

      await tester.tap(find.text('Chương 1: Mở đầu'));
      expect(selectedChapter, equals(0));
    });
  });

  group('Reader Widget Test', () {
    testWidgets('renders text chunks with contextual buttons and highlights active chunk',
        (tester) async {
      int? playedChapter;
      int? playedChunk;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Reader(
              book: dummyBook,
              currentChapterIndex: 0,
              currentChunkIndex: 0,
              chunkStatuses: const {0: ChunkStatus.playing, 1: ChunkStatus.ready},
              isPlaying: true,
              isLoading: false,
              onPlayChunk: (ch, ck) {
                playedChapter = ch;
                playedChunk = ck;
              },
            ),
          ),
        ),
      );

      expect(find.text('Đoạn thứ nhất của chương.'), findsOneWidget);
      expect(find.text('Đoạn thứ hai tiếp theo.'), findsOneWidget);

      // Chunk 0 is currently playing -> Button says 'Tạm dừng'
      expect(find.text('Tạm dừng'), findsOneWidget);

      // Chunk 1 has status ready -> Button says 'Phát ngay' and badge says '✓ Đã nạp sẵn'
      expect(find.text('✓ Đã nạp sẵn'), findsOneWidget);
      expect(find.text('Phát ngay'), findsOneWidget);

      await tester.tap(find.text('Tạm dừng'));
      expect(playedChapter, equals(0));
      expect(playedChunk, equals(0));
    });
  });

  group('AudioPlayerBar Widget Test', () {
    testWidgets('renders scrubber, forward buffer badge, speed and controls',
        (tester) async {
      bool playToggled = false;
      bool autoNextToggled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            bottomNavigationBar: AudioPlayerBar(
              currentChapterTitle: 'Chương 1: Mở đầu',
              currentChunkIndex: 0,
              totalChunks: 2,
              currentTime: 10.0,
              duration: 30.0,
              bufferedTime: 25.0, // forward buffer = 15.0s
              isPlaying: false,
              isLoading: false,
              autoNext: true,
              speed: 1.0,
              volume: 1.0,
              onTogglePlayPause: () => playToggled = true,
              onPrevChapter: () {},
              onNextChapter: () {},
              onSkipRelative: (_) {},
              onSeek: (_) {},
              onToggleAutoNext: () => autoNextToggled = true,
              onChangeSpeed: (_) {},
              onChangeVolume: (_) {},
            ),
          ),
        ),
      );

      expect(find.text('Chương 1: Mở đầu'), findsOneWidget);
      expect(find.text('Đệm trước: +15.0s'), findsOneWidget);
      expect(find.text('Auto Next'), findsOneWidget);
      expect(find.text('1.0x'), findsOneWidget);

      await tester.tap(find.byTooltip('Phát'));
      expect(playToggled, isTrue);

      await tester.tap(find.text('Auto Next'));
      expect(autoNextToggled, isTrue);
    });

    testWidgets('renders compact MiniPlayerBar on mobile screens and expands FullPlayerSheet',
        (tester) async {
      // Simulate mobile device screen size (390 x 844)
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      bool playToggled = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            bottomNavigationBar: AudioPlayerBar(
              currentChapterTitle: 'Chương 1: Bức Tranh Con Trăn Khổng Lồ',
              currentChunkIndex: 0,
              totalChunks: 3,
              currentTime: 15.0,
              duration: 60.0,
              bufferedTime: 30.0,
              isPlaying: false,
              isLoading: false,
              autoNext: true,
              speed: 1.0,
              volume: 1.0,
              onTogglePlayPause: () => playToggled = true,
              onPrevChapter: () {},
              onNextChapter: () {},
              onSkipRelative: (_) {},
              onSeek: (_) {},
              onToggleAutoNext: () {},
              onChangeSpeed: (_) {},
              onChangeVolume: (_) {},
            ),
          ),
        ),
      );

      // Verify mini player displays chapter title and progress on mobile
      expect(find.text('Chương 1: Bức Tranh Con Trăn Khổng Lồ'), findsOneWidget);
      expect(find.text('Đoạn 1/3 • 00:15 / 01:00'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);

      // Verify mini player controls
      expect(find.byTooltip('Phát'), findsOneWidget);
      await tester.tap(find.byTooltip('Phát'));
      expect(playToggled, isTrue);

      // Tap on chapter info to open FullPlayerSheet
      await tester.tap(find.text('Chương 1: Bức Tranh Con Trăn Khổng Lồ'));
      await tester.pumpAndSettle();

      // Verify FullPlayerSheet is open with enlarged controls
      expect(find.text('ĐANG PHÁT'), findsOneWidget);
      expect(find.text('Tự chuyển đoạn'), findsOneWidget);
      expect(find.byType(Slider), findsOneWidget);
    });
  });
}
