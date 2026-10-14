'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { EpubBook, TTSSettings, ChunkStatus } from '@/types';
import { fetchTTSAudio, TTSError } from '@/lib/tts';

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
  const currentBlobUrlRef = useRef<string | null>(null);
  const prefetchingChunksRef = useRef<Set<string>>(new Set());
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
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

  // Background Prefetching helper
  const prefetchChunk = useCallback(
    async (targetChapterIndex: number, targetChunkIndex: number) => {
      if (!book) return;
      const chapter = book.chapters[targetChapterIndex];
      if (!chapter || !chapter.chunks[targetChunkIndex]) return;

      const chunkKey = `${book.id}_ch${targetChapterIndex}_ck${targetChunkIndex}`;
      if (prefetchingChunksRef.current.has(chunkKey)) return;

      prefetchingChunksRef.current.add(chunkKey);
      try {
        await fetchTTSAudio(
          chapter.chunks[targetChunkIndex].text,
          settings,
          {
            bookId: book.id,
            chapterIndex: targetChapterIndex,
            chunkIndex: targetChunkIndex,
          }
        );
        if (targetChapterIndex === currentChapterIndex) {
          setChunkStatuses(prev => ({ ...prev, [targetChunkIndex]: 'ready' }));
        }
      } catch (err) {
        console.warn(`Lỗi khi prefetch chunk ${targetChunkIndex}:`, err);
      } finally {
        prefetchingChunksRef.current.delete(chunkKey);
      }
    },
    [book, settings, currentChapterIndex]
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
      setIsLoading(true);
      setCurrentChapterIndex(chapIdx);
      setCurrentChunkIndex(chunkIdx);

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

        // Clean up previous blob URL
        if (currentBlobUrlRef.current) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
        }

        const blobUrl = URL.createObjectURL(audioBlob);
        currentBlobUrlRef.current = blobUrl;

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

        // Clear any pending prefetch
        if (prefetchTimeoutRef.current) {
          clearTimeout(prefetchTimeoutRef.current);
          prefetchTimeoutRef.current = null;
        }

        // Trigger delayed prefetch for next chunk (wait 2500ms so current chunk is well underway)
        if (settings.enablePrefetch !== false) {
          prefetchTimeoutRef.current = setTimeout(() => {
            if (chunkIdx + 1 < chapter.chunks.length) {
              prefetchChunk(chapIdx, chunkIdx + 1);
            } else if (autoNext && chapIdx + 1 < book.chapters.length) {
              prefetchChunk(chapIdx + 1, 0);
            }
          }, 2500);
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
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = null;
      }
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
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = null;
      }
      setCurrentChapterIndex(chapterIndex);
      setCurrentChunkIndex(0);
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
  };
}
