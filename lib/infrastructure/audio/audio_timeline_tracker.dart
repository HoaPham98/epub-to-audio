import 'dart:typed_data';

class ChunkBoundary {
  final int chapterIndex;
  final int chunkIndex;
  double startTime;
  double endTime;
  final bool isParagraphEnd;

  ChunkBoundary({
    required this.chapterIndex,
    required this.chunkIndex,
    required this.startTime,
    required this.endTime,
    required this.isParagraphEnd,
  });

  double get duration => endTime - startTime;
}

class AudioTimelineTracker {
  final List<ChunkBoundary> _boundaries = [];
  double _accumulatedTime = 0.0;

  List<ChunkBoundary> get boundaries => List.unmodifiable(_boundaries);
  double get totalDuration => _accumulatedTime;

  /// Silence duration in seconds: 250ms for normal sentences, 500ms for paragraph endings.
  static double getSilenceDuration({required bool isParagraphEnd}) {
    return isParagraphEnd ? 0.5 : 0.25;
  }

  /// Generates PCM silence buffer (zeros) for 24kHz Mono 16-bit (48,000 bytes/sec).
  static Uint8List createSilencePadding({
    required bool isParagraphEnd,
    int sampleRate = 24000,
  }) {
    final durationSeconds = getSilenceDuration(isParagraphEnd: isParagraphEnd);
    final byteCount = (sampleRate * 2 * durationSeconds).round();
    return Uint8List(byteCount);
  }

  /// Enqueues a chunk and its subsequent silence boundary.
  /// For streaming SSE packets belonging to the same chunk, accumulates duration
  /// without duplicating sentence or paragraph silence gaps.
  ChunkBoundary enqueueChunk({
    required int chapterIndex,
    required int chunkIndex,
    required double chunkAudioDuration,
    required bool isParagraphEnd,
  }) {
    if (_boundaries.isNotEmpty &&
        _boundaries.last.chapterIndex == chapterIndex &&
        _boundaries.last.chunkIndex == chunkIndex) {
      final last = _boundaries.last;
      last.endTime += chunkAudioDuration;
      _accumulatedTime += chunkAudioDuration;
      return last;
    }

    final silence = getSilenceDuration(isParagraphEnd: isParagraphEnd);
    final totalChunkTime = chunkAudioDuration + silence;

    final start = _accumulatedTime;
    final end = start + totalChunkTime;

    final boundary = ChunkBoundary(
      chapterIndex: chapterIndex,
      chunkIndex: chunkIndex,
      startTime: start,
      endTime: end,
      isParagraphEnd: isParagraphEnd,
    );

    _boundaries.add(boundary);
    _accumulatedTime = end;
    return boundary;
  }

  /// Finds the currently active chunk at a given elapsed timeline position.
  ChunkBoundary? findActiveChunk(double currentTime) {
    if (_boundaries.isEmpty) return null;
    if (currentTime < 0) return _boundaries.first;

    for (int i = 0; i < _boundaries.length; i++) {
      final b = _boundaries[i];
      final nextStart =
          (i + 1 < _boundaries.length) ? _boundaries[i + 1].startTime : b.endTime;
      if (currentTime >= b.startTime && currentTime < nextStart) {
        return b;
      }
    }

    return _boundaries.last;
  }

  /// Dynamically rescales future boundaries upon playback speed change.
  void rescaleSpeed({
    required double oldSpeed,
    required double newSpeed,
    required double currentTime,
  }) {
    if (oldSpeed <= 0 || newSpeed <= 0 || oldSpeed == newSpeed) return;
    final ratio = oldSpeed / newSpeed;

    for (final b in _boundaries) {
      if (b.endTime > currentTime) {
        if (b.startTime >= currentTime) {
          b.startTime = currentTime + (b.startTime - currentTime) * ratio;
          b.endTime = currentTime + (b.endTime - currentTime) * ratio;
        } else {
          b.endTime = currentTime + (b.endTime - currentTime) * ratio;
        }
      }
    }

    _accumulatedTime =
        currentTime + (_accumulatedTime - currentTime) * ratio;
  }

  void reset() {
    _boundaries.clear();
    _accumulatedTime = 0.0;
  }
}
