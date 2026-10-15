'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Loader2, Minus, Plus, BookOpen, AlertCircle, RotateCw } from 'lucide-react';
import { EpubBook, ChunkStatus } from '@/domain';

interface ReaderProps {
  book: EpubBook | null;
  currentChapterIndex: number;
  currentChunkIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  bufferingChunk?: { chapterIndex: number; chunkIndex: number } | null;
  chunkStatuses: Record<number, ChunkStatus>;
  errorMessage: string | null;
  onPlayChunk: (chapterIndex: number, chunkIndex: number) => void;
  onRetry?: () => void;
  onOpenSettings: () => void;
}

export function Reader({
  book,
  currentChapterIndex,
  currentChunkIndex,
  isPlaying,
  isLoading,
  bufferingChunk = null,
  chunkStatuses,
  errorMessage,
  onPlayChunk,
  onRetry,
  onOpenSettings,
}: ReaderProps) {
  const [fontSize, setFontSize] = useState<number>(16);
  const activeChunkRef = useRef<HTMLDivElement | null>(null);

  // Smooth auto-scroll the currently reading chunk to the center of the viewport
  useEffect(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    if (activeChunkRef.current) {
      activeChunkRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentChapterIndex, currentChunkIndex]);

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
    <main className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-6 bg-[#f4f5fa] dark:bg-zinc-950 pb-12 md:pb-16 min-h-0">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Error notification banner with Retry button */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-300 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Đã xảy ra lỗi:</p>
              <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{errorMessage}</p>
              <div className="mt-2.5 flex items-center gap-3">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Thử lại ngay
                  </button>
                )}
                {errorMessage.includes('API Key') && (
                  <button
                    onClick={onOpenSettings}
                    className="inline-flex items-center text-xs font-semibold text-red-900 dark:text-red-200 underline hover:no-underline"
                  >
                    Mở Cài đặt API &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reading Card Container */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 shadow-xs">
          {/* Chapter Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
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
                  ref={isCurrent ? activeChunkRef : null}
                  className={`group relative rounded-xl p-4 transition-all border ${
                    isCurrent
                      ? 'border-indigo-400/80 bg-indigo-50/60 dark:bg-indigo-950/20 dark:border-indigo-800 shadow-xs ring-1 ring-indigo-400/40'
                      : 'border-transparent hover:border-zinc-200 dark:hover:border-zinc-800/80 hover:bg-white dark:hover:bg-zinc-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-zinc-400">
                      Đoạn {chunk.index + 1} ({chunk.charCount} ký tự)
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Status badges */}
                      {isCurrent && !isPlaying && !isLoading && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                          Tạm dừng
                        </span>
                      )}

                      {/* Pre-buffering badge isolated to the buffering chunk */}
                      {!isCurrent &&
                        bufferingChunk?.chapterIndex === currentChapterIndex &&
                        bufferingChunk?.chunkIndex === chunk.index && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 animate-pulse">
                            Đang nạp sẵn...
                          </span>
                        )}

                      {!isCurrent &&
                        !(
                          bufferingChunk?.chapterIndex === currentChapterIndex &&
                          bufferingChunk?.chunkIndex === chunk.index
                        ) &&
                        status === 'ready' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            ✓ Đã nạp sẵn
                          </span>
                        )}

                      {/* Contextual Action Button */}
                      {isCurrent && isPlaying ? (
                        <button
                          onClick={() => onPlayChunk(currentChapterIndex, chunk.index)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95"
                          title="Nhấn để tạm dừng"
                        >
                          <Pause className="h-3 w-3" />
                          <span>Tạm dừng</span>
                        </button>
                      ) : isCurrent && isLoading ? (
                        <button
                          onClick={() => onPlayChunk(currentChapterIndex, chunk.index)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 transition-all cursor-wait"
                          title="Đang kết nối tới server TTS..."
                        >
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Đang kết nối...</span>
                        </button>
                      ) : isCurrent && !isPlaying ? (
                        <button
                          onClick={() => onPlayChunk(currentChapterIndex, chunk.index)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shadow-xs transition-all active:scale-95"
                          title="Nhấn để tiếp tục nghe"
                        >
                          <Play className="h-3 w-3" />
                          <span>Tiếp tục</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onPlayChunk(currentChapterIndex, chunk.index)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                            status === 'ready'
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-950'
                          }`}
                        >
                          <Play className="h-3 w-3" />
                          <span>{status === 'ready' ? 'Phát ngay' : 'Nghe đoạn này'}</span>
                        </button>
                      )}
                    </div>
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
      </div>
    </main>
  );
}
