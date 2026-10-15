import {
  ChunkMeta,
  IAudioCacheRepository,
  IAudioStreamPlayer,
  ITTSStreamingService,
  TTSSettings,
} from '@/domain';
import {
  concatenateArrayBuffers,
  pcmToWavBlob,
  TTSClientFactory,
} from '@/infrastructure';

export interface StreamAndPlayParams {
  text: string;
  settings: TTSSettings;
  cacheInfo?: {
    bookId: string;
    chapterIndex: number;
    chunkIndex: number;
  };
  append?: boolean;
  signal?: AbortSignal;
  ttsServiceOverride?: ITTSStreamingService;
  onFirstData?: () => void;
  onNetworkDone?: () => void;
}

export interface StreamAndPlayResult {
  fromCache: boolean;
  blob?: Blob;
}

export class StreamAndPlayChunkUseCase {
  constructor(
    private readonly audioPlayer: IAudioStreamPlayer,
    private readonly audioCache: IAudioCacheRepository
  ) {}

  async execute(params: StreamAndPlayParams): Promise<StreamAndPlayResult> {
    const {
      text,
      settings,
      cacheInfo,
      append = false,
      signal,
      ttsServiceOverride,
      onFirstData,
      onNetworkDone,
    } = params;

    const meta: ChunkMeta | undefined = cacheInfo
      ? { chapterIndex: cacheInfo.chapterIndex, chunkIndex: cacheInfo.chunkIndex }
      : undefined;

    let cacheKey = '';
    if (cacheInfo) {
      cacheKey = this.audioCache.buildKey(
        cacheInfo.bookId,
        cacheInfo.chapterIndex,
        cacheInfo.chunkIndex,
        settings.model,
        settings.voice,
        settings.speed,
        'wav'
      );

      const cachedBlob = await this.audioCache.get(cacheKey);
      if (cachedBlob) {
        if (signal?.aborted) return { fromCache: true, blob: cachedBlob };
        onFirstData?.();
        await this.audioPlayer.playCachedBlob(cachedBlob, settings.speed, append, meta);
        onNetworkDone?.();
        return { fromCache: true, blob: cachedBlob };
      }
    }

    if (signal?.aborted) return { fromCache: false };

    await this.audioPlayer.init();
    if (!append) {
      this.audioPlayer.stop(false);
    }

    const ttsClient = ttsServiceOverride ?? TTSClientFactory.create(settings);
    const pcmBuffers: ArrayBuffer[] = [];
    const sampleRate = settings.sampleRate || 24000;
    let hasFiredFirstData = false;

    try {
      for await (const chunk of ttsClient.streamSpeech(text, settings, signal)) {
        if (signal?.aborted) {
          if (!append) {
            this.audioPlayer.stop();
          }
          return { fromCache: false };
        }

        this.audioPlayer.queuePcmChunk(chunk.pcmBuffer, chunk.sampleRate || sampleRate, meta);
        pcmBuffers.push(chunk.pcmBuffer);

        if (!hasFiredFirstData) {
          hasFiredFirstData = true;
          onFirstData?.();
        }
      }

      if (signal?.aborted) {
        if (!append) {
          this.audioPlayer.stop();
        }
        return { fromCache: false };
      }

      // Chunk has completed receiving all audio deltas from network.
      // Call onNetworkDone immediately so the caller knows the TTS server stream slot is free!
      onNetworkDone?.();

      if (pcmBuffers.length > 0) {
        const fullBuffer = concatenateArrayBuffers(pcmBuffers);
        const wavBlob = pcmToWavBlob(fullBuffer, sampleRate);
        if (cacheKey) {
          // Asynchronously persist to cache without blocking playback
          this.audioCache.set(cacheKey, wavBlob, this.audioPlayer.getDuration()).catch(err => {
            console.warn('Failed to cache audio in background:', err);
          });
        }
        return { fromCache: false, blob: wavBlob };
      }

      return { fromCache: false };
    } catch (err: unknown) {
      if (signal?.aborted) {
        return { fromCache: false };
      }
      throw err;
    }
  }
}
