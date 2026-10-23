import 'package:flutter/material.dart';

class FullPlayerSheet extends StatefulWidget {
  final String currentChapterTitle;
  final int currentChunkIndex;
  final int totalChunks;
  final double currentTime;
  final double duration;
  final double bufferedTime;
  final bool isPlaying;
  final bool isLoading;
  final bool autoNext;
  final double speed;
  final double volume;
  final VoidCallback onTogglePlayPause;
  final VoidCallback onPrevChapter;
  final VoidCallback onNextChapter;
  final Function(double seconds) onSkipRelative;
  final Function(double seconds) onSeek;
  final VoidCallback onToggleAutoNext;
  final Function(double speed) onChangeSpeed;
  final Function(double volume) onChangeVolume;

  const FullPlayerSheet({
    super.key,
    required this.currentChapterTitle,
    required this.currentChunkIndex,
    required this.totalChunks,
    required this.currentTime,
    required this.duration,
    this.bufferedTime = 0.0,
    required this.isPlaying,
    required this.isLoading,
    this.autoNext = true,
    this.speed = 1.0,
    this.volume = 1.0,
    required this.onTogglePlayPause,
    required this.onPrevChapter,
    required this.onNextChapter,
    required this.onSkipRelative,
    required this.onSeek,
    required this.onToggleAutoNext,
    required this.onChangeSpeed,
    required this.onChangeVolume,
  });

  static void show(
    BuildContext context, {
    required String currentChapterTitle,
    required int currentChunkIndex,
    required int totalChunks,
    required double currentTime,
    required double duration,
    double bufferedTime = 0.0,
    required bool isPlaying,
    required bool isLoading,
    bool autoNext = true,
    double speed = 1.0,
    double volume = 1.0,
    required VoidCallback onTogglePlayPause,
    required VoidCallback onPrevChapter,
    required VoidCallback onNextChapter,
    required Function(double seconds) onSkipRelative,
    required Function(double seconds) onSeek,
    required VoidCallback onToggleAutoNext,
    required Function(double speed) onChangeSpeed,
    required Function(double volume) onChangeVolume,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => FullPlayerSheet(
        currentChapterTitle: currentChapterTitle,
        currentChunkIndex: currentChunkIndex,
        totalChunks: totalChunks,
        currentTime: currentTime,
        duration: duration,
        bufferedTime: bufferedTime,
        isPlaying: isPlaying,
        isLoading: isLoading,
        autoNext: autoNext,
        speed: speed,
        volume: volume,
        onTogglePlayPause: onTogglePlayPause,
        onPrevChapter: onPrevChapter,
        onNextChapter: onNextChapter,
        onSkipRelative: onSkipRelative,
        onSeek: onSeek,
        onToggleAutoNext: onToggleAutoNext,
        onChangeSpeed: onChangeSpeed,
        onChangeVolume: onChangeVolume,
      ),
    );
  }

  @override
  State<FullPlayerSheet> createState() => _FullPlayerSheetState();
}

class _FullPlayerSheetState extends State<FullPlayerSheet> {
  late double _dragSeekValue;
  bool _isDragging = false;

  @override
  void initState() {
    super.initState();
    _dragSeekValue = widget.currentTime;
  }

