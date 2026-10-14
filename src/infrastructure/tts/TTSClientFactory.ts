import { ITTSStreamingService, TTSSettings } from '@/domain';
import { VieNeuStreamTTSClient } from './VieNeuStreamTTSClient';
import { StandardOpenAITTSClient } from './StandardOpenAITTSClient';

export class TTSClientFactory {
  private static vieneuClient = new VieNeuStreamTTSClient();
  private static standardClient = new StandardOpenAITTSClient();

  static create(settings: TTSSettings): ITTSStreamingService {
    const endpoint = (settings.endpoint || '').toLowerCase();
    const model = (settings.model || '').toLowerCase();

    // If strictly OpenAI official domain and using standard tts-1 without SSE
    if (
      endpoint.includes('api.openai.com') &&
      !model.includes('vieneu')
    ) {
      return this.standardClient;
    }

    // Default to optimized VieNeuStreamTTSClient for local/self-hosted/VieNeu endpoints
    return this.vieneuClient;
  }
}
