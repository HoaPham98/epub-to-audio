import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioStreamer } from '@/presentation/hooks/useAudioStreamer';
import { EpubBook, TTSSettings } from '@/domain';

let mockPlayerInstance: {
  init: ReturnType<typeof vi.fn>;
  ensureAudioElementPlaying: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setSpeed: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  isBufferExpired: ReturnType<typeof vi.fn>;
  getRemainingBufferedTime: ReturnType<typeof vi.fn>;
  getDuration: ReturnType<typeof vi.fn>;
  getBufferedTime: ReturnType<typeof vi.fn>;
  getCurrentTime: ReturnType<typeof vi.fn>;
  getChunkDuration: ReturnType<typeof vi.fn>;
  onTimeUpdate: ReturnType<typeof vi.fn>;
  onChunkChange: ReturnType<typeof vi.fn>;
  onEnded: ReturnType<typeof vi.fn>;
  onError: ReturnType<typeof vi.fn>;
  onPlaybackStateChange: ReturnType<typeof vi.fn>;
  queuePcmChunk: ReturnType<typeof vi.fn>;
};

let lastStreamParams: {
  onFirstData?: () => void;
  onNetworkDone?: () => void;
  append?: boolean;
} | null = null;

let stateCallback: ((state: 'idle' | 'playing' | 'paused') => void) | null = null;
let errorCallback: ((err: Error) => void) | null = null;

vi.mock('@/infrastructure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure')>();
  return {
    ...actual,
    WebAudioStreamPlayer: vi.fn().mockImplementation(function () {
      return mockPlayerInstance;
    }),
    IndexedDBAudioCache: vi.fn().mockImplementation(function () {
      return {
        buildKey: vi.fn(),
        getAudio: vi.fn().mockResolvedValue(null),
        saveAudio: vi.fn().mockResolvedValue(undefined),
        deleteBook: vi.fn(),
        clear: vi.fn(),
      };
    }),
  };
});

vi.mock('@/application', () => {
  return {
    AbortActiveStreamUseCase: vi.fn().mockImplementation(function () {
      return {
        execute: vi.fn(),
      };
    }),
    StreamAndPlayChunkUseCase: vi.fn().mockImplementation(function () {
      return {
        execute: vi.fn().mockImplementation(async (params) => {
          lastStreamParams = params;
          return { fromCache: false };
        }),
      };
    }),
  };
});

