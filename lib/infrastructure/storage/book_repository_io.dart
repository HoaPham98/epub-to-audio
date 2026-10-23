import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../domain/domain.dart';

class BookRepository implements IBookRepository {
  final Directory? customDirectory;
  Directory? _directory;
  bool _initialized = false;
  SharedPreferences? _prefs;

  BookRepository({this.customDirectory});

  Future<void> _ensureInitialized() async {
    if (_initialized) return;

    if (customDirectory != null) {
      _directory = customDirectory;
    } else {
      final appSupport = await getApplicationSupportDirectory();
      _directory = Directory('${appSupport.path}/books');
    }

    if (!await _directory!.exists()) {
      await _directory!.create(recursive: true);
    }

    _prefs = await SharedPreferences.getInstance();
    _initialized = true;
  }

  @override
  Future<List<EpubBook>> getBooks() async {
    await _ensureInitialized();
    final books = <EpubBook>[];
    final list = _directory!.listSync();

    for (final item in list) {
      if (item is File && item.path.endsWith('.json')) {
        try {
          final content = await item.readAsString();
          final json = jsonDecode(content) as Map<String, dynamic>;
          books.add(EpubBook.fromJson(json));
        } catch (_) {}
      }
    }

    books.sort((a, b) => b.uploadedAt.compareTo(a.uploadedAt));
    return books;
  }

  @override
  Future<EpubBook?> getBook(String id) async {
    await _ensureInitialized();
    final file = File('${_directory!.path}/$id.json');
    if (!await file.exists()) return null;

    try {
      final content = await file.readAsString();
      final json = jsonDecode(content) as Map<String, dynamic>;
      return EpubBook.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> saveBook(EpubBook book) async {
    await _ensureInitialized();
    final file = File('${_directory!.path}/${book.id}.json');
    await file.writeAsString(jsonEncode(book.toJson()), flush: true);
  }

  @override
  Future<void> deleteBook(String id) async {
    await _ensureInitialized();
    final file = File('${_directory!.path}/$id.json');
    if (await file.exists()) {
      await file.delete();
    }
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
    if (raw == null) return const TTSSettings();

    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      return TTSSettings.fromJson(json);
    } catch (_) {
      return const TTSSettings();
    }
  }

  @override
  Future<void> saveSettings(TTSSettings settings) async {
    await _ensureInitialized();
    await _prefs?.setString('tts_settings', jsonEncode(settings.toJson()));
  }
}
