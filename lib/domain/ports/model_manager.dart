class ModelDownloadProgress {
  final String fileName;
  final double progress; // 0.0 to 1.0
  final int bytesDownloaded;
  final int totalBytes;
  final bool isCompleted;
  final String? errorMessage;

  const ModelDownloadProgress({
    required this.fileName,
    required this.progress,
    required this.bytesDownloaded,
    required this.totalBytes,
    this.isCompleted = false,
    this.errorMessage,
  });

  ModelDownloadProgress copyWith({
    String? fileName,
    double? progress,
    int? bytesDownloaded,
    int? totalBytes,
    bool? isCompleted,
    String? errorMessage,
  }) {
    return ModelDownloadProgress(
      fileName: fileName ?? this.fileName,
      progress: progress ?? this.progress,
      bytesDownloaded: bytesDownloaded ?? this.bytesDownloaded,
      totalBytes: totalBytes ?? this.totalBytes,
      isCompleted: isCompleted ?? this.isCompleted,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

abstract interface class IOfflineModelManager {
  Future<bool> isModelDownloaded();

  Future<bool> isDictionaryDownloaded();

  Future<bool> isEngineInitialized();

  Future<String> getModelPath();

  Future<String> getDictionaryPath();

  Stream<ModelDownloadProgress> downloadModel({
    String? customUrl,
    void Function()? onCancel,
  });

  Stream<ModelDownloadProgress> downloadDictionary({
    String? customUrl,
    void Function()? onCancel,
  });

  Future<void> initializeEngine({int threads = 4});

  Future<void> disposeEngine();

  Future<void> deleteModelFiles();
}
