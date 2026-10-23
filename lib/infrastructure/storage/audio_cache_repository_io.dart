import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../../domain/domain.dart';

class _CacheIndexEntry {
  final String key;
  final String bookId;
  final int chapterIndex;
  final int chunkIndex;
  final String fileName;
  final int sizeBytes;
  final double? duration;
  final int timestamp;
  int lastAccessedAt;

  _CacheIndexEntry({
    required this.key,
    required this.bookId,
    required this.chapterIndex,
    required this.chunkIndex,
    required this.fileName,
    required this.sizeBytes,
    this.duration,
    required this.timestamp,
    required this.lastAccessedAt,
  });

  Map<String, dynamic> toJson() => {
        'key': key,
        'bookId': bookId,
        'chapterIndex': chapterIndex,
        'chunkIndex': chunkIndex,
        'fileName': fileName,
        'sizeBytes': sizeBytes,
        'duration': duration,
        'timestamp': timestamp,
        'lastAccessedAt': lastAccessedAt,
      };

  factory _CacheIndexEntry.fromJson(Map<String, dynamic> json) =>
      _CacheIndexEntry(
        key: json['key'] as String,
        bookId: json['bookId'] as String,
        chapterIndex: json['chapterIndex'] as int,
        chunkIndex: json['chunkIndex'] as int,
        fileName: json['fileName'] as String,
        sizeBytes: json['sizeBytes'] as int,
        duration: (json['duration'] as num?)?.toDouble(),
        timestamp: json['timestamp'] as int,
        lastAccessedAt: json['lastAccessedAt'] as int,
      );
}

class AudioCacheRepository implements IAudioCacheRepository {
  final Directory? customDirectory;
  Directory? _directory;
  final Map<String, _CacheIndexEntry> _index = {};
  bool _initialized = false;

  AudioCacheRepository({this.customDirectory});

  Future<void> _ensureInitialized() async {
    if (_initialized) return;

    if (customDirectory != null) {
      _directory = customDirectory;
    } else {
      final appCache = await getApplicationCacheDirectory();
      _directory = Directory('${appCache.path}/audio_cache');
    }

    if (!await _directory!.exists()) {
      await _directory!.create(recursive: true);
    }

    final indexFile = File('${_directory!.path}/index.json');
    if (await indexFile.exists()) {
      try {
        final content = await indexFile.readAsString();
        final Map<String, dynamic> data = jsonDecode(content);
        for (final entry in data.entries) {
          _index[entry.key] =
              _CacheIndexEntry.fromJson(entry.value as Map<String, dynamic>);
        }
      } catch (_) {
        _index.clear();
      }
    }

    _initialized = true;
  }

  Future<void> _persistIndex() async {
    if (_directory == null) return;
    final indexFile = File('${_directory!.path}/index.json');
    final map = _index.map((k, v) => MapEntry(k, v.toJson()));
    await indexFile.writeAsString(jsonEncode(map), flush: true);
  }

  String _sanitizeFileName(String key) {
    return '${key.replaceAll(RegExp(r'[^\w\-]'), '_')}.wav';
  }

  @override
  String buildKey({
    required String bookId,
    required int chapterIndex,
    required int chunkIndex,
    required String voice,
    required String model,
    required int sampleRate,
  }) {
    // Explicitly excludes speed to allow dynamic runtime scaling without duplicate caches
    return '$bookId-$chapterIndex-$chunkIndex-$voice-$model-$sampleRate';
  }

  @override
  Future<AudioCacheItem?> getAudioChunk(String key) async {
    await _ensureInitialized();
    final entry = _index[key];
    if (entry == null) return null;

    final file = File('${_directory!.path}/${entry.fileName}');
    if (!await file.exists()) {
      _index.remove(key);
      await _persistIndex();
      return null;
    }

    final bytes = await file.readAsBytes();
    entry.lastAccessedAt = DateTime.now().millisecondsSinceEpoch;
    await _persistIndex();

    return AudioCacheItem(
      key: entry.key,
      bookId: entry.bookId,
      chapterIndex: entry.chapterIndex,
      chunkIndex: entry.chunkIndex,
      bytes: bytes,
      duration: entry.duration,
      timestamp: entry.timestamp,
      lastAccessedAt: entry.lastAccessedAt,
    );
  }

