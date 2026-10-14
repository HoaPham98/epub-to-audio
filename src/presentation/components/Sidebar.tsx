'use client';

import React, { useState, useRef } from 'react';
import { Upload, Book, Play, Volume2, Search, FileText, RefreshCw } from 'lucide-react';
import { EpubBook } from '@/domain';

interface SidebarProps {
  book: EpubBook | null;
  currentChapterIndex: number;
  isPlaying: boolean;
  onSelectChapter: (index: number, playImmediately?: boolean) => void;
  onFileUpload: (file: File) => void;
  onLoadSample?: () => void;
  isParsing: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  book,
  currentChapterIndex,
  isPlaying,
  onSelectChapter,
  onFileUpload,
  onLoadSample,
  isParsing,
  isOpen,
  onClose,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredChapters = (book?.chapters || []).filter(ch =>
    ch.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-16 bottom-24 z-40 flex w-80 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-transform duration-300 md:static md:bottom-0 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top: Upload or Book Summary */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".epub,application/epub+zip"
            className="hidden"
          />

          {!book ? (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all group"
              >
                {isParsing ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <RefreshCw className="h-7 w-7 animate-spin text-indigo-600" />
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Đang giải mã EPUB...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        Tải lên file EPUB
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                        Kéo thả hoặc nhấp để chọn sách
                      </p>
                    </div>
                  </>
                )}
              </div>

              {onLoadSample && !isParsing && (
                <div className="mt-2.5 text-center">
                  <button
                    type="button"
                    onClick={onLoadSample}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <Book className="h-3.5 w-3.5" />
                    Thử ngay với sách mẫu Hoàng Tử Bé
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                {book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="h-16 w-12 rounded object-cover shadow-xs border border-zinc-200 dark:border-zinc-800 shrink-0"
                  />
                ) : (
                  <div className="flex h-16 w-12 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 shrink-0">
                    <Book className="h-6 w-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate" title={book.title}>
                    {book.title}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5" title={book.author}>
                    {book.author}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {book.chapters.length} chương
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {book.totalChunks} đoạn TTS
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Đổi sách EPUB khác
              </button>
            </div>
          )}
        </div>

        {/* Middle: ToC Search Bar */}
        {book && (
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Tìm tên chương..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        )}

        {/* ToC Chapter List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {!book ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-400">Chưa có sách nào được tải lên</p>
            </div>
          ) : filteredChapters.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-400">
              Không tìm thấy chương nào phù hợp
            </div>
          ) : (
            filteredChapters.map(chapter => {
              const isCurrent = chapter.index === currentChapterIndex;
              return (
                <div
                  key={chapter.id}
                  onClick={() => {
                    onSelectChapter(chapter.index, true);
                    onClose();
                  }}
                  className={`group flex items-center justify-between rounded-lg p-2.5 text-xs cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span
                      className={`text-[10px] w-5 text-right font-mono shrink-0 ${
                        isCurrent ? 'text-indigo-600 font-bold' : 'text-zinc-400'
                      }`}
                    >
                      {chapter.index + 1}
                    </span>
                    <span className="truncate leading-snug">{chapter.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-zinc-400 group-hover:hidden">
                      {chapter.chunks.length}p
                    </span>

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onSelectChapter(chapter.index, true);
                        onClose();
                      }}
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition-transform ${
                        isCurrent && isPlaying
                          ? 'bg-indigo-600 text-white animate-pulse'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 group-hover:scale-105'
                      }`}
                      title="Phát chương này"
                    >
                      {isCurrent && isPlaying ? (
                        <Volume2 className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3 ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
