import { TextChunk } from '@/types';

const MAX_CHUNK_LENGTH = 3500; // Safe threshold well below OpenAI's 4096 limit

/**
 * Splits raw text of a chapter into chunks suitable for OpenAI TTS API.
 * Preserves paragraph and sentence boundaries wherever possible.
 */
export function chunkChapterText(chapterIndex: number, text: string): TextChunk[] {
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!cleanText) {
    return [];
  }

  const rawParagraphs = cleanText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const normalizedParagraphs: string[] = [];

  // Break overly long paragraphs into sentences
  for (const paragraph of rawParagraphs) {
    if (paragraph.length <= MAX_CHUNK_LENGTH) {
      normalizedParagraphs.push(paragraph);
    } else {
      // Split by sentence endings (. ! ? ...)
      const sentences = paragraph.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [paragraph];
      let currentSentenceBlock = '';

      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;

        if (trimmed.length > MAX_CHUNK_LENGTH) {
          // If a single sentence exceeds MAX_CHUNK_LENGTH, break by words
          if (currentSentenceBlock) {
            normalizedParagraphs.push(currentSentenceBlock);
            currentSentenceBlock = '';
          }
          const words = trimmed.split(' ');
          let wordBlock = '';
          for (const word of words) {
            if ((wordBlock + ' ' + word).trim().length > MAX_CHUNK_LENGTH) {
              if (wordBlock) normalizedParagraphs.push(wordBlock.trim());
              wordBlock = word;
            } else {
              wordBlock = wordBlock ? `${wordBlock} ${word}` : word;
            }
          }
          if (wordBlock) normalizedParagraphs.push(wordBlock.trim());
        } else if ((currentSentenceBlock + ' ' + trimmed).trim().length > MAX_CHUNK_LENGTH) {
          normalizedParagraphs.push(currentSentenceBlock.trim());
          currentSentenceBlock = trimmed;
        } else {
          currentSentenceBlock = currentSentenceBlock ? `${currentSentenceBlock} ${trimmed}` : trimmed;
        }
      }
      if (currentSentenceBlock) {
        normalizedParagraphs.push(currentSentenceBlock.trim());
      }
    }
  }

  // Now bundle paragraphs into chunks up to MAX_CHUNK_LENGTH
  const chunks: TextChunk[] = [];
  let currentChunkText = '';
  let chunkIdx = 0;

  for (const para of normalizedParagraphs) {
    const candidate = currentChunkText ? `${currentChunkText}\n\n${para}` : para;
    if (candidate.length <= MAX_CHUNK_LENGTH) {
      currentChunkText = candidate;
    } else {
      if (currentChunkText) {
        chunks.push({
          id: `ch-${chapterIndex}-ck-${chunkIdx}`,
          index: chunkIdx,
          text: currentChunkText.trim(),
          charCount: currentChunkText.trim().length,
        });
        chunkIdx++;
      }
      currentChunkText = para;
    }
  }

  if (currentChunkText.trim()) {
    chunks.push({
      id: `ch-${chapterIndex}-ck-${chunkIdx}`,
      index: chunkIdx,
      text: currentChunkText.trim(),
      charCount: currentChunkText.trim().length,
    });
  }

  return chunks;
}
