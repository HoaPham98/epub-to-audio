import { TTSSettings } from '@/types';
import { buildAudioCacheKey, getCachedAudio, setCachedAudio } from './db';

export class TTSError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'TTSError';
  }
}

/**
 * Sequential execution queue to prevent concurrent requests to the TTS endpoint.
 * Protects against 429 Too Many Requests on local/rate-limited servers.
 */
class SequentialRequestQueue {
  private queue: Promise<void> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try {
          const result = await task();
          // 400ms cooldown between sequential requests
          await new Promise(r => setTimeout(r, 400));
          resolve(result);
        } catch (err) {
          await new Promise(r => setTimeout(r, 400));
          reject(err);
        }
      });
    });
  }
}

const globalTTSQueue = new SequentialRequestQueue();

// In-flight request deduplication map
const inFlightRequests = new Map<string, Promise<Blob>>();

/**
 * Executes a fetch function with automatic retries on 429 Too Many Requests.
 */
async function executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      const is429 =
        (err instanceof TTSError && err.status === 429) ||
        (err instanceof Error && err.message.includes('429'));

      if (is429 && attempt <= maxRetries) {
        const waitMs = attempt * 1500;
        console.warn(`[TTS 429] Server báo quá nhiều yêu cầu. Đang tạm dừng ${waitMs}ms và thử lại lần ${attempt}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Converts raw PCM audio buffer to a playable WAV Blob with a standard 44-byte RIFF header.
 */
function pcmToWavBlob(pcmBuffer: ArrayBuffer, sampleRate = 24000, numChannels = 1, bitDepth = 16): Blob {
  const dataLength = pcmBuffer.byteLength;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, (sampleRate * numChannels * bitDepth) / 8, true); // ByteRate
  view.setUint16(32, (numChannels * bitDepth) / 8, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Write actual PCM data
  new Uint8Array(buffer, 44).set(new Uint8Array(pcmBuffer));

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Generates speech for a text string, using cache if available.
 * Requests are strictly queued sequentially and automatically retried on 429.
 */
export async function fetchTTSAudio(
  text: string,
  settings: TTSSettings,
  cacheKeyInfo?: { bookId: string; chapterIndex: number; chunkIndex: number }
): Promise<Blob> {
  if (!settings.apiKey) {
    throw new TTSError('Chưa cấu hình API Key. Vui lòng mở Cài đặt (Settings) để nhập API Key của bạn.');
  }

  const format = settings.responseFormat || 'wav';

  // 1. Check IndexedDB cache if cache info is provided
  let cacheKey = '';
  if (cacheKeyInfo) {
    cacheKey = buildAudioCacheKey(
      cacheKeyInfo.bookId,
      cacheKeyInfo.chapterIndex,
      cacheKeyInfo.chunkIndex,
      settings.model,
      settings.voice,
      settings.speed,
      format
    );
    const cachedBlob = await getCachedAudio(cacheKey);
    if (cachedBlob) {
      return cachedBlob;
    }

    // Check if another call (e.g. background prefetch) is already downloading this chunk
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!;
    }
  }

  // 2. Prepare payload
  const cleanEndpoint = (settings.endpoint || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  const directUrl = cleanEndpoint.endsWith('/audio/speech')
    ? cleanEndpoint
    : `${cleanEndpoint}/audio/speech`;

  const requestBody = {
    model: settings.model || 'tts-1',
    input: text,
    voice: settings.voice || 'alloy',
    speed: settings.speed || 1.0,
    response_format: format,
  };

  // 3. Queue network request to avoid overloading the TTS endpoint
  const fetchPromise = globalTTSQueue.enqueue(() =>
    executeWithRetry(async () => {
      let audioBlob: Blob | null = null;

      // Attempt direct fetch if proxy is not forced
      if (!settings.useProxy) {
        try {
          const response = await fetch(directUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${settings.apiKey.trim()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            let errMsg = `Lỗi ${response.status}: ${response.statusText}`;
            try {
              const errData = await response.json();
              if (errData?.error?.message) {
                errMsg = errData.error.message;
              } else if (errData?.message) {
                errMsg = errData.message;
              }
            } catch {
              // ignore
            }
            throw new TTSError(errMsg, response.status);
          }

          if (format.toLowerCase() === 'pcm') {
            const pcmBuffer = await response.arrayBuffer();
            audioBlob = pcmToWavBlob(pcmBuffer);
          } else {
            audioBlob = await response.blob();
          }
        } catch (err: unknown) {
          if (err instanceof TTSError) {
            throw err;
          }
          console.warn('Direct TTS request failed, attempting fallback to /api/tts-proxy...', err);
        }
      }

      // If direct fetch was skipped or failed due to CORS/network, use proxy
      if (!audioBlob) {
        const proxyResponse = await fetch('/api/tts-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: settings.endpoint,
            apiKey: settings.apiKey,
            model: settings.model,
            input: text,
            voice: settings.voice,
            speed: settings.speed,
            response_format: format,
          }),
        });

        if (!proxyResponse.ok) {
          let errMsg = `Lỗi Proxy (${proxyResponse.status})`;
          try {
            const errJson = await proxyResponse.json();
            if (errJson?.error) errMsg = errJson.error;
          } catch {
            // ignore
          }
          throw new TTSError(errMsg, proxyResponse.status);
        }

        if (format.toLowerCase() === 'pcm') {
          const pcmBuffer = await proxyResponse.arrayBuffer();
          audioBlob = pcmToWavBlob(pcmBuffer);
        } else {
          audioBlob = await proxyResponse.blob();
        }
      }

      // 4. Store in IndexedDB cache for instant future reuse
      if (cacheKey && audioBlob) {
        await setCachedAudio(cacheKey, audioBlob);
      }

      return audioBlob;
    })
  );

  if (cacheKey) {
    inFlightRequests.set(cacheKey, fetchPromise);
    fetchPromise.finally(() => {
      inFlightRequests.delete(cacheKey);
    });
  }

  return fetchPromise;
}

/**
 * Tests connection to the OpenAI TTS endpoint with a short sample text.
 */
export async function testTTSConnection(settings: TTSSettings): Promise<{ success: boolean; message: string }> {
  try {
    const testText = 'Xin chào, kiểm tra kết nối TTS thành công!';
    await fetchTTSAudio(testText, settings);
    return {
      success: true,
      message: 'Kết nối và tạo âm thanh thử nghiệm thành công!',
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Lỗi kết nối không xác định';
    return {
      success: false,
      message: msg,
    };
  }
}

export interface VoiceOption {
  id: string;
  name: string;
  language?: string;
}

/**
 * Fetches the list of available voices from GET /v1/voices.
 */
export async function fetchAvailableVoices(
  endpoint: string,
  apiKey: string,
  useProxy = false
): Promise<VoiceOption[]> {
  let cleanEndpoint = (endpoint || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  if (cleanEndpoint.endsWith('/audio/speech')) {
    cleanEndpoint = cleanEndpoint.replace(/\/audio\/speech$/, '');
  }
  const targetUrl = cleanEndpoint.endsWith('/voices')
    ? cleanEndpoint
    : `${cleanEndpoint}/voices`;

  let rawData: unknown = null;

  // 1. Try direct fetch first if not forced proxy
  if (!useProxy) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }
      const res = await fetch(targetUrl, { method: 'GET', headers });
      if (res.ok) {
        rawData = await res.json();
      }
    } catch {
      // Direct fetch failed (likely CORS), will try proxy
    }
  }

  // 2. Fall back to /api/voices-proxy
  if (!rawData) {
    const proxyRes = await fetch('/api/voices-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: cleanEndpoint, apiKey }),
    });

    if (!proxyRes.ok) {
      let errMsg = `Không thể tải danh sách voices (${proxyRes.status})`;
      try {
        const errJson = await proxyRes.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }
    rawData = await proxyRes.json();
  }

  return extractVoicesList(rawData);
}

function extractVoicesList(data: unknown): VoiceOption[] {
  if (!data) return [];

  let list: unknown[] = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.voices)) {
      list = obj.voices;
    } else if (Array.isArray(obj.data)) {
      list = obj.data;
    } else if (Array.isArray(obj.items)) {
      list = obj.items;
    } else {
      const keys = Object.keys(obj);
      if (keys.length > 0 && typeof obj[keys[0]] === 'object') {
        return keys.map(k => {
          const item = obj[k] as Record<string, unknown>;
          return { id: k, name: String(item?.name || k) };
        });
      }
    }
  }

  const voices: VoiceOption[] = [];
  for (const item of list) {
    if (typeof item === 'string') {
      voices.push({ id: item, name: item });
    } else if (item && typeof item === 'object') {
      const v = item as Record<string, unknown>;
      const id = String(v.id || v.voice_id || v.name || v.voice || '');
      const name = String(v.name || v.label || v.id || id);
      const language = v.language || v.lang ? String(v.language || v.lang) : undefined;
      if (id) {
        voices.push({ id, name, language });
      }
    }
  }

  return voices;
}

export interface ModelOption {
  id: string;
  name?: string;
}

/**
 * Fetches the list of available models from GET /v1/models.
 */
export async function fetchAvailableModels(
  endpoint: string,
  apiKey: string,
  useProxy = false
): Promise<ModelOption[]> {
  let cleanEndpoint = (endpoint || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  if (cleanEndpoint.endsWith('/audio/speech')) {
    cleanEndpoint = cleanEndpoint.replace(/\/audio\/speech$/, '');
  }
  const targetUrl = cleanEndpoint.endsWith('/models')
    ? cleanEndpoint
    : `${cleanEndpoint}/models`;

  let rawData: unknown = null;

  // 1. Try direct fetch first if not forced proxy
  if (!useProxy) {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (apiKey && apiKey.trim()) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }
      const res = await fetch(targetUrl, { method: 'GET', headers });
      if (res.ok) {
        rawData = await res.json();
      }
    } catch {
      // Direct fetch failed (likely CORS), will try proxy
    }
  }

  // 2. Fall back to /api/models-proxy
  if (!rawData) {
    const proxyRes = await fetch('/api/models-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: cleanEndpoint, apiKey }),
    });

    if (!proxyRes.ok) {
      let errMsg = `Không thể tải danh sách models (${proxyRes.status})`;
      try {
        const errJson = await proxyRes.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }
    rawData = await proxyRes.json();
  }

  return extractModelsList(rawData);
}

function extractModelsList(data: unknown): ModelOption[] {
  if (!data) return [];

  let list: unknown[] = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      list = obj.data;
    } else if (Array.isArray(obj.models)) {
      list = obj.models;
    } else if (Array.isArray(obj.items)) {
      list = obj.items;
    } else {
      const keys = Object.keys(obj);
      if (keys.length > 0 && typeof obj[keys[0]] === 'object') {
        return keys.map(k => ({ id: k, name: k }));
      }
    }
  }

  const models: ModelOption[] = [];
  for (const item of list) {
    if (typeof item === 'string') {
      models.push({ id: item, name: item });
    } else if (item && typeof item === 'object') {
      const m = item as Record<string, unknown>;
      const id = String(m.id || m.model || m.name || '');
      const name = String(m.name || m.label || id);
      if (id) {
        models.push({ id, name });
      }
    }
  }

  return models;
}
