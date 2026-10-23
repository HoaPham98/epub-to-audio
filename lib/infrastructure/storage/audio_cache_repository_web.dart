import '../../domain/domain.dart';

class AudioCacheRepository implements IAudioCacheRepository {
  final Map<String, AudioCacheItem> _cache = {};

  @override
  String buildKey({
    required String bookId,
    required int chapterIndex,
    required int chunkIndex,
    required String voice,
    required String model,
    required int sampleRate,
  }) {
    return '$bookId-$chapterIndex-$chunkIndex-$voice-$model-$sampleRate';
  }

  @override
  Future<AudioCacheItem?> getAudioChunk(String key) async {
    final item = _cache[key];
    if (item == null) return null;
    final updated = AudioCacheItem(
      key: item.key,
      bookId: item.bookId,
      chapterIndex: item.chapterIndex,
      chunkIndex: item.chunkIndex,
      bytes: item.bytes,
      duration: item.duration,
      timestamp: item.timestamp,
      lastAccessedAt: DateTime.now().millisecondsSinceEpoch,
    );
    _cache[key] = updated;
    return updated;
  }

  @override
  Future<void> putAudioChunk(AudioCacheItem item) async {
    _cache[item.key] = item;
  }

  @override
  Future<void> deleteAudioChunk(String key) async {
    _cache.remove(key);
  }

  @override
  Future<void> clearBookCache(String bookId) async {
    _cache.removeWhere((_, item) => item.bookId == bookId);
  }

  @override
  Future<void> clearAllCache() async {
    _cache.clear();
  }

  @override
  Future<int> getTotalCacheSizeBytes() async {
    return _cache.values.fold<int>(0, (sum, item) => sum + item.bytes.length);
  }

  @override
  Future<int> cleanupLruAndTtl({
    required int maxSizeBytes,
    required Duration maxAge,
  }) async {
    int purgedCount = 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    final cutoff = now - maxAge.inMilliseconds;

    final expiredKeys = _cache.entries
        .where((e) => e.value.lastAccessedAt < cutoff)
        .map((e) => e.key)
        .toList();

    for (final key in expiredKeys) {
      _cache.remove(key);
      purgedCount++;
    }

    int totalSize =
        _cache.values.fold<int>(0, (sum, item) => sum + item.bytes.length);

    if (totalSize > maxSizeBytes) {
      final sorted = _cache.values.toList()
        ..sort((a, b) => a.lastAccessedAt.compareTo(b.lastAccessedAt));

      for (final item in sorted) {
        if (totalSize <= maxSizeBytes) break;
        _cache.remove(item.key);
        totalSize -= item.bytes.length;
        purgedCount++;
      }
    }

    return purgedCount;
  }

  @override
  Future<List<AudioCacheItem>> listItemsForBook(String bookId) async {
    return _cache.values.where((item) => item.bookId == bookId).toList();
  }
}
