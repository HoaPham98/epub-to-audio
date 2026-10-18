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
    createBuffer: ReturnType<typeof vi.fn>;
    createBufferSource: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let audioElementListeners: Record<string, ((...args: unknown[]) => void)[]>;
  let audioContextListeners: Record<string, ((...args: unknown[]) => void)[]>;

  beforeEach(() => {
    vi.restoreAllMocks();

    audioElementListeners = {};
    mockAudioElement = {
      id: 'background-audio-bridge',
      style: {},
      setAttribute: vi.fn(),
      preload: 'auto',
      loop: true,
      src: '/silence-10s.wav',
      paused: false,
      play: vi.fn().mockImplementation(() => {
        mockAudioElement.paused = false;
        return Promise.resolve();
      }),
      pause: vi.fn().mockImplementation(() => {
        mockAudioElement.paused = true;
      }),
      addEventListener: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (!audioElementListeners[event]) audioElementListeners[event] = [];
        audioElementListeners[event].push(handler);
      }),
      removeEventListener: vi.fn(),
    };

    audioContextListeners = {};
    mockAudioContext = {
      state: 'running',
      currentTime: 10,
      destination: {},
      suspend: vi.fn().mockImplementation(() => {
        mockAudioContext.state = 'suspended';
        return Promise.resolve();
      }),
      resume: vi.fn().mockImplementation(() => {
        mockAudioContext.state = 'running';
        return Promise.resolve();
      }),
      createGain: vi.fn().mockReturnValue({
        gain: { value: 1.0, setValueAtTime: vi.fn() },
        connect: vi.fn(),
      }),
      decodeAudioData: vi.fn(),
      createBuffer: vi.fn().mockImplementation((channels: number, length: number, sampleRate: number) => ({
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(length)),
      })),
      createBufferSource: vi.fn().mockReturnValue({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        playbackRate: { value: 1.0 },
      }),
      addEventListener: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (!audioContextListeners[event]) audioContextListeners[event] = [];
        audioContextListeners[event].push(handler);
      }),
      removeEventListener: vi.fn(),
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

  it('pauses audioElement and suspends AudioContext during pause() to align bridge with speech playback', async () => {
    await player.init();
    await player.play();

    expect(player.getPlayerState()).toBe('playing');

    // Pause playback
    await player.pause();

    // Verify player state changed to paused
    expect(player.getPlayerState()).toBe('paused');

    // Verify AudioContext was suspended
    expect(mockAudioContext.suspend).toHaveBeenCalled();

    // Verify audioElement was paused to keep bridge aligned with speech playback
    expect(mockAudioElement.pause).toHaveBeenCalled();
    expect(mockAudioElement.paused).toBe(true);
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

  it('emits playing transition only after output resume succeeds', async () => {
    await player.init();
    const transitions: string[] = [];
    player.onPlaybackStateChange(state => {
      transitions.push(state);
    });

    let resumeResolved = false;
    mockAudioContext.resume.mockImplementation(async () => {
      mockAudioContext.state = 'running';
      resumeResolved = true;
    });

    mockAudioContext.state = 'suspended';

    await player.play();

    expect(resumeResolved).toBe(true);
    expect(transitions).toEqual(['playing']);
    expect(player.getPlayerState()).toBe('playing');
  });

  it('keeps confirmed paused state and does not emit playing when output resume rejects', async () => {
    await player.init();
    await player.play();
    await player.pause();
    expect(player.getPlayerState()).toBe('paused');

    const stateSpy = vi.fn();
    player.onPlaybackStateChange(stateSpy);

    const errorSpy = vi.fn();
    player.onError(errorSpy);

    mockAudioContext.state = 'suspended';
    mockAudioContext.resume.mockRejectedValueOnce(new Error('Audio device unavailable'));

    await expect(player.play()).rejects.toThrow('Audio device unavailable');

    expect(stateSpy).not.toHaveBeenCalledWith('playing');
    expect(player.getPlayerState()).toBe('paused');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Audio device unavailable' })
    );
  });

  it('pauses player and emits paused transition on external bridge pause interruption', async () => {
    await player.init();
    await player.play();
    expect(player.getPlayerState()).toBe('playing');

    const stateSpy = vi.fn();
    player.onPlaybackStateChange(stateSpy);

    // Simulate external bridge interruption (e.g. bluetooth disconnect / headphone unplug)
    const pauseHandlers = audioElementListeners['pause'] || [];
    expect(pauseHandlers.length).toBeGreaterThan(0);
    for (const handler of pauseHandlers) {
      handler();
    }

    await Promise.resolve();

    expect(player.getPlayerState()).toBe('paused');
    expect(stateSpy).toHaveBeenCalledWith('paused');
  });

  it('pauses player and emits paused transition on external AudioContext suspension interruption', async () => {
    await player.init();
    await player.play();
    expect(player.getPlayerState()).toBe('playing');

    const stateSpy = vi.fn();
    player.onPlaybackStateChange(stateSpy);

    // Simulate OS suspending AudioContext externally
    mockAudioContext.state = 'suspended';
    const stateChangeHandlers = audioContextListeners['statechange'] || [];
    expect(stateChangeHandlers.length).toBeGreaterThan(0);
    for (const handler of stateChangeHandlers) {
      handler();
    }

    await Promise.resolve();

    expect(player.getPlayerState()).toBe('paused');
    expect(stateSpy).toHaveBeenCalledWith('paused');
  });

  it('keeps bridge lifecycle aligned through repeated pause/resume cycles', async () => {
    await player.init();

    await player.play();
    expect(player.getPlayerState()).toBe('playing');
    expect(mockAudioElement.paused).toBe(false);

    await player.pause();
    expect(player.getPlayerState()).toBe('paused');
    expect(mockAudioElement.paused).toBe(true);

    await player.play();
    expect(player.getPlayerState()).toBe('playing');
    expect(mockAudioElement.paused).toBe(false);

    await player.pause();
    expect(player.getPlayerState()).toBe('paused');
    expect(mockAudioElement.paused).toBe(true);
  });

  it('does not emit a playing transition or change playerState when PCM is received while paused', async () => {
    await player.init();
    await player.play();
    expect(player.getPlayerState()).toBe('playing');

    await player.pause();
    expect(player.getPlayerState()).toBe('paused');

    const stateChangeSpy = vi.fn();
    player.onPlaybackStateChange(stateChangeSpy);

    // Provide PCM buffer (e.g., 0.5s of 24kHz audio)
    const pcmBuffer = new Int16Array(12000).buffer;
    player.queuePcmChunk(pcmBuffer, 24000);

    expect(stateChangeSpy).not.toHaveBeenCalled();
    expect(player.getPlayerState()).toBe('paused');
  });
});

