import '../../domain/domain.dart';

class ManageOfflineModelUseCase {
  final IOfflineModelManager modelManager;

  const ManageOfflineModelUseCase({required this.modelManager});

  Future<bool> areFilesDownloaded() async {
    final modelOk = await modelManager.isModelDownloaded();
    final dictOk = await modelManager.isDictionaryDownloaded();
    return modelOk && dictOk;
  }

  Future<bool> isModelReady() async {
    final filesOk = await areFilesDownloaded();
    if (!filesOk) return false;
    return modelManager.isEngineInitialized();
  }

  Stream<ModelDownloadProgress> downloadAllFiles({
    String? customModelUrl,
    String? customDictUrl,
    void Function()? onCancel,
  }) async* {
    final modelOk = await modelManager.isModelDownloaded();
    if (!modelOk) {
      yield* modelManager.downloadModel(
        customUrl: customModelUrl,
        onCancel: onCancel,
      );
    }

    final dictOk = await modelManager.isDictionaryDownloaded();
    if (!dictOk) {
      yield* modelManager.downloadDictionary(
        customUrl: customDictUrl,
        onCancel: onCancel,
      );
    }
  }

  Future<void> initializeEngine({int threads = 4}) {
    return modelManager.initializeEngine(threads: threads);
  }

  Future<void> disposeEngine() {
    return modelManager.disposeEngine();
  }

  Future<void> deleteModelFiles() {
    return modelManager.deleteModelFiles();
  }
}
