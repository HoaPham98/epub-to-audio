import 'dart:async';
import 'package:flutter/material.dart';
import '../../application/application.dart';
import '../../domain/domain.dart';

class OfflineModelDownloadModal extends StatefulWidget {
  final ManageOfflineModelUseCase modelUseCase;
  final int threads;
  final VoidCallback? onReady;

  const OfflineModelDownloadModal({
    super.key,
    required this.modelUseCase,
    this.threads = 4,
    this.onReady,
  });

  static Future<void> show(
    BuildContext context, {
    required ManageOfflineModelUseCase modelUseCase,
    int threads = 4,
    VoidCallback? onReady,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => OfflineModelDownloadModal(
        modelUseCase: modelUseCase,
        threads: threads,
        onReady: onReady,
      ),
    );
  }

  @override
  State<OfflineModelDownloadModal> createState() => _OfflineModelDownloadModalState();
}

class _OfflineModelDownloadModalState extends State<OfflineModelDownloadModal> {
  bool _isLoading = true;
  bool _isDownloading = false;
  bool _isInitializing = false;
  bool _isDeleting = false;

  bool _modelDownloaded = false;
  bool _dictDownloaded = false;
  bool _engineReady = false;

  String? _errorMessage;
  String _currentStepName = '';
  double _currentProgress = 0.0;
  int _bytesDownloaded = 0;
  int _totalBytes = 0;

  StreamSubscription<ModelDownloadProgress>? _downloadSub;

  @override
  void initState() {
    super.initState();
    _checkStatus();
  }

  @override
  void dispose() {
    _downloadSub?.cancel();
    super.dispose();
  }

  Future<void> _checkStatus() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final modelOk = await widget.modelUseCase.modelManager.isModelDownloaded();
      final dictOk = await widget.modelUseCase.modelManager.isDictionaryDownloaded();
      final engineOk = await widget.modelUseCase.modelManager.isEngineInitialized();

