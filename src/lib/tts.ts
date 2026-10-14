import { TTSSettings } from '@/types';
import { buildAudioCacheKey, getCachedAudio, setCachedAudio } from './db';

export class TTSError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'TTSError';
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

  let audioBlob: Blob | null = null;

  // 3. Attempt direct fetch if proxy is not forced
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
      // If direct fetch fails with Network/CORS error, try falling back to our Next.js API proxy
      if (err instanceof TTSError) {
        throw err;
      }
      console.warn('Direct TTS request failed, attempting fallback to /api/tts-proxy...', err);
    }
  }

  // 4. If direct fetch was skipped or failed due to CORS/network, use proxy
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

  // 5. Store in IndexedDB cache for instant future reuse
  if (cacheKey && audioBlob) {
    await setCachedAudio(cacheKey, audioBlob);
  }

  return audioBlob;
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

