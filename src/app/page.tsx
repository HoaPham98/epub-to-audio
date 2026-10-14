'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/presentation/components';
import { Sidebar } from '@/presentation/components';
import { Reader } from '@/presentation/components';
import { AudioPlayerBar } from '@/presentation/components';
import { SettingsModal } from '@/presentation/components';
import { CacheModal } from '@/presentation/components';
import { useAudioStreamer } from '@/presentation/hooks';
import { EpubBook, TTSSettings } from '@/domain';
import {
  ManageAudioCacheUseCase,
  ParseAndLoadBookUseCase,
} from '@/application';
import {
  IndexedDBBookRepository,
  SentenceBoundaryChunker,
} from '@/infrastructure';

const DEFAULT_SETTINGS: TTSSettings = {
  endpoint: 'http://localhost:8000/v1',
  apiKey: '',
  model: 'vieneu-v3-turbo',
  voice: 'Mai Anh',
  responseFormat: 'pcm',
  sampleRate: 24000,
  speed: 1.0,
  useProxy: false,
  enablePrefetch: true,
  maxChars: 256,
  temperature: 0.8,
  topK: 25,
  topP: 0.95,
  repetitionPenalty: 1.2,
};

export default function Home() {
  const [book, setBook] = useState<EpubBook | null>(null);
  const [settings, setSettings] = useState<TTSSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem('epub_tts_settings');
      if (saved) {
        return {
          ...DEFAULT_SETTINGS,
          ...JSON.parse(saved),
          responseFormat: JSON.parse(saved).responseFormat || 'pcm',
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCacheOpen, setIsCacheOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [cacheStats, setCacheStats] = useState({ count: 0, estimatedSizeMB: 0 });

  const bookRepo = useMemo(() => new IndexedDBBookRepository(), []);
  const parseBookUseCase = useMemo(() => new ParseAndLoadBookUseCase(bookRepo), [bookRepo]);
  const cacheUseCase = useMemo(() => new ManageAudioCacheUseCase(), []);
  const chunker = useMemo(() => new SentenceBoundaryChunker(), []);

  const refreshCacheStats = useCallback(() => {
    cacheUseCase.getStats().then(setCacheStats);
  }, [cacheUseCase]);

  // Load saved book from IndexedDB & refresh stats
  useEffect(() => {
    bookRepo.getSavedBook().then(saved => {
      if (saved) {
        const hasLargeChunks = saved.chapters.some(ch => ch.chunks.some(ck => ck.charCount > 350));
        if (hasLargeChunks) {
          const updatedChapters = saved.chapters.map(ch => ({
            ...ch,
            chunks: chunker.chunkText(ch.index, ch.rawText, { minChars: 200, maxChars: 300 }),
          }));
          const totalChunks = updatedChapters.reduce((acc, ch) => acc + ch.chunks.length, 0);
          const updatedBook = { ...saved, chapters: updatedChapters, totalChunks };
          setBook(updatedBook);
          bookRepo.saveBook(updatedBook);
        } else {
          setBook(saved);
        }
      }
    });

    refreshCacheStats();
  }, [bookRepo, chunker, refreshCacheStats]);

  const handleSaveSettings = (newSettings: TTSSettings) => {
    setSettings(newSettings);
    localStorage.setItem('epub_tts_settings', JSON.stringify(newSettings));
  };

  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    try {
      const parsedBook = await parseBookUseCase.execute(file);
      setBook(parsedBook);
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
      const parsedBook = await parseBookUseCase.execute(blob, 'Hoang-Tu-Be-Mau.epub');
      setBook(parsedBook);
    } catch (e) {
      alert('Không thể tải sách mẫu: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsParsing(false);
    }
  };

  const audioPlayer = useAudioStreamer({
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
