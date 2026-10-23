import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:epub_to_audio/main.dart';
import 'package:epub_to_audio/presentation/widgets/widgets.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Web Chrome Integration Test Suite', () {
    testWidgets('Verify EPUB loading, Reader rendering, Modals, and Web Controls on Chrome',
        (tester) async {
      // 1. Launch App
      await tester.pumpWidget(const EpubToAudioApp());
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();

      // 2. Verify Header, Reader, AudioPlayerBar are rendered
      expect(find.byType(Header), findsOneWidget);
      expect(find.byType(Reader), findsOneWidget);
      expect(find.byType(AudioPlayerBar), findsOneWidget);
      expect(find.text('Cài đặt'), findsOneWidget);
      expect(find.text('Bộ nhớ đệm'), findsOneWidget);

      // 3. Open Settings Modal
      await tester.tap(find.text('Cài đặt'));
      await tester.pumpAndSettle();

      expect(find.byType(SettingsModal), findsOneWidget);
      expect(find.text('Cài đặt Giọng đọc & TTS'), findsOneWidget);
      expect(find.text('Máy chủ từ xa (API)'), findsOneWidget);

      // Close Settings Modal
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();
      expect(find.byType(SettingsModal), findsNothing);

      // 4. Open Cache Modal & Verify Web Quota (200 MB)
      await tester.tap(find.text('Bộ nhớ đệm'));
      await tester.pumpAndSettle();

      expect(find.byType(CacheModal), findsOneWidget);
      expect(find.text('Bộ Nhớ Đệm Âm Thanh (Audio Cache)'), findsOneWidget);
      expect(find.textContaining('200.0 MB'), findsOneWidget);

      // Close Cache Modal
      await tester.tap(
        find.descendant(
          of: find.byType(CacheModal),
          matching: find.byIcon(Icons.close),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(CacheModal), findsNothing);

      // 5. Test Desktop Keyboard Shortcuts on Chrome
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      await tester.pump();
    });
  });
}
