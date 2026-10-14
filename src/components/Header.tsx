'use client';

import React from 'react';
import { BookOpen, Settings, HardDrive, Menu, X } from 'lucide-react';
import { EpubBook } from '@/types';

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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 px-4 md:px-6 backdrop-blur-md">
      {/* Left: Mobile Sidebar Toggle & Branding */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors md:hidden"
          aria-label="Toggle Menu"
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base leading-tight">
              EPUB to Audio
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              OpenAI Speech TTS Reader
            </p>
          </div>
        </div>
      </div>

      {/* Middle: Active Book Info */}
      {book && (
        <div className="hidden lg:flex items-center gap-2 text-center max-w-md truncate px-4">
          <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200 truncate">
            {book.title}
          </span>
          <span className="text-xs text-zinc-400">|</span>
          <span className="text-xs text-zinc-500 truncate">{book.author}</span>
        </div>
      )}

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
