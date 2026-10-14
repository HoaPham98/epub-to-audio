'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Reader } from '@/components/Reader';
import { AudioPlayerBar } from '@/components/AudioPlayerBar';
import { SettingsModal } from '@/components/SettingsModal';
import { CacheModal } from '@/components/CacheModal';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { EpubBook, TTSSettings } from '@/types';
import { parseEpubFile } from '@/lib/epubParser';
import { getCacheStats, getSavedBook, saveCurrentBook } from '@/lib/db';

const DEFAULT_SETTINGS: TTSSettings = {
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'tts-1',
  voice: 'alloy',
  responseFormat: 'wav',
  speed: 1.0,
  useProxy: false,
};

export default function Home() {
  const [book, setBook] = useState<EpubBook | null>(null);
  const [settings, setSettings] = useState<TTSSettings>(DEFAULT_SETTINGS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCacheOpen, setIsCacheOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [cacheStats, setCacheStats] = useState({ count: 0, estimatedSizeMB: 0 });

  // Load settings from localStorage & saved book from IndexedDB
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('epub_tts_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          responseFormat: parsed.responseFormat || 'wav',
        });
      }
    } catch (e) {
      console.warn('Failed to parse saved settings', e);
    }

    // Load last uploaded book
    getSavedBook().then(saved => {
      if (saved) {
        setBook(saved);
      }
    });

    // Load cache stats
    refreshCacheStats();
  }, []);

  const refreshCacheStats = useCallback(() => {
    getCacheStats().then(setCacheStats);
  }, []);

  const handleSaveSettings = (newSettings: TTSSettings) => {
    setSettings(newSettings);
    localStorage.setItem('epub_tts_settings', JSON.stringify(newSettings));
  };

  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    try {
      const parsedBook = await parseEpubFile(file);
      setBook(parsedBook);
      await saveCurrentBook(parsedBook);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Lỗi khi đọc file EPUB');
    } finally {
      setIsParsing(false);
    }
  };

  const handleLoadSample = async () => {
    setIsParsing(true);
    try {
      const res = await fetch('/sample-book.epub');
      const blob = await res.blob();
      const file = new File([blob], 'Hoang-Tu-Be-Mau.epub', { type: 'application/epub+zip' });
      const parsedBook = await parseEpubFile(file);
      setBook(parsedBook);
      await saveCurrentBook(parsedBook);
    } catch (e) {
      alert('Không thể tải sách mẫu: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsParsing(false);
    }
  };

  const audioPlayer = useAudioPlayer({
    book,
    settings,
    onOpenSettings: () => setIsSettingsOpen(true),
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Header */}
      <Header
        book={book}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCache={() => {
          refreshCacheStats();
          setIsCacheOpen(true);
        }}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        cacheCount={cacheStats.count}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar with ToC & Upload */}
        <Sidebar
          book={book}
          currentChapterIndex={audioPlayer.currentChapterIndex}
          isPlaying={audioPlayer.isPlaying}
          onSelectChapter={(index, playImmediately) => {
            audioPlayer.selectChapter(index, playImmediately);
          }}
          onFileUpload={handleFileUpload}
          onLoadSample={handleLoadSample}
          isParsing={isParsing}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Center Chapter Reader */}
        <Reader
          book={book}
          currentChapterIndex={audioPlayer.currentChapterIndex}
          currentChunkIndex={audioPlayer.currentChunkIndex}
          isPlaying={audioPlayer.isPlaying}
          isLoading={audioPlayer.isLoading}
          chunkStatuses={audioPlayer.chunkStatuses}
          errorMessage={audioPlayer.errorMessage}
          onPlayChunk={(chIdx, ckIdx) => audioPlayer.playChunk(chIdx, ckIdx)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Sticky Bottom Audio Player Bar */}
      {book && (
        <AudioPlayerBar
          book={book}
          currentChapterIndex={audioPlayer.currentChapterIndex}
          currentChunkIndex={audioPlayer.currentChunkIndex}
          isPlaying={audioPlayer.isPlaying}
          isLoading={audioPlayer.isLoading}
          currentTime={audioPlayer.currentTime}
          duration={audioPlayer.duration}
          autoNext={audioPlayer.autoNext}
          onTogglePlayPause={audioPlayer.togglePlayPause}
          onPrevChapter={audioPlayer.prevChapter}
          onNextChapter={audioPlayer.nextChapter}
          onSeek={audioPlayer.seekTime}
          onSkipRelative={audioPlayer.skipRelative}
          onToggleAutoNext={audioPlayer.toggleAutoNext}
          speed={settings.speed}
          onChangeSpeed={speed => {
            const updated = { ...settings, speed };
            handleSaveSettings(updated);
          }}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Cache Manager Modal */}
      <CacheModal
        isOpen={isCacheOpen}
        onClose={() => setIsCacheOpen(false)}
        cacheCount={cacheStats.count}
        cacheSizeMB={cacheStats.estimatedSizeMB}
        onCacheCleared={refreshCacheStats}
      />
    </div>
  );
}
