import {
  IAudioCacheRepository,
  IAudioStreamPlayer,
  ITTSStreamingService,
  TTSSettings,
} from '@/domain';
import { TTSClientFactory } from '@/infrastructure';

export class AbortActiveStreamUseCase {
  constructor(private readonly audioPlayer: IAudioStreamPlayer) {}

  execute(activeController: AbortController | null): void {
    if (activeController) {
      try {
        activeController.abort();
      } catch {
        // ignore
      }
    }
    this.audioPlayer.stop();
  }
}

export class PipelineNextChunkUseCase {
  private inFlightPrefetches = new Set<string>();

  constructor(private readonly audioCache: IAudioCacheRepository) {}

  async execute(params: {
    nextText: string;
    settings: TTSSettings;
    cacheInfo: {
      bookId: string;
      chapterIndex: number;
      chunkIndex: number;
    };
    signal?: AbortSignal;
    ttsServiceOverride?: ITTSStreamingService;
  }): Promise<Blob | null> {
    const { nextText, settings, cacheInfo, signal, ttsServiceOverride } = params;

    const cacheKey = this.audioCache.buildKey(
      cacheInfo.bookId,
      cacheInfo.chapterIndex,
      cacheInfo.chunkIndex,
      settings.model,
      settings.voice,
      settings.speed,
      'wav'
    );

    // Skip if already cached or currently prefetching
    const existing = await this.audioCache.get(cacheKey);
    if (existing) return existing;
    if (this.inFlightPrefetches.has(cacheKey)) return null;

    this.inFlightPrefetches.add(cacheKey);
    const ttsClient = ttsServiceOverride ?? TTSClientFactory.create(settings);

    try {
      const blob = await ttsClient.fetchAudioBlob(nextText, settings, signal);
      if (signal?.aborted) return null;

      await this.audioCache.set(cacheKey, blob);
      return blob;
    } catch (err) {
      if (signal?.aborted) return null;
      console.warn(`[PipelineNextChunk] Lỗi prefetch chunk ${cacheInfo.chunkIndex}:`, err);
      return null;
    } finally {
      this.inFlightPrefetches.delete(cacheKey);
    }
  }
}
