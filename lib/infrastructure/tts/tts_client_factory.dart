import '../../domain/domain.dart';
import 'on_device_tts.dart';
import 'standard_openai_tts_client.dart';
import 'vieneu_stream_tts_client.dart';

class TTSClientFactory {
  static const _vieneuStreamClient = VieNeuStreamTTSClient();
  static const _standardOpenAIClient = StandardOpenAITTSClient();
  static const _onDeviceClient = OnDeviceVieNeuTTSClient();

  static ITTSStreamingService create(
    TTSSettings settings, {
    ITTSStreamingService? customClient,
  }) {
    if (customClient != null) return customClient;

    if (settings.ttsMode == TtsMode.offline) {
      return _onDeviceClient;
    }

    final endpoint = settings.endpoint.toLowerCase();
    final model = settings.model.toLowerCase();

    if (endpoint.contains('api.openai.com') && !model.contains('vieneu')) {
      return _standardOpenAIClient;
    }

    return _vieneuStreamClient;
  }
}
