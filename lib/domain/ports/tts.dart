import 'dart:typed_data';
import '../entities/audio.dart';
import '../entities/tts.dart';

abstract interface class ITTSStreamingService {
  Stream<AudioChunk> streamSpeech(
    String text,
    TTSSettings settings, {
    void Function()? onCancel,
  });

  Future<Uint8List> fetchAudioBytes(
    String text,
    TTSSettings settings,
  );

  Future<List<VoiceOption>> fetchVoices(
    String endpoint,
    String apiKey,
  );

  Future<List<ModelOption>> fetchModels(
    String endpoint,
    String apiKey,
  );

  Future<({bool success, String message})> testConnection(
    TTSSettings settings,
  );
}
