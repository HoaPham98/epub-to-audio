import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path/path.dart' as p;

import '../../domain/domain.dart';
import 'audio_timeline_tracker.dart';

class NativeAudioStreamPlayerAdapter implements IAudioStreamPlayer {
  final AudioTimelineTracker _timeline = AudioTimelineTracker();
  final Map<int, ChunkStatus> _chunkStatuses = {};
  final StreamController<PlaybackProgress> _progressController =
      StreamController<PlaybackProgress>.broadcast();

  final AudioPlayer? _customPlayer;
  AudioPlayer? _player;
  final List<File> _tempFiles = [];
  int _chunkCounter = 0;
  bool _playerInitialized = false;

  final BytesBuilder _pendingPcmBuffer = BytesBuilder(copy: false);
  Uint8List? _lastWavBytes;
  Timer? _pendingFlushTimer;
  int _currentSampleRate = 24000;
  bool _currentIsParagraph = false;
  int _lastChapterIndex = 0;
  int _lastChunkIndex = 0;
  bool _hasActiveAudio = false;

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

  NativeAudioStreamPlayerAdapter({AudioPlayer? audioPlayer})
      : _customPlayer = audioPlayer;

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

  Directory? _tempDirInstance;
  Future<Directory> _getTempDir() async {
    if (_tempDirInstance != null && await _tempDirInstance!.exists()) {
      return _tempDirInstance!;
    }
    final base = Directory.systemTemp;
    final dir = Directory(p.join(base.path, 'epub_to_audio_stream_$pid'));
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    _tempDirInstance = dir;
    return dir;
  }

  Future<void> _cleanupTempFiles() async {
    for (final f in _tempFiles) {
      try {
        if (await f.exists()) {
          await f.delete();
        }
      } catch (_) {}
    }
    _tempFiles.clear();
  }

