import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaSession } from '@/presentation/hooks/useMediaSession';
import { EpubBook } from '@/domain';

describe('useMediaSession Hook', () => {
  let mockSetPositionState: ReturnType<typeof vi.fn>;
  let mockSetActionHandler: ReturnType<typeof vi.fn>;

  const mockBook: EpubBook = {
    id: 'test-book-id',
    title: 'Test Book',
    author: 'Author',
    coverUrl: 'http://example.com/cover.jpg',
    chapters: [],
    totalChunks: 0,
    fileName: 'test.epub',
    fileSize: 1024,
    uploadedAt: Date.now(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockSetPositionState = vi.fn();
    mockSetActionHandler = vi.fn();

    vi.stubGlobal('MediaMetadata', function (this: unknown, init: unknown) {
      Object.assign(this as object, init);
    });

    vi.stubGlobal('navigator', {
      mediaSession: {
        metadata: null,
        playbackState: 'none',
        setActionHandler: mockSetActionHandler,
        setPositionState: mockSetPositionState,
      },
    });
  });

  it('sets playbackRate to 0 when paused to comply with W3C spec and Windows SMTC', () => {
    const { rerender } = renderHook(
      (props) =>
        useMediaSession({
          book: mockBook,
          currentChapterIndex: 0,
          currentChunkIndex: 0,
          isPlaying: props.isPlaying,
          currentTime: 10,
          duration: 100,
          playbackSpeed: 1.5,
          onPlay: vi.fn(),
          onPause: vi.fn(),
          onPrevChunk: vi.fn(),
          onNextChunk: vi.fn(),
          onSkipRelative: vi.fn(),
        }),
      {
        initialProps: { isPlaying: true },
      }
    );

    // When playing, playbackRate should match playbackSpeed
    expect(mockSetPositionState).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 100,
        position: 10,
        playbackRate: 1.5,
      })
    );

    mockSetPositionState.mockClear();

    // Rerender as paused
    rerender({ isPlaying: false });

    // When paused, playbackRate MUST be 0
    expect(mockSetPositionState).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 100,
        position: 10,
        playbackRate: 0,
      })
    );
    expect(navigator.mediaSession.playbackState).toBe('paused');
  });

  it('dispatches play and pause actions without optimistic state writes, updating playbackState only after confirmed events', () => {
    const onPlaySpy = vi.fn();
    const onPauseSpy = vi.fn();

    const { rerender } = renderHook(
      (props: { isPlaying: boolean }) =>
        useMediaSession({
          book: mockBook,
          currentChapterIndex: 0,
          currentChunkIndex: 0,
          isPlaying: props.isPlaying,
          currentTime: 10,
          duration: 100,
          playbackSpeed: 1.0,
          onPlay: onPlaySpy,
          onPause: onPauseSpy,
          onPrevChunk: vi.fn(),
          onNextChunk: vi.fn(),
          onSkipRelative: vi.fn(),
        }),
      {
        initialProps: { isPlaying: false },
      }
    );

    // Initial state is paused
    expect(navigator.mediaSession.playbackState).toBe('paused');

    // Find the registered 'play' action handler
    const playCall = mockSetActionHandler.mock.calls.find(call => call[0] === 'play');
    expect(playCall).toBeDefined();
    const playHandler = playCall![1];

    // Trigger the play handler
    act(() => {
      playHandler();
    });

    // onPlay callback dispatched
    expect(onPlaySpy).toHaveBeenCalledTimes(1);

    // CRITICAL: playbackState must NOT have been optimistically set to 'playing'
    expect(navigator.mediaSession.playbackState).toBe('paused');

    // State only transitions after confirmed player event updates isPlaying prop
    rerender({ isPlaying: true });
    expect(navigator.mediaSession.playbackState).toBe('playing');

    // Find the registered 'pause' action handler
    const pauseCall = mockSetActionHandler.mock.calls.find(call => call[0] === 'pause');
    expect(pauseCall).toBeDefined();
    const pauseHandler = pauseCall![1];

    // Trigger the pause handler
    act(() => {
      pauseHandler();
    });

    expect(onPauseSpy).toHaveBeenCalledTimes(1);

    // CRITICAL: playbackState must NOT have been optimistically set to 'paused'
    expect(navigator.mediaSession.playbackState).toBe('playing');

    // State only transitions after confirmed player event updates isPlaying prop
    rerender({ isPlaying: false });
    expect(navigator.mediaSession.playbackState).toBe('paused');
  });
});