  @override
  void didUpdateWidget(FullPlayerSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_isDragging) {
      _dragSeekValue = widget.currentTime;
    }
  }

  String _formatTime(double seconds) {
    if (seconds <= 0 || seconds.isNaN) return '00:00';
    final totalSec = seconds.toInt();
    final mins = totalSec ~/ 60;
    final secs = totalSec % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  void _cycleSpeed() {
    const speeds = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    int nextIdx = (speeds.indexOf(widget.speed) + 1) % speeds.length;
    if (nextIdx < 0) nextIdx = 1;
    widget.onChangeSpeed(speeds[nextIdx]);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final maxDuration = widget.duration > 0 ? widget.duration : 1.0;
    final currentSliderVal = _isDragging
        ? _dragSeekValue.clamp(0.0, maxDuration)
        : widget.currentTime.clamp(0.0, maxDuration);

    final forwardBuffer = (widget.bufferedTime > widget.currentTime)
        ? (widget.bufferedTime - widget.currentTime)
        : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF18181B) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: const [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle bar
              Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.grey[300],
                  borderRadius: BorderRadius.circular(2.5),
                ),
              ),
              const SizedBox(height: 12),

              // Top title & minimize action
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.keyboard_arrow_down, size: 28),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  Text(
                    'ĐANG PHÁT',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.2,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                  const SizedBox(width: 48), // Balancing width
                ],
              ),
              const SizedBox(height: 16),

              // Center artwork / icon illustration
              Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: isDark
                        ? [const Color(0xFF312E81), const Color(0xFF1E1B4B)]
                        : [const Color(0xFFE0E7FF), const Color(0xFFC7D2FE)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.indigo.withValues(alpha: 0.25),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(
                    Icons.menu_book_rounded,
                    size: 64,
                    color: Colors.indigo,
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Chapter Title & Chunk indicator
              Text(
                widget.currentChapterTitle.isEmpty
                    ? 'Chưa chọn chương'
                    : widget.currentChapterTitle,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                children: [
                  Text(
                    'Đoạn ${widget.currentChunkIndex + 1} / ${widget.totalChunks > 0 ? widget.totalChunks : 1}',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                  if (forwardBuffer > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.indigo.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'Đệm: +${forwardBuffer.toStringAsFixed(1)}s',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.indigo,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),

              // Scrubber slider with timers
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 4.0,
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8.0),
                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 16.0),
                  activeTrackColor: Colors.indigo,
                  inactiveTrackColor: isDark
                      ? const Color(0xFF27272A)
                      : const Color(0xFFE4E4E7),
                  thumbColor: Colors.indigo,
                ),
                child: Slider(
                  min: 0.0,
                  max: maxDuration,
                  value: currentSliderVal,
                  onChangeStart: (val) {
                    setState(() {
                      _isDragging = true;
                      _dragSeekValue = val;
                    });
                  },
                  onChanged: (val) {
                    setState(() {
                      _dragSeekValue = val;
                    });
                  },
                  onChangeEnd: (val) {
                    setState(() {
                      _isDragging = false;
                    });
                    widget.onSeek(val);
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _formatTime(currentSliderVal),
                      style: const TextStyle(
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: Colors.grey,
                      ),
                    ),
                    Text(
                      _formatTime(widget.duration),
                      style: const TextStyle(
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Playback controls row: |<  ↺10  [ PLAY ]  ↻10  >|
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.skip_previous_rounded, size: 30),
                    tooltip: 'Chương trước',
                    onPressed: widget.onPrevChapter,
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.replay_10_rounded, size: 32),
                    tooltip: 'Lùi 10s',
                    onPressed: () => widget.onSkipRelative(-10),
                  ),
                  const SizedBox(width: 14),
                  Container(
                    width: 64,
                    height: 64,
                    decoration: const BoxDecoration(
                      color: Colors.indigo,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.indigoAccent,
                          blurRadius: 12,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: IconButton(
                      icon: widget.isLoading
                          ? const SizedBox(
                              width: 28,
                              height: 28,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : Icon(
                              widget.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                              size: 38,
                              color: Colors.white,
                            ),
                      onPressed: widget.onTogglePlayPause,
                    ),
                  ),
                  const SizedBox(width: 14),
                  IconButton(
                    icon: const Icon(Icons.forward_10_rounded, size: 32),
                    tooltip: 'Tiến 10s',
                    onPressed: () => widget.onSkipRelative(10),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.skip_next_rounded, size: 30),
                    tooltip: 'Chương sau',
                    onPressed: widget.onNextChapter,
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Bottom options row: Speed Chip & Auto-Next Toggle
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: _cycleSpeed,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF27272A) : const Color(0xFFF4F4F5),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: isDark ? const Color(0xFF3F3F46) : const Color(0xFFE4E4E7),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.speed_rounded, size: 16),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                'Tốc độ: ${widget.speed.toStringAsFixed(widget.speed % 1 == 0 ? 0 : 2)}x',
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      onTap: widget.onToggleAutoNext,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        decoration: BoxDecoration(
                          color: widget.autoNext
                              ? Colors.indigo.withValues(alpha: 0.15)
                              : (isDark ? const Color(0xFF27272A) : const Color(0xFFF4F4F5)),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: widget.autoNext
                                ? Colors.indigo
                                : (isDark ? const Color(0xFF3F3F46) : const Color(0xFFE4E4E7)),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.auto_awesome_rounded,
                              size: 16,
                              color: widget.autoNext ? Colors.indigo : Colors.grey,
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                'Tự chuyển đoạn',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: widget.autoNext ? Colors.indigo : null,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
