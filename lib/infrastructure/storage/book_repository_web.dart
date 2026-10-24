import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../domain/domain.dart';

class BookRepository implements IBookRepository {
  final Map<String, EpubBook> _memoryBooks = {};
  SharedPreferences? _prefs;

  Future<void> _ensureInitialized() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  @override
  Future<List<EpubBook>> getBooks() async {
    await _ensureInitialized();
    final list = _memoryBooks.values.toList();
    list.sort((a, b) => b.uploadedAt.compareTo(a.uploadedAt));
    return list;
  }

  @override
  Future<EpubBook?> getBook(String id) async {
    await _ensureInitialized();
    return _memoryBooks[id];
  }

  @override
  Future<void> saveBook(EpubBook book) async {
    await _ensureInitialized();
    _memoryBooks[book.id] = book;
  }

  @override
  Future<void> deleteBook(String id) async {
    await _ensureInitialized();
    _memoryBooks.remove(id);
    await _prefs?.remove('progress_$id');
  }

  @override
  Future<PlaybackProgress?> getLastProgress(String bookId) async {
    await _ensureInitialized();
    final raw = _prefs?.getString('progress_$bookId');
    if (raw == null) return null;

    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final rawStatuses = json['chunkStatuses'] as Map<String, dynamic>? ?? {};
      final chunkStatuses = rawStatuses.map(
        (k, v) => MapEntry(
          int.parse(k),
          ChunkStatus.values.firstWhere(
            (s) => s.name == v,
            orElse: () => ChunkStatus.idle,
          ),
        ),
      );

      return PlaybackProgress(
        chapterIndex: json['chapterIndex'] as int? ?? 0,
        chunkIndex: json['chunkIndex'] as int? ?? 0,
        currentTime: (json['currentTime'] as num?)?.toDouble() ?? 0.0,
        duration: (json['duration'] as num?)?.toDouble() ?? 0.0,
        isPlaying: false,
        isLoading: false,
        autoNext: json['autoNext'] as bool? ?? true,
        chunkStatuses: chunkStatuses,
      );
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> saveProgress(String bookId, PlaybackProgress progress) async {
    await _ensureInitialized();
    final statusMap = progress.chunkStatuses
        .map((k, v) => MapEntry(k.toString(), v.name));

    final map = {
      'chapterIndex': progress.chapterIndex,
      'chunkIndex': progress.chunkIndex,
      'currentTime': progress.currentTime,
      'duration': progress.duration,
      'autoNext': progress.autoNext,
      'chunkStatuses': statusMap,
    };

    await _prefs?.setString('progress_$bookId', jsonEncode(map));
  }

  @override
  Future<TTSSettings> getSettings() async {
    await _ensureInitialized();
    final raw = _prefs?.getString('tts_settings');
    if (raw == null) return const TTSSettings(ttsMode: TtsMode.remote);

    try {
      dynamic decoded = jsonDecode(raw);
      while (decoded is String) {
        decoded = jsonDecode(decoded);
      }
      final json = decoded as Map<String, dynamic>;
      final s = TTSSettings.fromJson(json);
      return s.copyWith(ttsMode: TtsMode.remote);
    } catch (_) {
      return const TTSSettings(ttsMode: TtsMode.remote);
    }
  }

  @override
  Future<void> saveSettings(TTSSettings settings) async {
    await _ensureInitialized();
    await _prefs?.setString('tts_settings', jsonEncode(settings.toJson()));
  }
}
