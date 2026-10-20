import { ChunkerOptions, ITextChunkerService, TextChunk } from '@/domain';

export const DEFAULT_TARGET_CHARS = 200;
export const DEFAULT_MIN_CHARS = 20;
export const DEFAULT_OPTIMAL_MIN_CHARS = 150;
export const DEFAULT_OPTIMAL_MAX_CHARS = 250;
export const DEFAULT_SAFE_MAX_CHARS = 350;

export class SentenceBoundaryChunker implements ITextChunkerService {
  chunkText(
    chapterIndex: number,
    text: string,
    options?: ChunkerOptions
  ): TextChunk[] {
    const minChars = options?.minChars ?? DEFAULT_MIN_CHARS;
    const maxChars = options?.maxChars ?? DEFAULT_OPTIMAL_MAX_CHARS;
    const safeMaxChars = options?.safeMaxChars ?? DEFAULT_SAFE_MAX_CHARS;
    const mergeShort = options?.mergeShortSentences ?? true;

    const cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    if (!cleanText) {
      return [];
    }

    // 1. Split text into paragraphs by newline boundaries (\n+)
    const rawParagraphs = cleanText
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const chunks: TextChunk[] = [];
    let chunkIdx = 0;

    for (const paragraph of rawParagraphs) {
      // 2. Break paragraph into sentences using terminators (. ? ! … and optional quotes)
      const rawSentences = paragraph.match(/[^.!?…\n]+(?:[.!?…]+["'”’]?|$)/g) || [paragraph];
      const atomicUnits: string[] = [];

      for (const rawSentence of rawSentences) {
        const sentence = rawSentence.trim();
        if (!sentence) continue;

        if (sentence.length <= maxChars) {
          atomicUnits.push(sentence);
        } else {
          // Overly long sentence (> maxChars): split by clause delimiters (,, ;, :, —)
          const rawClauses = sentence.match(/[^,;:—\n]+(?:[,;:—]+["'”’]?|$)/g) || [sentence];
          for (const rawClause of rawClauses) {
            const clause = rawClause.trim();
            if (!clause) continue;

            if (clause.length <= maxChars) {
              atomicUnits.push(clause);
            } else {
              // Overly long clause: split by words up to maxChars
              const words = clause.split(' ');
              let wordAcc = '';
              for (const word of words) {
                const candidate = wordAcc ? `${wordAcc} ${word}` : word;
                if (candidate.length > maxChars) {
                  if (wordAcc.trim()) {
                    atomicUnits.push(wordAcc.trim());
                  }
                  wordAcc = word;
                } else {
                  wordAcc = candidate;
                }
              }
              if (wordAcc.trim()) {
                atomicUnits.push(wordAcc.trim());
              }
            }
          }
        }
      }

      if (atomicUnits.length === 0) continue;

      // 3. Merge ultra-short sentences (< minChars, e.g. 20 chars like "Vâng.", "Thật sao?")
      let processedUnits: string[] = [];
      if (mergeShort && atomicUnits.length > 1) {
        for (let i = 0; i < atomicUnits.length; i++) {
          const current = atomicUnits[i];
          if (current.length < minChars) {
            // Merge backward into previous unit if it fits within safeMaxChars
            if (processedUnits.length > 0) {
              const prev = processedUnits[processedUnits.length - 1];
              if ((prev + ' ' + current).length <= safeMaxChars) {
                processedUnits[processedUnits.length - 1] = `${prev} ${current}`;
                continue;
              }
            }
            // Otherwise merge forward into next unit if next unit exists
            if (i + 1 < atomicUnits.length) {
              atomicUnits[i + 1] = `${current} ${atomicUnits[i + 1]}`;
              continue;
            }
          }
          processedUnits.push(current);
        }
      } else {
        processedUnits = atomicUnits;
      }

      // 4. Assemble paragraph units into chunks targeting optimal length (150-250 chars)
      const paragraphChunks: string[] = [];
      let currentChunk = '';

      for (const unit of processedUnits) {
        if (!currentChunk) {
          currentChunk = unit;
          continue;
        }

        const candidate = `${currentChunk} ${unit}`;
        if (candidate.length <= maxChars) {
          currentChunk = candidate;
        } else {
          paragraphChunks.push(currentChunk.trim());
          currentChunk = unit;
        }
      }

      if (currentChunk.trim()) {
        // If trailing chunk in paragraph is ultra-short, merge into previous chunk if within safeMaxChars
        if (
          mergeShort &&
          paragraphChunks.length > 0 &&
          currentChunk.trim().length < minChars &&
          (paragraphChunks[paragraphChunks.length - 1] + ' ' + currentChunk.trim()).length <= safeMaxChars
        ) {
          paragraphChunks[paragraphChunks.length - 1] = `${paragraphChunks[paragraphChunks.length - 1]} ${currentChunk.trim()}`;
        } else {
          paragraphChunks.push(currentChunk.trim());
        }
      }

      // 5. Append to overall chunks, tagging isParagraphEnd on the last chunk of the paragraph
      for (let i = 0; i < paragraphChunks.length; i++) {
        const text = paragraphChunks[i];
        const isParagraphEnd = i === paragraphChunks.length - 1;

        chunks.push({
          id: `ch-${chapterIndex}-ck-${chunkIdx}`,
          index: chunkIdx,
          text,
          charCount: text.length,
          isParagraphEnd,
        });
        chunkIdx++;
      }
    }

    return chunks;
  }
}
