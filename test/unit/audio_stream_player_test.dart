import 'dart:typed_data';
import 'package:epub_to_audio/domain/domain.dart';
import 'package:epub_to_audio/infrastructure/audio/audio_timeline_tracker.dart';
import 'package:epub_to_audio/infrastructure/audio/native_audio_player_io.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AudioTimelineTracker (Silence padding & boundary calculations)', () {
    late AudioTimelineTracker tracker;

    setUp(() {
      tracker = AudioTimelineTracker();
    });

    test('generates correct silence padding buffer sizes for 24kHz Mono 16-bit', () {
      // 250ms silence = 24000 * 2 * 0.25 = 12000 bytes
      final sentenceSilence = AudioTimelineTracker.createSilencePadding(
        isParagraphEnd: false,
        sampleRate: 24000,
      );
      expect(sentenceSilence.length, equals(12000));
      expect(sentenceSilence.every((byte) => byte == 0), isTrue);

      // 500ms silence = 24000 * 2 * 0.50 = 24000 bytes
      final paragraphSilence = AudioTimelineTracker.createSilencePadding(
        isParagraphEnd: true,
        sampleRate: 24000,
      );
      expect(paragraphSilence.length, equals(24000));
      expect(paragraphSilence.every((byte) => byte == 0), isTrue);
    });

    test('enqueues chunks and tracks cumulative timeline with silence gaps', () {
      // Chunk 0: 1.0s audio + 250ms silence = 1.25s
      final b0 = tracker.enqueueChunk(
        chapterIndex: 0,
        chunkIndex: 0,
        chunkAudioDuration: 1.0,
        isParagraphEnd: false,
      );
      expect(b0.startTime, equals(0.0));
      expect(b0.endTime, equals(1.25));

      // Chunk 1: 2.0s audio + 500ms paragraph silence = 2.5s
      final b1 = tracker.enqueueChunk(
        chapterIndex: 0,
        chunkIndex: 1,
        chunkAudioDuration: 2.0,
        isParagraphEnd: true,
      );
      expect(b1.startTime, equals(1.25));
      expect(b1.endTime, equals(3.75));

      expect(tracker.totalDuration, equals(3.75));
    });

    test('correctly finds active chunk boundary at elapsed times', () {
      tracker.enqueueChunk(
        chapterIndex: 0,
        chunkIndex: 0,
        chunkAudioDuration: 1.0,
        isParagraphEnd: false,
      ); // 0.0 to 1.25s
      tracker.enqueueChunk(
        chapterIndex: 0,
        chunkIndex: 1,
        chunkAudioDuration: 2.0,
        isParagraphEnd: true,
      ); // 1.25 to 3.75s

      final activeAt0 = tracker.findActiveChunk(0.5);
      expect(activeAt0?.chunkIndex, equals(0));

      final activeAtSilence = tracker.findActiveChunk(1.1);
      expect(activeAtSilence?.chunkIndex, equals(0));

      final activeAtSecond = tracker.findActiveChunk(2.0);
      expect(activeAtSecond?.chunkIndex, equals(1));
    });

    test('dynamically rescales timeline boundaries when speed changes', () {
      tracker.enqueueChunk(
        chapterIndex: 0,
        chunkIndex: 0,
        chunkAudioDuration: 2.0,
        isParagraphEnd: false,
      ); // 0.0 to 2.25s at 1.0x

      expect(tracker.totalDuration, equals(2.25));

      // Change speed from 1.0x to 2.0x at currentTime = 0.0
      tracker.rescaleSpeed(oldSpeed: 1.0, newSpeed: 2.0, currentTime: 0.0);

      // Remaining 2.25s is halved to 1.125s
      expect(tracker.totalDuration, closeTo(1.125, 0.001));
    });
  });

  group('NativeAudioStreamPlayerAdapter (State machine & Queueing)', () {
    late NativeAudioStreamPlayerAdapter player;

    setUp(() {
      player = NativeAudioStreamPlayerAdapter();
    });

    tearDown(() async {
      await player.dispose();
    });

    test('initial state is idle and duration is zero', () {
      final p = player.currentProgress;
      expect(p.isPlaying, isFalse);
      expect(p.currentTime, equals(0.0));
      expect(p.duration, equals(0.0));
    });

    test('queueAudioChunk appends audio and updates progress status', () async {
      // 48,000 bytes = 1.0s at 24kHz Mono 16-bit
      final dummyPcm = Uint8List(48000);

      await player.queueAudioChunk(
        0,
        0,
        dummyPcm,
        meta: const ChunkMeta(
          chapterIndex: 0,
          chunkIndex: 0,
          charCount: 20,
          isParagraphEnd: false,
          estimatedDuration: 1.0,
        ),
      );

      final progress = player.currentProgress;
      expect(progress.chunkStatuses[0], equals(ChunkStatus.ready));
      // 1.0s audio + 0.25s sentence silence = 1.25s
      expect(progress.duration, closeTo(1.25, 0.01));
    });

    test('play, pause, seek, setSpeed, and stop update player state', () async {
      final dummyPcm = Uint8List(48000);
      await player.queueAudioChunk(0, 0, dummyPcm);

      await player.play();
      expect(player.currentProgress.isPlaying, isTrue);

      await player.pause();
      expect(player.currentProgress.isPlaying, isFalse);

      await player.seek(0.5);
      expect(player.currentProgress.currentTime, closeTo(0.5, 0.01));

      await player.setSpeed(1.5);
      expect(player.currentProgress.isPlaying, isFalse);

      await player.stop();
      expect(player.currentProgress.isPlaying, isFalse);
      expect(player.currentProgress.currentTime, equals(0.0));
    });
  });
}