  bool _isWidgetsBindingInitialized() {
    try {
      WidgetsBinding.instance;
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _initPlayer() async {
    if (_playerInitialized) return;
    _playerInitialized = true;

    if (!_isWidgetsBindingInitialized() && _customPlayer == null) {
      _player = null;
      return;
    }

    try {
      final player = _customPlayer ?? AudioPlayer();
      await player.setSpeed(_speed);
      await player.setVolume(_volume);

      player.playerStateStream.listen((state) {
        if (state.processingState == ProcessingState.completed) {
          _isPlaying = false;
          _currentTime = _timeline.totalDuration;
          _emitProgress();
        } else {
          final isPlay =
              state.playing && state.processingState != ProcessingState.idle;
          if (_isPlaying != isPlay &&
              state.processingState != ProcessingState.completed) {
            _isPlaying = isPlay;
            _emitProgress();
          }
        }
      });

      player.positionStream.listen((pos) {
        if (!_isPlaying) return;
        final seconds = pos.inMilliseconds / 1000.0;
        _currentTime = seconds.clamp(
          0.0,
          _timeline.totalDuration > 0
              ? _timeline.totalDuration
              : double.infinity,
        );

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

      _player = player;
    } catch (e) {
      debugPrint('[NativeAudioStreamPlayer] Native audio player init fallback: $e');
      _player = null;
    }
  }

  void _startTicker() {
    _ticker?.cancel();
    const intervalMs = 100;
    _ticker = Timer.periodic(const Duration(milliseconds: intervalMs), (timer) {
      if (!_isPlaying) return;

      final deltaSeconds = (intervalMs / 1000.0) * _speed;
      _currentTime += deltaSeconds;

      if (_currentTime >= _timeline.totalDuration &&
          _timeline.totalDuration > 0) {
        _currentTime = _timeline.totalDuration;
        _isPlaying = false;
        timer.cancel();
        _emitProgress();
        return;
      }

      // Check active chunk transition
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

  Future<void> _flushPendingAudio() async {
    Uint8List? wavBytes;

    if (_lastWavBytes != null) {
      wavBytes = _lastWavBytes;
      _lastWavBytes = null;
    } else if (_pendingPcmBuffer.isNotEmpty) {
      final rawPcm = _pendingPcmBuffer.takeBytes();
      if (rawPcm.isNotEmpty) {
        final silence = AudioTimelineTracker.createSilencePadding(
          isParagraphEnd: _currentIsParagraph,
          sampleRate: _currentSampleRate,
        );
        final combined = Uint8List(rawPcm.length + silence.length);
        combined.setRange(0, rawPcm.length, rawPcm);
        combined.setRange(rawPcm.length, combined.length, silence);

        wavBytes =
            pcmToWav(combined, sampleRate: _currentSampleRate, channels: 1);
      }
    }

    if (wavBytes == null || wavBytes.isEmpty) return;

    final tempDir = await _getTempDir();
    final tempFile = File(p.join(
      tempDir.path,
      'chunk_${_lastChapterIndex}_${_lastChunkIndex}_${_chunkCounter++}.wav',
    ));
    await tempFile.writeAsBytes(wavBytes, flush: true);
    _tempFiles.add(tempFile);

    debugPrint(
        '[NativeAudioStreamPlayer] Flushed ${wavBytes.length} bytes WAV (rate: $_currentSampleRate Hz) to ${tempFile.path}');

    if (_player != null) {
      try {
        await _player!.setFilePath(tempFile.path);
        await _player!.setSpeed(_speed);
        await _player!.setVolume(_volume);
        _hasActiveAudio = true;
        if (_isPlaying) {
          debugPrint('[NativeAudioStreamPlayer] Audio playback started at speed $_speed');
          await _player!.play();
        }
      } catch (e) {
        debugPrint(
            '[NativeAudioStreamPlayer] Error in _flushPendingAudio playback: $e');
        _startTicker();
      }
    } else {
      _startTicker();
    }
  }

  @override
  Future<void> play() async {
    _isPlaying = true;
    await _initPlayer();
    if (_player != null) {
      try {
        if (_lastWavBytes != null || _pendingPcmBuffer.isNotEmpty) {
          await _flushPendingAudio();
        } else if (_hasActiveAudio) {
          await _player!.play();
        } else {
          _startTicker();
        }
      } catch (e) {
        debugPrint('[NativeAudioStreamPlayer] Error in play(): $e');
        _startTicker();
      }
    } else {
      _startTicker();
    }
    _emitProgress();
  }

  @override
  Future<void> pause() async {
    _isPlaying = false;
    _ticker?.cancel();
    if (_player != null && _hasActiveAudio) {
      try {
        await _player!.pause();
      } catch (e) {
        debugPrint('[NativeAudioStreamPlayer] Error in pause(): $e');
      }
    }
    _emitProgress();
  }

  @override
  Future<void> stop() async {
    _isPlaying = false;
    _currentTime = 0.0;
    _ticker?.cancel();
    if (_player != null && _hasActiveAudio) {
      try {
        await _player!.stop();
      } catch (e) {
        debugPrint('[NativeAudioStreamPlayer] Error in stop(): $e');
      }
    }
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

    if (_player != null && _hasActiveAudio) {
      try {
        await _player!.seek(
          Duration(milliseconds: (clamped * 1000).toInt()),
        );
      } catch (e) {
        debugPrint('[NativeAudioStreamPlayer] Error in seek(): $e');
      }
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
    if (_player != null) {
      try {
        await _player!.setSpeed(speed);
      } catch (e) {
        debugPrint('[NativeAudioStreamPlayer] Error in setSpeed(): $e');
      }
    }
    _emitProgress();
  }

  @override
  Future<void> setVolume(double volume) async {
    _volume = volume.clamp(0.0, 1.0);
    if (_player != null) {
      try {
        await _player!.setVolume(_volume);
      } catch (e) {
        debugPrint('[NativeAudioStreamPlayer] Error in setVolume(): $e');
      }
    }
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
    final isWav = isWavBytes(audioBytes);
    final rawPcm = isWav ? wavToPcm(audioBytes) : audioBytes;

    int rate = sampleRate ?? 24000;
    if (isWav && audioBytes.length >= 28) {
      rate = ByteData.sublistView(audioBytes, 24, 28).getUint32(0, Endian.little);
    }

    _currentSampleRate = rate;
    _currentIsParagraph = isParagraph;
    _lastChapterIndex = chapterIndex;
    _lastChunkIndex = chunkIndex;

    if (rawPcm.isNotEmpty) {
      final audioSeconds = rawPcm.length / (rate * 2.0);
      _timeline.enqueueChunk(
        chapterIndex: chapterIndex,
        chunkIndex: chunkIndex,
        chunkAudioDuration: audioSeconds,
        isParagraphEnd: isParagraph,
      );

      if (isWav) {
        _lastWavBytes = audioBytes;
      } else {
        _pendingPcmBuffer.add(rawPcm);
      }
    }

    await _initPlayer();

    _chunkStatuses[chunkIndex] = ChunkStatus.ready;
    _emitProgress();

    if (isLastChunk) {
      _pendingFlushTimer?.cancel();
      await _flushPendingAudio();
    } else {
      _pendingFlushTimer?.cancel();
      _pendingFlushTimer = Timer(const Duration(milliseconds: 150), () {
        _flushPendingAudio();
      });
    }
  }

  @override
  Future<void> clearQueue() async {
    _pendingFlushTimer?.cancel();
    _pendingPcmBuffer.clear();
    _lastWavBytes = null;
    _timeline.reset();
    _chunkStatuses.clear();
    _currentTime = 0.0;
    _hasActiveAudio = false;
    _ticker?.cancel();
    if (_player != null) {
      try {
        await _player!.stop();
      } catch (e) {
        debugPrint(
            '[NativeAudioStreamPlayer] Error clearing player queue: $e');
      }
    }
    await _cleanupTempFiles();
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
    _pendingFlushTimer?.cancel();
    _ticker?.cancel();
    if (_player != null) {
      try {
        await _player!.dispose();
      } catch (_) {}
    }
    await _cleanupTempFiles();
    await _progressController.close();
  }
}

IAudioStreamPlayer createPlatformAudioPlayer() =>
    NativeAudioStreamPlayerAdapter();