  @override
  Future<void> putAudioChunk(AudioCacheItem item) async {
    await _ensureInitialized();
    final fileName = _sanitizeFileName(item.key);
    final file = File('${_directory!.path}/$fileName');
    await file.writeAsBytes(item.bytes, flush: true);

    _index[item.key] = _CacheIndexEntry(
      key: item.key,
      bookId: item.bookId,
      chapterIndex: item.chapterIndex,
      chunkIndex: item.chunkIndex,
      fileName: fileName,
      sizeBytes: item.bytes.length,
      duration: item.duration,
      timestamp: item.timestamp,
      lastAccessedAt: item.lastAccessedAt,
    );

    await _persistIndex();
  }

  @override
  Future<void> deleteAudioChunk(String key) async {
    await _ensureInitialized();
    final entry = _index.remove(key);
    if (entry != null) {
      final file = File('${_directory!.path}/${entry.fileName}');
      if (await file.exists()) {
        await file.delete();
      }
      await _persistIndex();
    }
  }

  @override
  Future<void> clearBookCache(String bookId) async {
    await _ensureInitialized();
    final toRemove = _index.values.where((e) => e.bookId == bookId).toList();
    for (final entry in toRemove) {
      _index.remove(entry.key);
      final file = File('${_directory!.path}/${entry.fileName}');
      if (await file.exists()) {
        await file.delete();
      }
    }
    await _persistIndex();
  }

  @override
  Future<void> clearAllCache() async {
    await _ensureInitialized();
    for (final entry in _index.values) {
      final file = File('${_directory!.path}/${entry.fileName}');
      if (await file.exists()) {
        await file.delete();
      }
    }
    _index.clear();
    await _persistIndex();
  }

  @override
  Future<int> getTotalCacheSizeBytes() async {
    await _ensureInitialized();
    return _index.values.fold<int>(0, (sum, e) => sum + e.sizeBytes);
  }

  @override
  Future<int> cleanupLruAndTtl({
    required int maxSizeBytes,
    required Duration maxAge,
  }) async {
    await _ensureInitialized();
    int purgedCount = 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    final cutoff = now - maxAge.inMilliseconds;

    // 1. Sliding TTL cleanup: purge expired items
    final expiredEntries =
        _index.values.where((e) => e.lastAccessedAt < cutoff).toList();

    for (final entry in expiredEntries) {
      _index.remove(entry.key);
      final file = File('${_directory!.path}/${entry.fileName}');
      if (await file.exists()) {
        await file.delete();
      }
      purgedCount++;
    }

    // 2. LRU cleanup: if total size still exceeds maxSizeBytes, evict oldest
    int totalSize = _index.values.fold<int>(0, (sum, e) => sum + e.sizeBytes);
    if (totalSize > maxSizeBytes) {
      final sortedEntries = _index.values.toList()
        ..sort((a, b) => a.lastAccessedAt.compareTo(b.lastAccessedAt));

      for (final entry in sortedEntries) {
        if (totalSize <= maxSizeBytes) break;

        _index.remove(entry.key);
        final file = File('${_directory!.path}/${entry.fileName}');
        if (await file.exists()) {
          await file.delete();
        }
        totalSize -= entry.sizeBytes;
        purgedCount++;
      }
    }

    await _persistIndex();
    return purgedCount;
  }

  @override
  Future<List<AudioCacheItem>> listItemsForBook(String bookId) async {
    await _ensureInitialized();
    final results = <AudioCacheItem>[];
    for (final entry in _index.values.where((e) => e.bookId == bookId)) {
      final file = File('${_directory!.path}/${entry.fileName}');
      if (await file.exists()) {
        final bytes = await file.readAsBytes();
        results.add(AudioCacheItem(
          key: entry.key,
          bookId: entry.bookId,
          chapterIndex: entry.chapterIndex,
          chunkIndex: entry.chunkIndex,
          bytes: bytes,
          duration: entry.duration,
          timestamp: entry.timestamp,
          lastAccessedAt: entry.lastAccessedAt,
        ));
      }
    }
    return results;
  }
}
