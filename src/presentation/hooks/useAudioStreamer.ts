'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChunkStatus, EpubBook, TTSSettings, estimateSpeechDuration } from '@/domain';
import {
  AbortActiveStreamUseCase,
  StreamAndPlayChunkUseCase,
} from '@/application';
import { IndexedDBAudioCache, WebAudioStreamPlayer } from '@/infrastructure';
import { useMediaSession } from './useMediaSession';

// Sliding window prefetch constants: 800-1200 characters corresponds to ~50-75 seconds of audio buffer
const MIN_PREFETCH_CHARS = 800;
const MAX_PREFETCH_CHARS = 1200;

/**
 * Calculates the cumulative character count of queued chunks ahead of the playhead
 * (strictly after currentChunkIndex up to and including targetChunkIndex).
 */
function calculateForwardBufferedChars(
  currentChapIdx: number,
  currentChunkIdx: number,
  targetChapIdx: number,
  targetChunkIdx: number,
  book: EpubBook | null
): number {
  if (!book) return 0;
  let totalChars = 0;
  let curChap = currentChapIdx;
  let curChunk = currentChunkIdx;

  while (true) {
    if (curChap > targetChapIdx || (curChap === targetChapIdx && curChunk >= targetChunkIdx)) {
      break;
    }

    const chapter = book.chapters[curChap];
    if (!chapter) break;

    if (curChunk + 1 < chapter.chunks.length) {
      curChunk++;
    } else if (curChap + 1 < book.chapters.length) {
      curChap++;
      curChunk = 0;
    } else {
      break;
    }

    const targetChapter = book.chapters[curChap];
    if (targetChapter && targetChapter.chunks[curChunk]) {
      const c = targetChapter.chunks[curChunk];
      totalChars += c.charCount || c.text.length;
    }
  }

  return totalChars;
}

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
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [bufferingChunk, setBufferingChunk] = useState<{ chapterIndex: number; chunkIndex: number } | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [autoNext, setAutoNext] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('epub_tts_auto_next');
    return saved !== null ? saved === 'true' : true;
  });
  const [chunkStatuses, setChunkStatuses] = useState<Record<number, ChunkStatus>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chunkDurations, setChunkDurations] = useState<Record<string, number>>({});
  const [volume, setVolumeState] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Stable service singletons via useState lazy initialization (React 19 compliant)
  const [audioPlayer] = useState(() => new WebAudioStreamPlayer());
  const [audioCache] = useState(() => new IndexedDBAudioCache());

  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const isStreamingNetworkRef = useRef<boolean>(false);
  const [latestQueuedTarget, setLatestQueuedTarget] = useState<{ chapterIndex: number; chunkIndex: number } | null>(null);
  const latestQueuedTargetRef = useRef<{ chapterIndex: number; chunkIndex: number } | null>(null);

  const updateLatestQueuedTarget = useCallback((target: { chapterIndex: number; chunkIndex: number } | null) => {
    latestQueuedTargetRef.current = target;
    setLatestQueuedTarget(target);
  }, []);
  const isPausedByUserRef = useRef<boolean>(false);
  const pausedTargetChunkRef = useRef<{ chapterIndex: number; chunkIndex: number } | null>(null);

  const streamChunkRef = useRef<(chapIdx: number, chunkIdx: number, append: boolean) => Promise<void>>(
    async () => {}
  );

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

  // Stream chunk internal implementation
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

      // If starting fresh (user click or skip), abort previous and reset player
      if (!append) {
        abortUseCase.execute(activeAbortControllerRef.current);
        audioPlayer.ensureAudioElementPlaying?.();
        setCurrentChapterIndex(chapIdx);
        setCurrentChunkIndex(chunkIdx);
        saveProgress(chapIdx, chunkIdx);
        updateLatestQueuedTarget({ chapterIndex: chapIdx, chunkIndex: chunkIdx });
        setIsLoading(true);
        setChunkStatuses({ [chunkIdx]: 'loading' });

        const charCount = chapter.chunks[chunkIdx].charCount || chapter.chunks[chunkIdx].text.length;
        const est = estimateSpeechDuration(charCount, 16);
        setEstimatedDuration(est);
        setDuration(est);
        setCurrentTime(0);
        setBufferedTime(0);
      }

      const controller = new AbortController();
      activeAbortControllerRef.current = controller;
      isStreamingNetworkRef.current = true;
      setIsBuffering(true);
      setBufferingChunk({ chapterIndex: chapIdx, chunkIndex: chunkIdx });

      try {
        const text = chapter.chunks[chunkIdx].text;

        await streamAndPlayUseCase.execute({
          text,
          settings,
          cacheInfo: {
            bookId: book.id,
            chapterIndex: chapIdx,
            chunkIndex: chunkIdx,
            isParagraphEnd: chapter.chunks[chunkIdx]?.isParagraphEnd,
          },
          append,
          signal: controller.signal,
          onFirstData: () => {
            if (controller.signal.aborted) return;
            // First audio packet arrived (~300ms lead-in): audio output starts immediately!
            if (!isPausedByUserRef.current) {
              audioPlayer.ensureAudioElementPlaying?.();
              setIsPlaying(true);
              if (!append && chapIdx === currentChapterIndex) {
                setChunkStatuses(prev => ({
                  ...prev,
                  [chunkIdx]: 'playing',
                }));
              }
            }
            if (!append) {
              setIsLoading(false);
            }
          },
          onNetworkDone: () => {
            // Network stream for this chunk is completed
            isStreamingNetworkRef.current = false;
            const actualChunkDur = audioPlayer.getChunkDuration?.(chapIdx, chunkIdx);
            if (actualChunkDur && actualChunkDur > 0) {
              setChunkDurations(prev => ({
                ...prev,
                [`${chapIdx}:${chunkIdx}`]: actualChunkDur,
              }));
            }
            const actual = audioPlayer.getDuration();
            if (actual > 0) {
              setEstimatedDuration(actual);
              setDuration(actual);
            }

            // Mark completed chunk as ready (if not currently the active playing chunk)
            if (chapIdx === currentChapterIndex) {
              setChunkStatuses(prev => ({
                ...prev,
                [chunkIdx]: prev[chunkIdx] === 'playing' ? 'playing' : 'ready',
              }));
            }

            const currentTarget = latestQueuedTargetRef.current;
            if (
              currentTarget &&
              currentTarget.chapterIndex === chapIdx &&
              currentTarget.chunkIndex === chunkIdx
            ) {
              // Calculate cumulative forward buffered characters from playhead to latest target
              const forwardChars = calculateForwardBufferedChars(
                currentChapterIndex,
                currentChunkIndex,
                chapIdx,
                chunkIdx,
                book
              );

              // If forward buffer is below the target minimum threshold, continue prefetching
              if (forwardChars < MIN_PREFETCH_CHARS) {
                const next = getNextTarget(chapIdx, chunkIdx);
                if (next) {
                  updateLatestQueuedTarget(next);
                  setBufferingChunk(next);
                  setIsBuffering(true);
                  if (next.chapterIndex === currentChapterIndex) {
                    setChunkStatuses(prev => ({
                      ...prev,
                      [next.chunkIndex]: 'loading',
                    }));
                  }
                  streamChunkRef.current(next.chapterIndex, next.chunkIndex, true);
                  return;
                }
              }

              // Threshold reached (>= MIN_PREFETCH_CHARS) or reached end of book
              setBufferingChunk(null);
              setIsBuffering(false);
            } else {
              setBufferingChunk(null);
              setIsBuffering(false);
            }
          },
        });

        if (controller.signal.aborted) {
          return;
        }

        // If not paused by user, ensure playing status for manual/initial plays
        if (!isPausedByUserRef.current && !append) {
          setIsPlaying(true);
        }
        if (!append) {
          setIsLoading(false);
        }
        if (chapIdx === currentChapterIndex) {
          setChunkStatuses(prev => ({
            ...prev,
            [chunkIdx]: append
              ? (prev[chunkIdx] || 'ready')
              : (isPausedByUserRef.current ? 'ready' : 'playing'),
          }));
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        isStreamingNetworkRef.current = false;
        setIsBuffering(false);
        setBufferingChunk(null);
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
    [book, settings, onOpenSettings, abortUseCase, saveProgress, streamAndPlayUseCase, getNextTarget, audioPlayer]
  );

  useEffect(() => {
    streamChunkRef.current = streamChunkInternal;
  }, [streamChunkInternal]);

  // Play a specific chunk from the beginning (manual user interaction)
  const playChunk = useCallback(
    (chapIdx: number, chunkIdx: number) => {
      // Synchronous user-gesture unlock for Chrome Android audio focus & notification
      audioPlayer.init();
      audioPlayer.ensureAudioElementPlaying?.();

      isPausedByUserRef.current = false;
      pausedTargetChunkRef.current = null;
      streamChunkInternal(chapIdx, chunkIdx, false);
    },
    [audioPlayer, streamChunkInternal]
  );

  // Retry action for recoverable errors
  const retryActiveStream = useCallback(() => {
    setErrorMessage(null);
    playChunk(currentChapterIndex, currentChunkIndex);
  }, [playChunk, currentChapterIndex, currentChunkIndex]);

  // Setup Player event listeners
  useEffect(() => {
    const unsubTime = audioPlayer.onTimeUpdate(t => {
      setCurrentTime(t);
      const actualD = audioPlayer.getDuration();
      if (actualD > 0) {
        setDuration(prev => Math.max(prev, actualD));
      }
      setBufferedTime(audioPlayer.getBufferedTime());
    });

    // Synchronized chunk boundary transitions: update UI highlight gaplessly
    const unsubChunkChange = audioPlayer.onChunkChange((chapIdx, chunkIdx) => {
      if (chapIdx !== currentChapterIndex) {
        setCurrentChapterIndex(chapIdx);
        setCurrentChunkIndex(chunkIdx);
        const newStatuses: Record<number, ChunkStatus> = { [chunkIdx]: 'playing' };
        if (latestQueuedTargetRef.current && latestQueuedTargetRef.current.chapterIndex === chapIdx) {
          for (let i = chunkIdx + 1; i <= latestQueuedTargetRef.current.chunkIndex; i++) {
            newStatuses[i] = 'ready';
          }
        }
        setChunkStatuses(newStatuses);
      } else {
        setCurrentChunkIndex(chunkIdx);
        setChunkStatuses(prev => ({
          ...prev,
          [chunkIdx]: 'playing',
        }));
      }
      saveProgress(chapIdx, chunkIdx);

      const chap = book?.chapters[chapIdx];
      if (chap && chap.chunks[chunkIdx]) {
        const est = estimateSpeechDuration(
          chap.chunks[chunkIdx].charCount || chap.chunks[chunkIdx].text.length,
          16
        );
        setEstimatedDuration(prev => Math.max(prev, est));
        setDuration(prev => Math.max(prev, est));
      }

      // Check if sliding forward buffer needs replenishment
      if (!isStreamingNetworkRef.current && latestQueuedTargetRef.current) {
        const target = latestQueuedTargetRef.current;
        const forwardChars = calculateForwardBufferedChars(
          chapIdx,
          chunkIdx,
          target.chapterIndex,
          target.chunkIndex,
          book
        );
        if (forwardChars < MIN_PREFETCH_CHARS) {
          const next = getNextTarget(target.chapterIndex, target.chunkIndex);
          if (next) {
            updateLatestQueuedTarget(next);
            setBufferingChunk(next);
            setIsBuffering(true);
            if (next.chapterIndex === chapIdx) {
              setChunkStatuses(prev => ({
                ...prev,
                [next.chunkIndex]: 'loading',
              }));
            }
            streamChunkRef.current(next.chapterIndex, next.chunkIndex, true);
          }
        }
      }
    });

    const unsubEnded = audioPlayer.onEnded(() => {
      // Audio queue has completely drained
      if (!isStreamingNetworkRef.current) {
        setIsPlaying(false);
        setCurrentTime(0);
        setIsBuffering(false);
      }
    });

    const unsubError = audioPlayer.onError(err => {
      setIsLoading(false);
      setIsPlaying(false);
      setIsBuffering(false);
      setErrorMessage(err.message);
    });

    return () => {
      unsubTime();
      unsubChunkChange();
      unsubEnded();
      unsubError();
    };
  }, [audioPlayer, saveProgress, book, currentChapterIndex, getNextTarget]);

  // Audio player playback state listener (Android notification / Bluetooth / OS events)
  useEffect(() => {
    if (!audioPlayer.onPlaybackStateChange) return;
    const unsubState = audioPlayer.onPlaybackStateChange(state => {
      if (state === 'paused') {
        setIsPlaying(false);
        isPausedByUserRef.current = true;
      } else if (state === 'playing') {
        setIsPlaying(true);
        isPausedByUserRef.current = false;
      } else if (state === 'idle') {
        setIsPlaying(false);
      }
    });
    return unsubState;
  }, [audioPlayer]);

  // Chapter chunk duration calculation
  const getChunkDuration = useCallback(
    (chapIdx: number, chunkIdx: number): number => {
      const key = `${chapIdx}:${chunkIdx}`;
      if (chunkDurations[key] !== undefined && chunkDurations[key] > 0) {
        return chunkDurations[key];
      }
      const playerDur = audioPlayer.getChunkDuration?.(chapIdx, chunkIdx);
      if (playerDur && playerDur > 0) {
        return playerDur;
      }
      const chap = book?.chapters[chapIdx];
      const chunk = chap?.chunks[chunkIdx];
      if (!chunk) return 1;
      const charCount = chunk.charCount || chunk.text.length;
      return estimateSpeechDuration(charCount, 16);
    },
    [book, chunkDurations, audioPlayer]
  );

  // Chapter timeline metrics
  const {
    chapterTotalDuration,
    chapterCurrentTime,
    chapterBufferedTime,
    forwardBufferSeconds,
    isChapterFullyBuffered,
  } = useMemo(() => {
    const chap = book?.chapters[currentChapterIndex];
    const numChunks = chap?.chunks.length || 0;
    if (numChunks === 0) {
      return {
        chapterTotalDuration: 1,
        chapterCurrentTime: 0,
        chapterBufferedTime: 0,
        forwardBufferSeconds: 0,
        isChapterFullyBuffered: false,
      };
    }

    let totalDuration = 0;
    let pastChunksDuration = 0;
    const durations: number[] = [];

    for (let i = 0; i < numChunks; i++) {
      const d = getChunkDuration(currentChapterIndex, i);
      durations.push(d);
      totalDuration += d;
      if (i < currentChunkIndex) {
        pastChunksDuration += d;
      }
    }

    totalDuration = Math.max(1, totalDuration);

    // Within-chunk progress
    const withinChunk = audioPlayer.getActiveChunkTime ? audioPlayer.getActiveChunkTime() : 0;
    const currentChunkDur = durations[currentChunkIndex] || 1;
    const clampedWithinChunk = Math.max(0, Math.min(withinChunk, currentChunkDur));
    const currTime = Math.min(totalDuration, pastChunksDuration + clampedWithinChunk);

    // Chapter buffered time
    let buffTime = currTime;
    const target = latestQueuedTarget;
    if (target) {
      if (target.chapterIndex > currentChapterIndex) {
        buffTime = totalDuration;
      } else if (target.chapterIndex === currentChapterIndex) {
        let sumQueued = 0;
        for (let i = 0; i <= Math.min(target.chunkIndex, numChunks - 1); i++) {
          sumQueued += durations[i] || 0;
        }
        buffTime = Math.max(currTime, Math.min(totalDuration, sumQueued));
      }
    }

    const fwdBuffer = Math.max(0, buffTime - currTime);
    const fullyBuffered = buffTime >= totalDuration - 0.5;

    return {
      chapterTotalDuration: totalDuration,
      chapterCurrentTime: currTime,
      chapterBufferedTime: buffTime,
      forwardBufferSeconds: fwdBuffer,
      isChapterFullyBuffered: fullyBuffered,
    };
  }, [book, currentChapterIndex, currentChunkIndex, currentTime, getChunkDuration, audioPlayer, latestQueuedTarget]);

  // Explicit Pause Audio
  const pauseAudio = useCallback(() => {
    isPausedByUserRef.current = true;
    setIsPlaying(false);
    pausedTargetChunkRef.current = {
      chapterIndex: currentChapterIndex,
      chunkIndex: currentChunkIndex,
    };
    audioPlayer.pause();
  }, [audioPlayer, currentChapterIndex, currentChunkIndex]);

  // Explicit Resume Audio
  const resumeAudio = useCallback(async () => {
    setErrorMessage(null);

    if (
      pausedTargetChunkRef.current &&
      (pausedTargetChunkRef.current.chapterIndex !== currentChapterIndex ||
        pausedTargetChunkRef.current.chunkIndex !== currentChunkIndex)
    ) {
      const target = pausedTargetChunkRef.current;
      pausedTargetChunkRef.current = null;
      isPausedByUserRef.current = false;
      playChunk(target.chapterIndex, target.chunkIndex);
      return;
    }

    // Check buffer expiration/depletion
    const isExpired = audioPlayer.isBufferExpired
      ? audioPlayer.isBufferExpired()
      : audioPlayer.getRemainingBufferedTime() <= 0.1;

    if (isExpired) {
      isPausedByUserRef.current = false;
      playChunk(currentChapterIndex, currentChunkIndex);
      return;
    }

    try {
      await audioPlayer.play();
      isPausedByUserRef.current = false;
      setIsPlaying(true);
    } catch (err: unknown) {
      console.warn('Resume audio failed:', err);
      isPausedByUserRef.current = true;
      setIsPlaying(false);
      const msg = err instanceof Error ? err.message : 'Không thể tiếp tục phát âm thanh';
      setErrorMessage(msg);
    }
  }, [audioPlayer, currentChapterIndex, currentChunkIndex, playChunk]);

  // Play / Pause toggle
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseAudio();
    } else {
      audioPlayer.init();
      audioPlayer.ensureAudioElementPlaying?.();
      resumeAudio();
    }
  }, [isPlaying, audioPlayer, pauseAudio, resumeAudio]);

  // Jump to chapter
  const selectChapter = useCallback(
    (chapterIndex: number, startPlayImmediately = false) => {
      isPausedByUserRef.current = false;
      pausedTargetChunkRef.current = null;
      abortUseCase.execute(activeAbortControllerRef.current);
      activeAbortControllerRef.current = null;
      isStreamingNetworkRef.current = false;
      setIsBuffering(false);
      updateLatestQueuedTarget(null);

      audioPlayer.stop();
      setCurrentChapterIndex(chapterIndex);
      setCurrentChunkIndex(0);
      saveProgress(chapterIndex, 0);
      setCurrentTime(0);
      setBufferedTime(0);
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

  const nextChunk = useCallback(() => {
    if (!book) return;
    const currentChapter = book.chapters[currentChapterIndex];
    if (!currentChapter) return;
    if (currentChunkIndex + 1 < currentChapter.chunks.length) {
      playChunk(currentChapterIndex, currentChunkIndex + 1);
    } else if (currentChapterIndex + 1 < book.chapters.length) {
      selectChapter(currentChapterIndex + 1, true);
    }
  }, [book, currentChapterIndex, currentChunkIndex, playChunk, selectChapter]);

  const prevChunk = useCallback(() => {
    if (!book) return;
    if (currentChunkIndex > 0) {
      playChunk(currentChapterIndex, currentChunkIndex - 1);
    } else if (currentChapterIndex > 0) {
      const prevChap = book.chapters[currentChapterIndex - 1];
      const lastChunkIdx = prevChap && prevChap.chunks.length > 0 ? prevChap.chunks.length - 1 : 0;
      selectChapter(currentChapterIndex - 1, false);
      playChunk(currentChapterIndex - 1, lastChunkIdx);
    }
  }, [book, currentChapterIndex, currentChunkIndex, playChunk, selectChapter]);

  const seekChapterTime = useCallback(
    (targetSeconds: number) => {
      if (!book) return;
      const currentChapter = book.chapters[currentChapterIndex];
      if (!currentChapter || currentChapter.chunks.length === 0) return;

      let accumulated = 0;
      let targetChunk = 0;
      for (let i = 0; i < currentChapter.chunks.length; i++) {
        const d = getChunkDuration(currentChapterIndex, i);
        if (targetSeconds < accumulated + d || i === currentChapter.chunks.length - 1) {
          targetChunk = i;
          break;
        }
        accumulated += d;
      }

      playChunk(currentChapterIndex, targetChunk);
    },
    [book, currentChapterIndex, getChunkDuration, playChunk]
  );

  const seekTime = useCallback(
    (time: number) => {
      seekChapterTime(time);
    },
    [seekChapterTime]
  );

  const skipRelative = useCallback(
    (seconds: number) => {
      const newTime = Math.max(0, Math.min(chapterCurrentTime + seconds, chapterTotalDuration));
      seekChapterTime(newTime);
    },
    [chapterCurrentTime, chapterTotalDuration, seekChapterTime]
  );

  // Connect Media Session API for Notification and Lock Screen controls
  useMediaSession({
    book,
    currentChapterIndex,
    currentChunkIndex,
    isPlaying,
    currentTime: chapterCurrentTime,
    duration: chapterTotalDuration,
    playbackSpeed: settings.speed,
    onPlay: resumeAudio,
    onPause: pauseAudio,
    onPrevChunk: prevChunk,
    onNextChunk: nextChunk,
    onSkipRelative: skipRelative,
    onSeek: seekChapterTime,
  });

  const setVolume = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolumeState(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
    audioPlayer.setVolume?.(clamped);
  }, [audioPlayer, isMuted]);

  const adjustVolume = useCallback((delta: number) => {
    setVolumeState(prev => {
      const clamped = Math.max(0, Math.min(1, Math.round((prev + delta) * 100) / 100));
      if (clamped > 0 && isMuted) {
        setIsMuted(false);
      }
      audioPlayer.setVolume?.(clamped);
      return clamped;
    });
  }, [audioPlayer, isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (next) {
        audioPlayer.setVolume?.(0);
      } else {
        audioPlayer.setVolume?.(volume);
      }
      return next;
    });
  }, [audioPlayer, volume]);

  // Contextual chunk click handler: if active chunk, toggle pause/play; otherwise play target chunk
  const handleChunkClick = useCallback(
    (chapIdx: number, chunkIdx: number) => {
      audioPlayer.init();
      audioPlayer.ensureAudioElementPlaying?.();
      if (chapIdx === currentChapterIndex && chunkIdx === currentChunkIndex) {
        togglePlayPause();
      } else {
        playChunk(chapIdx, chunkIdx);
      }
    },
    [audioPlayer, currentChapterIndex, currentChunkIndex, togglePlayPause, playChunk]
  );

  return {
    volume,
    isMuted,
    setVolume,
    adjustVolume,
    toggleMute,
    currentChapterIndex,
    currentChunkIndex,
    isPlaying,
    isLoading,
    isBuffering,
    bufferingChunk,
    currentTime: chapterCurrentTime,
    duration: chapterTotalDuration,
    estimatedDuration: chapterTotalDuration,
    bufferedTime: chapterBufferedTime,
    chapterCurrentTime,
    chapterTotalDuration,
    chapterBufferedTime,
    forwardBufferSeconds,
    isChapterFullyBuffered,
    autoNext,
    chunkStatuses,
    errorMessage,
    setErrorMessage,
    togglePlayPause,
    pauseAudio,
    resumeAudio,
    selectChapter,
    nextChapter,
    prevChapter,
    nextChunk,
    prevChunk,
    seekTime: seekChapterTime,
    seekChapterTime,
    skipRelative,
    toggleAutoNext,
    playChunk,
    handleChunkClick,
    retryActiveStream,
  };
}
