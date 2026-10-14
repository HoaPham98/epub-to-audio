import { AudioChunk, ModelOption, TTSSettings, VoiceOption } from '../entities';

export interface ITTSStreamingService {
  streamSpeech(
    text: string,
    settings: TTSSettings,
    signal?: AbortSignal
  ): AsyncIterable<AudioChunk>;

  fetchAudioBlob(
    text: string,
    settings: TTSSettings,
    signal?: AbortSignal
  ): Promise<Blob>;

  fetchVoices(
    endpoint: string,
    apiKey: string,
    useProxy?: boolean
  ): Promise<VoiceOption[]>;

  fetchModels(
    endpoint: string,
    apiKey: string,
    useProxy?: boolean
  ): Promise<ModelOption[]>;

  testConnection(
    settings: TTSSettings
  ): Promise<{ success: boolean; message: string }>;
}
