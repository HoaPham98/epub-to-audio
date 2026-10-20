export interface TextChunk {
  id: string;
  index: number;
  text: string;
  charCount: number;
  isParagraphEnd?: boolean;
}

export interface EpubChapter {
  id: string;
  index: number;
  title: string;
  href: string;
  contentHtml: string;
  rawText: string;
  chunks: TextChunk[];
}

export interface EpubBook {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  chapters: EpubChapter[];
  totalChunks: number;
  fileName: string;
  fileSize: number;
  uploadedAt: number;
}
