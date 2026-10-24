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
          heightFactor: 0.9,
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
  late TextEditingController _voiceCtrl;
  late String _selectedVoice;
  late int _sampleRate;
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

  bool _isFetchingVoices = false;
  String? _voicesFeedback;
  bool? _voicesFeedbackSuccess;
  List<VoiceOption> _fetchedVoices = [];

  bool _isFetchingModels = false;
  String? _modelsFeedback;
  bool? _modelsFeedbackSuccess;
  List<ModelOption> _fetchedModels = [];

  bool _showAdvanced = false;

  static const List<String> _suggestedVoices = [
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

  @override
  void initState() {
    super.initState();
    final s = widget.settings;
    _mode = kIsWeb ? TtsMode.remote : s.ttsMode;
    _endpointCtrl = TextEditingController(text: s.endpoint);
    _apiKeyCtrl = TextEditingController(text: s.apiKey);
    _modelCtrl = TextEditingController(text: s.model);
    _selectedVoice = s.voice;
    _voiceCtrl = TextEditingController(text: s.voice);
    _sampleRate = s.sampleRate;
    // Auto-correct to 48000 Hz if connecting to VieNeu server with old 24000 default
    if (_sampleRate == 24000 &&
        (_endpointCtrl.text.contains('vieneu') ||
            _modelCtrl.text.contains('turbo'))) {
      _sampleRate = 48000;
    }
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
    _voiceCtrl.dispose();
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

  Future<void> _handleFetchVoices() async {
    final endpoint = _endpointCtrl.text.trim();
    if (endpoint.isEmpty) {
      setState(() {
        _voicesFeedback = 'Vui lòng nhập Endpoint URL trước.';
        _voicesFeedbackSuccess = false;
      });
      return;
    }
    setState(() {
      _isFetchingVoices = true;
      _voicesFeedback = null;
    });

    try {
      final current = _buildSettings();
      final client = TTSClientFactory.create(current);
      final voices = await client.fetchVoices(
        endpoint,
        _apiKeyCtrl.text.trim(),
        useCorsProxy: _useCorsProxy,
        corsProxyUrl: _corsProxyUrlCtrl.text.trim(),
      );

      setState(() {
        _isFetchingVoices = false;
        if (voices.isEmpty) {
          _voicesFeedback =
              'Endpoint trả về 0 giọng đọc. Vui lòng kiểm tra lại URL/API key.';
          _voicesFeedbackSuccess = false;
        } else {
          _fetchedVoices = voices;
          _voicesFeedback = 'Đã tìm thấy ${voices.length} giọng đọc từ /v1/voices!';
          _voicesFeedbackSuccess = true;
          final exists = voices.any((v) =>
              v.id.toLowerCase() == _selectedVoice.toLowerCase() ||
              v.name.toLowerCase() == _selectedVoice.toLowerCase());
          if (!exists && voices.isNotEmpty) {
            final firstVoice = voices.first.name.isNotEmpty
                ? voices.first.name
                : voices.first.id;
            _selectedVoice = firstVoice;
            _voiceCtrl.text = firstVoice;
          }
        }
      });
    } catch (e) {
      setState(() {
        _isFetchingVoices = false;
        _voicesFeedback = 'Lỗi tải danh sách voices: $e';
        _voicesFeedbackSuccess = false;
      });
    }
  }

  Future<void> _handleFetchModels() async {
    final endpoint = _endpointCtrl.text.trim();
    if (endpoint.isEmpty) {
      setState(() {
        _modelsFeedback = 'Vui lòng nhập Endpoint URL trước.';
        _modelsFeedbackSuccess = false;
      });
      return;
    }
    setState(() {
      _isFetchingModels = true;
      _modelsFeedback = null;
    });

    try {
      final current = _buildSettings();
      final client = TTSClientFactory.create(current);
      final models = await client.fetchModels(
        endpoint,
        _apiKeyCtrl.text.trim(),
        useCorsProxy: _useCorsProxy,
        corsProxyUrl: _corsProxyUrlCtrl.text.trim(),
      );

      setState(() {
        _isFetchingModels = false;
        if (models.isEmpty) {
          _modelsFeedback = 'Endpoint trả về 0 models. Kiểm tra lại URL.';
          _modelsFeedbackSuccess = false;
        } else {
          _fetchedModels = models;
          _modelsFeedback = 'Đã tìm thấy ${models.length} models từ /v1/models!';
          _modelsFeedbackSuccess = true;
          final exists = models.any((m) =>
              m.id.toLowerCase() == _modelCtrl.text.trim().toLowerCase());
          if (!exists && models.isNotEmpty) {
            _modelCtrl.text = models.first.id;
          }
        }
      });
    } catch (e) {
      setState(() {
        _isFetchingModels = false;
        _modelsFeedback = 'Lỗi tải danh sách models: $e';
        _modelsFeedbackSuccess = false;
      });
    }
  }

  void _applyPreset({
    required String endpoint,
    required String model,
    required String voice,
    required int sampleRate,
  }) {
    setState(() {
      _endpointCtrl.text = endpoint;
      _modelCtrl.text = model;
      _selectedVoice = voice;
      _voiceCtrl.text = voice;
      _sampleRate = sampleRate;
      _voicesFeedback = null;
      _modelsFeedback = null;
      _testMessage = null;
    });
  }

  TTSSettings _buildSettings() {
    return widget.settings.copyWith(
      ttsMode: _mode,
      endpoint: _endpointCtrl.text.trim(),
      apiKey: _apiKeyCtrl.text.trim(),
      model: _modelCtrl.text.trim(),
      voice: _selectedVoice,
      sampleRate: _sampleRate,
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
        const SizedBox(height: 14),

        // Mode selector segment (Offline vs Remote)
        SegmentedButton<TtsMode>(
          showSelectedIcon: false,
          segments: [
            ButtonSegment<TtsMode>(
              value: TtsMode.offline,
              label: Text(
                widget.isBottomSheet ? 'Offline' : 'Offline On-Device',
                overflow: TextOverflow.ellipsis,
              ),
              icon: const Icon(Icons.offline_bolt, size: 16),
            ),
            ButtonSegment<TtsMode>(
              value: TtsMode.remote,
              label: Text(
                widget.isBottomSheet ? 'Máy chủ (API)' : 'Máy chủ từ xa (API)',
                overflow: TextOverflow.ellipsis,
              ),
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
        const SizedBox(height: 16),

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
                final updated = _buildSettings();
                Navigator.of(context).pop();
                widget.onSave(updated);
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
        constraints: const BoxConstraints(maxWidth: 580, maxHeight: 720),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: content,
        ),
      ),
    );
  }

  Widget _buildOfflineSettings(bool isDark) {
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
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
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
        const Text(
          'Giọng đọc (25 giọng tiếng Việt có sẵn):',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          key: ValueKey(_selectedVoice),
          initialValue: _suggestedVoices.contains(_selectedVoice)
              ? _selectedVoice
              : _suggestedVoices.first,
          decoration: InputDecoration(
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          items: _suggestedVoices
              .map((v) => DropdownMenuItem(
                    value: v,
                    child: Text(v, style: const TextStyle(fontSize: 13)),
                  ))
              .toList(),
          onChanged: (val) {
            if (val != null) {
              setState(() {
                _selectedVoice = val;
                _voiceCtrl.text = val;
              });
            }
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
    );
  }

  Widget _buildRemoteSettings(bool isDark) {
    final activeVoices = _fetchedVoices.isNotEmpty
        ? _fetchedVoices
            .map((v) => v.name.isNotEmpty ? v.name : v.id)
            .toList()
        : _suggestedVoices;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Quick Presets
        const Text(
          'Cấu hình mẫu nhanh:',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            _buildPresetChip(
              label: 'VieNeu-TTS (Cloud)',
              endpoint: 'https://vieneu-tts.iamqh.io.vn/v1',
              model: 'vieneu-v3-turbo',
              voice: 'Mai Anh',
              sampleRate: 48000,
              isDark: isDark,
            ),
            _buildPresetChip(
              label: 'VieNeu-TTS (Local)',
              endpoint: 'http://localhost:8000/v1',
              model: 'vieneu-v3-turbo',
              voice: 'Mai Anh',
              sampleRate: 48000,
              isDark: isDark,
            ),
            _buildPresetChip(
              label: 'OpenAI (Chính thức)',
              endpoint: 'https://api.openai.com/v1',
              model: 'tts-1',
              voice: 'alloy',
              sampleRate: 24000,
              isDark: isDark,
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Endpoint URL
        const Text('Endpoint URL:',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 6),
        TextField(
          controller: _endpointCtrl,
          decoration: InputDecoration(
            hintText: 'https://vieneu-tts.iamqh.io.vn/v1',
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
        ),
        const SizedBox(height: 12),

        // API Key
        const Text('API Key (nếu có):',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 6),
        TextField(
          controller: _apiKeyCtrl,
          obscureText: true,
          decoration: InputDecoration(
            hintText: 'Để trống nếu server không yêu cầu',
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          style: const TextStyle(fontSize: 13),
        ),
        const SizedBox(height: 12),

        // Model Selection
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Mô hình TTS (Model):',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            TextButton.icon(
              onPressed: _isFetchingModels ? null : _handleFetchModels,
              icon: _isFetchingModels
                  ? const SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh, size: 14),
              label: const Text('Tải Models', style: TextStyle(fontSize: 11)),
              style: TextButton.styleFrom(
                minimumSize: Size.zero,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        TextField(
          controller: _modelCtrl,
          decoration: InputDecoration(
            hintText: 'vieneu-v3-turbo',
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
        ),
        if (_modelsFeedback != null) ...[
          const SizedBox(height: 4),
          Text(
            _modelsFeedback!,
            style: TextStyle(
              fontSize: 11,
              color: _modelsFeedbackSuccess == true ? Colors.green : Colors.red,
            ),
          ),
        ],
        if (_fetchedModels.isNotEmpty) ...[
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: _fetchedModels.map((m) {
              final isSel =
                  _modelCtrl.text.trim().toLowerCase() == m.id.toLowerCase();
              final modelLabel =
                  (m.name != null && m.name!.isNotEmpty) ? m.name! : m.id;
              return ChoiceChip(
                label: Text(modelLabel, style: const TextStyle(fontSize: 11)),
                selected: isSel,
                onSelected: (selected) {
                  if (selected) setState(() => _modelCtrl.text = m.id);
                },
              );
            }).toList(),
          ),
        ],
        const SizedBox(height: 12),

        // Voice Selection
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Giọng đọc (Voice):',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            TextButton.icon(
              onPressed: _isFetchingVoices ? null : _handleFetchVoices,
              icon: _isFetchingVoices
                  ? const SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh, size: 14),
              label: const Text('Tải Voices từ API',
                  style: TextStyle(fontSize: 11)),
              style: TextButton.styleFrom(
                minimumSize: Size.zero,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        TextField(
          controller: _voiceCtrl,
          decoration: InputDecoration(
            hintText: 'Mai Anh, Hải Đăng, v.v.',
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          style: const TextStyle(fontSize: 13),
          onChanged: (val) {
            setState(() => _selectedVoice = val.trim());
          },
        ),
        if (_voicesFeedback != null) ...[
          const SizedBox(height: 4),
          Text(
            _voicesFeedback!,
            style: TextStyle(
              fontSize: 11,
              color: _voicesFeedbackSuccess == true ? Colors.green : Colors.red,
            ),
          ),
        ],
        const SizedBox(height: 8),

        // Quick Voice Chips Grid
        Container(
          constraints: const BoxConstraints(maxHeight: 130),
          child: SingleChildScrollView(
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: activeVoices.map((voice) {
                final isSelected =
                    _selectedVoice.toLowerCase() == voice.toLowerCase();
                return ChoiceChip(
                  label: Text(
                    voice,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight:
                          isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  selected: isSelected,
                  selectedColor: Colors.indigo.withValues(alpha: 0.2),
                  checkmarkColor: Colors.indigo,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() {
                        _selectedVoice = voice;
                        _voiceCtrl.text = voice;
                      });
                    }
                  },
                );
              }).toList(),
            ),
          ),
        ),
        const SizedBox(height: 14),

        // Sample Rate Selection
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Sample Rate (Tần số lấy mẫu):',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            Text(
              '$_sampleRate Hz',
              style: const TextStyle(
                fontFamily: 'monospace',
                fontWeight: FontWeight.bold,
                color: Colors.indigo,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  backgroundColor: _sampleRate == 48000
                      ? Colors.indigo.withValues(alpha: 0.15)
                      : null,
                  side: BorderSide(
                    color: _sampleRate == 48000 ? Colors.indigo : Colors.grey[400]!,
                    width: _sampleRate == 48000 ? 1.8 : 1.0,
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                onPressed: () => setState(() => _sampleRate = 48000),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '48,000 Hz',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: _sampleRate == 48000 ? Colors.indigo : null,
                      ),
                    ),
                    const Text(
                      'Native VieNeu',
                      style: TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  backgroundColor: _sampleRate == 24000
                      ? Colors.indigo.withValues(alpha: 0.15)
                      : null,
                  side: BorderSide(
                    color: _sampleRate == 24000 ? Colors.indigo : Colors.grey[400]!,
                    width: _sampleRate == 24000 ? 1.8 : 1.0,
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                onPressed: () => setState(() => _sampleRate = 24000),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '24,000 Hz',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: _sampleRate == 24000 ? Colors.indigo : null,
                      ),
                    ),
                    const Text(
                      'OpenAI Standard',
                      style: TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          'VieNeu-TTS server chuẩn phát ở 48,000 Hz. Chọn 48,000 Hz giúp giọng nói đúng tốc độ và giữ nguyên cao độ tự nhiên.',
          style: TextStyle(fontSize: 10.5, color: Colors.grey),
        ),
        const SizedBox(height: 14),

        // Collapsible Advanced Settings
        Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            title: const Text(
              'Cài đặt nâng cao (Sampling & Voice)',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            ),
            tilePadding: EdgeInsets.zero,
            initiallyExpanded: _showAdvanced,
            onExpansionChanged: (val) => setState(() => _showAdvanced = val),
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Temperature:', style: TextStyle(fontSize: 12)),
                  Text(_temperature.toStringAsFixed(2),
                      style: const TextStyle(
                          fontFamily: 'monospace', fontWeight: FontWeight.bold)),
                ],
              ),
              Slider(
                value: _temperature,
                min: 0.1,
                max: 1.5,
                divisions: 14,
                onChanged: (val) => setState(() => _temperature = val),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Top-K:', style: TextStyle(fontSize: 12)),
                  Text('$_topK',
                      style: const TextStyle(
                          fontFamily: 'monospace', fontWeight: FontWeight.bold)),
                ],
              ),
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

        // CORS Proxy (Web only)
        if (kIsWeb) ...[
          const SizedBox(height: 10),
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
                    'Bật khi API server chặn CORS từ trình duyệt',
                    style: TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                  value: _useCorsProxy,
                  activeThumbColor: Colors.amber,
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
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: _testSuccess == true
                  ? Colors.green.withValues(alpha: 0.1)
                  : Colors.red.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: _testSuccess == true ? Colors.green : Colors.red,
              ),
            ),
            child: Text(
              _testMessage!,
              style: TextStyle(
                fontSize: 12,
                color: _testSuccess == true ? Colors.green[800] : Colors.red[800],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPresetChip({
    required String label,
    required String endpoint,
    required String model,
    required String voice,
    required int sampleRate,
    required bool isDark,
  }) {
    final isSelected = _endpointCtrl.text.trim() == endpoint &&
        _modelCtrl.text.trim() == model;
    return ActionChip(
      label: Text(label, style: const TextStyle(fontSize: 11)),
      backgroundColor: isSelected
          ? Colors.indigo.withValues(alpha: 0.2)
          : (isDark ? const Color(0xFF27272A) : const Color(0xFFF4F4F5)),
      side: BorderSide(
        color: isSelected ? Colors.indigo : Colors.grey[400]!,
      ),
      onPressed: () => _applyPreset(
        endpoint: endpoint,
        model: model,
        voice: voice,
        sampleRate: sampleRate,
      ),
    );
  }
}
