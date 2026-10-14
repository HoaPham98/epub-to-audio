import JSZip from 'jszip';
import { EpubBook, EpubChapter } from '@/types';
import { chunkChapterText } from './chunker';

/**
 * Extracts plain text from an HTML/XHTML string, preserving structure and newlines.
 */
function extractCleanText(htmlContent: string): { cleanHtml: string; plainText: string; title?: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // Remove script, style, svg, nav elements that shouldn't be read out loud
  const unwanted = doc.querySelectorAll('script, style, svg, noscript, nav[epub\\:type="toc"]');
  unwanted.forEach(el => el.remove());

  let detectedTitle = '';
  const titleEl = doc.querySelector('title, h1, h2, h3');
  if (titleEl && titleEl.textContent) {
    detectedTitle = titleEl.textContent.trim();
  }

  // Convert block elements to have newlines
  const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'tr', 'section', 'article'];
  blockTags.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => {
      el.after('\n\n');
    });
  });
  doc.querySelectorAll('br').forEach(el => el.after('\n'));

  const plainText = (doc.body?.textContent || '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  return {
    cleanHtml: doc.body?.innerHTML || '',
    plainText,
    title: detectedTitle,
  };
}

/**
 * Resolves a relative path given a base directory path.
 */
function resolvePath(basePath: string, relativePath: string): string {
  const baseDir = basePath.includes('/') ? basePath.substring(0, basePath.lastIndexOf('/') + 1) : '';
  const full = baseDir + relativePath;
  const parts = full.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

export async function parseEpubFile(file: File): Promise<EpubBook> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Read META-INF/container.xml
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Tệp không hợp lệ: Không tìm thấy META-INF/container.xml trong file EPUB.');
  }

  const containerXmlText = await containerFile.async('text');
  const domParser = new DOMParser();
  const containerDoc = domParser.parseFromString(containerXmlText, 'application/xml');
  const rootfileEl = containerDoc.querySelector('rootfile');
  const opfPath = rootfileEl?.getAttribute('full-path');

  if (!opfPath) {
    throw new Error('Tệp không hợp lệ: Không tìm thấy đường dẫn file OPF.');
  }

  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`Không tìm thấy file OPF tại đường dẫn: ${opfPath}`);
  }

  const opfXmlText = await opfFile.async('text');
  const opfDoc = domParser.parseFromString(opfXmlText, 'application/xml');

  // Metadata
  const title = opfDoc.querySelector('title')?.textContent?.trim() || file.name.replace(/\.epub$/i, '');
  const author = opfDoc.querySelector('creator')?.textContent?.trim() || 'Tác giả không xác định';

  // Manifest items
  const manifestItems: Record<string, { href: string; mediaType: string; properties?: string }> = {};
  opfDoc.querySelectorAll('manifest > item').forEach(item => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type') || '';
    const properties = item.getAttribute('properties') || '';
    if (id && href) {
      manifestItems[id] = { href, mediaType, properties };
    }
  });

  // Cover image extraction
  let coverUrl: string | undefined = undefined;
  const coverItem = Object.values(manifestItems).find(
    i => i.properties?.includes('cover-image') || i.mediaType.startsWith('image/') && i.href.toLowerCase().includes('cover')
  );
  if (coverItem) {
    const resolvedCoverPath = resolvePath(opfPath, coverItem.href);
    const coverZipFile = zip.file(resolvedCoverPath);
    if (coverZipFile) {
      const coverBlob = await coverZipFile.async('blob');
      coverUrl = URL.createObjectURL(coverBlob);
    }
  }

  // ToC Mapping
  const tocTitleMap: Record<string, string> = {};

  // Try EPUB 2 NCX
  const ncxItem = Object.values(manifestItems).find(i => i.mediaType === 'application/x-dtbncx+xml');
  if (ncxItem) {
    const ncxPath = resolvePath(opfPath, ncxItem.href);
    const ncxZip = zip.file(ncxPath);
    if (ncxZip) {
      const ncxText = await ncxZip.async('text');
      const ncxDoc = domParser.parseFromString(ncxText, 'application/xml');
      ncxDoc.querySelectorAll('navPoint').forEach(np => {
        const text = np.querySelector('navLabel > text')?.textContent?.trim();
        const src = np.querySelector('content')?.getAttribute('src');
        if (text && src) {
          const cleanSrc = src.split('#')[0];
          tocTitleMap[cleanSrc] = text;
        }
      });
    }
  }

  // Try EPUB 3 Nav
  const navItem = Object.values(manifestItems).find(i => i.properties?.includes('nav'));
  if (navItem) {
    const navPath = resolvePath(opfPath, navItem.href);
    const navZip = zip.file(navPath);
    if (navZip) {
      const navText = await navZip.async('text');
      const navDoc = domParser.parseFromString(navText, 'text/html');
      navDoc.querySelectorAll('nav[epub\\:type="toc"] a, nav a').forEach(a => {
        const text = a.textContent?.trim();
        const href = a.getAttribute('href');
        if (text && href) {
          const cleanHref = href.split('#')[0];
          tocTitleMap[cleanHref] = text;
        }
      });
    }
  }

  // Spine items in reading order
  const spineItemRefs = Array.from(opfDoc.querySelectorAll('spine > itemref'));
  const chapters: EpubChapter[] = [];
  let totalChunks = 0;
  let chapterIndex = 0;

  for (const itemref of spineItemRefs) {
    const idref = itemref.getAttribute('idref');
    if (!idref || !manifestItems[idref]) continue;

    const manifestEntry = manifestItems[idref];
    const resolvedChapterPath = resolvePath(opfPath, manifestEntry.href);
    const chapterZipFile = zip.file(resolvedChapterPath);
    if (!chapterZipFile) continue;

    const htmlContent = await chapterZipFile.async('text');
    const { cleanHtml, plainText, title: extractedTitle } = extractCleanText(htmlContent);

    // Skip empty filler chapters with almost no readable text
    if (!plainText || plainText.length < 5) continue;

    // Determine best title
    const filenameOnly = manifestEntry.href.split('/').pop() || '';
    const mappedTitle = tocTitleMap[manifestEntry.href] || tocTitleMap[filenameOnly];
    const chapterTitle = mappedTitle || extractedTitle || `Chương ${chapterIndex + 1}`;

    const chunks = chunkChapterText(chapterIndex, plainText);
    totalChunks += chunks.length;

    chapters.push({
      id: idref,
      index: chapterIndex,
      title: chapterTitle,
      href: manifestEntry.href,
      contentHtml: cleanHtml,
      rawText: plainText,
      chunks,
    });

    chapterIndex++;
  }

  if (chapters.length === 0) {
    throw new Error('Không thể trích xuất nội dung văn bản từ file EPUB này.');
  }

  return {
    id: `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    author,
    coverUrl,
    chapters,
    totalChunks,
    fileName: file.name,
    fileSize: file.size,
    uploadedAt: Date.now(),
  };
}
