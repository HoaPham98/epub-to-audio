import {
  AudioChunk,
  ITTSStreamingService,
  ModelOption,
  TTSSettings,
  VoiceOption,
} from '@/domain';
import { pcmToWavBlob } from './pcmUtils';

export class StandardOpenAITTSClient implements ITTSStreamingService {
  async *streamSpeech(
    text: string,
    settings: TTSSettings,
    signal?: AbortSignal
  ): AsyncIterable<AudioChunk> {
    const blob = await this.fetchAudioBlob(text, settings, signal);
    const arrayBuffer = await blob.arrayBuffer();

    // Yield single chunk for standard non-SSE endpoint
    yield {
      pcmBuffer: arrayBuffer,
      sampleRate: settings.sampleRate || 24000,
      channels: 1,
      isLast: true,
    };
  }

  async fetchAudioBlob(
    text: string,
    settings: TTSSettings,
    signal?: AbortSignal
  ): Promise<Blob> {
    const cleanEndpoint = (settings.endpoint || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
    const directUrl = cleanEndpoint.endsWith('/audio/speech')
      ? cleanEndpoint
      : `${cleanEndpoint}/audio/speech`;

    const format = settings.responseFormat || 'wav';
    const requestBody = {
      model: settings.model || 'tts-1',
      input: text,
      voice: settings.voice || 'alloy',
      speed: settings.speed || 1.0,
      response_format: format,
    };

    let response: Response | null = null;

    if (!settings.useProxy) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
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
      } catch (err) {
        if (signal?.aborted) throw err;
      }
    }

    if (!response || !response.ok) {
      response = await fetch('/api/tts-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    if (format.toLowerCase() === 'pcm') {
      const pcmBuffer = await response.arrayBuffer();
      return pcmToWavBlob(pcmBuffer, settings.sampleRate || 24000);
    }

    return await response.blob();
  }

  async fetchVoices(
    endpoint: string,
    apiKey: string,
    useProxy = false
  ): Promise<VoiceOption[]> {
    let cleanEndpoint = (endpoint || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
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
        // Fallback to proxy
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

    // Default OpenAI voices if endpoint does not return /voices list
    if (!rawData) {
      return [
        { id: 'alloy', name: 'Alloy' },
        { id: 'echo', name: 'Echo' },
        { id: 'fable', name: 'Fable' },
        { id: 'onyx', name: 'Onyx' },
        { id: 'nova', name: 'Nova' },
        { id: 'shimmer', name: 'Shimmer' },
      ];
    }

    return [];
  }

  async fetchModels(): Promise<ModelOption[]> {
    return [
      { id: 'tts-1', name: 'TTS-1 (Standard)' },
      { id: 'tts-1-hd', name: 'TTS-1 HD (High Quality)' },
    ];
  }

  async testConnection(settings: TTSSettings): Promise<{ success: boolean; message: string }> {
    try {
      await this.fetchAudioBlob('Xin chào, kiểm tra kết nối OpenAI TTS thành công!', settings);
      return { success: true, message: 'Kết nối OpenAI TTS thành công!' };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : 'Lỗi kết nối không xác định' };
    }
  }
}