describe('useAudioStreamer Hook - Confirmed State & Error Recovery', () => {
  const mockBook: EpubBook = {
    id: 'test-book-id',
    title: 'Test Book',
    author: 'Author',
    coverUrl: 'http://example.com/cover.jpg',
    chapters: [
      {
        id: 'chap-1',
        index: 0,
        title: 'Chapter 1',
        href: 'chap1.html',
        contentHtml: '<p>test</p>',
        rawText: 'test',
        chunks: [
          { id: 'chunk-0', index: 0, text: 'Sample chunk 1 text', charCount: 19 },
          { id: 'chunk-1', index: 1, text: 'Sample chunk 2 text', charCount: 19 },
        ],
      },
    ],
    totalChunks: 2,
    fileName: 'test.epub',
    fileSize: 1024,
    uploadedAt: Date.now(),
  };

  const mockSettings: TTSSettings = {
    endpoint: 'http://localhost:8000',
    apiKey: 'test-key',
    model: 'tts-1',
    voice: 'test-voice',
    responseFormat: 'pcm',
    speed: 1.0,
    useProxy: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    lastStreamParams = null;
    stateCallback = null;
    errorCallback = null;

    mockPlayerInstance = {
      init: vi.fn().mockResolvedValue(undefined),
      ensureAudioElementPlaying: vi.fn().mockResolvedValue(undefined),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      setSpeed: vi.fn(),
      setVolume: vi.fn(),
      isBufferExpired: vi.fn().mockReturnValue(false),
      getRemainingBufferedTime: vi.fn().mockReturnValue(10),
      getDuration: vi.fn().mockReturnValue(100),
      getBufferedTime: vi.fn().mockReturnValue(50),
      getCurrentTime: vi.fn().mockReturnValue(10),
      getChunkDuration: vi.fn().mockReturnValue(5),
      onTimeUpdate: vi.fn().mockReturnValue(() => {}),
      onChunkChange: vi.fn().mockReturnValue(() => {}),
      onEnded: vi.fn().mockReturnValue(() => {}),
      onError: vi.fn().mockImplementation((cb) => {
        errorCallback = cb;
        return () => {};
      }),
      onPlaybackStateChange: vi.fn().mockImplementation((cb) => {
        stateCallback = cb;
        return () => {};
      }),
      queuePcmChunk: vi.fn(),
    };

    vi.stubGlobal('MediaMetadata', function (this: unknown, init: unknown) {
      Object.assign(this as object, init);
    });

    vi.stubGlobal('navigator', {
      mediaSession: {
        metadata: null,
        playbackState: 'none',
        setActionHandler: vi.fn(),
        setPositionState: vi.fn(),
      },
    });

    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it('surfaces a rejected resume as a recoverable reader error without changing confirmed paused state', async () => {
    mockPlayerInstance.play.mockRejectedValueOnce(new Error('Audio device busy'));

    const { result } = renderHook(() =>
      useAudioStreamer({
        book: mockBook,
        settings: mockSettings,
        onOpenSettings: vi.fn(),
      })
    );

    // Initial state: paused
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.errorMessage).toBeNull();
    expect(navigator.mediaSession.playbackState).toBe('paused');

    // Attempt to resume audio
    await act(async () => {
      await result.current.resumeAudio();
    });

    // Error is surfaced to reader
    expect(result.current.errorMessage).toBe('Audio device busy');

    // Confirmed state remains paused
    expect(result.current.isPlaying).toBe(false);
    expect(navigator.mediaSession.playbackState).toBe('paused');
  });

  it('leaves reader and notification states paused when TTS data arrives while paused', async () => {
    const { result } = renderHook(() =>
      useAudioStreamer({
        book: mockBook,
        settings: mockSettings,
        onOpenSettings: vi.fn(),
      })
    );

    // Initial pause
    act(() => {
      result.current.pauseAudio();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(navigator.mediaSession.playbackState).toBe('paused');

    // Start playing a chunk (triggers stream)
    await act(async () => {
      result.current.playChunk(0, 0);
    });

    // User pauses while stream is in progress
    act(() => {
      result.current.pauseAudio();
    });

    expect(result.current.isPlaying).toBe(false);

    // Simulate first audio packet arriving from network
    act(() => {
      if (lastStreamParams?.onFirstData) {
        lastStreamParams.onFirstData();
      }
    });

    // Confirmed state MUST remain paused, notification remains paused
    expect(result.current.isPlaying).toBe(false);
    expect(navigator.mediaSession.playbackState).toBe('paused');
  });

  it('updates reader and notification state when player emits confirmed state changes', () => {
    const { result } = renderHook(() =>
      useAudioStreamer({
        book: mockBook,
        settings: mockSettings,
        onOpenSettings: vi.fn(),
      })
    );

    expect(stateCallback).not.toBeNull();

    // Player emits confirmed 'playing'
    act(() => {
      stateCallback!('playing');
    });

    expect(result.current.isPlaying).toBe(true);
    expect(navigator.mediaSession.playbackState).toBe('playing');

    // Player emits confirmed 'paused'
    act(() => {
      stateCallback!('paused');
    });

    expect(result.current.isPlaying).toBe(false);
    expect(navigator.mediaSession.playbackState).toBe('paused');
  });

  it('updates reader error message when player emits an error event', () => {
    const { result } = renderHook(() =>
      useAudioStreamer({
        book: mockBook,
        settings: mockSettings,
        onOpenSettings: vi.fn(),
      })
    );

    expect(errorCallback).not.toBeNull();

    act(() => {
      errorCallback!(new Error('Audio decoding error'));
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.errorMessage).toBe('Audio decoding error');
  });
});
