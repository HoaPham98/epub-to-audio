import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../../domain/domain.dart';

class StandardOpenAITTSClient implements ITTSStreamingService {
  final http.Client? customClient;

  const StandardOpenAITTSClient({this.customClient});

  http.Client _createClient() => customClient ?? http.Client();

  String _resolveSpeechUrl(String endpoint) {
    var clean = (endpoint.isEmpty ? 'https://api.openai.com/v1' : endpoint)
        .trim()
        .replaceAll(RegExp(r'/+$'), '');
    if (clean.endsWith('/audio/speech')) return clean;
    return '$clean/audio/speech';
  }

  @override
  Stream<AudioChunk> streamSpeech(
    String text,
    TTSSettings settings, {
    void Function()? onCancel,
  }) async* {
    final bytes = await fetchAudioBytes(text, settings);
    yield AudioChunk(
      pcmBuffer: bytes,
      sampleRate: settings.sampleRate,
      channels: 1,
      isLast: true,
    );
  }

  @override
  Future<Uint8List> fetchAudioBytes(
    String text,
    TTSSettings settings,
  ) async {
    final client = _createClient();
    final url = Uri.parse(_resolveSpeechUrl(settings.endpoint));

    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (settings.apiKey.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${settings.apiKey.trim()}';
    }

    final format = settings.responseFormat.isEmpty ? 'wav' : settings.responseFormat;
    final requestBody = jsonEncode({
      'model': settings.model.isEmpty ? 'tts-1' : settings.model,
      'input': text,
      'voice': settings.voice.isEmpty ? 'alloy' : settings.voice,
      'speed': settings.speed,
      'response_format': format,
    });

    try {
      final res = await client.post(url, headers: headers, body: requestBody);
      if (res.statusCode != 200) {
        throw http.ClientException('Lỗi ${res.statusCode} từ máy chủ OpenAI', url);
      }

      final bytes = res.bodyBytes;
      if (format.toLowerCase() == 'pcm') {
        return pcmToWav(
          bytes,
          sampleRate: settings.sampleRate,
          channels: 1,
        );
      }
      return bytes;
    } finally {
      if (customClient == null) client.close();
    }
  }

  @override
  Future<List<VoiceOption>> fetchVoices(
    String endpoint,
    String apiKey,
  ) async {
    return const [
      VoiceOption(id: 'alloy', name: 'Alloy'),
      VoiceOption(id: 'echo', name: 'Echo'),
      VoiceOption(id: 'fable', name: 'Fable'),
      VoiceOption(id: 'onyx', name: 'Onyx'),
      VoiceOption(id: 'nova', name: 'Nova'),
      VoiceOption(id: 'shimmer', name: 'Shimmer'),
    ];
  }

  @override
  Future<List<ModelOption>> fetchModels(
    String endpoint,
    String apiKey,
  ) async {
    return const [
      ModelOption(id: 'tts-1', name: 'TTS-1 (Standard)'),
      ModelOption(id: 'tts-1-hd', name: 'TTS-1 HD (High Quality)'),
    ];
  }

  @override
  Future<({bool success, String message})> testConnection(
    TTSSettings settings,
  ) async {
    try {
      const testText = 'Hello OpenAI TTS';
      await fetchAudioBytes(testText, settings);
      return (
        success: true,
        message: 'Kết nối OpenAI TTS thành công!',
      );
    } catch (e) {
      return (
        success: false,
        message: e.toString(),
      );
    }
  }
}
