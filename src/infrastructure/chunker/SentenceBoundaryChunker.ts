import { ChunkerOptions, ITextChunkerService, TextChunk } from '@/domain';

export const DEFAULT_TARGET_CHARS = 200;
export const DEFAULT_MIN_CHARS = 20;
export const DEFAULT_OPTIMAL_MIN_CHARS = 150;
export const DEFAULT_OPTIMAL_MAX_CHARS = 250;
export const DEFAULT_SAFE_MAX_CHARS = 350;

const HAS_ALPHANUMERIC = /[\p{L}\p{N}]/u;

interface UnitWithMeta {
  text: string;
  isParagraphEnd: boolean;
}

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

    if (!cleanText || !HAS_ALPHANUMERIC.test(cleanText)) {
      return [];
    }

    // 1. Split text into paragraphs by newline boundaries (\n+) and filter out non-speech paragraphs
    const rawParagraphs = cleanText
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0 && HAS_ALPHANUMERIC.test(p));

    if (rawParagraphs.length === 0) {
      return [];
    }

    const allUnits: UnitWithMeta[] = [];

    for (const paragraph of rawParagraphs) {
      // 2. Break paragraph into sentences using terminators (. ? ! … and optional quotes)
      const rawSentences = paragraph.match(/[^.!?…\n]+(?:[.!?…]+["'”’]?|$)/g) || [paragraph];
      const atomicUnits: string[] = [];

      for (const rawSentence of rawSentences) {
        const sentence = rawSentence.trim();
        if (!sentence || !HAS_ALPHANUMERIC.test(sentence)) continue;

        if (sentence.length <= maxChars) {
          atomicUnits.push(sentence);
        } else {
          // Overly long sentence (> maxChars): split by clause delimiters (,, ;, :, —)
          const rawClauses = sentence.match(/[^,;:—\n]+(?:[,;:—]+["'”’]?|$)/g) || [sentence];
          for (const rawClause of rawClauses) {
            const clause = rawClause.trim();
            if (!clause || !HAS_ALPHANUMERIC.test(clause)) continue;

            if (clause.length <= maxChars) {
              atomicUnits.push(clause);
            } else {
              // Overly long clause: split by words up to maxChars
              const words = clause.split(' ');
              let wordAcc = '';
              for (const word of words) {
                const candidate = wordAcc ? `${wordAcc} ${word}` : word;
                if (candidate.length > maxChars) {
                  if (wordAcc.trim() && HAS_ALPHANUMERIC.test(wordAcc)) {
                    atomicUnits.push(wordAcc.trim());
                  }
                  wordAcc = word;
                } else {
                  wordAcc = candidate;
                }
              }
              if (wordAcc.trim() && HAS_ALPHANUMERIC.test(wordAcc)) {
                atomicUnits.push(wordAcc.trim());
              }
            }
          }
        }
      }

      if (atomicUnits.length === 0) continue;

      // 3. Merge ultra-short sentences (< minChars, e.g. 20 chars like "Vâng.", "Thật sao?") within paragraph
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

      for (let i = 0; i < processedUnits.length; i++) {
        allUnits.push({
          text: processedUnits[i],
          isParagraphEnd: i === processedUnits.length - 1,
        });
      }
    }

    if (allUnits.length === 0) {
      return [];
    }

    // 4. Assemble units into optimal chunks (150-250 chars) with cross-paragraph accumulation
    const chunks: TextChunk[] = [];
    let chunkIdx = 0;
    let currentChunkText = '';
    let currentChunkEndsParagraph = false;

    for (const unit of allUnits) {
      if (!currentChunkText) {
        currentChunkText = unit.text;
        currentChunkEndsParagraph = unit.isParagraphEnd;
        continue;
      }

      // If current chunk ended at a paragraph boundary and already reached optimal min length (>= 150 chars),
      // respect paragraph boundary and close chunk.
      if (currentChunkEndsParagraph && currentChunkText.length >= DEFAULT_OPTIMAL_MIN_CHARS) {
        chunks.push({
          id: `ch-${chapterIndex}-ck-${chunkIdx}`,
          index: chunkIdx,
          text: currentChunkText.trim(),
          charCount: currentChunkText.trim().length,
          isParagraphEnd: true,
        });
        chunkIdx++;
        currentChunkText = unit.text;
        currentChunkEndsParagraph = unit.isParagraphEnd;
        continue;
      }

      // If mergeShort is false and we hit a paragraph end, do not accumulate across paragraphs
      if (!mergeShort && currentChunkEndsParagraph) {
        chunks.push({
          id: `ch-${chapterIndex}-ck-${chunkIdx}`,
          index: chunkIdx,
          text: currentChunkText.trim(),
          charCount: currentChunkText.trim().length,
          isParagraphEnd: true,
        });
        chunkIdx++;
        currentChunkText = unit.text;
        currentChunkEndsParagraph = unit.isParagraphEnd;
        continue;
      }

      const separator = currentChunkEndsParagraph ? '\n' : ' ';
      const candidate = `${currentChunkText}${separator}${unit.text}`;

      // Check if candidate fits within maxChars, or safeMaxChars if current chunk is ultra-short
      const fitsInMax = candidate.length <= maxChars;
      const fitsInSafe = mergeShort && currentChunkText.length < minChars && candidate.length <= safeMaxChars;

      if (fitsInMax || fitsInSafe) {
        currentChunkText = candidate;
        currentChunkEndsParagraph = unit.isParagraphEnd;
      } else {
        chunks.push({
          id: `ch-${chapterIndex}-ck-${chunkIdx}`,
          index: chunkIdx,
          text: currentChunkText.trim(),
          charCount: currentChunkText.trim().length,
          isParagraphEnd: currentChunkEndsParagraph,
        });
        chunkIdx++;
        currentChunkText = unit.text;
        currentChunkEndsParagraph = unit.isParagraphEnd;
      }
    }

    if (currentChunkText.trim()) {
      // If trailing chunk is ultra-short, attempt to merge into previous chunk if within safeMaxChars
      if (
        mergeShort &&
        chunks.length > 0 &&
        currentChunkText.trim().length < minChars
      ) {
        const prevChunk = chunks[chunks.length - 1];
        const separator = prevChunk.isParagraphEnd ? '\n' : ' ';
        const combined = `${prevChunk.text}${separator}${currentChunkText.trim()}`;
        if (combined.length <= safeMaxChars) {
          prevChunk.text = combined;
          prevChunk.charCount = combined.length;
          prevChunk.isParagraphEnd = currentChunkEndsParagraph;
        } else {
          chunks.push({
            id: `ch-${chapterIndex}-ck-${chunkIdx}`,
            index: chunkIdx,
            text: currentChunkText.trim(),
            charCount: currentChunkText.trim().length,
            isParagraphEnd: currentChunkEndsParagraph,
          });
        }
      } else {
        chunks.push({
          id: `ch-${chapterIndex}-ck-${chunkIdx}`,
          index: chunkIdx,
          text: currentChunkText.trim(),
          charCount: currentChunkText.trim().length,
          isParagraphEnd: currentChunkEndsParagraph,
        });
      }
    }

    return chunks;
  }
}
