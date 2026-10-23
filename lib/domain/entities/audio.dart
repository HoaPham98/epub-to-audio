import 'dart:typed_data';

enum ChunkStatus {
  idle,
  loading,
  ready,
  playing,
  error;

  String get displayName {
    switch (this) {
      case ChunkStatus.idle:
        return 'Sẵn sàng';
      case ChunkStatus.loading:
        return 'Đang tải...';
      case ChunkStatus.ready:
        return 'Đã nạp sẵn';
      case ChunkStatus.playing:
        return 'Đang đọc';
      case ChunkStatus.error:
        return 'Lỗi';
    }
  }
}

class AudioChunk {
  final Uint8List pcmBuffer;
  final int sampleRate;
  final int channels;
  final bool isLast;

  const AudioChunk({
    required this.pcmBuffer,
    required this.sampleRate,
    required this.channels,
    this.isLast = false,
  });
}

class AudioCacheItem {
  final String key;
  final String bookId;
  final int chapterIndex;
  final int chunkIndex;
  final Uint8List bytes;
  final double? duration;
  final int timestamp;
  final int lastAccessedAt;

  const AudioCacheItem({
    required this.key,
    required this.bookId,
    required this.chapterIndex,
    required this.chunkIndex,
    required this.bytes,
    this.duration,
    required this.timestamp,
    required this.lastAccessedAt,
  });
}

class PlaybackProgress {
  final int chapterIndex;
  final int chunkIndex;
  final double currentTime;
  final double duration;
  final bool isPlaying;
  final bool isLoading;
  final bool autoNext;
  final Map<int, ChunkStatus> chunkStatuses;
  final String? errorMessage;

  const PlaybackProgress({
    required this.chapterIndex,
    required this.chunkIndex,
    required this.currentTime,
    required this.duration,
    required this.isPlaying,
    required this.isLoading,
    required this.autoNext,
    required this.chunkStatuses,
    this.errorMessage,
  });
}
