import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../domain/domain.dart';
import '../../infrastructure/tts/tts.dart';

class SettingsModal extends StatefulWidget {
  final TTSSettings settings;
  final Function(TTSSettings updated) onSave;
  final VoidCallback onOpenModelDownload;
  final bool isBottomSheet;

  const SettingsModal({
    super.key,
    required this.settings,
    required this.onSave,
    required this.onOpenModelDownload,
    this.isBottomSheet = false,
  });

  static Future<void> show(
    BuildContext context, {
    required TTSSettings settings,
    required Function(TTSSettings updated) onSave,
    required VoidCallback onOpenModelDownload,
  }) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    if (isMobile) {
      return showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => FractionallySizedBox(
          heightFactor: 0.85,
          child: SettingsModal(
            settings: settings,
            onSave: onSave,
            onOpenModelDownload: onOpenModelDownload,
            isBottomSheet: true,
          ),
        ),
      );
    }
    return showDialog(
      context: context,
      builder: (ctx) => SettingsModal(
        settings: settings,
        onSave: onSave,
        onOpenModelDownload: onOpenModelDownload,
        isBottomSheet: false,
      ),
    );
  }

  @override
  State<SettingsModal> createState() => _SettingsModalState();
}

class _SettingsModalState extends State<SettingsModal> {
  late TtsMode _mode;
  late TextEditingController _endpointCtrl;
  late TextEditingController _apiKeyCtrl;
  late TextEditingController _modelCtrl;
  late String _selectedVoice;
  late int _threads;
  late double _temperature;
  late int _topK;
  late double _topP;
  late double _repetitionPenalty;
  late bool _useCorsProxy;
  late TextEditingController _corsProxyUrlCtrl;

  bool _isTesting = false;
  String? _testMessage;
  bool? _testSuccess;

  @override
  void initState() {
    super.initState();
    final s = widget.settings;
    _mode = kIsWeb ? TtsMode.remote : s.ttsMode;
    _endpointCtrl = TextEditingController(text: s.endpoint);
    _apiKeyCtrl = TextEditingController(text: s.apiKey);
    _modelCtrl = TextEditingController(text: s.model);
    _selectedVoice = s.voice;
    _threads = s.threads;
    _temperature = s.temperature;
    _topK = s.topK;
    _topP = s.topP;
    _repetitionPenalty = s.repetitionPenalty;
    _useCorsProxy = s.useCorsProxy;
    _corsProxyUrlCtrl = TextEditingController(text: s.corsProxyUrl);
  }

