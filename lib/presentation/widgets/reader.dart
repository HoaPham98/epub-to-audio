import 'package:flutter/material.dart';
import '../../domain/domain.dart';

class Reader extends StatefulWidget {
  final EpubBook? book;
  final int currentChapterIndex;
  final int currentChunkIndex;
  final Map<int, ChunkStatus> chunkStatuses;
  final bool isPlaying;
  final bool isLoading;
  final ({int chapterIndex, int chunkIndex})? bufferingChunk;
  final Function(int chapterIndex, int chunkIndex) onPlayChunk;

  const Reader({
    super.key,
    required this.book,
    required this.currentChapterIndex,
    required this.currentChunkIndex,
    required this.chunkStatuses,
    this.isPlaying = false,
    this.isLoading = false,
    this.bufferingChunk,
    required this.onPlayChunk,
  });

  @override
  State<Reader> createState() => _ReaderState();
}

class _ReaderState extends State<Reader> {
  double _fontSize = 16.0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final book = widget.book;

    if (book == null || book.chapters.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.menu_book, size: 48, color: Colors.grey),
            SizedBox(height: 12),
            Text(
              'Chưa có sách nào được chọn',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            SizedBox(height: 4),
            Text(
              'Vui lòng tải lên file EPUB hoặc mở sách mẫu từ thanh bên.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    final chapter = (widget.currentChapterIndex < book.chapters.length)
        ? book.chapters[widget.currentChapterIndex]
        : null;

    if (chapter == null || chapter.chunks.isEmpty) {
      return const Center(
        child: Text('Chương này không có nội dung chữ để hiển thị.'),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Chapter Header & Font adjusters
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'CHƯƠNG ${widget.currentChapterIndex + 1} / ${book.chapters.length}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.2,
                            color: Colors.indigo,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          chapter.title,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: isDark
                            ? const Color(0xFF27272A)
                            : const Color(0xFFE4E4E7),
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove, size: 14),
                          tooltip: 'Giảm cỡ chữ',
                          onPressed: () {
                            setState(() {
                              _fontSize = (_fontSize - 1).clamp(12.0, 28.0);
                            });
                          },
                        ),
                        Text(
                          '${_fontSize.toInt()}px',
                          style: const TextStyle(
                            fontSize: 11,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add, size: 14),
                          tooltip: 'Tăng cỡ chữ',
                          onPressed: () {
                            setState(() {
                              _fontSize = (_fontSize + 1).clamp(12.0, 28.0);
                            });
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(height: 1),
              const SizedBox(height: 20),

              // Chunks list
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: chapter.chunks.length,
                itemBuilder: (context, idx) {
                  final chunk = chapter.chunks[idx];
                  final isCurrent = chunk.index == widget.currentChunkIndex;
                  final status =
                      widget.chunkStatuses[chunk.index] ?? ChunkStatus.idle;

                  final isBuffering = widget.bufferingChunk?.chapterIndex ==
                          widget.currentChapterIndex &&
                      widget.bufferingChunk?.chunkIndex == chunk.index;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isCurrent
                          ? Colors.indigo.withValues(alpha: isDark ? 0.2 : 0.08)
                          : isDark
                              ? const Color(0xFF18181B)
                              : Colors.white,
                      border: Border.all(
                        color: isCurrent
                            ? Colors.indigo
                            : isDark
                                ? const Color(0xFF27272A)
                                : const Color(0xFFE4E4E7),
                        width: isCurrent ? 1.5 : 1.0,
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Meta bar
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: Text(
                                'Đoạn ${chunk.index + 1} (${chunk.charCount} ký tự)',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Colors.grey,
                                  fontFamily: 'monospace',
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Badges
                                if (isBuffering && !isCurrent) ...[
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.amber.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(
                                          color: Colors.amber.withValues(alpha: 0.5)),
                                    ),
                                    child: const Text(
                                      'Đang nạp sẵn...',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.amber,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                ] else if (status == ChunkStatus.ready &&
                                    !isCurrent) ...[
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.green.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(
                                          color: Colors.green.withValues(alpha: 0.5)),
                                    ),
                                    child: const Text(
                                      '✓ Đã nạp sẵn',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.green,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                ],

                                // Contextual Action Button
                                _buildChunkButton(
                                  chunkIndex: chunk.index,
                                  isCurrent: isCurrent,
                                  status: status,
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),

                        // Chunk text
                        SelectableText(
                          chunk.text,
                          style: TextStyle(
                            fontSize: _fontSize,
                            height: 1.6,
                            color: isDark
                                ? const Color(0xFFF4F4F5)
                                : const Color(0xFF27272A),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChunkButton({
    required int chunkIndex,
    required bool isCurrent,
    required ChunkStatus status,
  }) {
    if (isCurrent && widget.isPlaying) {
      return FilledButton.icon(
        icon: const Icon(Icons.pause, size: 12),
        label: const Text('Tạm dừng', style: TextStyle(fontSize: 11)),
        onPressed: () =>
            widget.onPlayChunk(widget.currentChapterIndex, chunkIndex),
        style: FilledButton.styleFrom(
          backgroundColor: Colors.indigo,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          minimumSize: Size.zero,
        ),
      );
    } else if (isCurrent && widget.isLoading) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.amber.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 6),
            Text('Đang kết nối...',
                style: TextStyle(fontSize: 11, color: Colors.amber)),
          ],
        ),
      );
    } else if (isCurrent && !widget.isPlaying) {
      return OutlinedButton.icon(
        icon: const Icon(Icons.play_arrow, size: 12),
        label: const Text('Tiếp tục', style: TextStyle(fontSize: 11)),
        onPressed: () =>
            widget.onPlayChunk(widget.currentChapterIndex, chunkIndex),
        style: OutlinedButton.styleFrom(
          foregroundColor: Colors.indigo,
          side: const BorderSide(color: Colors.indigo, width: 1.5),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          minimumSize: Size.zero,
        ),
      );
    } else if (status == ChunkStatus.ready) {
      return FilledButton.tonalIcon(
        icon: const Icon(Icons.play_arrow, size: 12),
        label: const Text('Phát ngay', style: TextStyle(fontSize: 11)),
        onPressed: () =>
            widget.onPlayChunk(widget.currentChapterIndex, chunkIndex),
        style: FilledButton.styleFrom(
          backgroundColor: Colors.green.withValues(alpha: 0.15),
          foregroundColor: Colors.green[800],
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          minimumSize: Size.zero,
        ),
      );
    } else {
      return TextButton.icon(
        icon: const Icon(Icons.play_arrow, size: 12),
        label: const Text('Nghe đoạn này', style: TextStyle(fontSize: 11)),
        onPressed: () =>
            widget.onPlayChunk(widget.currentChapterIndex, chunkIndex),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          minimumSize: Size.zero,
        ),
      );
    }
  }
}
