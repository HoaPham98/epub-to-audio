import 'dart:convert';
import 'dart:typed_data';
import 'package:archive/archive.dart';
import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html_parser;
import 'package:xml/xml.dart';

import '../../domain/domain.dart';
import '../chunker/sentence_boundary_chunker.dart';

class _ExtractedHtmlText {
  final String cleanHtml;
  final String plainText;
  final String? title;

  const _ExtractedHtmlText({
    required this.cleanHtml,
    required this.plainText,
    this.title,
  });
}

class EpubParserAdapter implements IEpubParser {
  final ITextChunkerService chunker;

  const EpubParserAdapter({
    this.chunker = const SentenceBoundaryChunker(),
  });

  @override
  Future<EpubBook> parse(Uint8List bytes, {String? fileName}) async {
    final archive = ZipDecoder().decodeBytes(bytes);

    ArchiveFile? findFile(String path) {
      final cleanPath = path.replaceAll('\\', '/');
      for (final file in archive.files) {
        if (file.name.replaceAll('\\', '/') == cleanPath) {
          return file;
        }
      }
      return null;
    }

    // 1. Locate META-INF/container.xml
    final containerFile = findFile('META-INF/container.xml');
    if (containerFile == null) {
      throw const FormatException(
        'Tệp không hợp lệ: Không tìm thấy META-INF/container.xml trong file EPUB.',
      );
    }

    final containerXmlText = utf8.decode(containerFile.content as List<int>);
    final containerDoc = XmlDocument.parse(containerXmlText);
    final rootfileEl = containerDoc.findAllElements('rootfile').firstOrNull;
    final opfPath = rootfileEl?.getAttribute('full-path');

    if (opfPath == null || opfPath.isEmpty) {
      throw const FormatException(
        'Tệp không hợp lệ: Không tìm thấy đường dẫn file OPF.',
      );
    }

    // 2. Read OPF file
    final opfFile = findFile(opfPath);
    if (opfFile == null) {
      throw FormatException(
        'Không tìm thấy file OPF tại đường dẫn: $opfPath',
      );
    }

    final opfXmlText = utf8.decode(opfFile.content as List<int>);
    final opfDoc = XmlDocument.parse(opfXmlText);

    final displayName = fileName ?? 'ebook.epub';
    final titleEl = opfDoc.findAllElements('dc:title').firstOrNull ??
        opfDoc.findAllElements('title').firstOrNull;
    final authorEl = opfDoc.findAllElements('dc:creator').firstOrNull ??
        opfDoc.findAllElements('creator').firstOrNull;

    final title = (titleEl != null && titleEl.innerText.trim().isNotEmpty)
        ? titleEl.innerText.trim()
        : displayName.replaceAll(RegExp(r'\.epub$', caseSensitive: false), '');
    final author = (authorEl != null && authorEl.innerText.trim().isNotEmpty)
        ? authorEl.innerText.trim()
        : 'Tác giả không xác định';

    // 3. Extract manifest items
    final Map<String, ({String href, String mediaType, String properties})>
        manifestItems = {};

    for (final item in opfDoc.findAllElements('item')) {
      final id = item.getAttribute('id');
      final href = item.getAttribute('href');
      final mediaType = item.getAttribute('media-type') ?? '';
      final properties = item.getAttribute('properties') ?? '';
      if (id != null && href != null) {
        manifestItems[id] = (
          href: href,
          mediaType: mediaType,
          properties: properties,
        );
      }
    }

    // 4. Extract cover image (as base64 data URI)
    String? coverUrl;
    String? coverHref;
    for (final item in manifestItems.values) {
      if (item.properties.contains('cover-image') ||
          (item.mediaType.startsWith('image/') &&
              item.href.toLowerCase().contains('cover'))) {
        coverHref = item.href;
        break;
      }
    }

    if (coverHref != null) {
      final resolvedCoverPath = _resolvePath(opfPath, coverHref);
      final coverFile = findFile(resolvedCoverPath);
      if (coverFile != null) {
        final coverBytes = coverFile.content as List<int>;
        final mediaType = manifestItems.values
                .firstWhere(
                  (m) => m.href == coverHref,
                  orElse: () => (
                    href: coverHref!,
                    mediaType: 'image/jpeg',
                    properties: '',
                  ),
                )
                .mediaType;
        coverUrl = 'data:$mediaType;base64,${base64Encode(coverBytes)}';
      }
    }

    // 5. Build TOC Title Map from NCX or NAV
    final Map<String, String> tocTitleMap = {};

    // Try NCX
    final ncxItem = manifestItems.values
        .where((i) => i.mediaType == 'application/x-dtbncx+xml')
        .firstOrNull;
    if (ncxItem != null) {
      final ncxPath = _resolvePath(opfPath, ncxItem.href);
      final ncxFile = findFile(ncxPath);
      if (ncxFile != null) {
        final ncxText = utf8.decode(ncxFile.content as List<int>);
        final ncxDoc = XmlDocument.parse(ncxText);
        for (final np in ncxDoc.findAllElements('navPoint')) {
          final label = np.findAllElements('text').firstOrNull?.innerText.trim();
          final src = np.findAllElements('content').firstOrNull?.getAttribute('src');
          if (label != null && src != null) {
            final cleanSrc = src.split('#').first;
            tocTitleMap[cleanSrc] = label;
          }
        }
      }
    }

    // Try EPUB3 NAV
    final navItem = manifestItems.values
        .where((i) => i.properties.contains('nav'))
        .firstOrNull;
    if (navItem != null) {
      final navPath = _resolvePath(opfPath, navItem.href);
      final navFile = findFile(navPath);
      if (navFile != null) {
        final navText = utf8.decode(navFile.content as List<int>);
        final navDoc = html_parser.parse(navText);
        for (final a in navDoc.querySelectorAll('nav a')) {
          final text = a.text.trim();
          final href = a.attributes['href'];
          if (text.isNotEmpty && href != null) {
            final cleanHref = href.split('#').first;
            tocTitleMap[cleanHref] = text;
          }
        }
      }
    }

    // 6. Extract chapters from spine itemrefs
    final chapters = <EpubChapter>[];
    int totalChunks = 0;
    int chapterIndex = 0;

    for (final itemref in opfDoc.findAllElements('itemref')) {
      final idref = itemref.getAttribute('idref');
      if (idref == null || !manifestItems.containsKey(idref)) continue;

      final manifestEntry = manifestItems[idref]!;
      final resolvedChapterPath = _resolvePath(opfPath, manifestEntry.href);
      final chapterFile = findFile(resolvedChapterPath);
      if (chapterFile == null) continue;

      final htmlContent = utf8.decode(chapterFile.content as List<int>);
      final extracted = _extractCleanText(htmlContent);

      if (extracted.plainText.length < 5) continue;

      final filenameOnly = manifestEntry.href.split('/').last;
      final mappedTitle =
          tocTitleMap[manifestEntry.href] ?? tocTitleMap[filenameOnly];
      final chapterTitle =
          mappedTitle ?? extracted.title ?? 'Chương ${chapterIndex + 1}';

      final chunks = chunker.chunkText(chapterIndex, extracted.plainText);
      totalChunks += chunks.length;

      chapters.add(EpubChapter(
        id: idref,
        index: chapterIndex,
        title: chapterTitle,
        href: manifestEntry.href,
        contentHtml: extracted.cleanHtml,
        rawText: extracted.plainText,
        chunks: chunks,
      ));

      chapterIndex++;
    }

    if (chapters.isEmpty) {
      throw const FormatException(
        'Không thể trích xuất nội dung văn bản từ file EPUB này.',
      );
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    final randomSuffix = (now % 100000).toString().padLeft(5, '0');

    return EpubBook(
      id: 'book-$now-$randomSuffix',
      title: title,
      author: author,
      coverUrl: coverUrl,
      chapters: chapters,
      totalChunks: totalChunks,
      fileName: displayName,
      fileSize: bytes.length,
      uploadedAt: now,
    );
  }

  _ExtractedHtmlText _extractCleanText(String htmlContent) {
    final doc = html_parser.parse(htmlContent);

    for (final el in doc.querySelectorAll(
      'script, style, svg, noscript, nav[epub\\:type="toc"]',
    )) {
      el.remove();
    }

    String? detectedTitle;
    final titleEl = doc.querySelector('title, h1, h2, h3');
    if (titleEl != null && titleEl.text.trim().isNotEmpty) {
      detectedTitle = titleEl.text.trim();
    }

    const blockTags = [
      'p',
      'div',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'li',
      'blockquote',
      'tr',
      'section',
      'article',
    ];

    for (final tag in blockTags) {
      for (final el in doc.querySelectorAll(tag)) {
        el.append(dom.Text('\n\n'));
      }
    }

    for (final br in doc.querySelectorAll('br')) {
      br.append(dom.Text('\n'));
    }

    final bodyText = doc.body?.text ?? '';
    final plainText = bodyText
        .replaceAll(RegExp(r'[ \t]+'), ' ')
        .replaceAll(RegExp(r'\n\s*\n\s*\n+'), '\n\n')
        .trim();

    return _ExtractedHtmlText(
      cleanHtml: doc.body?.innerHtml ?? '',
      plainText: plainText,
      title: detectedTitle,
    );
  }

  String _resolvePath(String basePath, String relativePath) {
    final baseDir = basePath.contains('/')
        ? basePath.substring(0, basePath.lastIndexOf('/') + 1)
        : '';
    final full = baseDir + relativePath;
    final parts = full.split('/');
    final List<String> resolved = [];
    for (final part in parts) {
      if (part.isEmpty || part == '.') continue;
      if (part == '..') {
        if (resolved.isNotEmpty) resolved.removeLast();
      } else {
        resolved.add(part);
      }
    }
    return resolved.join('/');
  }
}
