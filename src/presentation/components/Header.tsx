'use client';

import React from 'react';
import { BookOpen, Settings, HardDrive, Menu } from 'lucide-react';
import { EpubBook } from '@/domain';

interface HeaderProps {
  book: EpubBook | null;
  onOpenSettings: () => void;
  onOpenCache: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  cacheCount: number;
}

export function Header({
  book,
  onOpenSettings,
  onOpenCache,
  isSidebarOpen,
  onToggleSidebar,
  cacheCount,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 px-4 md:px-6 backdrop-blur-md">
      {/* Left: Sidebar Toggle & Book Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          aria-label={isSidebarOpen ? 'Thu gọn thanh bên' : 'Mở thanh bên'}
          title={isSidebarOpen ? 'Thu gọn thanh bên' : 'Mở thanh bên'}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Branding when sidebar is closed/collapsed */}
        {!isSidebarOpen && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-xs shrink-0">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm hidden sm:inline">
              EPUB to Audio
            </span>
          </div>
        )}

        {/* Desktop Active Book breadcrumb */}
        {book ? (
          <div className="hidden md:flex items-center gap-2 truncate">
            {!isSidebarOpen && <span className="text-zinc-300 dark:text-zinc-700">|</span>}
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-xs lg:max-w-md">
              {book.title}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
              {book.author}
            </span>
          </div>
        ) : (
          isSidebarOpen && (
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
              <span>VieNeu TTS Streaming Reader</span>
            </div>
          )
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCache}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Quản lý bộ nhớ đệm âm thanh"
        >
          <HardDrive className="h-4 w-4 text-zinc-500" />
          <span className="hidden sm:inline">Bộ nhớ đệm</span>
          {cacheCount > 0 && (
            <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 text-[10px] font-semibold">
              {cacheCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors"
          title="Cài đặt API Endpoint & Giọng đọc"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Cài đặt API</span>
        </button>
      </div>
    </header>
  );
}
