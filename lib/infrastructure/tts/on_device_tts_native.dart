import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import 'package:vieneu_tts/vieneu_tts.dart';
import '../../domain/domain.dart';

class OnDeviceVieNeuTTSClient implements ITTSStreamingService {
  const OnDeviceVieNeuTTSClient();

  @override
  Stream<AudioChunk> streamSpeech(
    String text,
    TTSSettings settings, {
    void Function()? onCancel,
  }) async* {
    final resolvedVoice = VieneuTts.resolveVoiceId(settings.voice);
    final options = TtsSynthesisOptions(
      voice: resolvedVoice,
      speed: settings.speed,
      sampleRate: 24000,
      channels: 1,
      responseFormat: AudioFormat.pcm,
      temperature: settings.temperature,
      topK: settings.topK,
      topP: settings.topP,
      repetitionPenalty: settings.repetitionPenalty,
      maxChars: settings.maxChars,
    );

    final stream = VieneuTts.stream(text: text, options: options);

    await for (final chunk in stream) {
      yield AudioChunk(
        pcmBuffer: chunk,
        sampleRate: 24000,
        channels: 1,
      );
    }
  }

  @override
  Future<Uint8List> fetchAudioBytes(
    String text,
    TTSSettings settings,
  ) async {
    final resolvedVoice = VieneuTts.resolveVoiceId(settings.voice);
    final options = TtsSynthesisOptions(
      voice: resolvedVoice,
      speed: settings.speed,
      sampleRate: 24000,
      channels: 1,
      responseFormat: AudioFormat.wav,
      temperature: settings.temperature,
      topK: settings.topK,
      topP: settings.topP,
      repetitionPenalty: settings.repetitionPenalty,
      maxChars: settings.maxChars,
    );

    return VieneuTts.synthesize(text: text, options: options);
  }

  @override
  Future<List<VoiceOption>> fetchVoices(
    String endpoint,
    String apiKey,
  ) async {
    return VieneuTts.availableVoices
        .map(
          (v) => VoiceOption(
            id: v.id,
            name: v.name,
            description: v.label,
          ),
        )
        .toList();
  }

  @override
  Future<List<ModelOption>> fetchModels(
    String endpoint,
    String apiKey,
  ) async {
    return const [
      ModelOption(
        id: 'vieneu-v3-turbo',
        name: 'VieNeu-TTS v3 Turbo (On-Device)',
      ),
    ];
  }

  @override
  Future<({bool success, String message})> testConnection(
    TTSSettings settings,
  ) async {
    final ok = VieneuTts.isInitialized;
    return (
      success: ok,
      message: ok
          ? 'Engine on-device đã sẵn sàng'
          : 'Engine on-device chưa được khởi tạo (cần tải model)',
    );
  }
}

class OfflineModelManagerService implements IOfflineModelManager {
  final Directory? customDirectory;
  final int minExpectedModelBytes;
  final int minExpectedDictBytes;

  const OfflineModelManagerService({
    this.customDirectory,
    this.minExpectedModelBytes = 10 * 1024 * 1024,
    this.minExpectedDictBytes = 5 * 1024 * 1024,
  });

  Future<Directory> _getDirectory() async {
    if (customDirectory != null) {
      if (!await customDirectory!.exists()) {
        await customDirectory!.create(recursive: true);
      }
      return customDirectory!;
    }
    final support = await getApplicationSupportDirectory();
    final dir = Directory('${support.path}/vieneu_models');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  @override
  Future<String> getModelPath() async {
    final dir = await _getDirectory();
    return '${dir.path}/model.gguf';
  }

  @override
  Future<String> getDictionaryPath() async {
    final dir = await _getDirectory();
    return '${dir.path}/sea_g2p.bin';
  }

  @override
  Future<bool> isModelDownloaded() async {
    final path = await getModelPath();
    final file = File(path);
    if (!await file.exists()) return false;
    final len = await file.length();
    return len >= minExpectedModelBytes;
  }

  @override
  Future<bool> isDictionaryDownloaded() async {
    final path = await getDictionaryPath();
    final file = File(path);
    if (!await file.exists()) return false;
    final len = await file.length();
    return len >= minExpectedDictBytes;
  }

  @override
  Future<bool> isEngineInitialized() async {
    return VieneuTts.isInitialized;
  }

  @override
  Stream<ModelDownloadProgress> downloadModel({
    String? customUrl,
    void Function()? onCancel,
  }) async* {
    final dir = await _getDirectory();
    final controller = StreamController<ModelDownloadProgress>();

    unawaited(() async {
      try {
        await VieneuTts.downloadModel(
          destinationDir: dir.path,
          modelUrl: customUrl ?? VieneuTts.defaultModelUrl,
          onProgress: (p) {
            final total = 188 * 1024 * 1024;
            final downloaded = (total * p).round();
            controller.add(ModelDownloadProgress(
              fileName: 'model.gguf',
              progress: p,
              bytesDownloaded: downloaded,
              totalBytes: total,
              isCompleted: p >= 1.0,
            ));
          },
        );
        if (!controller.isClosed) {
          await controller.close();
        }
      } catch (e) {
        if (!controller.isClosed) {
          controller.addError(e);
          await controller.close();
        }
      }
    }());

    yield* controller.stream;
  }

  @override
  Stream<ModelDownloadProgress> downloadDictionary({
    String? customUrl,
    void Function()? onCancel,
  }) async* {
    final dir = await _getDirectory();
    final controller = StreamController<ModelDownloadProgress>();

    unawaited(() async {
      try {
        await VieneuTts.downloadDictionary(
          destinationDir: dir.path,
          dictUrl: customUrl ?? VieneuTts.defaultDictUrl,
          onProgress: (p) {
            final total = 60 * 1024 * 1024;
            final downloaded = (total * p).round();
            controller.add(ModelDownloadProgress(
              fileName: 'sea_g2p.bin',
              progress: p,
              bytesDownloaded: downloaded,
              totalBytes: total,
              isCompleted: p >= 1.0,
            ));
          },
        );
        if (!controller.isClosed) {
          await controller.close();
        }
      } catch (e) {
        if (!controller.isClosed) {
          controller.addError(e);
          await controller.close();
        }
      }
    }());

    yield* controller.stream;
  }

  @override
  Future<void> initializeEngine({int threads = 4}) async {
    final modelPath = await getModelPath();
    final dictPath = await getDictionaryPath();

    if (!File(modelPath).existsSync()) {
      throw FileSystemException('GGUF model file not found', modelPath);
    }

    await VieneuTts.init(
      modelPath: modelPath,
      dictPath: File(dictPath).existsSync() ? dictPath : null,
      threads: threads,
    );
  }

  @override
  Future<void> disposeEngine() async {
    await VieneuTts.dispose();
  }

  @override
  Future<void> deleteModelFiles() async {
    await VieneuTts.dispose();
    final modelPath = await getModelPath();
    final dictPath = await getDictionaryPath();

    final modelFile = File(modelPath);
    if (await modelFile.exists()) {
      await modelFile.delete();
    }

    final dictFile = File(dictPath);
    if (await dictFile.exists()) {
      await dictFile.delete();
    }
  }
}
