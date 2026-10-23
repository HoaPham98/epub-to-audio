import 'dart:convert';
import 'dart:typed_data';
import 'package:epub_to_audio/domain/domain.dart';
import 'package:epub_to_audio/infrastructure/tts/on_device_tts.dart';
import 'package:epub_to_audio/infrastructure/tts/standard_openai_tts_client.dart';
import 'package:epub_to_audio/infrastructure/tts/tts_client_factory.dart';
import 'package:epub_to_audio/infrastructure/tts/vieneu_stream_tts_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  group('VieNeuStreamTTSClient (SSE parsing & 429 retry)', () {
    test('successfully parses real-time SSE speech.audio.delta base64 PCM stream',
        () async {
      final pcm1 = Uint8List.fromList([1, 2, 3, 4]);
      final pcm2 = Uint8List.fromList([5, 6, 7, 8]);

      final ssePayload = '''
event: message
data: {"type": "speech.audio.delta", "audio": "${base64Encode(pcm1)}"}

event: message
data: {"type": "speech.audio.delta", "audio": "${base64Encode(pcm2)}"}

event: message
data: {"type": "speech.audio.done"}

data: [DONE]
''';

      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/audio/speech'));
        expect(request.headers['Accept'], equals('text/event-stream'));

        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['stream_format'], equals('sse'));
        expect(body['response_format'], equals('pcm'));
        expect(body.containsKey('max_chars'), isFalse);

        return http.Response(
          ssePayload,
          200,
          headers: {'content-type': 'text/event-stream'},
        );
      });

      final client = VieNeuStreamTTSClient(customClient: mockClient);
      const settings = TTSSettings(
        endpoint: 'http://localhost:8000/v1',
        sampleRate: 24000,
      );

      final chunks = await client.streamSpeech('Xin chào', settings).toList();

      expect(chunks.length, equals(2));
      expect(chunks[0].pcmBuffer, equals(pcm1));
      expect(chunks[0].sampleRate, equals(24000));
      expect(chunks[1].pcmBuffer, equals(pcm2));
    });

    test('retries with backoff on HTTP 429 Server Busy before succeeding',
        () async {
      int requestCount = 0;
      final pcm = Uint8List.fromList([10, 20]);

      final mockClient = MockClient((request) async {
        requestCount++;
        if (requestCount == 1) {
          // First attempt: 429 Server Busy with Retry-After 1s
          return http.Response(
            '{"error": "Server busy"}',
            429,
            headers: {'retry-after': '1'},
          );
        }
        // Second attempt: succeeds
        return http.Response(
          'data: {"type": "speech.audio.delta", "audio": "${base64Encode(pcm)}"}\n\ndata: [DONE]\n',
          200,
          headers: {'content-type': 'text/event-stream'},
        );
      });

      final client = VieNeuStreamTTSClient(
        customClient: mockClient,
        initialRetryDelay: const Duration(milliseconds: 10),
      );

      final chunks = await client
          .streamSpeech('Xin chào', const TTSSettings())
          .toList();

      expect(requestCount, equals(2));
      expect(chunks.length, equals(1));
      expect(chunks[0].pcmBuffer, equals(pcm));
    });
  });

  group('StandardOpenAITTSClient', () {
    test('fetches full audio buffer via standard POST /v1/audio/speech',
        () async {
      final wavData = Uint8List.fromList([82, 73, 70, 70, 1, 2, 3, 4]);

      final mockClient = MockClient((request) async {
        expect(request.url.path, endsWith('/audio/speech'));
        return http.Response.bytes(
          wavData,
          200,
          headers: {'content-type': 'audio/wav'},
        );
      });

      final client = StandardOpenAITTSClient(customClient: mockClient);
      const settings = TTSSettings(
        endpoint: 'https://api.openai.com/v1',
        model: 'tts-1',
        voice: 'alloy',
        responseFormat: 'wav',
      );

      final chunks = await client.streamSpeech('Hello', settings).toList();
      expect(chunks.length, equals(1));
      expect(chunks[0].pcmBuffer, equals(wavData));
      expect(chunks[0].isLast, isTrue);
    });
  });

  group('TTSClientFactory', () {
    test('routes to appropriate client based on TTSSettings', () {
      const offlineSettings = TTSSettings(ttsMode: TtsMode.offline);
      final offlineClient = TTSClientFactory.create(offlineSettings);
      expect(offlineClient, isA<OnDeviceVieNeuTTSClient>());

      const openaiSettings = TTSSettings(
        ttsMode: TtsMode.remote,
        endpoint: 'https://api.openai.com/v1',
        model: 'tts-1',
      );
      final openaiClient = TTSClientFactory.create(openaiSettings);
      expect(openaiClient, isA<StandardOpenAITTSClient>());

      const vieneuRemoteSettings = TTSSettings(
        ttsMode: TtsMode.remote,
        endpoint: 'https://tts.example.com/v1',
        model: 'vieneu-v3-turbo',
      );
      final vieneuClient = TTSClientFactory.create(vieneuRemoteSettings);
      expect(vieneuClient, isA<VieNeuStreamTTSClient>());
    });
  });
}