  @override
  void dispose() {
    _endpointCtrl.dispose();
    _apiKeyCtrl.dispose();
    _modelCtrl.dispose();
    _corsProxyUrlCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleTestConnection() async {
    setState(() {
      _isTesting = true;
      _testMessage = null;
      _testSuccess = null;
    });

    try {
      final current = _buildSettings();
      final client = TTSClientFactory.create(current);
      final result = await client.testConnection(current);
      setState(() {
        _isTesting = false;
        _testSuccess = result.success;
        _testMessage = result.message;
      });
    } catch (e) {
      setState(() {
        _isTesting = false;
        _testSuccess = false;
        _testMessage = e.toString();
      });
    }
  }

  TTSSettings _buildSettings() {
    return widget.settings.copyWith(
      ttsMode: _mode,
      endpoint: _endpointCtrl.text.trim(),
      apiKey: _apiKeyCtrl.text.trim(),
      model: _modelCtrl.text.trim(),
      voice: _selectedVoice,
      threads: _threads,
      temperature: _temperature,
      topK: _topK,
      topP: _topP,
      repetitionPenalty: _repetitionPenalty,
      useCorsProxy: _useCorsProxy,
      corsProxyUrl: _corsProxyUrlCtrl.text.trim(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.isBottomSheet) ...[
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
        ],
        // Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Expanded(
              child: Text(
                'Cài đặt Giọng đọc & TTS',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 20),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Mode selector segment (Offline vs Remote)
        SegmentedButton<TtsMode>(
          showSelectedIcon: false,
          segments: [
            ButtonSegment<TtsMode>(
              value: TtsMode.offline,
              label: Text(widget.isBottomSheet ? 'Offline' : 'Offline On-Device', overflow: TextOverflow.ellipsis),
              icon: const Icon(Icons.offline_bolt, size: 16),
            ),
            ButtonSegment<TtsMode>(
              value: TtsMode.remote,
              label: Text(widget.isBottomSheet ? 'Máy chủ (API)' : 'Máy chủ từ xa (API)', overflow: TextOverflow.ellipsis),
              icon: const Icon(Icons.cloud_queue, size: 16),
            ),
          ],
          selected: {_mode},
          onSelectionChanged: (set) {
            if (kIsWeb && set.first == TtsMode.offline) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'On-device TTS chỉ hỗ trợ trên Windows, Android và iOS.',
                  ),
                ),
              );
              return;
            }
            setState(() => _mode = set.first);
          },
        ),
        const SizedBox(height: 20),

        // Content based on Mode
        Expanded(
          child: SingleChildScrollView(
            child: _mode == TtsMode.offline
                ? _buildOfflineSettings(isDark)
                : _buildRemoteSettings(isDark),
          ),
        ),

        const SizedBox(height: 16),
        // Footer Actions
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Hủy'),
            ),
            const SizedBox(width: 8),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Colors.indigo,
                foregroundColor: Colors.white,
              ),
              onPressed: () {
                widget.onSave(_buildSettings());
                Navigator.of(context).pop();
              },
              child: const Text('Lưu cài đặt'),
            ),
          ],
        ),
      ],
    );

    if (widget.isBottomSheet) {
      return Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF18181B) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: content,
      );
    }

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: isDark ? const Color(0xFF18181B) : Colors.white,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 550, maxHeight: 680),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: content,
        ),
      ),
    );
  }

  Widget _buildOfflineSettings(bool isDark) {
    final voices = [
      'Minh Quân Pro',
      'Ngọc Huyền',
      'Mai Anh',
      'Thùy Dung',
      'Quang Sơn',
      'Ngọc Trân',
      'Anh Khôi',
      'Trúc Ly',
      'Adam bựa',
      'Thiền Tâm Đức',
      'Minh Đức',
      'Phạm Tuyên',
      'Thái Sơn',
      'Xuân Vĩnh',
      'Thanh Bình',
      'Ngọc Linh',
      'Đoan Trang',
      'Thục Đoan',
      'Minh Triết',
      'Mỹ Duyên',
      'Quỳnh Anh',
      'Đức Trí',
      'Kim Thanh',
      'Adam',
      'Mạnh Dũng',
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Model Download Banner
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.indigo.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.indigo.withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              const Icon(Icons.memory, color: Colors.indigo, size: 24),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'VieNeu-TTS v3 Turbo GGUF',
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    Text(
                      'Model 188 MB + Dictionary 60 MB',
                      style: TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  ],
                ),
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.download, size: 14),
                label: const Text('Quản lý Model', style: TextStyle(fontSize: 11)),
                onPressed: widget.onOpenModelDownload,
                style: OutlinedButton.styleFrom(
                  minimumSize: Size.zero,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Voice selector
        const Text('Giọng đọc (25 giọng tiếng Việt có sẵn):',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          initialValue: voices.contains(_selectedVoice) ? _selectedVoice : voices.first,
          decoration: InputDecoration(
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          items: voices
              .map((v) => DropdownMenuItem(
                    value: v,
                    child: Text(v, style: const TextStyle(fontSize: 13)),
                  ))
              .toList(),
          onChanged: (val) {
            if (val != null) setState(() => _selectedVoice = val);
          },
        ),
        const SizedBox(height: 16),

        // CPU Threads
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Expanded(
              child: Text(
                'Số luồng CPU (threads):',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Text('$_threads luồng',
                style: const TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.bold,
                    color: Colors.indigo)),
          ],
        ),
        Slider(
          value: _threads.toDouble(),
          min: 1,
          max: 16,
          divisions: 15,
          label: '$_threads',
          onChanged: (val) => setState(() => _threads = val.round()),
        ),

        // Advanced Sampling: Temperature & Top-K
        if (widget.isBottomSheet) ...[
          Text('Temperature (${_temperature.toStringAsFixed(2)})',
              style: const TextStyle(fontSize: 12)),
          Slider(
            value: _temperature,
            min: 0.1,
            max: 1.5,
            divisions: 14,
            onChanged: (val) => setState(() => _temperature = val),
          ),
          const SizedBox(height: 8),
          Text('Top-K ($_topK)', style: const TextStyle(fontSize: 12)),
          Slider(
            value: _topK.toDouble(),
            min: 1,
            max: 100,
            divisions: 99,
            onChanged: (val) => setState(() => _topK = val.round()),
          ),
        ] else ...[
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Temperature (${_temperature.toStringAsFixed(2)})',
                        style: const TextStyle(fontSize: 12)),
                    Slider(
                      value: _temperature,
                      min: 0.1,
                      max: 1.5,
                      divisions: 14,
                      onChanged: (val) => setState(() => _temperature = val),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Top-K ($_topK)', style: const TextStyle(fontSize: 12)),
                    Slider(
                      value: _topK.toDouble(),
                      min: 1,
                      max: 100,
                      divisions: 99,
                      onChanged: (val) => setState(() => _topK = val.round()),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildRemoteSettings(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Endpoint URL:',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 6),
        TextField(
          controller: _endpointCtrl,
          decoration: InputDecoration(
            hintText: 'http://localhost:8000/v1',
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          style: const TextStyle(fontSize: 13),
        ),
        const SizedBox(height: 12),

        const Text('API Key (nếu có):',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 6),
        TextField(
          controller: _apiKeyCtrl,
          obscureText: true,
          decoration: InputDecoration(
            hintText: 'sk-...',
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          style: const TextStyle(fontSize: 13),
        ),
        const SizedBox(height: 12),

        const Text('Model:',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 6),
        TextField(
          controller: _modelCtrl,
          decoration: InputDecoration(
            hintText: 'vieneu-v3-turbo',
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          style: const TextStyle(fontSize: 13),
        ),
        if (kIsWeb) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.amber.withValues(alpha: 0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text(
                    'Kích hoạt CORS Proxy (Web)',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  subtitle: const Text(
                    'Giúp gọi API remote từ trình duyệt Web không bị chặn bởi CORS',
                    style: TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                  value: _useCorsProxy,
                  activeColor: Colors.amber,
                  onChanged: (val) => setState(() => _useCorsProxy = val),
                ),
                if (_useCorsProxy) ...[
                  const SizedBox(height: 8),
                  const Text('CORS Proxy URL Prefix:',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _corsProxyUrlCtrl,
                    decoration: InputDecoration(
                      hintText: 'https://proxy.corsfix.com/?',
                      isDense: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    style: const TextStyle(fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),

        // Test connection button
        OutlinedButton.icon(
          icon: _isTesting
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.wifi_tethering, size: 16),
          label: const Text('Kiểm tra kết nối API',
              style: TextStyle(fontSize: 12)),
          onPressed: _isTesting ? null : _handleTestConnection,
        ),
        if (_testMessage != null) ...[
          const SizedBox(height: 8),
          Text(
            _testMessage!,
            style: TextStyle(
              fontSize: 12,
              color: _testSuccess == true ? Colors.green : Colors.red,
            ),
          ),
        ],
      ],
    );
  }
}
