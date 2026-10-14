export interface TTSSettings {
  endpoint: string;
  apiKey: string;
  model: string;
  voice: string;
  responseFormat: string;
  speed: number;
  useProxy: boolean;
  enablePrefetch?: boolean;
  requestDelayMs?: number;
  // Advanced VieNeu-TTS settings
  sampleRate?: number; // 48000, 24000, 16000, 8000
  temperature?: number; // 0.0 - 2.0
  topK?: number; // 1 - 1024
  topP?: number; // 0.0 - 1.0
  repetitionPenalty?: number; // 1.0 - 2.0
  maxChars?: number; // 64 - 512, default 256
}

export interface VoiceOption {
  id: string;
  name: string;
  language?: string;
  gender?: string;
  description?: string;
}

export interface ModelOption {
  id: string;
  name?: string;
}
