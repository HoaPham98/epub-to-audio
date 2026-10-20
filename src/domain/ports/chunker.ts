import { TextChunk } from '../entities';

export interface ChunkerOptions {
  minChars?: number;
  targetChars?: number;
  maxChars?: number;
  safeMaxChars?: number;
  mergeShortSentences?: boolean;
}

export interface ITextChunkerService {
  chunkText(
    chapterIndex: number,
    text: string,
    options?: ChunkerOptions
  ): TextChunk[];
}

