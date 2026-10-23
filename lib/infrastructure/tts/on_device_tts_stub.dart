import 'dart:typed_data';
import '../../domain/domain.dart';

class OnDeviceVieNeuTTSClient implements ITTSStreamingService {
  const OnDeviceVieNeuTTSClient();

  @override
  Stream<AudioChunk> streamSpeech(
    String text,
    TTSSettings settings, {
    void Function()? onCancel,
  }) async* {
    throw UnsupportedError('On-device TTS is not supported on this platform.');
  }

  @override
  Future<Uint8List> fetchAudioBytes(
    String text,
    TTSSettings settings,
  ) async {
    throw UnsupportedError('On-device TTS is not supported on this platform.');
  }

  @override
  Future<List<VoiceOption>> fetchVoices(
    String endpoint,
    String apiKey,
  ) async {
    return const [];
  }

  @override
  Future<List<ModelOption>> fetchModels(
    String endpoint,
    String apiKey,
  ) async {
    return const [];
  }

  @override
  Future<({bool success, String message})> testConnection(
    TTSSettings settings,
  ) async {
    return (
      success: false,
      message: 'On-device TTS is not supported on this platform.'
    );
  }
}

class OfflineModelManagerService implements IOfflineModelManager {
  const OfflineModelManagerService();

  @override
  Future<bool> isModelDownloaded() async => false;

  @override
  Future<bool> isDictionaryDownloaded() async => false;

  @override
  Future<bool> isEngineInitialized() async => false;

  @override
  Future<String> getModelPath() async => '';

  @override
  Future<String> getDictionaryPath() async => '';

  @override
  Stream<ModelDownloadProgress> downloadModel({
    String? customUrl,
    void Function()? onCancel,
  }) async* {
    throw UnsupportedError(
        'Offline model download is not supported on this platform.');
  }

  @override
  Stream<ModelDownloadProgress> downloadDictionary({
    String? customUrl,
    void Function()? onCancel,
  }) async* {
    throw UnsupportedError(
        'Offline model download is not supported on this platform.');
  }

  @override
  Future<void> initializeEngine({int threads = 4}) async {
    throw UnsupportedError(
        'Offline model initialization is not supported on this platform.');
  }

  @override
  Future<void> disposeEngine() async {}

  @override
  Future<void> deleteModelFiles() async {}
}
