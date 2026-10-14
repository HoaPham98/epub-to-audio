'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChunkStatus, EpubBook, TTSSettings } from '@/domain';
import {
  AbortActiveStreamUseCase,
  StreamAndPlayChunkUseCase,
} from '@/application';
import { IndexedDBAudioCache, WebAudioStreamPlayer } from '@/infrastructure';

interface UseAudioStreamerProps {
  book: EpubBook | null;
  settings: TTSSettings;
  onOpenSettings: () => void;
}

export function useAudioStreamer({ book, settings, onOpenSettings }: UseAudioStreamerProps) {
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [autoNext, setAutoNext] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('epub_tts_auto_next');
    return saved !== null ? saved === 'true' : true;
  });
  const [chunkStatuses, setChunkStatuses] = useState<Record<number, ChunkStatus>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stable service singletons via useState lazy initialization (React 19 compliant)
  const [audioPlayer] = useState(() => new WebAudioStreamPlayer());
  const [audioCache] = useState(() => new IndexedDBAudioCache());

  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const isStreamingNetworkRef = useRef<boolean>(false);
  const latestQueuedTargetRef = useRef<{ chapterIndex: number; chunkIndex: number } | null>(null);
  const streamChunkRef = useRef<(chapIdx: number, chunkIdx: number, append: boolean) => Promise<void>>(async () => {});

  const streamAndPlayUseCase = useMemo(
    () => new StreamAndPlayChunkUseCase(audioPlayer, audioCache),
    [audioPlayer, audioCache]
  );
  const abortUseCase = useMemo(
    () => new AbortActiveStreamUseCase(audioPlayer),
    [audioPlayer]
  );

  // Speed sync
  useEffect(() => {
    audioPlayer.setSpeed(settings.speed);
  }, [audioPlayer, settings.speed]);

  const saveProgress = useCallback(
    (chapIdx: number, chunkIdx: number) => {
      if (!book) return;
      try {
        localStorage.setItem(
          `epub_progress_${book.id}`,
          JSON.stringify({ chapterIndex: chapIdx, chunkIndex: chunkIdx, timestamp: Date.now() })
        );
      } catch (e) {
        console.warn('Failed to save progress', e);
      }
    },
    [book]
  );

  // Restore reading progress when book changes
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
          const chap = book.chapters[chapterIndex];
          const validChunk =
            typeof chunkIndex === 'number' && chap && chunkIndex >= 0 && chunkIndex < chap.chunks.length
              ? chunkIndex
              : 0;
          queueMicrotask(() => {
            setCurrentChapterIndex(chapterIndex);
            setCurrentChunkIndex(validChunk);
          });
        }
      }
    } catch (e) {
      console.warn('Failed to restore progress', e);
    }
  }, [book]);

  const toggleAutoNext = useCallback(() => {
    setAutoNext(prev => {
      const nextVal = !prev;
      localStorage.setItem('epub_tts_auto_next', String(nextVal));
      return nextVal;
    });
  }, []);

  // Compute next chunk coordinates
  const getNextTarget = useCallback(
    (chapIdx: number, chunkIdx: number): { chapterIndex: number; chunkIndex: number } | null => {
      if (!book) return null;
      const chapter = book.chapters[chapIdx];
      if (!chapter) return null;

      if (chunkIdx + 1 < chapter.chunks.length) {
        return { chapterIndex: chapIdx, chunkIndex: chunkIdx + 1 };
      }
      if (autoNext && chapIdx + 1 < book.chapters.length) {
        return { chapterIndex: chapIdx + 1, chunkIndex: 0 };
      }
      return null;
    },
    [book, autoNext]
  );

  // Stream subsequent chunk seamlessly with append=true
  const streamChunkInternal = useCallback(
    async (
      chapIdx: number,
      chunkIdx: number,
      append: boolean
    ) => {
      if (!book) return;
      const chapter = book.chapters[chapIdx];
      if (!chapter || !chapter.chunks[chunkIdx]) return;

      if (
        !settings.apiKey &&
        !settings.endpoint.includes('localhost') &&
        !settings.endpoint.includes('127.0.0.1')
      ) {
        setErrorMessage('Vui lòng thiết lập API Key trong Cài đặt để phát âm thanh.');
        onOpenSettings();
        return;
      }

      setErrorMessage(null);

      // If starting fresh (user click), abort any active stream and reset player
      if (!append) {
        abortUseCase.execute(activeAbortControllerRef.current);
        setCurrentChapterIndex(chapIdx);
        setCurrentChunkIndex(chunkIdx);
        saveProgress(chapIdx, chunkIdx);
        latestQueuedTargetRef.current = { chapterIndex: chapIdx, chunkIndex: chunkIdx };
        setIsLoading(true);
        setChunkStatuses({ [chunkIdx]: 'loading' });
      }

      const controller = new AbortController();
      activeAbortControllerRef.current = controller;
      isStreamingNetworkRef.current = true;

      try {
        const text = chapter.chunks[chunkIdx].text;

        await streamAndPlayUseCase.execute({
          text,
          settings,
          cacheInfo: {
            bookId: book.id,
            chapterIndex: chapIdx,
            chunkIndex: chunkIdx,
          },
          append,
          signal: controller.signal,
          onNetworkDone: () => {
            // Network stream for this chunk is finished. Server slot is now free!
            isStreamingNetworkRef.current = false;

            // Immediately chain the next chunk if auto-chaining is active and we are still playing
            const currentTarget = latestQueuedTargetRef.current;
            if (
              currentTarget &&
              currentTarget.chapterIndex === chapIdx &&
              currentTarget.chunkIndex === chunkIdx
            ) {
              const next = getNextTarget(chapIdx, chunkIdx);
              if (next) {
                latestQueuedTargetRef.current = next;
                // Strict sequential chaining: chunk N+1 streams immediately with 0 queue wait
                streamChunkRef.current(next.chapterIndex, next.chunkIndex, true);
              }
            }
          },
        });

        if (controller.signal.aborted) {
          return;
        }

        setIsPlaying(true);
        setIsLoading(false);
        setChunkStatuses(prev => ({
          ...prev,
          [chunkIdx]: 'playing',
        }));
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        isStreamingNetworkRef.current = false;
        console.error('Stream chunk error:', err);
        const msg = err instanceof Error ? err.message : 'Lỗi khi gọi API TTS';
        setErrorMessage(msg);
        setChunkStatuses(prev => ({
          ...prev,
          [chunkIdx]: 'error',
        }));
        setIsPlaying(false);
        setIsLoading(false);
      }
    },
    [book, settings, onOpenSettings, abortUseCase, saveProgress, streamAndPlayUseCase, getNextTarget]
  );

  useEffect(() => {
    streamChunkRef.current = streamChunkInternal;
  }, [streamChunkInternal]);

  // Play a specific chunk from the beginning (manual user interaction)
  const playChunk = useCallback(
    (chapIdx: number, chunkIdx: number) => {
      streamChunkInternal(chapIdx, chunkIdx, false);
    },
    [streamChunkInternal]
  );

  // Setup Player event listeners
  useEffect(() => {
    const unsubTime = audioPlayer.onTimeUpdate(t => {
      setCurrentTime(t);
      const d = audioPlayer.getDuration();
      setDuration(d);
    });

    // Synchronized chunk boundary transitions: update UI highlight gaplessly
    const unsubChunkChange = audioPlayer.onChunkChange((chapIdx, chunkIdx) => {
      setCurrentChapterIndex(chapIdx);
      setCurrentChunkIndex(chunkIdx);
      saveProgress(chapIdx, chunkIdx);
      setChunkStatuses(prev => ({
        ...prev,
        [chunkIdx]: 'playing',
      }));
    });

    const unsubEnded = audioPlayer.onEnded(() => {
      // Audio queue has completely drained
      if (!isStreamingNetworkRef.current) {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    });

    const unsubError = audioPlayer.onError(err => {
      setIsLoading(false);
      setIsPlaying(false);
      setErrorMessage(err.message);
    });

    return () => {
      unsubTime();
      unsubChunkChange();
      unsubEnded();
      unsubError();
    };
  }, [audioPlayer, saveProgress]);

  // Play / Pause toggle
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      audioPlayer.pause();
      abortUseCase.execute(activeAbortControllerRef.current);
      isStreamingNetworkRef.current = false;
      setIsPlaying(false);
    } else {
      if (audioPlayer.getDuration() > 0 && currentTime < audioPlayer.getDuration()) {
        audioPlayer.play().then(() => {
          setIsPlaying(true);
          // If buffered time is running low, resume next chunk stream
          if (
            !isStreamingNetworkRef.current &&
            audioPlayer.getRemainingBufferedTime() < 2.0 &&
            latestQueuedTargetRef.current
          ) {
            const next = getNextTarget(
              latestQueuedTargetRef.current.chapterIndex,
              latestQueuedTargetRef.current.chunkIndex
            );
            if (next) {
              latestQueuedTargetRef.current = next;
              streamChunkInternal(next.chapterIndex, next.chunkIndex, true);
            }
          }
        });
      } else {
        playChunk(currentChapterIndex, currentChunkIndex);
      }
    }
  }, [
    isPlaying,
    audioPlayer,
    abortUseCase,
    currentTime,
    playChunk,
    currentChapterIndex,
    currentChunkIndex,
    getNextTarget,
    streamChunkInternal,
  ]);

  // Jump to chapter
  const selectChapter = useCallback(
    (chapterIndex: number, startPlayImmediately = false) => {
      abortUseCase.execute(activeAbortControllerRef.current);
      activeAbortControllerRef.current = null;
      isStreamingNetworkRef.current = false;
      latestQueuedTargetRef.current = null;

      audioPlayer.stop();
      setCurrentChapterIndex(chapterIndex);
      setCurrentChunkIndex(0);
      saveProgress(chapterIndex, 0);
      setCurrentTime(0);
      setChunkStatuses({});
      setIsPlaying(false);

      if (startPlayImmediately) {
        playChunk(chapterIndex, 0);
      }
    },
    [abortUseCase, audioPlayer, saveProgress, playChunk]
  );

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

  const seekTime = useCallback(
    (time: number) => {
      audioPlayer.seek(time);
      setCurrentTime(time);
    },
    [audioPlayer]
  );

  const skipRelative = useCallback(
    (seconds: number) => {
      const newTime = Math.max(0, Math.min(currentTime + seconds, duration));
      seekTime(newTime);
    },
    [currentTime, duration, seekTime]
  );

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
