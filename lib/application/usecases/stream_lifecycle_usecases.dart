import 'dart:typed_data';
import '../../domain/domain.dart';

class AbortActiveStreamUseCase {
  final IAudioStreamPlayer audioPlayer;

  const AbortActiveStreamUseCase({required this.audioPlayer});

  Future<void> execute(void Function()? cancelCallback) async {
    try {
      cancelCallback?.call();
    } catch (_) {}
    await audioPlayer.stop();
  }
}

class CandidatePrefetchChunk {
  final int chapterIndex;
  final int chunkIndex;
  final TextChunk chunk;

  const CandidatePrefetchChunk({
    required this.chapterIndex,
    required this.chunkIndex,
    required this.chunk,
  });
}

class SlidingWindowPrefetchUseCase {
  final IAudioCacheRepository audioCache;
  final IAudioStreamPlayer? audioPlayer;
  final Set<String> _inFlightKeys = {};

  SlidingWindowPrefetchUseCase({
    required this.audioCache,
    this.audioPlayer,
  });

  /// Finds chunks ahead within the 800–1,200 character sliding window,
  /// supporting cross-chapter boundary continuity.
  List<CandidatePrefetchChunk> planPrefetchWindow({
    required EpubBook book,
    required int currentChapterIndex,
    required int currentChunkIndex,
    int minChars = 800,
    int maxChars = 1200,
  }) {
    final List<CandidatePrefetchChunk> candidates = [];
    int accumulatedChars = 0;

    int chIdx = currentChapterIndex;
    int startChunk = currentChunkIndex + 1;

    while (chIdx < book.chapters.length && accumulatedChars < minChars) {
      final chapter = book.chapters[chIdx];
      for (int k = startChunk; k < chapter.chunks.length; k++) {
        final chunk = chapter.chunks[k];
        if (accumulatedChars + chunk.charCount > maxChars &&
            candidates.isNotEmpty) {
          return candidates;
        }
        candidates.add(CandidatePrefetchChunk(
          chapterIndex: chIdx,
          chunkIndex: k,
          chunk: chunk,
        ));
        accumulatedChars += chunk.charCount;
        if (accumulatedChars >= minChars) {
          return candidates;
        }
      }
      // Advance to next chapter for cross-chapter continuity
      chIdx++;
      startChunk = 0;
    }

    return candidates;
  }

  Future<int> execute({
    required EpubBook book,
    required int currentChapterIndex,
    required int currentChunkIndex,
    required TTSSettings settings,
    required ITTSStreamingService ttsService,
    int minChars = 800,
    int maxChars = 1200,
    bool Function()? isCancelled,
  }) async {
    final candidates = planPrefetchWindow(
      book: book,
      currentChapterIndex: currentChapterIndex,
      currentChunkIndex: currentChunkIndex,
      minChars: minChars,
      maxChars: maxChars,
    );

    int prefetchedCount = 0;

    for (final candidate in candidates) {
      if (isCancelled?.call() == true) break;

      final cacheKey = audioCache.buildKey(
        bookId: book.id,
        chapterIndex: candidate.chapterIndex,
        chunkIndex: candidate.chunkIndex,
        voice: settings.voice,
        model: settings.model,
        sampleRate: settings.sampleRate,
      );

      if (_inFlightKeys.contains(cacheKey)) continue;

      final existing = await audioCache.getAudioChunk(cacheKey);
      if (existing != null) {
        await audioPlayer?.setChunkStatus(
          candidate.chapterIndex,
          candidate.chunkIndex,
          ChunkStatus.ready,
        );
        continue;
      }

      _inFlightKeys.add(cacheKey);
      await audioPlayer?.setChunkStatus(
        candidate.chapterIndex,
        candidate.chunkIndex,
        ChunkStatus.loading,
      );

      try {
        final audioBytes = await ttsService.fetchAudioBytes(
          candidate.chunk.text,
          settings,
        );

        if (isCancelled?.call() == true) break;

        // If raw PCM, encapsulate in standard WAV
        final Uint8List wavBytes = isWavBytes(audioBytes)
            ? audioBytes
            : pcmToWav(
                audioBytes,
                sampleRate: settings.sampleRate,
                channels: settings.channels,
              );

        final now = DateTime.now().millisecondsSinceEpoch;
        final cacheItem = AudioCacheItem(
          key: cacheKey,
          bookId: book.id,
          chapterIndex: candidate.chapterIndex,
          chunkIndex: candidate.chunkIndex,
          bytes: wavBytes,
          duration: estimateSpeechDuration(
            candidate.chunk.charCount,
            speed: settings.speed,
          ),
          timestamp: now,
          lastAccessedAt: now,
        );

        await audioCache.putAudioChunk(cacheItem);
        await audioPlayer?.setChunkStatus(
          candidate.chapterIndex,
          candidate.chunkIndex,
          ChunkStatus.ready,
        );
        prefetchedCount++;
      } catch (err) {
        if (isCancelled?.call() == true) break;
        await audioPlayer?.setChunkStatus(
          candidate.chapterIndex,
          candidate.chunkIndex,
          ChunkStatus.error,
        );
      } finally {
        _inFlightKeys.delete(cacheKey);
      }
    }

    return prefetchedCount;
  }
}

extension _SetExtension<T> on Set<T> {
  void delete(T value) => remove(value);
}
