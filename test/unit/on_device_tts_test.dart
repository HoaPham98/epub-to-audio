import 'dart:io';
import 'package:epub_to_audio/domain/domain.dart';
import 'package:epub_to_audio/infrastructure/tts/on_device_tts_native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vieneu_tts/vieneu_tts.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;
  late OfflineModelManagerService modelManager;
  const client = OnDeviceVieNeuTTSClient();

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('vieneu_model_test_');
    modelManager = OfflineModelManagerService(
      customDirectory: tempDir,
      minExpectedModelBytes: 10,
      minExpectedDictBytes: 10,
    );
  });

  tearDown(() async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('OnDeviceVieNeuTTSClient (Voice resolution & catalog)', () {
    test('resolves voice name case-insensitively and diacritic-tolerantly', () {
      expect(VieneuTts.resolveVoiceId('Mai Anh'), equals('mai_anh'));
      expect(VieneuTts.resolveVoiceId('MAI ANH'), equals('mai_anh'));
      expect(VieneuTts.resolveVoiceId('mai_anh'), equals('mai_anh'));
      expect(VieneuTts.resolveVoiceId('Minh Quân Pro'), equals('minh_quan_pro'));
      expect(VieneuTts.resolveVoiceId('thuy_dung'), equals('thuy_dung'));
      expect(VieneuTts.resolveVoiceId('Thùy Dung'), equals('thuy_dung'));
      expect(VieneuTts.resolveVoiceId('quang son'), equals('quang_son'));
    });

    test('fetches full 25 embedded voices catalog', () async {
      final voices = await client.fetchVoices('', '');
      expect(voices.length, equals(25));
      expect(voices.any((v) => v.id == 'mai_anh'), isTrue);
      expect(voices.any((v) => v.id == 'minh_quan_pro'), isTrue);
      expect(voices.any((v) => v.id == 'thuy_dung'), isTrue);
      expect(voices.any((v) => v.id == 'quang_son'), isTrue);
    });

    test('fetches on-device models list', () async {
      final models = await client.fetchModels('', '');
      expect(models.length, equals(1));
      expect(models.first.id, equals('vieneu-v3-turbo'));
    });

    test('throws StateError when synthesizing without engine initialization', () async {
      const settings = TTSSettings(voice: 'mai_anh');
      expect(
        () => client.fetchAudioBytes('Xin chào', settings),
        throwsStateError,
      );
    });
  });

  group('OfflineModelManagerService (Paths & File checks)', () {
    test('correctly detects missing model and dictionary files', () async {
      expect(await modelManager.isModelDownloaded(), isFalse);
      expect(await modelManager.isDictionaryDownloaded(), isFalse);
    });

    test('correctly detects files when written to disk', () async {
      final modelPath = await modelManager.getModelPath();
      final dictPath = await modelManager.getDictionaryPath();

      final modelFile = File(modelPath);
      final dictFile = File(dictPath);

      await modelFile.writeAsBytes(List.filled(20, 1));
      await dictFile.writeAsBytes(List.filled(20, 2));

      expect(await modelManager.isModelDownloaded(), isTrue);
      expect(await modelManager.isDictionaryDownloaded(), isTrue);

      await modelManager.deleteModelFiles();
      expect(await modelManager.isModelDownloaded(), isFalse);
      expect(await modelManager.isDictionaryDownloaded(), isFalse);
    });
  });
}
