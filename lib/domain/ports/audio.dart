import 'dart:typed_data';
import '../entities/audio.dart';

class ChunkMeta {
  final int chapterIndex;
  final int chunkIndex;
  final int charCount;
  final bool isParagraphEnd;
  final double estimatedDuration;

  const ChunkMeta({
    required this.chapterIndex,
    required this.chunkIndex,
    required this.charCount,
    this.isParagraphEnd = false,
    required this.estimatedDuration,
  });
}

/// Helper function to estimate speech duration based on character count and speech speed.
/// Average Vietnamese reading speed is approximately 14-16 characters per second at 1.0x.
double estimateSpeechDuration(
  int charCount, {
  double speed = 1.0,
  double charsPerSecond = 15.0,
}) {
  if (charCount <= 0 || charsPerSecond <= 0) return 0.0;
  final effectiveSpeed = speed <= 0 ? 1.0 : speed;
  return (charCount / charsPerSecond) / effectiveSpeed;
}

abstract interface class IAudioStreamPlayer {
  Stream<PlaybackProgress> get progressStream;

  PlaybackProgress get currentProgress;

  Future<void> play();

  Future<void> pause();

  Future<void> stop();

  Future<void> seek(double seconds);

  Future<void> setSpeed(double speed);

  Future<void> setVolume(double volume);

  Future<void> queueAudioChunk(
    int chapterIndex,
    int chunkIndex,
    Uint8List audioBytes, {
    bool isLastChunk = false,
    ChunkMeta? meta,
  });

  Future<void> clearQueue();

  Future<void> setChunkStatus(int chapterIndex, int chunkIndex, ChunkStatus status);

  Future<void> updateMetadata({
    required String title,
    required String author,
    String? coverUrl,
    required String chapterTitle,
  });

  Future<void> dispose();
}