      if (mounted) {
        setState(() {
          _modelDownloaded = modelOk;
          _dictDownloaded = dictOk;
          _engineReady = engineOk;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString();
        });
      }
    }
  }

  void _startDownload() {
    if (_isDownloading) return;

    setState(() {
      _isDownloading = true;
      _errorMessage = null;
      _currentProgress = 0.0;
      _currentStepName = 'Đang chuẩn bị tải...';
    });

    _downloadSub?.cancel();
    _downloadSub = widget.modelUseCase.downloadAllFiles().listen(
      (progress) {
        if (!mounted) return;
        setState(() {
          _currentStepName = 'Đang tải: ${progress.fileName}';
          _currentProgress = progress.progress.clamp(0.0, 1.0);
          _bytesDownloaded = progress.bytesDownloaded;
          _totalBytes = progress.totalBytes;
          if (progress.errorMessage != null) {
            _errorMessage = progress.errorMessage;
          }
        });
      },
      onError: (err) {
        if (!mounted) return;
        setState(() {
          _isDownloading = false;
          _errorMessage = err.toString();
        });
      },
      onDone: () async {
        if (!mounted) return;
        setState(() {
          _isDownloading = false;
        });
        await _checkStatus();
        if (_modelDownloaded && _dictDownloaded && !_engineReady) {
          _initializeEngine();
        }
      },
      cancelOnError: true,
    );
  }

  void _cancelDownload() {
    _downloadSub?.cancel();
    _downloadSub = null;
    setState(() {
      _isDownloading = false;
      _currentStepName = 'Đã hủy tải xuống';
    });
  }

  Future<void> _initializeEngine() async {
    setState(() {
      _isInitializing = true;
      _errorMessage = null;
    });

    try {
      await widget.modelUseCase.initializeEngine(threads: widget.threads);
      if (mounted) {
        setState(() {
          _isInitializing = false;
          _engineReady = true;
        });
        widget.onReady?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isInitializing = false;
          _errorMessage = 'Lỗi khởi tạo động cơ TTS: $e';
        });
      }
    }
  }

  Future<void> _deleteFiles() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xác nhận xóa mô hình'),
        content: const Text(
          'Bạn có chắc muốn xóa tệp model.gguf và sea_g2p.bin (~248 MB)? '
          'Bạn sẽ cần tải lại nếu muốn sử dụng chế độ ngoại tuyến.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Hủy'),
          ),
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
      _isDeleting = true;
      _errorMessage = null;
    });

    try {
      await widget.modelUseCase.deleteModelFiles();
      if (mounted) {
        setState(() {
          _isDeleting = false;
        });
        await _checkStatus();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isDeleting = false;
          _errorMessage = 'Lỗi xóa tệp: $e';
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
    final isComplete = _modelDownloaded && _dictDownloaded;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: const Color(0xFF1E293B),
      child: Container(
        width: 500,
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
                    color: Colors.blue.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.offline_bolt, color: Colors.blue),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Mô hình VieNeu-TTS Ngoại Tuyến',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70),
                  onPressed: _isDownloading ? null : () => Navigator.of(context).pop(),
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
              // Files status section
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.white10),
                ),
                child: Column(
                  children: [
                    _buildFileRow(
                      name: 'VieNeu-TTS Model (model.gguf)',
                      size: '~188 MB',
                      isDownloaded: _modelDownloaded,
                    ),
                    const Divider(color: Colors.white10, height: 16),
                    _buildFileRow(
                      name: 'SEA-G2P Dict (sea_g2p.bin)',
                      size: '~60 MB',
                      isDownloaded: _dictDownloaded,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Status indicator
              if (_engineReady)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.green.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.check_circle, color: Colors.green, size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Động cơ TTS ngoại tuyến đã sẵn sàng hoạt động (24 kHz Mono).',
                          style: TextStyle(color: Colors.greenAccent, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                )
              else if (isComplete)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.info_outline, color: Colors.amber, size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Các tệp đã tải xong. Cần khởi tạo động cơ để sử dụng.',
                          style: TextStyle(color: Colors.amberAccent, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),

              // Download progress section
              if (_isDownloading) ...[
                const SizedBox(height: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            _currentStepName,
                            style: const TextStyle(color: Colors.white70, fontSize: 13),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          '${(_currentProgress * 100).toStringAsFixed(1)}%',
                          style: const TextStyle(
                            color: Colors.blueAccent,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: _currentProgress > 0 ? _currentProgress : null,
                      backgroundColor: Colors.white12,
                      valueColor: const AlwaysStoppedAnimation<Color>(Colors.blueAccent),
                      minHeight: 8,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    const SizedBox(height: 6),
                    if (_totalBytes > 0)
                      Text(
                        '${_formatBytes(_bytesDownloaded)} / ${_formatBytes(_totalBytes)}',
                        style: const TextStyle(color: Colors.white54, fontSize: 12),
                      ),
                  ],
                ),
              ],

              // Error banner
              if (_errorMessage != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.redAccent, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),

              // Action buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (isComplete) ...[
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.redAccent,
                        side: const BorderSide(color: Colors.redAccent),
                      ),
                      onPressed: (_isDownloading || _isInitializing || _isDeleting)
                          ? null
                          : _deleteFiles,
                      icon: _isDeleting
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.redAccent),
                            )
                          : const Icon(Icons.delete_outline, size: 18),
                      label: const Text('Xóa tệp'),
                    ),
                    const SizedBox(width: 8),
                  ],

                  if (_isDownloading)
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.white70),
                      onPressed: _cancelDownload,
                      child: const Text('Hủy'),
                    )
                  else if (!isComplete)
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blueAccent,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: _startDownload,
                      icon: const Icon(Icons.download, size: 18),
                      label: const Text('Tải xuống toàn bộ (~248 MB)'),
                    )
                  else if (!_engineReady)
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: _isInitializing ? null : _initializeEngine,
                      icon: _isInitializing
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.play_arrow, size: 18),
                      label: Text(_isInitializing ? 'Đang khởi tạo...' : 'Khởi tạo động cơ'),
                    )
                  else
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blueAccent,
                        foregroundColor: Colors.white,
                      ),
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Đóng'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildFileRow({
    required String name,
    required String size,
    required bool isDownloaded,
  }) {
    return Row(
      children: [
        Icon(
          isDownloaded ? Icons.check_circle : Icons.radio_button_unchecked,
          color: isDownloaded ? Colors.greenAccent : Colors.white38,
          size: 18,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
              ),
              Text(
                size,
                style: const TextStyle(color: Colors.white54, fontSize: 11),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: isDownloaded
                ? Colors.green.withValues(alpha: 0.2)
                : Colors.white10,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            isDownloaded ? 'Đã tải' : 'Chưa tải',
            style: TextStyle(
              color: isDownloaded ? Colors.greenAccent : Colors.white60,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}
