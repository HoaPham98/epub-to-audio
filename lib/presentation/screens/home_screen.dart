import 'dart:async';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;

import '../../application/application.dart';
import '../../domain/domain.dart';
import '../../infrastructure/audio/audio_stream_player.dart';
import '../../infrastructure/parser/epub_parser_adapter.dart';
import '../../infrastructure/storage/audio_cache_repository.dart';
import '../../infrastructure/storage/book_repository.dart';
import '../../infrastructure/tts/on_device_tts.dart';
import '../../infrastructure/tts/tts_client_factory.dart';
import '../widgets/widgets.dart';

class HomeScreen extends StatefulWidget {
  final IBookRepository? bookRepository;
  final IAudioCacheRepository? cacheRepository;
  final IEpubParser? epubParser;
  final IOfflineModelManager? modelManager;
  final IAudioStreamPlayer? audioPlayer;
  final ITTSStreamingService? ttsService;

  const HomeScreen({
    super.key,
    this.bookRepository,
    this.cacheRepository,
    this.epubParser,
    this.modelManager,
    this.audioPlayer,
    this.ttsService,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final IBookRepository _bookRepo;
  late final IAudioCacheRepository _cacheRepo;
  late final IEpubParser _parser;
  late final IOfflineModelManager _modelManager;
  late final IAudioStreamPlayer _audioPlayer;

  late final ParseAndLoadBookUseCase _loadBookUseCase;
  late final ManageAudioCacheUseCase _cacheUseCase;
  late final ManageOfflineModelUseCase _modelUseCase;
  late final StreamAndPlayChunkUseCase _streamPlayUseCase;
  late final SlidingWindowPrefetchUseCase _prefetchUseCase;

  EpubBook? _currentBook;
  int _currentChapterIndex = 0;
  int _currentChunkIndex = 0;
  final Map<int, ChunkStatus> _chunkStatuses = {};
  ({int chapterIndex, int chunkIndex})? _bufferingChunk;

  TTSSettings _settings = const TTSSettings();
  bool _isSidebarOpen = true;
  bool _isLoading = false;
  bool _isParsing = false;
  bool _isPlaying = false;
  double _currentTime = 0.0;
  double _duration = 0.0;
  final double _bufferedTime = 0.0;
  double _speed = 1.0;
  double _volume = 1.0;
  double _prevVolume = 1.0;
  int _cacheCount = 0;

  StreamSubscription<PlaybackProgress>? _progressSub;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _bookRepo = widget.bookRepository ?? BookRepository();
    _cacheRepo = widget.cacheRepository ?? AudioCacheRepository();
    _parser = widget.epubParser ?? const EpubParserAdapter();
    _modelManager = widget.modelManager ?? const OfflineModelManagerService();
    _audioPlayer = widget.audioPlayer ?? createPlatformAudioPlayer();

    _loadBookUseCase = ParseAndLoadBookUseCase(bookRepo: _bookRepo, parser: _parser);
    _cacheUseCase = ManageAudioCacheUseCase(cacheRepo: _cacheRepo);
    _modelUseCase = ManageOfflineModelUseCase(modelManager: _modelManager);
    _streamPlayUseCase = StreamAndPlayChunkUseCase(audioPlayer: _audioPlayer, audioCache: _cacheRepo);
    _prefetchUseCase = SlidingWindowPrefetchUseCase(audioCache: _cacheRepo, audioPlayer: _audioPlayer);

    _initApp();
  }

  @override
  void dispose() {
    _progressSub?.cancel();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _initApp() async {
    setState(() => _isLoading = true);
    try {
      _settings = await _bookRepo.getSettings();
      _speed = _settings.speed;

      _progressSub = _audioPlayer.progressStream.listen(_onProgressUpdate);

      final books = await _bookRepo.getBooks();
      if (books.isNotEmpty) {
        final lastBook = books.first;
        final progress = await _bookRepo.getLastProgress(lastBook.id);
        if (mounted) {
          setState(() {
            _currentBook = lastBook;
            if (progress != null) {
              _currentChapterIndex = progress.chapterIndex.clamp(0, lastBook.chapters.length - 1);
              _currentChunkIndex = progress.chunkIndex;
            }
          });
        }
      } else {
        await _loadSampleBook();
      }

      await _refreshCacheCount();
    } catch (e) {
      debugPrint('HomeScreen init error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _onProgressUpdate(PlaybackProgress progress) {
    if (!mounted) return;
    setState(() {
      _isPlaying = progress.isPlaying;
      _currentTime = progress.currentTime;
      _duration = progress.duration;
      _currentChapterIndex = progress.chapterIndex;
      _currentChunkIndex = progress.chunkIndex;
      _chunkStatuses[_currentChunkIndex] = _isPlaying ? ChunkStatus.playing : ChunkStatus.ready;
    });

    if (_currentBook != null) {
      _bookRepo.saveProgress(_currentBook!.id, progress);
    }
  }

  Future<void> _refreshCacheCount() async {
    if (_currentBook == null) return;
    try {
      final items = await _cacheUseCase.listBookItems(_currentBook!.id);
      if (mounted) {
        setState(() => _cacheCount = items.length);
      }
    } catch (_) {}
  }

  Future<void> _loadSampleBook() async {
    setState(() => _isParsing = true);
    try {
      final byteData = await rootBundle.load('assets/sample-book.epub');
      final bytes = byteData.buffer.asUint8List();
      final book = await _loadBookUseCase.execute(bytes, fileName: 'sample-book.epub');
      if (mounted) {
        setState(() {
          _currentBook = book;
          _currentChapterIndex = 0;
          _currentChunkIndex = 0;
          _chunkStatuses.clear();
        });
      }
    } catch (e) {
      debugPrint('Load sample book error: $e');
    } finally {
      if (mounted) setState(() => _isParsing = false);
    }
  }

  Future<void> _handleUploadFile(PlatformFile file) async {
    if (file.bytes == null) return;
    setState(() => _isParsing = true);
    try {
      final book = await _loadBookUseCase.execute(file.bytes!, fileName: file.name);
      if (mounted) {
        setState(() {
          _currentBook = book;
          _currentChapterIndex = 0;
          _currentChunkIndex = 0;
          _chunkStatuses.clear();
        });
        await _refreshCacheCount();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể đọc file EPUB: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isParsing = false);
    }
  }

  void _handleSelectChapter(int index) {
    if (_currentBook == null || index < 0 || index >= _currentBook!.chapters.length) return;
    setState(() {
      _currentChapterIndex = index;
      _currentChunkIndex = 0;
      _chunkStatuses.clear();
    });
    _audioPlayer.pause();
  }

  Future<void> _playChunk(int chapterIndex, int chunkIndex) async {
    if (_currentBook == null) return;
    final chapter = _currentBook!.chapters[chapterIndex];
    if (chunkIndex < 0 || chunkIndex >= chapter.chunks.length) return;

    final chunk = chapter.chunks[chunkIndex];
    final ttsService = widget.ttsService ?? TTSClientFactory.create(_settings);

    setState(() {
      _currentChapterIndex = chapterIndex;
      _currentChunkIndex = chunkIndex;
      _chunkStatuses[chunkIndex] = ChunkStatus.loading;
      _bufferingChunk = (chapterIndex: chapterIndex, chunkIndex: chunkIndex);
    });

    try {
      await _streamPlayUseCase.execute(StreamAndPlayParams(
        text: chunk.text,
        settings: _settings,
        bookId: _currentBook!.id,
        chapterIndex: chapterIndex,
        chunkIndex: chunkIndex,
        isParagraphEnd: chunk.isParagraphEnd,
        isLastChunk: chunkIndex == chapter.chunks.length - 1,
        ttsService: ttsService,
        onFirstData: () {
          if (mounted) {
            setState(() {
              _chunkStatuses[chunkIndex] = ChunkStatus.playing;
              _bufferingChunk = null;
            });
          }
        },
      ));

      // Trigger prefetch in the background
      _triggerPrefetch(chapterIndex, chunkIndex);
    } catch (e) {
      if (mounted) {
        setState(() {
          _chunkStatuses[chunkIndex] = ChunkStatus.error;
          _bufferingChunk = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi phát âm thanh: $e')),
        );
      }
    }
  }

  void _triggerPrefetch(int chapterIndex, int chunkIndex) {
    if (_currentBook == null) return;
    final ttsService = widget.ttsService ?? TTSClientFactory.create(_settings);

    _prefetchUseCase.execute(
      book: _currentBook!,
      currentChapterIndex: chapterIndex,
      currentChunkIndex: chunkIndex,
      settings: _settings,
      ttsService: ttsService,
    );
  }

  void _handleTogglePlayPause() {
    if (_isPlaying) {
      _audioPlayer.pause();
    } else {
      if (_currentBook != null && _currentBook!.chapters.isNotEmpty) {
        _playChunk(_currentChapterIndex, _currentChunkIndex);
      }
    }
  }

  void _handleSkipRelative(double seconds) {
    final target = (_currentTime + seconds).clamp(0.0, _duration);
    _audioPlayer.seek(target);
  }

  void _handleSeek(double seconds) {
    _audioPlayer.seek(seconds);
  }

  void _handlePrevChapter() {
    if (_currentChapterIndex > 0) {
      _handleSelectChapter(_currentChapterIndex - 1);
    }
  }

  void _handleNextChapter() {
    if (_currentBook != null && _currentChapterIndex < _currentBook!.chapters.length - 1) {
      _handleSelectChapter(_currentChapterIndex + 1);
    }
  }

  void _handleChangeSpeed(double speed) {
    setState(() => _speed = speed);
    _audioPlayer.setSpeed(speed);
    _settings = _settings.copyWith(speed: speed);
    _bookRepo.saveSettings(_settings);
  }

  void _handleChangeVolume(double volume) {
    setState(() => _volume = volume);
    _audioPlayer.setVolume(volume);
  }

  void _handleToggleMute() {
    if (_volume > 0) {
      _prevVolume = _volume;
      _handleChangeVolume(0.0);
    } else {
      _handleChangeVolume(_prevVolume > 0 ? _prevVolume : 1.0);
    }
  }

  void _openSettings() {
    SettingsModal.show(
      context,
      settings: _settings,
      onSave: (updated) {
        setState(() => _settings = updated);
        _bookRepo.saveSettings(updated);
        _handleChangeSpeed(updated.speed);
      },
      onOpenModelDownload: _openModelDownload,
    );
  }

  void _openModelDownload() {
    OfflineModelDownloadModal.show(
      context,
      modelUseCase: _modelUseCase,
      threads: _settings.threads,
    );
  }

  void _openCache() {
    CacheModal.show(
      context,
      cacheUseCase: _cacheUseCase,
      currentBookId: _currentBook?.id,
      currentBookTitle: _currentBook?.title,
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentChapter = (_currentBook != null &&
            _currentChapterIndex < _currentBook!.chapters.length)
        ? _currentBook!.chapters[_currentChapterIndex]
        : null;

    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 768;

    return DesktopShortcutsWrapper(
      onTogglePlayPause: _handleTogglePlayPause,
      onSeekBackward: () => _handleSkipRelative(-10),
      onSeekForward: () => _handleSkipRelative(10),
      onVolumeUp: () => _handleChangeVolume((_volume + 0.1).clamp(0.0, 1.0)),
      onVolumeDown: () => _handleChangeVolume((_volume - 0.1).clamp(0.0, 1.0)),
      onToggleMute: _handleToggleMute,
      onSpeedDown: () => _handleChangeSpeed((_speed - 0.25).clamp(0.5, 3.0)),
      onSpeedUp: () => _handleChangeSpeed((_speed + 0.25).clamp(0.5, 3.0)),
      child: Scaffold(
        key: _scaffoldKey,
        drawer: !isDesktop
            ? Drawer(
                child: SafeArea(
                  child: Sidebar(
                    book: _currentBook,
                    currentChapterIndex: _currentChapterIndex,
                    isPlaying: _isPlaying,
                    isParsing: _isParsing,
                    onSelectChapter: (idx) {
                      _handleSelectChapter(idx);
                      Navigator.of(context).pop();
                    },
                    onUploadFile: (file) {
                      _handleUploadFile(file);
                      Navigator.of(context).pop();
                    },
                    onLoadSample: () {
                      _loadSampleBook();
                      Navigator.of(context).pop();
                    },
                    onClose: () => Navigator.of(context).pop(),
                  ),
                ),
              )
            : null,
        appBar: Header(
          book: _currentBook,
          cacheCount: _cacheCount,
          isSidebarOpen: isDesktop ? _isSidebarOpen : false,
          onToggleSidebar: () {
            if (isDesktop) {
              setState(() => _isSidebarOpen = !_isSidebarOpen);
            } else {
              _scaffoldKey.currentState?.openDrawer();
            }
          },
          onOpenSettings: _openSettings,
          onOpenCache: _openCache,
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : Row(
                children: [
                  if (_isSidebarOpen && isDesktop)
                    SizedBox(
                      width: 320,
                      child: Sidebar(
                        book: _currentBook,
                        currentChapterIndex: _currentChapterIndex,
                        isPlaying: _isPlaying,
                        isParsing: _isParsing,
                        onSelectChapter: _handleSelectChapter,
                        onUploadFile: _handleUploadFile,
                        onLoadSample: _loadSampleBook,
                        onClose: () => setState(() => _isSidebarOpen = false),
                      ),
                    ),
                  Expanded(
                    child: Reader(
                      book: _currentBook,
                      currentChapterIndex: _currentChapterIndex,
                      currentChunkIndex: _currentChunkIndex,
                      chunkStatuses: _chunkStatuses,
                      isPlaying: _isPlaying,
                      isLoading: _bufferingChunk != null,
                      bufferingChunk: _bufferingChunk,
                      onPlayChunk: _playChunk,
                    ),
                  ),
                ],
              ),
        bottomNavigationBar: AudioPlayerBar(
          currentChapterTitle: currentChapter?.title ?? 'Chưa chọn chương',
          currentChunkIndex: _currentChunkIndex,
          totalChunks: currentChapter?.chunks.length ?? 0,
          currentTime: _currentTime,
          duration: _duration,
          bufferedTime: _bufferedTime,
          isPlaying: _isPlaying,
          isLoading: _bufferingChunk != null,
          speed: _speed,
          volume: _volume,
          onTogglePlayPause: _handleTogglePlayPause,
          onPrevChapter: _handlePrevChapter,
          onNextChapter: _handleNextChapter,
          onSkipRelative: _handleSkipRelative,
          onSeek: _handleSeek,
          onToggleAutoNext: () {},
          onChangeSpeed: _handleChangeSpeed,
          onChangeVolume: _handleChangeVolume,
        ),
      ),
    );
  }
}
