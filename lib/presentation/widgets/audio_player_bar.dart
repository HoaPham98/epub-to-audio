import 'package:flutter/material.dart';
import 'full_player_sheet.dart';

class AudioPlayerBar extends StatelessWidget {
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
  final String voice;
  final VoidCallback? onOpenSettings;

  const AudioPlayerBar({
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
    this.voice = '',
    this.onOpenSettings,
    required this.onTogglePlayPause,
    required this.onPrevChapter,
    required this.onNextChapter,
    required this.onSkipRelative,
    required this.onSeek,
    required this.onToggleAutoNext,
    required this.onChangeSpeed,
    required this.onChangeVolume,
  });

  String _formatTime(double seconds) {
    if (seconds <= 0 || seconds.isNaN) return '00:00';
    final totalSec = seconds.toInt();
    final mins = totalSec ~/ 60;
    final secs = totalSec % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  void _cycleSpeed() {
    const speeds = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    int nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    if (nextIdx < 0) nextIdx = 1;
    onChangeSpeed(speeds[nextIdx]);
  }

  void _openFullPlayer(BuildContext context) {
    FullPlayerSheet.show(
      context,
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
      voice: voice,
      onOpenSettings: onOpenSettings,
      onTogglePlayPause: onTogglePlayPause,
      onPrevChapter: onPrevChapter,
      onNextChapter: onNextChapter,
      onSkipRelative: onSkipRelative,
      onSeek: onSeek,
      onToggleAutoNext: onToggleAutoNext,
      onChangeSpeed: onChangeSpeed,
      onChangeVolume: onChangeVolume,
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 768;

    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final maxDuration = duration > 0 ? duration : 1.0;
    final clampedCurrent = currentTime.clamp(0.0, maxDuration);

    if (isMobile) {
      return _buildMiniPlayer(context, isDark, clampedCurrent, maxDuration);
    }

    return _buildDesktopPlayer(context, isDark, clampedCurrent, maxDuration);
  }

  Widget _buildMiniPlayer(
    BuildContext context,
    bool isDark,
    double clampedCurrent,
    double maxDuration,
  ) {
    final progress = maxDuration > 0 ? (clampedCurrent / maxDuration).clamp(0.0, 1.0) : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF18181B) : Colors.white,
        border: Border(
          top: BorderSide(
            color: isDark ? const Color(0xFF27272A) : const Color(0xFFE4E4E7),
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top thin progress bar
            LinearProgressIndicator(
              value: progress,
              minHeight: 2.5,
              backgroundColor: isDark ? const Color(0xFF27272A) : const Color(0xFFE4E4E7),
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.indigo),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Row(
                children: [
                  // Tappable chapter / chunk info
                  Expanded(
                    child: InkWell(
                      onTap: () => _openFullPlayer(context),
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    currentChapterTitle.isEmpty
                                        ? 'Chưa chọn chương'
                                        : currentChapterTitle,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(
                                  Icons.expand_less_rounded,
                                  size: 16,
                                  color: Colors.grey,
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Đoạn ${currentChunkIndex + 1}/${totalChunks > 0 ? totalChunks : 1}${voice.isNotEmpty ? " • $voice" : ""} • ${_formatTime(currentTime)} / ${_formatTime(duration)}',
                              style: const TextStyle(fontSize: 11, color: Colors.grey),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Touch Controls: -10s, Play/Pause, +10s, Speed
                  IconButton(
                    icon: const Icon(Icons.replay_10_rounded, size: 22),
                    padding: const EdgeInsets.all(6),
                    constraints: const BoxConstraints(),
                    tooltip: 'Lùi 10s',
                    onPressed: () => onSkipRelative(-10),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    width: 38,
                    height: 38,
                    decoration: const BoxDecoration(
                      color: Colors.indigo,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: isLoading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Icon(
                              isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                              size: 22,
                              color: Colors.white,
                            ),
                      tooltip: isPlaying ? 'Tạm dừng' : 'Phát',
                      onPressed: onTogglePlayPause,
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton(
                    icon: const Icon(Icons.forward_10_rounded, size: 22),
                    padding: const EdgeInsets.all(6),
                    constraints: const BoxConstraints(),
                    tooltip: 'Tua 10s',
                    onPressed: () => onSkipRelative(10),
                  ),
                  const SizedBox(width: 6),
                  InkWell(
                    onTap: _cycleSpeed,
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF27272A) : const Color(0xFFF4F4F5),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: isDark ? const Color(0xFF3F3F46) : const Color(0xFFE4E4E7),
                        ),
                      ),
                      child: Text(
                        '${speed.toStringAsFixed(speed % 1 == 0 ? 0 : 2)}x',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDesktopPlayer(
    BuildContext context,
    bool isDark,
    double clampedCurrent,
    double maxDuration,
  ) {
    final forwardBuffer =
        (bufferedTime > currentTime) ? (bufferedTime - currentTime) : 0.0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF18181B) : Colors.white,
        border: Border(
          top: BorderSide(
            color: isDark ? const Color(0xFF27272A) : const Color(0xFFE4E4E7),
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // Left: Chapter Info & Forward Buffer Badge
              Expanded(
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      currentChapterTitle.isEmpty
                          ? 'Chưa chọn chương'
                          : currentChapterTitle,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 6,
                      children: [
                        Text(
                          'Đoạn ${currentChunkIndex + 1} / ${totalChunks > 0 ? totalChunks : 1}',
                          style: const TextStyle(
                              fontSize: 11, color: Colors.grey),
                        ),
                        if (voice.isNotEmpty)
                          InkWell(
                            onTap: onOpenSettings,
                            borderRadius: BorderRadius.circular(4),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.indigo.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.record_voice_over,
                                      size: 11, color: Colors.indigo),
                                  const SizedBox(width: 4),
                                  Text(
                                    voice,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.indigo,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        if (forwardBuffer > 0)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.indigo.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              'Đệm trước: +${forwardBuffer.toStringAsFixed(1)}s',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.indigo,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),

              // Center: Control buttons
              _buildDesktopControls(),

              // Right: AutoNext, Speed, Volume
              Expanded(
                flex: 3,
                child: Align(
                  alignment: Alignment.centerRight,
                  child: _buildOptionsRow(isDark),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),

          // Scrubber slider with timers
          Row(
            children: [
              Text(
                _formatTime(currentTime),
                style: const TextStyle(
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: Colors.grey,
                ),
              ),
              Expanded(
                child: SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 3.0,
                    thumbShape:
                        const RoundSliderThumbShape(enabledThumbRadius: 6.0),
                    overlayShape:
                        const RoundSliderOverlayShape(overlayRadius: 12.0),
                    activeTrackColor: Colors.indigo,
                    inactiveTrackColor: isDark
                        ? const Color(0xFF27272A)
                        : const Color(0xFFE4E4E7),
                    thumbColor: Colors.indigo,
                  ),
                  child: Slider(
                    min: 0.0,
                    max: maxDuration,
                    value: clampedCurrent,
                    onChanged: (val) => onSeek(val),
                  ),
                ),
              ),
              Text(
                _formatTime(duration),
                style: const TextStyle(
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDesktopControls() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        IconButton(
          icon: const Icon(Icons.skip_previous, size: 20),
          tooltip: 'Chương trước',
          onPressed: onPrevChapter,
        ),
        IconButton(
          icon: const Icon(Icons.replay_10, size: 20),
          tooltip: 'Lùi 10s',
          onPressed: () => onSkipRelative(-10),
        ),
        const SizedBox(width: 4),
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: Colors.indigo,
            shape: BoxShape.circle,
          ),
          child: IconButton(
            icon: isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Icon(
                    isPlaying ? Icons.pause : Icons.play_arrow,
                    size: 20,
                    color: Colors.white,
                  ),
            tooltip: isPlaying ? 'Tạm dừng' : 'Phát',
            onPressed: onTogglePlayPause,
          ),
        ),
        const SizedBox(width: 4),
        IconButton(
          icon: const Icon(Icons.forward_10, size: 20),
          tooltip: 'Tua 10s',
          onPressed: () => onSkipRelative(10),
        ),
        IconButton(
          icon: const Icon(Icons.skip_next, size: 20),
          tooltip: 'Chương sau',
          onPressed: onNextChapter,
        ),
      ],
    );
  }

  Widget _buildOptionsRow(bool isDark, {bool compact = false}) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          OutlinedButton.icon(
            icon: Icon(
              Icons.auto_awesome,
              size: 13,
              color: autoNext ? Colors.indigo : Colors.grey,
            ),
            label: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Auto Next', style: TextStyle(fontSize: 11)),
                const SizedBox(width: 4),
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: autoNext ? Colors.indigo : Colors.grey,
                  ),
                ),
              ],
            ),
            onPressed: onToggleAutoNext,
            style: OutlinedButton.styleFrom(
              side: BorderSide(
                color: autoNext
                    ? Colors.indigo.withValues(alpha: 0.6)
                    : Colors.grey.withValues(alpha: 0.3),
              ),
              backgroundColor: autoNext
                  ? Colors.indigo.withValues(alpha: 0.08)
                  : Colors.transparent,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
            ),
          ),
          const SizedBox(width: 6),
          PopupMenuButton<double>(
            initialValue: speed,
            tooltip: 'Tốc độ đọc',
            onSelected: onChangeSpeed,
            itemBuilder: (context) => [0.75, 1.0, 1.25, 1.5, 1.75, 2.0]
                .map((s) => PopupMenuItem(
                      value: s,
                      child: Text(
                        '${s}x',
                        style: TextStyle(
                          fontWeight:
                              s == speed ? FontWeight.bold : FontWeight.normal,
                          color: s == speed ? Colors.indigo : null,
                        ),
                      ),
                    ))
                .toList(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                border: Border.all(
                  color: isDark
                      ? const Color(0xFF27272A)
                      : const Color(0xFFE4E4E7),
                ),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.speed, size: 13, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text('${speed}x', style: const TextStyle(fontSize: 11)),
                ],
              ),
            ),
          ),
          if (!compact) ...[
            const SizedBox(width: 6),
            IconButton(
              icon: Icon(
                volume == 0 ? Icons.volume_off : Icons.volume_up,
                size: 18,
                color: volume == 0 ? Colors.red : null,
              ),
              tooltip: volume == 0 ? 'Bật âm thanh' : 'Tắt tiếng',
              onPressed: () {
                onChangeVolume(volume == 0 ? 1.0 : 0.0);
              },
            ),
          ],
        ],
      ),
    );
  }
}
