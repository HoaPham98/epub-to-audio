import 'dart:async';
import 'dart:js_interop';
import 'package:flutter/foundation.dart';
import '../../domain/domain.dart';
import 'audio_timeline_tracker.dart';

@JS('_webAudioEngine')
external JSObject? get _webAudioEngine;

@JS('_registerWebAudioEndedCallback')
external void _registerWebAudioEndedCallback(JSFunction fn);

extension WebAudioEngineMethods on JSObject {
  external void queuePCMChunk(JSUint8Array pcmBytes, int sampleRate);
  external void play();
  external void pause();
  external void stop();
  external void setVolume(double volume);
}

class WebAudioStreamPlayerAdapter implements IAudioStreamPlayer {
  final AudioTimelineTracker _timeline = AudioTimelineTracker();
  final Map<int, ChunkStatus> _chunkStatuses = {};
  final StreamController<PlaybackProgress> _progressController =
      StreamController<PlaybackProgress>.broadcast();

  int _currentChapterIndex = 0;
  int _currentChunkIndex = 0;
  double _currentTime = 0.0;
  bool _isPlaying = false;
  bool _isLoading = false;
  double _speed = 1.0;
  double _volume = 1.0;
  Timer? _ticker;

  String _title = '';
  String _author = '';
  String? _coverUrl;
  String _chapterTitle = '';

  double get speed => _speed;
  double get volume => _volume;
  String get title => _title;
  String get author => _author;
  String? get coverUrl => _coverUrl;
  String get chapterTitle => _chapterTitle;

  WebAudioStreamPlayerAdapter() {
    try {
      _registerWebAudioEndedCallback(() {
        if (_isPlaying) {
          debugPrint('[WebAudioStreamPlayer] JS audio ended callback fired');
          _currentTime = _timeline.totalDuration;
          _isPlaying = false;
          _ticker?.cancel();
          _emitProgress();
        }
      }.toJS);
    } catch (e) {
      debugPrint('[WebAudioStreamPlayer] error registering ended callback: $e');
    }
  }

  @override
  Stream<PlaybackProgress> get progressStream => _progressController.stream;

  @override
  PlaybackProgress get currentProgress => PlaybackProgress(
        chapterIndex: _currentChapterIndex,
        chunkIndex: _currentChunkIndex,
        currentTime: _currentTime,
        duration: _timeline.totalDuration,
        isPlaying: _isPlaying,
        isLoading: _isLoading,
        autoNext: true,
        chunkStatuses: Map.unmodifiable(_chunkStatuses),
      );

  void _emitProgress() {
    if (!_progressController.isClosed) {
      _progressController.add(currentProgress);
    }
  }

  void _callEngineQueue(Uint8List pcm, int sampleRate) {
    try {
      final engine = _webAudioEngine;
      if (engine != null) {
        debugPrint('[WebAudioStreamPlayer] calling queuePCMChunk ${pcm.length} bytes @ $sampleRate Hz');
        engine.queuePCMChunk(pcm.toJS, sampleRate);
      } else {
        debugPrint('[WebAudioStreamPlayer] _webAudioEngine is NULL!');
      }
    } catch (e) {
      debugPrint('[WebAudioStreamPlayer] error in queuePCMChunk: $e');
    }
  }

  void _callEnginePlay() {
    try {
      _webAudioEngine?.play();
      debugPrint('[WebAudioStreamPlayer] calling play()');
    } catch (e) {
      debugPrint('[WebAudioStreamPlayer] error in play(): $e');
    }
  }

  void _callEnginePause() {
    try {
      _webAudioEngine?.pause();
      debugPrint('[WebAudioStreamPlayer] calling pause()');
    } catch (e) {
      debugPrint('[WebAudioStreamPlayer] error in pause(): $e');
    }
  }

  void _callEngineStop() {
    try {
      _webAudioEngine?.stop();
      debugPrint('[WebAudioStreamPlayer] calling stop()');
    } catch (e) {
      debugPrint('[WebAudioStreamPlayer] error in stop(): $e');
    }
  }

  void _callEngineVolume(double vol) {
    try {
      _webAudioEngine?.setVolume(vol);
    } catch (_) {}
  }

