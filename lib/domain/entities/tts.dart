enum TtsMode {
  offline,
  remote;

  String get displayName => this == TtsMode.offline ? 'Offline (On-Device)' : 'Máy chủ từ xa (API)';
}

class TTSSettings {
  final TtsMode ttsMode;
  final String endpoint;
  final String apiKey;
  final String model;
  final String voice;
  final String responseFormat;
  final double speed;
  final bool enablePrefetch;
  final int requestDelayMs;
  final int sampleRate; // 48000, 24000, 16000, 8000
  final int channels; // 1 (mono), 2 (stereo)
  final double temperature; // 0.0 - 2.0
  final int topK; // 1 - 1024
  final double topP; // 0.0 - 1.0
  final double repetitionPenalty; // 1.0 - 2.0
  final int maxChars; // 256 - 512
  final int threads; // CPU threads on native
  final bool useCorsProxy;
  final String corsProxyUrl;

  const TTSSettings({
    this.ttsMode = TtsMode.offline,
    this.endpoint = 'http://localhost:8000/v1',
    this.apiKey = '',
    this.model = 'vieneu-v3-turbo',
    this.voice = 'Mai Anh',
    this.responseFormat = 'pcm',
    this.speed = 1.0,
    this.enablePrefetch = true,
    this.requestDelayMs = 0,
    this.sampleRate = 24000,
    this.channels = 1,
    this.temperature = 0.8,
    this.topK = 25,
    this.topP = 0.95,
    this.repetitionPenalty = 1.2,
    this.maxChars = 512,
    this.threads = 4,
    this.useCorsProxy = false,
    this.corsProxyUrl = 'https://proxy.corsfix.com/?',
  });

  TTSSettings copyWith({
    TtsMode? ttsMode,
    String? endpoint,
    String? apiKey,
    String? model,
    String? voice,
    String? responseFormat,
    double? speed,
    bool? enablePrefetch,
    int? requestDelayMs,
    int? sampleRate,
    int? channels,
    double? temperature,
    int? topK,
    double? topP,
    double? repetitionPenalty,
    int? maxChars,
    int? threads,
    bool? useCorsProxy,
    String? corsProxyUrl,
  }) {
    return TTSSettings(
      ttsMode: ttsMode ?? this.ttsMode,
      endpoint: endpoint ?? this.endpoint,
      apiKey: apiKey ?? this.apiKey,
      model: model ?? this.model,
      voice: voice ?? this.voice,
      responseFormat: responseFormat ?? this.responseFormat,
      speed: speed ?? this.speed,
      enablePrefetch: enablePrefetch ?? this.enablePrefetch,
      requestDelayMs: requestDelayMs ?? this.requestDelayMs,
      sampleRate: sampleRate ?? this.sampleRate,
      channels: channels ?? this.channels,
      temperature: temperature ?? this.temperature,
      topK: topK ?? this.topK,
      topP: topP ?? this.topP,
      repetitionPenalty: repetitionPenalty ?? this.repetitionPenalty,
      maxChars: maxChars ?? this.maxChars,
      threads: threads ?? this.threads,
      useCorsProxy: useCorsProxy ?? this.useCorsProxy,
      corsProxyUrl: corsProxyUrl ?? this.corsProxyUrl,
    );
  }

  Map<String, dynamic> toJson() => {
        'ttsMode': ttsMode.name,
        'endpoint': endpoint,
        'apiKey': apiKey,
        'model': model,
        'voice': voice,
        'responseFormat': responseFormat,
        'speed': speed,
        'enablePrefetch': enablePrefetch,
        'requestDelayMs': requestDelayMs,
        'sampleRate': sampleRate,
        'channels': channels,
        'temperature': temperature,
        'topK': topK,
        'topP': topP,
        'repetitionPenalty': repetitionPenalty,
        'maxChars': maxChars,
        'threads': threads,
        'useCorsProxy': useCorsProxy,
        'corsProxyUrl': corsProxyUrl,
      };

  factory TTSSettings.fromJson(Map<String, dynamic> json) => TTSSettings(
        ttsMode: json['ttsMode'] == 'remote' ? TtsMode.remote : TtsMode.offline,
        endpoint: json['endpoint'] as String? ?? 'http://localhost:8000/v1',
        apiKey: json['apiKey'] as String? ?? '',
        model: json['model'] as String? ?? 'vieneu-v3-turbo',
        voice: json['voice'] as String? ?? 'Mai Anh',
        responseFormat: json['responseFormat'] as String? ?? 'pcm',
        speed: (json['speed'] as num?)?.toDouble() ?? 1.0,
        enablePrefetch: json['enablePrefetch'] as bool? ?? true,
        requestDelayMs: json['requestDelayMs'] as int? ?? 0,
        sampleRate: json['sampleRate'] as int? ?? 24000,
        channels: json['channels'] as int? ?? 1,
        temperature: (json['temperature'] as num?)?.toDouble() ?? 0.8,
        topK: json['topK'] as int? ?? 25,
        topP: (json['topP'] as num?)?.toDouble() ?? 0.95,
        repetitionPenalty: (json['repetitionPenalty'] as num?)?.toDouble() ?? 1.2,
        maxChars: json['maxChars'] as int? ?? 512,
        threads: json['threads'] as int? ?? 4,
        useCorsProxy: json['useCorsProxy'] as bool? ?? false,
        corsProxyUrl: json['corsProxyUrl'] as String? ?? 'https://proxy.corsfix.com/?',
      );
}

class VoiceOption {
  final String id;
  final String name;
  final String? language;
  final String? gender;
  final String? description;

  const VoiceOption({
    required this.id,
    required this.name,
    this.language,
    this.gender,
    this.description,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'language': language,
        'gender': gender,
        'description': description,
      };

  factory VoiceOption.fromJson(Map<String, dynamic> json) => VoiceOption(
        id: json['id'] as String,
        name: json['name'] as String,
        language: json['language'] as String?,
        gender: json['gender'] as String?,
        description: json['description'] as String?,
      );
}

class ModelOption {
  final String id;
  final String? name;

  const ModelOption({required this.id, this.name});

  Map<String, dynamic> toJson() => {'id': id, 'name': name};

  factory ModelOption.fromJson(Map<String, dynamic> json) => ModelOption(
        id: json['id'] as String,
        name: json['name'] as String?,
      );
}
