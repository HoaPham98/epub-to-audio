import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../application/application.dart';
import '../../domain/domain.dart';

class CacheModal extends StatefulWidget {
  final ManageAudioCacheUseCase cacheUseCase;
  final String? currentBookId;
  final String? currentBookTitle;

  const CacheModal({
    super.key,
    required this.cacheUseCase,
    this.currentBookId,
    this.currentBookTitle,
  });

  static Future<void> show(
    BuildContext context, {
    required ManageAudioCacheUseCase cacheUseCase,
    String? currentBookId,
    String? currentBookTitle,
  }) {
    return showDialog(
      context: context,
      builder: (ctx) => CacheModal(
        cacheUseCase: cacheUseCase,
        currentBookId: currentBookId,
        currentBookTitle: currentBookTitle,
      ),
    );
  }

  @override
  State<CacheModal> createState() => _CacheModalState();
}

class _CacheModalState extends State<CacheModal> {
  bool _isLoading = true;
  bool _isProcessing = false;
  int _totalSizeBytes = 0;
  List<AudioCacheItem> _bookItems = [];
  String? _statusMessage;
  bool _isSuccess = true;

  int get _maxCacheQuotaBytes {
    if (kIsWeb) return 200 * 1024 * 1024; // 200MB Web
    return 500 * 1024 * 1024; // 500MB Native
  }

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      final total = await widget.cacheUseCase.getTotalSizeBytes();
      List<AudioCacheItem> items = [];
      if (widget.currentBookId != null) {
        items = await widget.cacheUseCase.listBookItems(widget.currentBookId!);
      }

      if (mounted) {
        setState(() {
          _totalSizeBytes = total;
          _bookItems = items;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _statusMessage = 'Lỗi tải thống kê: $e';
          _isSuccess = false;
        });
      }
    }
  }

  Future<void> _handleCleanupLru() async {
    setState(() {
      _isProcessing = true;
      _statusMessage = null;
    });

    try {
      final purged = await widget.cacheUseCase.cleanup(
        maxSizeBytes: _maxCacheQuotaBytes,
        maxAge: const Duration(days: 7),
      );
      await _loadStats();
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _statusMessage = 'Đã dọn dẹp $purged đoạn âm thanh cũ / vượt giới hạn.';
          _isSuccess = true;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _statusMessage = 'Lỗi dọn dẹp: $e';
          _isSuccess = false;
        });
      }
    }
  }

  Future<void> _handleClearCurrentBook() async {
    if (widget.currentBookId == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa đệm sách hiện tại'),
        content: Text('Xác nhận xóa toàn bộ âm thanh đã nạp sẵn cho "${widget.currentBookTitle ?? 'sách'}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Hủy')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Xóa', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isProcessing = true;
      _statusMessage = null;
    });

    try {
      await widget.cacheUseCase.clearBook(widget.currentBookId!);
      await _loadStats();
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _statusMessage = 'Đã xóa bộ nhớ đệm của sách.';
          _isSuccess = true;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _statusMessage = 'Lỗi: $e';
          _isSuccess = false;
        });
      }
    }
  }

  Future<void> _handleClearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa toàn bộ bộ nhớ đệm'),
        content: const Text(
          'Bạn có chắc muốn xóa tất cả các tệp âm thanh 24 kHz WAV trong bộ nhớ đệm? '
          'Hành động này không thể hoàn tác.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Hủy')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Xóa toàn bộ', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isProcessing = true;
      _statusMessage = null;
    });

    try {
      await widget.cacheUseCase.clearAll();
      await _loadStats();
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _statusMessage = 'Đã xóa toàn bộ bộ nhớ đệm thành công.';
          _isSuccess = true;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isProcessing = false;
          _statusMessage = 'Lỗi: $e';
          _isSuccess = false;
        });
      }
    }
  }

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 B';
    const suffixes = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    double d = bytes.toDouble();
    while (d >= 1024 && i < suffixes.length - 1) {
      d /= 1024;
      i++;
    }
    return '${d.toStringAsFixed(1)} ${suffixes[i]}';
  }

  @override
  Widget build(BuildContext context) {
    final quota = _maxCacheQuotaBytes;
    final ratio = (_totalSizeBytes / quota).clamp(0.0, 1.0);

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: const Color(0xFF1E293B),
      child: Container(
        width: 520,
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.indigo.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.storage, color: Colors.indigoAccent),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Bộ Nhớ Đệm Âm Thanh (Audio Cache)',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (_isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: CircularProgressIndicator(),
                ),
              )
            else ...[
              // Storage Gauge Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Expanded(
                          child: Text(
                            'Dung lượng đã sử dụng',
                            style: TextStyle(color: Colors.white70, fontSize: 13),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          '${_formatBytes(_totalSizeBytes)} / ${_formatBytes(quota)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    LinearProgressIndicator(
                      value: ratio,
                      backgroundColor: Colors.white12,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        ratio > 0.9 ? Colors.redAccent : (ratio > 0.7 ? Colors.amberAccent : Colors.indigoAccent),
                      ),
                      minHeight: 10,
                      borderRadius: BorderRadius.circular(5),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            'Cơ chế: LRU + Hết hạn trượt (7 ngày)',
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 11),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${(ratio * 100).toStringAsFixed(1)}% dung lượng',
                          style: TextStyle(
                            color: ratio > 0.9 ? Colors.redAccent : Colors.white60,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Current book cached chunks stats
              if (widget.currentBookId != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.bookmark, color: Colors.blueAccent, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Sách hiện tại: ${_bookItems.length} đoạn âm thanh sẵn sàng',
                          style: const TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                      ),
                      TextButton.icon(
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.orangeAccent,
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                        onPressed: _isProcessing ? null : _handleClearCurrentBook,
                        icon: const Icon(Icons.delete_outline, size: 16),
                        label: const Text('Xóa sách này', style: TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Status Banner
              if (_statusMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _isSuccess
                        ? Colors.green.withValues(alpha: 0.2)
                        : Colors.red.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _isSuccess
                          ? Colors.green.withValues(alpha: 0.4)
                          : Colors.red.withValues(alpha: 0.4),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _isSuccess ? Icons.check_circle_outline : Icons.error_outline,
                        color: _isSuccess ? Colors.greenAccent : Colors.redAccent,
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _statusMessage!,
                          style: TextStyle(
                            color: _isSuccess ? Colors.greenAccent : Colors.redAccent,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              const SizedBox(height: 12),

              // Action Buttons
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.redAccent,
                      side: const BorderSide(color: Colors.redAccent),
                    ),
                    onPressed: _isProcessing ? null : _handleClearAll,
                    icon: const Icon(Icons.delete_forever, size: 18),
                    label: const Text('Xóa tất cả'),
                  ),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.indigoAccent,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _isProcessing ? null : _handleCleanupLru,
                    icon: _isProcessing
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.cleaning_services, size: 18),
                    label: const Text('Dọn dẹp LRU / TTL'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
