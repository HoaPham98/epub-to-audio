import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../../domain/domain.dart';
import 'cors_proxy_resolver.dart';

class VieNeuStreamTTSClient implements ITTSStreamingService {
  final http.Client? customClient;
  final Duration initialRetryDelay;
  final int maxRetries;

  const VieNeuStreamTTSClient({
    this.customClient,
    this.initialRetryDelay = const Duration(milliseconds: 1000),
    this.maxRetries = 3,
  });

  http.Client _createClient() => customClient ?? http.Client();

  String _resolveSpeechUrl(String endpoint) {
    var clean = (endpoint.isEmpty ? 'http://localhost:8000/v1' : endpoint)
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
    final client = _createClient();
    final rawUrl = _resolveSpeechUrl(settings.endpoint);
    final targetUrl = resolveTTSUrl(rawUrl, settings);
    final url = Uri.parse(targetUrl);

    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };
    if (settings.apiKey.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${settings.apiKey.trim()}';
    }

    final requestBody = jsonEncode({
      'model': settings.model,
      'input': text,
      'voice': settings.voice,
      'response_format': 'pcm',
      'stream_format': 'sse',
      'sample_rate': settings.sampleRate,
      'speed': settings.speed,
      'temperature': settings.temperature,
      'top_k': settings.topK,
      'top_p': settings.topP,
      'repetition_penalty': settings.repetitionPenalty,
      // Note: Do not send restrictive max_chars to prevent mid-sentence chunk splitting
    });

    http.StreamedResponse? response;
    int attempt = 0;

    while (attempt <= maxRetries) {
      final request = http.Request('POST', url)
        ..headers.addAll(headers)
        ..body = requestBody;

      final res = await client.send(request);

      if (res.statusCode == 429 && attempt < maxRetries) {
        final retryAfter = res.headers['retry-after'];
        int delayMs = initialRetryDelay.inMilliseconds * (1 << attempt);
        if (retryAfter != null) {
          final parsed = int.tryParse(retryAfter);
          if (parsed != null && parsed > 0) {
            delayMs = parsed * 1000;
          }
        }
        await Future.delayed(Duration(milliseconds: delayMs));
        attempt++;
        continue;
      }

      response = res;
      break;
    }

    if (response == null || response.statusCode != 200) {
      final status = response?.statusCode ?? 500;
      if (status == 429) {
        throw http.ClientException(
          'Máy chủ VieNeu-TTS đang bận (HTTP 429). Vui lòng thử lại sau giây lát.',
          url,
        );
      }
      throw http.ClientException('Lỗi $status từ máy chủ TTS', url);
    }

    int effectiveSampleRate = settings.sampleRate;
    final headerSampleRate = int.tryParse(response.headers['x-sample-rate'] ?? '');
    if (headerSampleRate != null && headerSampleRate > 0) {
      effectiveSampleRate = headerSampleRate;
    }

    final linesStream = response.stream
        .transform(utf8.decoder)
        .transform(const LineSplitter());

    await for (final line in linesStream) {
      final trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      final dataContent = trimmed.substring(5).trim();
      if (dataContent == '[DONE]') break;

      try {
        final event = jsonDecode(dataContent) as Map<String, dynamic>;
        final type = event['type'];
        if ((type == 'speech.audio.delta' || type == null) && event['audio'] != null) {
          final pcmBytes = base64Decode(event['audio'] as String);
          yield AudioChunk(
            pcmBuffer: pcmBytes,
            sampleRate: effectiveSampleRate,
            channels: 1,
          );
        } else if (type == 'speech.audio.done') {
          break;
        }
      } catch (_) {}
    }

