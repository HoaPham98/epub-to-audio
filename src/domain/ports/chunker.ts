import { TextChunk } from '../entities';

export interface ITextChunkerService {
  chunkText(
    chapterIndex: number,
    text: string,
    options?: { minChars?: number; maxChars?: number }
  ): TextChunk[];
}
