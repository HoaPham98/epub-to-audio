import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebAudioStreamPlayer } from '@/infrastructure/audio/WebAudioStreamPlayer';

describe('WebAudioStreamPlayer Background Audio Bridge & Pause Behavior', () => {
  let player: WebAudioStreamPlayer;
  let mockAudioElement: {
    id: string;
    style: Record<string, string>;
    setAttribute: ReturnType<typeof vi.fn>;
    preload: string;
    loop: boolean;
    src: string;
    paused: boolean;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let mockAudioContext: {
    state: string;
    currentTime: number;
    destination: Record<string, unknown>;
    suspend: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    createGain: ReturnType<typeof vi.fn>;
    decodeAudioData: ReturnType<typeof vi.fn>;
    createBufferSource: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockAudioElement = {
      id: 'background-audio-bridge',
      style: {},
      setAttribute: vi.fn(),
      preload: 'auto',
      loop: true,
      src: '/silence-10s.wav',
      paused: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockImplementation(() => {
        mockAudioElement.paused = true;
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockAudioContext = {
      state: 'running',
      currentTime: 10,
      destination: {},
      suspend: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      createGain: vi.fn().mockReturnValue({
        gain: { value: 1.0 },
        connect: vi.fn(),
      }),
      decodeAudioData: vi.fn(),
      createBufferSource: vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        playbackRate: { value: 1.0 },
      }),
    };

    // Global mocks
    vi.stubGlobal('window', {
      AudioContext: vi.fn().mockImplementation(function (this: unknown) {
        return mockAudioContext;
      }),
      setInterval: vi.fn().mockReturnValue(123),
      clearInterval: vi.fn(),
    });
    vi.stubGlobal('document', {
      getElementById: vi.fn().mockImplementation((id: string) => {
        if (id === 'background-audio-bridge') return mockAudioElement;
        return null;
      }),
      createElement: vi.fn().mockReturnValue(mockAudioElement),
      body: {
        appendChild: vi.fn(),
      },
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('navigator', {
      mediaSession: {
        metadata: null,
        playbackState: 'none',
        setActionHandler: vi.fn(),
        setPositionState: vi.fn(),
      },
    });

    player = new WebAudioStreamPlayer();
  });

  it('keeps audioElement playing during pause() to maintain active Windows SMTC session', async () => {
    await player.init();
    await player.play();

    expect(player.getPlayerState()).toBe('playing');

    // Pause playback
    await player.pause();

    // Verify player state changed to paused
    expect(player.getPlayerState()).toBe('paused');

    // Verify AudioContext was suspended
    expect(mockAudioContext.suspend).toHaveBeenCalled();

    // CRITICAL: audioElement.pause() must NOT be called so Windows SMTC retains the active media session
    expect(mockAudioElement.pause).not.toHaveBeenCalled();
    expect(mockAudioElement.paused).toBe(false);
  });

  it('pauses audioElement when stop() is explicitly called', async () => {
    await player.init();
    await player.play();

    expect(player.getPlayerState()).toBe('playing');

    player.stop();

    // Verify player state returned to idle
    expect(player.getPlayerState()).toBe('idle');

    // Verify audioElement was paused on explicit stop
    expect(mockAudioElement.pause).toHaveBeenCalled();
  });
});
