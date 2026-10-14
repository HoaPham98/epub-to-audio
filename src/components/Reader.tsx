'use client';

import React, { useState } from 'react';
import { Volume2, Play, Minus, Plus, BookOpen, AlertCircle } from 'lucide-react';
import { EpubBook, ChunkStatus } from '@/types';

interface ReaderProps {
  book: EpubBook | null;
  currentChapterIndex: number;
  currentChunkIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  chunkStatuses: Record<number, ChunkStatus>;
  errorMessage: string | null;
  onPlayChunk: (chapterIndex: number, chunkIndex: number) => void;
  onOpenSettings: () => void;
}

export function Reader({
  book,
  currentChapterIndex,
  currentChunkIndex,
  isPlaying,
  isLoading,
  chunkStatuses,
  errorMessage,
  onPlayChunk,
  onOpenSettings,
}: ReaderProps) {
  const [fontSize, setFontSize] = useState<number>(16);

  if (!book) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-50/50 dark:bg-zinc-900/20">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 mb-4 shadow-xs">
          <BookOpen className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
          Chào mừng bạn đến với EPUB Audio Reader
        </h2>
        <p className="mt-2 text-sm text-zinc-500 max-w-md">
          Tải lên một cuốn sách EPUB từ thanh bên trái và thiết lập OpenAI API Key để chuyển sách chữ thành sách nói chất lượng cao.
        </p>
      </main>
    );
  }

  const currentChapter = book.chapters[currentChapterIndex];

  return (
    <main className="flex-1 overflow-y-auto px-4 md:px-12 py-8 bg-zinc-50/30 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-300 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Đã xảy ra lỗi:</p>
              <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{errorMessage}</p>
              {errorMessage.includes('API Key') && (
                <button
                  onClick={onOpenSettings}
                  className="mt-2 inline-flex items-center text-xs font-semibold text-red-900 dark:text-red-200 underline hover:no-underline"
                >
                  Mở Cài đặt API ngay &rarr;
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chapter Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Chương {currentChapterIndex + 1} / {book.chapters.length}
            </span>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {currentChapter ? currentChapter.title : 'Chưa chọn chương'}
            </h1>
          </div>

          {/* Reader font size adjusters */}
          <div className="flex items-center gap-1 self-start sm:self-auto rounded-lg border border-zinc-200 dark:border-zinc-800 p-1 bg-white dark:bg-zinc-900 shadow-2xs">
            <button
              onClick={() => setFontSize(s => Math.max(13, s - 1))}
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Giảm kích thước chữ"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 text-xs font-mono font-medium text-zinc-600 dark:text-zinc-300">
              {fontSize}px
            </span>
            <button
              onClick={() => setFontSize(s => Math.min(24, s + 1))}
              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Tăng kích thước chữ"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Chunks Display */}
        {currentChapter && currentChapter.chunks.length > 0 ? (
          <div className="space-y-4 pt-2">
            {currentChapter.chunks.map(chunk => {
              const isCurrent = chunk.index === currentChunkIndex;
              const status = chunkStatuses[chunk.index] || 'idle';

              return (
                <div
                  key={chunk.id}
                  className={`group relative rounded-xl p-4 transition-all border ${
                    isCurrent
                      ? 'border-indigo-400/80 bg-indigo-50/60 dark:bg-indigo-950/20 dark:border-indigo-800 shadow-xs'
                      : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-800/80 hover:bg-white dark:hover:bg-zinc-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-zinc-400">
                      Đoạn {chunk.index + 1} ({chunk.charCount} ký tự)
                    </span>

                    <button
                      onClick={() => onPlayChunk(currentChapterIndex, chunk.index)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                        isCurrent && isPlaying
                          ? 'bg-indigo-600 text-white'
                          : isCurrent && isLoading
                          ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-950'
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <>
                          <Volume2 className="h-3 w-3 animate-pulse" />
                          <span>Đang đọc</span>
                        </>
                      ) : isCurrent && isLoading ? (
                        <span>Đang tải audio...</span>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          <span>Nghe đoạn này</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p
                    style={{ fontSize: `${fontSize}px` }}
                    className="leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-line select-text"
                  >
                    {chunk.text}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-zinc-400">
            Chương này không có nội dung chữ để hiển thị.
          </div>
        )}
      </div>
    </main>
  );
}
