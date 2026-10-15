'use client';

import { useEffect, useRef } from 'react';
import { EpubBook } from '@/domain';

interface UseMediaSessionProps {
  book: EpubBook | null;
  currentChapterIndex: number;
  currentChunkIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  onPlay: () => void;
  onPause: () => void;
  onPrevChunk: () => void;
  onNextChunk: () => void;
  onSkipRelative: (seconds: number) => void;
  onSeek?: (seconds: number) => void;
}

export function useMediaSession({
  book,
  currentChapterIndex,
  currentChunkIndex,
  isPlaying,
  currentTime,
  duration,
  playbackSpeed,
  onPlay,
  onPause,
  onPrevChunk,
  onNextChunk,
  onSkipRelative,
  onSeek,
}: UseMediaSessionProps) {
  const callbacksRef = useRef({
    onPlay,
    onPause,
    onPrevChunk,
    onNextChunk,
    onSkipRelative,
    onSeek,
  });

  const lastPositionUpdateRef = useRef<number>(0);
  const lastReportedTimeRef = useRef<number>(0);
  const lastChapterChunkRef = useRef<{ chapter: number; chunk: number }>({
    chapter: currentChapterIndex,
    chunk: currentChunkIndex,
  });
  const lastPlayingRef = useRef<boolean>(isPlaying);

  useEffect(() => {
    callbacksRef.current = {
      onPlay,
      onPause,
      onPrevChunk,
      onNextChunk,
      onSkipRelative,
      onSeek,
    };
  });

  // 1. Sync MediaMetadata when book, chapter, or chunk changes
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    if (!book) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const currentChapter = book.chapters[currentChapterIndex];
    const totalChunks = currentChapter ? currentChapter.chunks.length : 0;
    const title = currentChapter
      ? `${currentChapter.title} - Đoạn ${currentChunkIndex + 1}/${totalChunks}`
      : book.title;
    const artist = book.author || 'Tác giả không xác định';
    const album = book.title;

    const origin = window.location.origin;
    const toAbsoluteUrl = (url: string) => {
      if (
        url.startsWith('http://') ||
        url.startsWith('https://') ||
        url.startsWith('data:') ||
        url.startsWith('blob:')
      ) {
        return url;
      }
      return new URL(url, origin).href;
    };

    const raw192 = book.coverUrl || '/icons/icon-192x192.png';
    const raw512 = book.coverUrl || '/icons/icon-512x512.png';

    const artwork: MediaImage[] = [
      {
        src: toAbsoluteUrl(raw192),
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: toAbsoluteUrl(raw512),
        sizes: '512x512',
        type: 'image/png',
      },
    ];

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title,
        artist,
        album,
        artwork,
      });
    } catch (e) {
      console.warn('Failed to set MediaMetadata', e);
    }
  }, [book, currentChapterIndex, currentChunkIndex]);

  // 2. Register persistent MediaSession Action Handlers once on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      [
        'play',
        () => {
          try {
            navigator.mediaSession.playbackState = 'playing';
          } catch {}
          callbacksRef.current.onPlay();
        },
      ],
      [
        'pause',
        () => {
          try {
            navigator.mediaSession.playbackState = 'paused';
          } catch {}
          callbacksRef.current.onPause();
        },
      ],
      [
        'seekbackward',
        details => callbacksRef.current.onSkipRelative(-(details.seekOffset || 10)),
      ],
      [
        'seekforward',
        details => callbacksRef.current.onSkipRelative(details.seekOffset || 10),
      ],
      [
        'seekto',
        details => {
          if (details.seekTime !== undefined && callbacksRef.current.onSeek) {
            callbacksRef.current.onSeek(details.seekTime);
          }
        },
      ],
      [
        'previoustrack',
        () => {
          callbacksRef.current.onPrevChunk();
        },
      ],
      [
        'nexttrack',
        () => {
          callbacksRef.current.onNextChunk();
        },
      ],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Browser might not support certain optional media session actions
      }
    }

    // Clean up only when the component unmounts
    return () => {
      for (const [action] of actionHandlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // 3. Sync Playback State
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {
      // ignore
    }
  }, [isPlaying]);

  // 4. Sync Position State for Lock Screen Timeline with minimum 500ms throttle
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('mediaSession' in navigator) ||
      !('setPositionState' in navigator.mediaSession)
    ) {
      return;
    }

    if (duration > 0 && currentTime >= 0 && Number.isFinite(duration)) {
      const now = Date.now();
      const isChunkChanged =
        currentChapterIndex !== lastChapterChunkRef.current.chapter ||
        currentChunkIndex !== lastChapterChunkRef.current.chunk;
      const isExplicitSeek = Math.abs(currentTime - lastReportedTimeRef.current) > 2.0;
      const isPlaybackStateChanged = isPlaying !== lastPlayingRef.current;
      const isThrottled = now - lastPositionUpdateRef.current >= 500;

      if (isChunkChanged || isExplicitSeek || isPlaybackStateChanged || isThrottled) {
        lastPositionUpdateRef.current = now;
        lastReportedTimeRef.current = currentTime;
        lastChapterChunkRef.current = {
          chapter: currentChapterIndex,
          chunk: currentChunkIndex,
        };
        lastPlayingRef.current = isPlaying;

        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(duration, 0.1),
            playbackRate: isPlaying ? Math.max(0.25, Math.min(3.0, playbackSpeed || 1.0)) : 0,
            position: Math.min(Math.max(0, currentTime), duration),
          });
        } catch {
          // Can throw if position > duration due to minor float timing jitter
        }
      }
    }
  }, [currentTime, duration, playbackSpeed, currentChapterIndex, currentChunkIndex, isPlaying]);
}
