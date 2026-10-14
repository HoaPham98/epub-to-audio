import { TextChunk } from '@/types';

const TARGET_MIN_LENGTH = 280;
const MAX_CHUNK_LENGTH = 400; // ~300 to 400 characters per chunk

/**
 * Splits raw text of a chapter into small chunks (~300 - 400 characters),
 * preserving sentence and clause boundaries.
 */
export function chunkChapterText(chapterIndex: number, text: string): TextChunk[] {
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!cleanText) {
    return [];
  }

  // 1. Break text into logical sentence units
  const rawSentences = cleanText.match(/[^.!?\n]+[.!?]+["']?|[^.!?\n]+(?:\n+|$)/g) || [cleanText];
  const atomicUnits: string[] = [];

  for (const sentence of rawSentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // If a sentence is within our limit, keep as is
    if (trimmed.length <= MAX_CHUNK_LENGTH) {
      atomicUnits.push(trimmed);
    } else {
      // Split overly long sentence by clauses (, ; : -)
      const clauses = trimmed.match(/[^,;:—]+[,;:—]+|[^,;:—]+$/g) || [trimmed];
      for (const clause of clauses) {
        const clauseTrimmed = clause.trim();
        if (!clauseTrimmed) continue;

        if (clauseTrimmed.length <= MAX_CHUNK_LENGTH) {
          atomicUnits.push(clauseTrimmed);
        } else {
          // If a single clause still exceeds, split by words
          const words = clauseTrimmed.split(' ');
          let wordAcc = '';
          for (const word of words) {
            if ((wordAcc + ' ' + word).trim().length > MAX_CHUNK_LENGTH) {
              if (wordAcc) atomicUnits.push(wordAcc.trim());
              wordAcc = word;
            } else {
              wordAcc = wordAcc ? `${wordAcc} ${word}` : word;
            }
          }
          if (wordAcc.trim()) {
            atomicUnits.push(wordAcc.trim());
          }
        }
      }
    }
  }

  // 2. Assemble atomic units into chunks targeting 300 - 400 characters
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkIdx = 0;

  for (const unit of atomicUnits) {
    const separator = currentChunk ? ' ' : '';
    const candidate = currentChunk + separator + unit;

    if (candidate.length <= MAX_CHUNK_LENGTH) {
      currentChunk = candidate;
    } else {
      // If adding this unit exceeds 400 characters, push current chunk
      if (currentChunk.trim()) {
        chunks.push({
          id: `ch-${chapterIndex}-ck-${chunkIdx}`,
          index: chunkIdx,
          text: currentChunk.trim(),
          charCount: currentChunk.trim().length,
        });
        chunkIdx++;
      }
      currentChunk = unit;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: `ch-${chapterIndex}-ck-${chunkIdx}`,
      index: chunkIdx,
      text: currentChunk.trim(),
      charCount: currentChunk.trim().length,
    });
  }

  return chunks;
}
