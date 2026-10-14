import { ITextChunkerService, TextChunk } from '@/domain';

const DEFAULT_TARGET_MAX = 300;

export class SentenceBoundaryChunker implements ITextChunkerService {
  chunkText(
    chapterIndex: number,
    text: string,
    options?: { minChars?: number; maxChars?: number }
  ): TextChunk[] {
    const maxLen = options?.maxChars ?? DEFAULT_TARGET_MAX;

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

      if (trimmed.length <= maxLen) {
        atomicUnits.push(trimmed);
      } else {
        // Overly long sentence: split by clauses (, ; : —)
        const clauses = trimmed.match(/[^,;:—]+[,;:—]+|[^,;:—]+$/g) || [trimmed];
        for (const clause of clauses) {
          const clauseTrimmed = clause.trim();
          if (!clauseTrimmed) continue;

          if (clauseTrimmed.length <= maxLen) {
            atomicUnits.push(clauseTrimmed);
          } else {
            // Overly long clause: split by words
            const words = clauseTrimmed.split(' ');
            let wordAcc = '';
            for (const word of words) {
              if ((wordAcc + ' ' + word).trim().length > maxLen) {
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

    // 2. Assemble atomic units into chunks targeting 200 - 300 characters
    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let chunkIdx = 0;

    for (const unit of atomicUnits) {
      const separator = currentChunk ? ' ' : '';
      const candidate = currentChunk + separator + unit;

      if (candidate.length <= maxLen) {
        currentChunk = candidate;
      } else {
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
}
