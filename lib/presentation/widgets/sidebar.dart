import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../../domain/domain.dart';

class Sidebar extends StatefulWidget {
  final EpubBook? book;
  final int currentChapterIndex;
  final bool isPlaying;
  final bool isParsing;
  final Function(int chapterIndex) onSelectChapter;
  final Function(PlatformFile file) onUploadFile;
  final VoidCallback? onLoadSample;
  final VoidCallback onClose;

  const Sidebar({
    super.key,
    required this.book,
    required this.currentChapterIndex,
    this.isPlaying = false,
    this.isParsing = false,
    required this.onSelectChapter,
    required this.onUploadFile,
    this.onLoadSample,
    required this.onClose,
  });

  @override
  State<Sidebar> createState() => _SidebarState();
}

class _SidebarState extends State<Sidebar> {
  String _searchQuery = '';

  Future<void> _handlePickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['epub'],
      withData: true,
    );

    if (result != null && result.files.isNotEmpty) {
      widget.onUploadFile(result.files.first);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final book = widget.book;

    final filteredChapters = book == null
        ? <EpubChapter>[]
        : book.chapters.where((c) {
            if (_searchQuery.trim().isEmpty) return true;
            return c.title.toLowerCase().contains(_searchQuery.toLowerCase());
          }).toList();

    return Container(
      width: 320,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF18181B) : const Color(0xFFFAFAFA),
        border: Border(
          right: BorderSide(
            color: isDark ? const Color(0xFF27272A) : const Color(0xFFE4E4E7),
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header of Sidebar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: isDark ? const Color(0xFF27272A) : const Color(0xFFE4E4E7),
                ),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Colors.amber, Colors.indigo],
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.menu_book,
                          size: 16, color: Colors.white),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Mục lục sách',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  tooltip: 'Đóng',
                  onPressed: widget.onClose,
                ),
              ],
            ),
          ),

          // Upload or Book Meta Card
          Padding(
            padding: const EdgeInsets.all(12),
            child: book == null
                ? Column(
                    children: [
                      InkWell(
                        onTap: widget.isParsing ? null : _handlePickFile,
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: Colors.indigo.withValues(alpha: 0.3),
                              style: BorderStyle.solid,
                            ),
                            borderRadius: BorderRadius.circular(12),
                            color: Colors.indigo.withValues(alpha: 0.05),
                          ),
                          child: widget.isParsing
                              ? const Column(
                                  children: [
                                    CircularProgressIndicator(strokeWidth: 2),
                                    SizedBox(height: 8),
                                    Text('Đang giải mã EPUB...',
                                        style: TextStyle(fontSize: 12)),
                                  ],
                                )
                              : const Column(
                                  children: [
                                    Icon(Icons.upload_file,
                                        size: 28, color: Colors.indigo),
                                    SizedBox(height: 8),
                                    Text('Tải lên file EPUB',
                                        style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13)),
                                    SizedBox(height: 2),
                                    Text('Nhấp để chọn file từ máy',
                                        style: TextStyle(
                                            fontSize: 11, color: Colors.grey)),
                                  ],
                                ),
                        ),
                      ),
                      if (widget.onLoadSample != null && !widget.isParsing) ...[
                        const SizedBox(height: 8),
                        TextButton.icon(
                          icon: const Icon(Icons.book, size: 14),
                          label: const Text('Thử ngay với sách mẫu Hoàng Tử Bé',
                              style: TextStyle(fontSize: 11)),
                          onPressed: widget.onLoadSample,
                        ),
                      ],
                    ],
                  )
                : Column(
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (book.coverUrl != null &&
                              book.coverUrl!.startsWith('data:'))
                            ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: Image.memory(
                                base64Decode(book.coverUrl!.split(',').last),
                                width: 44,
                                height: 60,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Icon(
                                    Icons.book,
                                    size: 40,
                                    color: Colors.grey),
                              ),
                            )
                          else
                            Container(
                              width: 44,
                              height: 60,
                              decoration: BoxDecoration(
                                color: Colors.grey.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Icon(Icons.book,
                                  size: 24, color: Colors.grey),
                            ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  book.title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  book.author,
                                  style: const TextStyle(
                                      fontSize: 11, color: Colors.grey),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '${book.chapters.length} chương · ${book.totalChunks} đoạn TTS',
                                  style: const TextStyle(
                                      fontSize: 10, color: Colors.grey),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.upload, size: 13),
                        label: const Text('Đổi sách EPUB khác',
                            style: TextStyle(fontSize: 11)),
                        onPressed: _handlePickFile,
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(32),
                        ),
                      ),
                    ],
                  ),
          ),

          // Search chapters
          if (book != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: TextField(
                decoration: InputDecoration(
                  hintText: 'Tìm tên chương...',
                  hintStyle: const TextStyle(fontSize: 12),
                  prefixIcon: const Icon(Icons.search, size: 14),
                  isDense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                style: const TextStyle(fontSize: 12),
                onChanged: (val) => setState(() => _searchQuery = val),
              ),
            ),

          // Chapter List
          Expanded(
            child: book == null
                ? const Center(
                    child: Text('Chưa có sách nào được tải lên',
                        style: TextStyle(fontSize: 12, color: Colors.grey)),
                  )
                : ListView.builder(
                    itemCount: filteredChapters.length,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    itemBuilder: (context, idx) {
                      final chapter = filteredChapters[idx];
                      final isCurrent =
                          chapter.index == widget.currentChapterIndex;

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Material(
                          color: isCurrent
                              ? Colors.indigo.withValues(alpha: 0.12)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          child: ListTile(
                            dense: true,
                            visualDensity: VisualDensity.compact,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 0),
                            leading: Text(
                              '${chapter.index + 1}',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight:
                                    isCurrent ? FontWeight.bold : FontWeight.normal,
                                color: isCurrent ? Colors.indigo : Colors.grey,
                              ),
                            ),
                            title: Text(
                              chapter.title,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight:
                                    isCurrent ? FontWeight.bold : FontWeight.normal,
                                color: isCurrent ? Colors.indigo : null,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '${chapter.chunks.length}p',
                                  style: const TextStyle(
                                      fontSize: 10, color: Colors.grey),
                                ),
                                const SizedBox(width: 6),
                                InkWell(
                                  onTap: () =>
                                      widget.onSelectChapter(chapter.index),
                                  borderRadius: BorderRadius.circular(16),
                                  child: Container(
                                    padding: const EdgeInsets.all(5),
                                    decoration: BoxDecoration(
                                      color: isCurrent && widget.isPlaying
                                          ? Colors.indigo
                                          : Colors.grey.withValues(alpha: 0.15),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      isCurrent && widget.isPlaying
                                          ? Icons.volume_up
                                          : Icons.play_arrow,
                                      size: 14,
                                      color: isCurrent && widget.isPlaying
                                          ? Colors.white
                                          : null,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            onTap: () => widget.onSelectChapter(chapter.index),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
