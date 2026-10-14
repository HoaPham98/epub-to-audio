import {
  AudioChunk,
  ITTSStreamingService,
  ModelOption,
  TTSSettings,
  VoiceOption,
} from '@/domain';
import { base64ToArrayBuffer, concatenateArrayBuffers, pcmToWavBlob } from './pcmUtils';

export class VieNeuStreamTTSClient implements ITTSStreamingService {
  async *streamSpeech(
    text: string,
    settings: TTSSettings,
    signal?: AbortSignal
  ): AsyncIterable<AudioChunk> {
    const cleanEndpoint = (settings.endpoint || 'http://localhost:8000/v1').trim().replace(/\/+$/, '');
    const directUrl = cleanEndpoint.endsWith('/audio/speech')
      ? cleanEndpoint
      : `${cleanEndpoint}/audio/speech`;

    const sampleRate = settings.sampleRate || 24000;
    const requestBody = {
      model: settings.model || 'vieneu-v3-turbo',
      input: text,
      voice: settings.voice || 'Mai Anh',
      speed: settings.speed || 1.0,
      response_format: 'pcm',
      stream_format: 'sse',
      sample_rate: sampleRate,
      max_chars: settings.maxChars || 256,
      ...(settings.temperature !== undefined ? { temperature: settings.temperature } : {}),
      ...(settings.topK !== undefined ? { top_k: settings.topK } : {}),
      ...(settings.topP !== undefined ? { top_p: settings.topP } : {}),
      ...(settings.repetitionPenalty !== undefined ? { repetition_penalty: settings.repetitionPenalty } : {}),
    };

    let response: Response | null = null;

    // 1. Attempt direct connection if not forcing proxy
    if (!settings.useProxy) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        };
        if (settings.apiKey?.trim()) {
          headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
        }
        response = await fetch(directUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal,
        });
      } catch (err: unknown) {
        if (signal?.aborted) throw err;
        console.warn('[VieNeuStreamTTSClient] Direct fetch failed, falling back to proxy...', err);
      }
    }

    // 2. Fall back to proxy if direct connection was skipped or failed
    if (!response || !response.ok) {
      const proxyUrl = '/api/tts-proxy';
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          ...requestBody,
          endpoint: cleanEndpoint,
          apiKey: settings.apiKey,
        }),
        signal,
      });
    }

    if (!response.ok) {
      let errMsg = `Lỗi ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) errMsg = errJson.error.message;
        else if (errJson?.error) errMsg = errJson.error;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    // 3. Parse Server-Sent Events (SSE)
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) {
          await reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataContent = trimmed.slice(5).trim();
          if (dataContent === '[DONE]') break;

          try {
            const event = JSON.parse(dataContent);
            if (event.type === 'speech.audio.delta' && event.audio) {
              const pcmBuffer = base64ToArrayBuffer(event.audio);
              yield {
                pcmBuffer,
                sampleRate,
                channels: 1,
              };
            } else if (event.type === 'speech.audio.done') {
              break;
            }
          } catch {
            // Ignore non-json lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async fetchAudioBlob(
    text: string,
    settings: TTSSettings,
    signal?: AbortSignal
  ): Promise<Blob> {
    const pcmChunks: ArrayBuffer[] = [];
    const sampleRate = settings.sampleRate || 24000;

    for await (const chunk of this.streamSpeech(text, settings, signal)) {
      pcmChunks.push(chunk.pcmBuffer);
    }

    const fullBuffer = concatenateArrayBuffers(pcmChunks);
    return pcmToWavBlob(fullBuffer, sampleRate);
  }

  async fetchVoices(
    endpoint: string,
    apiKey: string,
    useProxy = false
  ): Promise<VoiceOption[]> {
    let cleanEndpoint = (endpoint || 'http://localhost:8000/v1').trim().replace(/\/+$/, '');
    if (cleanEndpoint.endsWith('/audio/speech')) {
      cleanEndpoint = cleanEndpoint.replace(/\/audio\/speech$/, '');
    }
    const targetUrl = cleanEndpoint.endsWith('/voices') ? cleanEndpoint : `${cleanEndpoint}/voices`;

    let rawData: unknown = null;
    if (!useProxy) {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (apiKey?.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`;
        const res = await fetch(targetUrl, { method: 'GET', headers });
        if (res.ok) rawData = await res.json();
      } catch {
        // Direct fetch failed, fallback to proxy
      }
    }

    if (!rawData) {
      const proxyRes = await fetch('/api/voices-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: cleanEndpoint, apiKey }),
      });
      if (proxyRes.ok) rawData = await proxyRes.json();
    }

    return this.parseVoices(rawData);
  }

  async fetchModels(
    endpoint: string,
    apiKey: string,
    useProxy = false
  ): Promise<ModelOption[]> {
    let cleanEndpoint = (endpoint || 'http://localhost:8000/v1').trim().replace(/\/+$/, '');
    if (cleanEndpoint.endsWith('/audio/speech')) {
      cleanEndpoint = cleanEndpoint.replace(/\/audio\/speech$/, '');
    }
    const targetUrl = cleanEndpoint.endsWith('/models') ? cleanEndpoint : `${cleanEndpoint}/models`;

    let rawData: unknown = null;
    if (!useProxy) {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (apiKey?.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`;
        const res = await fetch(targetUrl, { method: 'GET', headers });
        if (res.ok) rawData = await res.json();
      } catch {
        // Fallback to proxy
      }
    }

    if (!rawData) {
      const proxyRes = await fetch('/api/models-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: cleanEndpoint, apiKey }),
      });
      if (proxyRes.ok) rawData = await proxyRes.json();
    }

    return this.parseModels(rawData);
  }

  async testConnection(settings: TTSSettings): Promise<{ success: boolean; message: string }> {
    try {
      const testText = 'Xin chào, kiểm tra kết nối VieNeu-TTS thành công!';
      await this.fetchAudioBlob(testText, settings);
      return {
        success: true,
        message: 'Kết nối và stream VieNeu-TTS thành công!',
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Lỗi kết nối không xác định',
      };
    }
  }

  private parseVoices(data: unknown): VoiceOption[] {
    if (!data) return [];
    let list: unknown[] = [];
    if (Array.isArray(data)) list = data;
    else if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.voices)) list = obj.voices;
      else if (Array.isArray(obj.data)) list = obj.data;
      else if (Array.isArray(obj.items)) list = obj.items;
      else {
        const keys = Object.keys(obj);
        return keys.map(k => {
          const item = obj[k] as Record<string, unknown>;
          return { id: k, name: String(item?.name || k), gender: item?.gender ? String(item.gender) : undefined };
        });
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
        const gender = v.gender ? String(v.gender) : undefined;
        const description = v.description ? String(v.description) : undefined;
        if (id) voices.push({ id, name, language, gender, description });
      }
    }
    return voices;
  }

  private parseModels(data: unknown): ModelOption[] {
    if (!data) return [];
    let list: unknown[] = [];
    if (Array.isArray(data)) list = data;
    else if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.data)) list = obj.data;
      else if (Array.isArray(obj.models)) list = obj.models;
    }
    const models: ModelOption[] = [];
    for (const item of list) {
      if (typeof item === 'string') models.push({ id: item, name: item });
      else if (item && typeof item === 'object') {
        const m = item as Record<string, unknown>;
        const id = String(m.id || m.model || m.name || '');
        const name = String(m.name || m.label || id);
        if (id) models.push({ id, name });
      }
    }
    return models;
  }
}