  void _startTicker() {
    _ticker?.cancel();
    const intervalMs = 100;
    _ticker = Timer.periodic(const Duration(milliseconds: intervalMs), (timer) {
      if (!_isPlaying) return;

      final deltaSeconds = (intervalMs / 1000.0) * _speed;
      _currentTime += deltaSeconds;

      if (_currentTime >= _timeline.totalDuration && _timeline.totalDuration > 0) {
        _currentTime = _timeline.totalDuration;
        _isPlaying = false;
        timer.cancel();
        _emitProgress();
        return;
      }

      final active = _timeline.findActiveChunk(_currentTime);
      if (active != null) {
        if (active.chapterIndex != _currentChapterIndex ||
            active.chunkIndex != _currentChunkIndex) {
          _currentChapterIndex = active.chapterIndex;
          _currentChunkIndex = active.chunkIndex;
          _chunkStatuses[_currentChunkIndex] = ChunkStatus.playing;
        }
      }

      _emitProgress();
    });
  }

  @override
  Future<void> play() async {
    _isPlaying = true;
    _callEnginePlay();
    _startTicker();
    _emitProgress();
  }

  @override
  Future<void> pause() async {
    _isPlaying = false;
    _callEnginePause();
    _ticker?.cancel();
    _emitProgress();
  }

  @override
  Future<void> stop() async {
    _isPlaying = false;
    _currentTime = 0.0;
    _callEngineStop();
    _ticker?.cancel();
    _emitProgress();
  }

  @override
  Future<void> seek(double seconds) async {
    final clamped = seconds.clamp(0.0, _timeline.totalDuration);
    _currentTime = clamped;
    final active = _timeline.findActiveChunk(_currentTime);
    if (active != null) {
      _currentChapterIndex = active.chapterIndex;
      _currentChunkIndex = active.chunkIndex;
    }
    _emitProgress();
  }

  @override
  Future<void> setSpeed(double speed) async {
    if (speed <= 0) return;
    _timeline.rescaleSpeed(
      oldSpeed: _speed,
      newSpeed: speed,
      currentTime: _currentTime,
    );
    _speed = speed;
    _emitProgress();
  }

  @override
  Future<void> setVolume(double volume) async {
    _volume = volume.clamp(0.0, 1.0);
    _callEngineVolume(_volume);
  }

  @override
  Future<void> queueAudioChunk(
    int chapterIndex,
    int chunkIndex,
    Uint8List audioBytes, {
    bool isLastChunk = false,
    ChunkMeta? meta,
    int? sampleRate,
  }) async {
    final isParagraph = meta?.isParagraphEnd ?? false;
    final rawPcm = isWavBytes(audioBytes) ? wavToPcm(audioBytes) : audioBytes;

    int rate = sampleRate ?? 24000;
    if (isWavBytes(audioBytes) && audioBytes.length >= 28) {
      rate = ByteData.sublistView(audioBytes, 24, 28).getUint32(0, Endian.little);
    }

    // 16-bit Mono (2 bytes per sample) -> rate * 2 bytes/sec
    final audioSeconds = rawPcm.length / (rate * 2.0);

    _timeline.enqueueChunk(
      chapterIndex: chapterIndex,
      chunkIndex: chunkIndex,
      chunkAudioDuration: audioSeconds,
      isParagraphEnd: isParagraph,
    );

    _callEngineQueue(rawPcm, rate);

    _chunkStatuses[chunkIndex] = ChunkStatus.ready;
    _emitProgress();
  }

  @override
  Future<void> clearQueue() async {
    _timeline.reset();
    _chunkStatuses.clear();
    _currentTime = 0.0;
    _callEngineStop();
    _emitProgress();
  }

  @override
  Future<void> setChunkStatus(
    int chapterIndex,
    int chunkIndex,
    ChunkStatus status,
  ) async {
    _chunkStatuses[chunkIndex] = status;
    if (status == ChunkStatus.loading) {
      _isLoading = true;
    } else if (status == ChunkStatus.playing || status == ChunkStatus.ready) {
      _isLoading = false;
    }
    _emitProgress();
  }

  @override
  Future<void> updateMetadata({
    required String title,
    required String author,
    String? coverUrl,
    required String chapterTitle,
  }) async {
    _title = title;
    _author = author;
    _coverUrl = coverUrl;
    _chapterTitle = chapterTitle;
  }

  @override
  Future<void> dispose() async {
    _ticker?.cancel();
    _callEngineStop();
    await _progressController.close();
  }
}

IAudioStreamPlayer createPlatformAudioPlayer() => WebAudioStreamPlayerAdapter();
