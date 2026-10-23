import 'package:flutter/material.dart';
import '../../domain/domain.dart';

class Header extends StatelessWidget implements PreferredSizeWidget {
  final EpubBook? book;
  final VoidCallback onOpenSettings;
  final VoidCallback onOpenCache;
  final VoidCallback onToggleSidebar;
  final bool isSidebarOpen;
  final int cacheCount;

  const Header({
    super.key,
    required this.book,
    required this.onOpenSettings,
    required this.onOpenCache,
    required this.onToggleSidebar,
    this.isSidebarOpen = false,
    this.cacheCount = 0,
  });

  @override
  Size get preferredSize => const Size.fromHeight(60.0);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = screenWidth < 768;

    return Container(
      height: preferredSize.height,
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFF09090B).withValues(alpha: 0.9)
            : Colors.white.withValues(alpha: 0.9),
        border: Border(
          bottom: BorderSide(
            color: isDark ? const Color(0xFF27272A) : const Color(0xFFE4E4E7),
            width: 1.0,
          ),
        ),
      ),
      padding: EdgeInsets.symmetric(horizontal: isMobile ? 8.0 : 16.0),
      child: Row(
        children: [
          // Left: Menu / Toggle Sidebar
          IconButton(
            icon: const Icon(Icons.menu, size: 20),
            tooltip: isSidebarOpen ? 'Thu gọn thanh bên' : 'Mở danh mục',
            onPressed: onToggleSidebar,
            style: IconButton.styleFrom(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(
                  color: isDark ? const Color(0xFF27272A) : const Color(0xFFE4E4E7),
                ),
              ),
            ),
          ),
          SizedBox(width: isMobile ? 8 : 12),

          // Branding & Active Book breadcrumb
          if (!isMobile && !isSidebarOpen) ...[
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Colors.amber, Colors.indigo],
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.menu_book, size: 16, color: Colors.white),
            ),
            const SizedBox(width: 8),
            const Text(
              'EPUB to Audio',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(width: 12),
          ],

          if (book != null) ...[
            if (!isMobile) ...[
              Container(
                height: 16,
                width: 1,
                color: isDark ? Colors.grey[700] : Colors.grey[300],
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: isMobile
                  ? Text(
                      book!.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                      overflow: TextOverflow.ellipsis,
                    )
                  : Row(
                      children: [
                        Flexible(
                          child: Text(
                            book!.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const Text('  /  ', style: TextStyle(color: Colors.grey)),
                        Flexible(
                          child: Text(
                            book!.author,
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
            ),
          ] else
            Expanded(
              child: isMobile
                  ? const Text(
                      'EPUB to Audio',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    )
                  : const Spacer(),
            ),

          // Right: Actions
          if (isMobile) ...[
            IconButton(
              icon: Badge.count(
                count: cacheCount,
                isLabelVisible: cacheCount > 0,
                backgroundColor: Colors.indigo,
                child: const Icon(Icons.folder_outlined, size: 20),
              ),
              tooltip: 'Bộ nhớ đệm',
              onPressed: onOpenCache,
            ),
            IconButton(
              icon: const Icon(Icons.settings_outlined, size: 20),
              tooltip: 'Cài đặt',
              onPressed: onOpenSettings,
            ),
          ] else ...[
            OutlinedButton.icon(
              icon: const Icon(Icons.storage, size: 15),
              label: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Bộ nhớ đệm', style: TextStyle(fontSize: 12)),
                  if (cacheCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.indigo.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$cacheCount',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.indigo,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              onPressed: onOpenCache,
              style: OutlinedButton.styleFrom(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton.icon(
              icon: const Icon(Icons.settings, size: 15),
              label: const Text('Cài đặt', style: TextStyle(fontSize: 12)),
              onPressed: onOpenSettings,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.indigo,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