    if (customClient == null) {
      client.close();
    }
  }

  @override
  Future<Uint8List> fetchAudioBytes(
    String text,
    TTSSettings settings,
  ) async {
    final pcmChunks = <Uint8List>[];
    int effectiveRate = settings.sampleRate;
    await for (final chunk in streamSpeech(text, settings)) {
      pcmChunks.add(chunk.pcmBuffer);
      effectiveRate = chunk.sampleRate;
    }

    final totalLen = pcmChunks.fold<int>(0, (sum, b) => sum + b.length);
    final fullPcm = Uint8List(totalLen);
    int offset = 0;
    for (final b in pcmChunks) {
      fullPcm.setRange(offset, offset + b.length, b);
      offset += b.length;
    }

    return pcmToWav(
      fullPcm,
      sampleRate: effectiveRate,
      channels: 1,
    );
  }

  @override
  Future<List<VoiceOption>> fetchVoices(
    String endpoint,
    String apiKey, {
    bool useCorsProxy = false,
    String corsProxyUrl = 'https://proxy.corsfix.com/?',
  }) async {
    final client = _createClient();
    try {
      var clean = (endpoint.isEmpty ? 'http://localhost:8000/v1' : endpoint)
          .trim()
          .replaceAll(RegExp(r'/+$'), '');
      if (clean.endsWith('/audio/speech')) {
        clean = clean.replaceAll(RegExp(r'/audio/speech$'), '');
      }
      final targetUrl = clean.endsWith('/voices') ? clean : '$clean/voices';
      final resolvedUrl = resolveTTSUrl(
        targetUrl,
        TTSSettings(
          endpoint: endpoint,
          apiKey: apiKey,
          useCorsProxy: useCorsProxy,
          corsProxyUrl: corsProxyUrl,
        ),
      );

      final headers = <String, String>{'Accept': 'application/json'};
      if (apiKey.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${apiKey.trim()}';
      }

      final res = await client.get(Uri.parse(resolvedUrl), headers: headers);
      if (res.statusCode == 200) {
        final dynamic data = jsonDecode(res.body);
        return _parseVoices(data);
      }
      return const [];
    } catch (_) {
      return const [];
    } finally {
      if (customClient == null) client.close();
    }
  }

  @override
  Future<List<ModelOption>> fetchModels(
    String endpoint,
    String apiKey, {
    bool useCorsProxy = false,
    String corsProxyUrl = 'https://proxy.corsfix.com/?',
  }) async {
    final client = _createClient();
    try {
      var clean = (endpoint.isEmpty ? 'http://localhost:8000/v1' : endpoint)
          .trim()
          .replaceAll(RegExp(r'/+$'), '');
      if (clean.endsWith('/audio/speech')) {
        clean = clean.replaceAll(RegExp(r'/audio/speech$'), '');
      }
      final targetUrl = clean.endsWith('/models') ? clean : '$clean/models';
      final resolvedUrl = resolveTTSUrl(
        targetUrl,
        TTSSettings(
          endpoint: endpoint,
          apiKey: apiKey,
          useCorsProxy: useCorsProxy,
          corsProxyUrl: corsProxyUrl,
        ),
      );

      final headers = <String, String>{'Accept': 'application/json'};
      if (apiKey.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${apiKey.trim()}';
      }

      final res = await client.get(Uri.parse(resolvedUrl), headers: headers);
      if (res.statusCode == 200) {
        final dynamic data = jsonDecode(res.body);
        return _parseModels(data);
      }
      return const [];
    } catch (_) {
      return const [];
    } finally {
      if (customClient == null) client.close();
    }
  }

  @override
  Future<({bool success, String message})> testConnection(
    TTSSettings settings,
  ) async {
    try {
      const testText = 'Xin chào, kiểm tra kết nối VieNeu-TTS!';
      await fetchAudioBytes(testText, settings);
      return (
        success: true,
        message: 'Kết nối và stream VieNeu-TTS thành công!',
      );
    } catch (e) {
      return (
        success: false,
        message: e.toString(),
      );
    }
  }

  List<VoiceOption> _parseVoices(dynamic data) {
    if (data == null) return const [];
    List<dynamic> list = [];
    if (data is List) {
      list = data;
    } else if (data is Map<String, dynamic>) {
      if (data['voices'] is List) {
        list = data['voices'] as List;
      } else if (data['data'] is List) {
        list = data['data'] as List;
      }
    }

    final voices = <VoiceOption>[];
    for (final item in list) {
      if (item is String) {
        voices.add(VoiceOption(id: item, name: item));
      } else if (item is Map<String, dynamic>) {
        final id = (item['id'] ?? item['voice_id'] ?? item['name'] ?? '').toString();
        final name = (item['name'] ?? item['label'] ?? id).toString();
        if (id.isNotEmpty) {
          voices.add(VoiceOption(
            id: id,
            name: name,
            language: item['language']?.toString(),
            gender: item['gender']?.toString(),
            description: item['description']?.toString(),
          ));
        }
      }
    }
    return voices;
  }

  List<ModelOption> _parseModels(dynamic data) {
    if (data == null) return const [];
    List<dynamic> list = [];
    if (data is List) {
      list = data;
    } else if (data is Map<String, dynamic>) {
      if (data['data'] is List) {
        list = data['data'] as List;
      } else if (data['models'] is List) {
        list = data['models'] as List;
      }
    }

    final models = <ModelOption>[];
    for (final item in list) {
      if (item is String) {
        models.add(ModelOption(id: item, name: item));
      } else if (item is Map<String, dynamic>) {
        final id = (item['id'] ?? item['model'] ?? item['name'] ?? '').toString();
        final name = (item['name'] ?? item['label'] ?? id).toString();
        if (id.isNotEmpty) {
          models.add(ModelOption(id: id, name: name));
        }
      }
    }
    return models;
  }
}
