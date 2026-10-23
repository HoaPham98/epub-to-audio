import 'dart:typed_data';
import '../../domain/domain.dart';

class StreamAndPlayParams {
  final String text;
  final TTSSettings settings;
  final String? bookId;
  final int chapterIndex;
  final int chunkIndex;
  final bool isParagraphEnd;
  final bool isLastChunk;
  final bool append;
  final ITTSStreamingService ttsService;
  final void Function()? onFirstData;
  final void Function()? onNetworkDone;
  final bool Function()? isCancelled;

  const StreamAndPlayParams({
    required this.text,
    required this.settings,
    this.bookId,
    required this.chapterIndex,
    required this.chunkIndex,
    this.isParagraphEnd = false,
    this.isLastChunk = false,
    this.append = false,
    required this.ttsService,
    this.onFirstData,
    this.onNetworkDone,
    this.isCancelled,
  });
}

class StreamAndPlayResult {
  final bool fromCache;
  final Uint8List? audioBytes;

  const StreamAndPlayResult({
    required this.fromCache,
    this.audioBytes,
  });
}

class StreamAndPlayChunkUseCase {
  final IAudioStreamPlayer audioPlayer;
  final IAudioCacheRepository audioCache;

  const StreamAndPlayChunkUseCase({
    required this.audioPlayer,
    required this.audioCache,
  });

  Future<StreamAndPlayResult> execute(StreamAndPlayParams params) async {
    final meta = ChunkMeta(
      chapterIndex: params.chapterIndex,
      chunkIndex: params.chunkIndex,
      charCount: params.text.length,
      isParagraphEnd: params.isParagraphEnd,
      estimatedDuration: estimateSpeechDuration(
        params.text.length,
        speed: params.settings.speed,
      ),
    );

    String? cacheKey;
    if (params.bookId != null && params.bookId!.isNotEmpty) {
      cacheKey = audioCache.buildKey(
        bookId: params.bookId!,
        chapterIndex: params.chapterIndex,
        chunkIndex: params.chunkIndex,
        voice: params.settings.voice,
        model: params.settings.model,
        sampleRate: params.settings.sampleRate,
      );

      final cached = await audioCache.getAudioChunk(cacheKey);
      if (cached != null) {
        if (params.isCancelled?.call() == true) {
          return StreamAndPlayResult(fromCache: true, audioBytes: cached.bytes);
        }

        params.onFirstData?.call();
        await audioPlayer.queueAudioChunk(
          params.chapterIndex,
          params.chunkIndex,
          cached.bytes,
          isLastChunk: params.isLastChunk,
          meta: meta,
        );
        await audioPlayer.setChunkStatus(
          params.chapterIndex,
          params.chunkIndex,
          ChunkStatus.ready,
        );
        params.onNetworkDone?.call();
        return StreamAndPlayResult(fromCache: true, audioBytes: cached.bytes);
      }
    }

    if (params.isCancelled?.call() == true) {
      return const StreamAndPlayResult(fromCache: false);
    }

    if (!params.append) {
      await audioPlayer.clearQueue();
    }

    await audioPlayer.setChunkStatus(
      params.chapterIndex,
      params.chunkIndex,
      ChunkStatus.loading,
    );

    final List<Uint8List> pcmBuffers = [];
    bool hasFiredFirstData = false;

    try {
      final stream = params.ttsService.streamSpeech(
        params.text,
        params.settings,
        onCancel: () {},
      );

      await for (final chunk in stream) {
        if (params.isCancelled?.call() == true) {
          if (!params.append) {
            await audioPlayer.stop();
          }
          return const StreamAndPlayResult(fromCache: false);
        }

        pcmBuffers.add(chunk.pcmBuffer);

        if (!hasFiredFirstData) {
          hasFiredFirstData = true;
          params.onFirstData?.call();
          await audioPlayer.setChunkStatus(
            params.chapterIndex,
            params.chunkIndex,
            ChunkStatus.playing,
          );
        }

        await audioPlayer.queueAudioChunk(
          params.chapterIndex,
          params.chunkIndex,
          chunk.pcmBuffer,
          isLastChunk: chunk.isLast,
          meta: meta,
        );
      }

      if (params.isCancelled?.call() == true) {
        if (!params.append) {
          await audioPlayer.stop();
        }
        return const StreamAndPlayResult(fromCache: false);
      }

      params.onNetworkDone?.call();

      if (pcmBuffers.isNotEmpty) {
        final totalLen = pcmBuffers.fold<int>(0, (sum, b) => sum + b.length);
        final fullPcm = Uint8List(totalLen);
        int offset = 0;
        for (final b in pcmBuffers) {
          fullPcm.setRange(offset, offset + b.length, b);
          offset += b.length;
        }

        final wavBytes = pcmToWav(
          fullPcm,
          sampleRate: params.settings.sampleRate,
          channels: params.settings.channels,
        );

        if (cacheKey != null && params.bookId != null) {
          final now = DateTime.now().millisecondsSinceEpoch;
          final cacheItem = AudioCacheItem(
            key: cacheKey,
            bookId: params.bookId!,
            chapterIndex: params.chapterIndex,
            chunkIndex: params.chunkIndex,
            bytes: wavBytes,
            duration: meta.estimatedDuration,
            timestamp: now,
            lastAccessedAt: now,
          );
          // Asynchronously persist to cache without blocking playback
          audioCache.putAudioChunk(cacheItem).catchError((_) {});
        }

        return StreamAndPlayResult(fromCache: false, audioBytes: wavBytes);
      }

      return const StreamAndPlayResult(fromCache: false);
    } catch (e) {
      if (params.isCancelled?.call() == true) {
        return const StreamAndPlayResult(fromCache: false);
      }
      await audioPlayer.setChunkStatus(
        params.chapterIndex,
        params.chunkIndex,
        ChunkStatus.error,
      );
      rethrow;
    }
  }
}
