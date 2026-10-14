'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { EpubBook, TTSSettings, ChunkStatus } from '@/types';
import { fetchTTSAudio } from '@/lib/tts';

interface UseAudioPlayerProps {
  book: EpubBook | null;
  settings: TTSSettings;
  onOpenSettings: () => void;
}

export function useAudioPlayer({ book, settings, onOpenSettings }: UseAudioPlayerProps) {
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [autoNext, setAutoNext] = useState<boolean>(true);
  const [chunkStatuses, setChunkStatuses] = useState<Record<number, ChunkStatus>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchingChunksRef = useRef<Set<string>>(new Set());
  // In-memory Preloaded Blob URL cache: chunkKey -> ObjectURL (for 0ms instant playback)
  const preloadedBlobUrlsRef = useRef<Map<string, string>>(new Map());

  // Initialize Audio element on mount
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setErrorMessage('Không thể phát file âm thanh này.');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);

    // Load autoNext preference from localStorage
    const savedAutoNext = localStorage.getItem('epub_tts_auto_next');
    if (savedAutoNext !== null) {
      setAutoNext(savedAutoNext === 'true');
    }

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      // Clean up all preloaded Object URLs
      preloadedBlobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      preloadedBlobUrlsRef.current.clear();
    };
  }, []);

  // Update speed when settings change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = settings.speed;
    }
  }, [settings.speed]);

  // Save autoNext preference
  const toggleAutoNext = useCallback(() => {
    setAutoNext(prev => {
      const nextVal = !prev;
      localStorage.setItem('epub_tts_auto_next', String(nextVal));
      return nextVal;
    });
  }, []);

  // Save reading progress (current chapter & chunk) to localStorage
  const saveProgress = useCallback(
    (chapIdx: number, chunkIdx: number) => {
      if (!book) return;
      try {
        localStorage.setItem(
          `epub_progress_${book.id}`,
          JSON.stringify({ chapterIndex: chapIdx, chunkIndex: chunkIdx, timestamp: Date.now() })
        );
      } catch (e) {
        console.warn('Failed to save reading progress', e);
      }
    },
    [book]
  );

  // Restore reading progress when book loads or changes
  useEffect(() => {
    if (!book) return;
    try {
      const saved = localStorage.getItem(`epub_progress_${book.id}`);
      if (saved) {
        const { chapterIndex, chunkIndex } = JSON.parse(saved);
        if (
          typeof chapterIndex === 'number' &&
          chapterIndex >= 0 &&
          chapterIndex < book.chapters.length
        ) {
          setCurrentChapterIndex(chapterIndex);
          const chap = book.chapters[chapterIndex];
          if (
            typeof chunkIndex === 'number' &&
            chap &&
            chunkIndex >= 0 &&
            chunkIndex < chap.chunks.length
          ) {
            setCurrentChunkIndex(chunkIndex);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore reading progress', e);
    }
  }, [book]);

  // Helper to get consistent chunk key
  const getChunkKey = useCallback(
    (chapIdx: number, chunkIdx: number) => {
      if (!book) return '';
      return `${book.id}_ch${chapIdx}_ck${chunkIdx}`;
    },
    [book]
  );

  // Background Prefetching: fetches audio blob and keeps ObjectURL in memory
  const prefetchChunk = useCallback(
    async (targetChapterIndex: number, targetChunkIndex: number) => {
      if (!book) return;
      const chapter = book.chapters[targetChapterIndex];
      if (!chapter || !chapter.chunks[targetChunkIndex]) return;

      const chunkKey = `${book.id}_ch${targetChapterIndex}_ck${targetChunkIndex}`;

      // Skip if already in memory or currently fetching
      if (preloadedBlobUrlsRef.current.has(chunkKey) || prefetchingChunksRef.current.has(chunkKey)) {
        return;
      }

      prefetchingChunksRef.current.add(chunkKey);

      // Only mark status for current chapter
      if (targetChapterIndex === currentChapterIndex) {
        setChunkStatuses(prev => ({
          ...prev,
          [targetChunkIndex]: prev[targetChunkIndex] === 'playing' ? 'playing' : 'loading',
        }));
      }

      try {
        const audioBlob = await fetchTTSAudio(
          chapter.chunks[targetChunkIndex].text,
          settings,
          {
            bookId: book.id,
            chapterIndex: targetChapterIndex,
            chunkIndex: targetChunkIndex,
          }
        );

        // Pre-create Object URL and cache in memory for 0ms latency transition
        if (!preloadedBlobUrlsRef.current.has(chunkKey)) {
          const blobUrl = URL.createObjectURL(audioBlob);
          preloadedBlobUrlsRef.current.set(chunkKey, blobUrl);
        }

        if (targetChapterIndex === currentChapterIndex) {
          setChunkStatuses(prev => ({
            ...prev,
            [targetChunkIndex]: prev[targetChunkIndex] === 'playing' ? 'playing' : 'ready',
          }));
        }

        // Buffer ahead: If current chapter has more chunks, prefetch the next one!
        if (targetChunkIndex + 1 < chapter.chunks.length) {
          const nextKey = `${book.id}_ch${targetChapterIndex}_ck${targetChunkIndex + 1}`;
          if (!preloadedBlobUrlsRef.current.has(nextKey) && !prefetchingChunksRef.current.has(nextKey)) {
            prefetchChunk(targetChapterIndex, targetChunkIndex + 1);
          }
        } else if (autoNext && targetChapterIndex + 1 < book.chapters.length) {
          // Cross-chapter prefetch: prefetch chunk 0 of the next chapter!
          const nextChapKey = `${book.id}_ch${targetChapterIndex + 1}_ck0`;
          if (!preloadedBlobUrlsRef.current.has(nextChapKey) && !prefetchingChunksRef.current.has(nextChapKey)) {
            prefetchChunk(targetChapterIndex + 1, 0);
          }
        }
      } catch (err) {
        console.warn(`[Prefetch] Lỗi khi tải trước chunk ${targetChunkIndex}:`, err);
        if (targetChapterIndex === currentChapterIndex) {
          setChunkStatuses(prev => ({
            ...prev,
            [targetChunkIndex]: prev[targetChunkIndex] === 'playing' ? 'playing' : 'idle',
          }));
        }
      } finally {
        prefetchingChunksRef.current.delete(chunkKey);
      }
    },
    [book, settings, currentChapterIndex, autoNext]
  );

  // Play a specific chunk
  const playChunk = useCallback(
    async (chapIdx: number, chunkIdx: number) => {
      if (!book) return;
      const chapter = book.chapters[chapIdx];
      if (!chapter || !chapter.chunks[chunkIdx]) return;

      if (!settings.apiKey) {
        setErrorMessage('Vui lòng thiết lập API Key trong Cài đặt để phát âm thanh.');
        onOpenSettings();
        return;
      }

      setErrorMessage(null);
      setCurrentChapterIndex(chapIdx);
      setCurrentChunkIndex(chunkIdx);
      saveProgress(chapIdx, chunkIdx);

      const chunkKey = `${book.id}_ch${chapIdx}_ck${chunkIdx}`;

      // FAST PATH: Check if already preloaded in memory
      if (preloadedBlobUrlsRef.current.has(chunkKey)) {
        const preloadedUrl = preloadedBlobUrlsRef.current.get(chunkKey)!;
        setIsLoading(false);

        if (audioRef.current) {
          audioRef.current.src = preloadedUrl;
          audioRef.current.playbackRate = settings.speed;
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (e) {
            console.error('Audio play failed:', e);
          }
        }

        setChunkStatuses(prev => ({
          ...prev,
          [chunkIdx]: 'playing',
        }));

        // Immediately trigger background prefetch for next chunk!
        if (settings.enablePrefetch !== false) {
          if (chunkIdx + 1 < chapter.chunks.length) {
            prefetchChunk(chapIdx, chunkIdx + 1);
          } else if (autoNext && chapIdx + 1 < book.chapters.length) {
            prefetchChunk(chapIdx + 1, 0);
          }
        }
        return;
      }

      // SLOW PATH: First time loading (not yet preloaded)
      setIsLoading(true);
      setChunkStatuses(prev => ({
        ...prev,
        [chunkIdx]: 'loading',
      }));

      try {
        const chunk = chapter.chunks[chunkIdx];
        const audioBlob = await fetchTTSAudio(chunk.text, settings, {
          bookId: book.id,
          chapterIndex: chapIdx,
          chunkIndex: chunkIdx,
        });

        const blobUrl = URL.createObjectURL(audioBlob);
        preloadedBlobUrlsRef.current.set(chunkKey, blobUrl);

        if (audioRef.current) {
          audioRef.current.src = blobUrl;
          audioRef.current.playbackRate = settings.speed;
          await audioRef.current.play();
          setIsPlaying(true);
        }

        setChunkStatuses(prev => ({
          ...prev,
          [chunkIdx]: 'playing',
        }));

        // Immediately trigger background prefetch for next chunk!
        if (settings.enablePrefetch !== false) {
          if (chunkIdx + 1 < chapter.chunks.length) {
            prefetchChunk(chapIdx, chunkIdx + 1);
          } else if (autoNext && chapIdx + 1 < book.chapters.length) {
            prefetchChunk(chapIdx + 1, 0);
          }
        }
      } catch (err: unknown) {
        console.error('Play chunk error:', err);
        const message = err instanceof Error ? err.message : 'Lỗi khi gọi API TTS';
        setErrorMessage(message);
        setChunkStatuses(prev => ({
          ...prev,
          [chunkIdx]: 'error',
        }));
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    },
    [book, settings, onOpenSettings, autoNext, prefetchChunk]
  );

  // Audio End Listener for continuous chunk playback & Auto-Next chapter
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (!book) return;
      const chapter = book.chapters[currentChapterIndex];
      if (!chapter) return;

      // Check if more chunks exist in current chapter
      if (currentChunkIndex + 1 < chapter.chunks.length) {
        playChunk(currentChapterIndex, currentChunkIndex + 1);
      } else {
        // End of chapter!
        if (autoNext && currentChapterIndex + 1 < book.chapters.length) {
          // Advance to next chapter, chunk 0
          playChunk(currentChapterIndex + 1, 0);
        } else {
          setIsPlaying(false);
          setCurrentTime(0);
        }
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [book, currentChapterIndex, currentChunkIndex, autoNext, playChunk]);

  // Play / Pause toggle
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current.src && audioRef.current.src !== window.location.href) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
      } else {
        playChunk(currentChapterIndex, currentChunkIndex);
      }
    }
  }, [isPlaying, currentChapterIndex, currentChunkIndex, playChunk]);

  // Jump to chapter
  const selectChapter = useCallback(
    (chapterIndex: number, startPlayImmediately = false) => {
      setCurrentChapterIndex(chapterIndex);
      setCurrentChunkIndex(0);
      saveProgress(chapterIndex, 0);
      setCurrentTime(0);
      setChunkStatuses({});
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);

      if (startPlayImmediately) {
        playChunk(chapterIndex, 0);
      }
    },
    [playChunk]
  );

  // Next / Previous Chapter buttons
  const nextChapter = useCallback(() => {
    if (!book) return;
    if (currentChapterIndex + 1 < book.chapters.length) {
      selectChapter(currentChapterIndex + 1, isPlaying);
    }
  }, [book, currentChapterIndex, isPlaying, selectChapter]);

  const prevChapter = useCallback(() => {
    if (!book) return;
    if (currentChapterIndex > 0) {
      selectChapter(currentChapterIndex - 1, isPlaying);
    }
  }, [book, currentChapterIndex, isPlaying, selectChapter]);

  // Seek time forward / backward
  const seekTime = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const skipRelative = useCallback((seconds: number) => {
    if (audioRef.current) {
      seekTime(audioRef.current.currentTime + seconds);
    }
  }, [seekTime]);

  return {
    currentChapterIndex,
    currentChunkIndex,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    autoNext,
    chunkStatuses,
    errorMessage,
    setErrorMessage,
    togglePlayPause,
    selectChapter,
    nextChapter,
    prevChapter,
    seekTime,
    skipRelative,
    toggleAutoNext,
    playChunk,
    prefetchChunk,
  };
}
