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

  describe('Natural Silence Padding', () => {
    beforeEach(() => {
      // Use 2.0s window for static unit tests to schedule both chunks without advancing clock
      player.lookaheadWindowSec = 2.0;
    });

    it('schedules 250ms silence between consecutive sentence chunks within the same paragraph', async () => {
      await player.init();
      const startedTimes: number[] = [];
      mockAudioContext.createBufferSource = vi.fn().mockImplementation(() => {
        const source = {
          buffer: null,
          connect: vi.fn(),
          start: vi.fn().mockImplementation((time: number) => startedTimes.push(time)),
          stop: vi.fn(),
          playbackRate: { value: 1.0 },
        };
        return source;
      });

      // 1.0 second of audio at 24kHz = 24000 samples
      const pcm1 = new Int16Array(24000).buffer;
      const pcm2 = new Int16Array(24000).buffer;

      // Queue Chunk 0 (inter-sentence, isParagraphEnd: false)
      player.queuePcmChunk(pcm1, 24000, { chapterIndex: 0, chunkIndex: 0, isParagraphEnd: false });
      // Queue Chunk 1
      player.queuePcmChunk(pcm2, 24000, { chapterIndex: 0, chunkIndex: 1, isParagraphEnd: false });

      expect(startedTimes.length).toBe(2);
      const chunk0Start = startedTimes[0];
      const chunk1Start = startedTimes[1];
      // Chunk 0 duration is 1.0s. Chunk 1 should start at chunk0Start + 1.0s + 0.25s silence gap = +1.25s
      const gap = chunk1Start - (chunk0Start + 1.0);
      expect(gap).toBeCloseTo(0.25, 2);
    });

    it('schedules 500ms silence after a chunk ending a paragraph', async () => {
      await player.init();
      const startedTimes: number[] = [];
      mockAudioContext.createBufferSource = vi.fn().mockImplementation(() => {
        const source = {
          buffer: null,
          connect: vi.fn(),
          start: vi.fn().mockImplementation((time: number) => startedTimes.push(time)),
          stop: vi.fn(),
          playbackRate: { value: 1.0 },
        };
        return source;
      });

      const pcm1 = new Int16Array(24000).buffer;
      const pcm2 = new Int16Array(24000).buffer;

      // Queue Chunk 0 ending a paragraph (isParagraphEnd: true)
      player.queuePcmChunk(pcm1, 24000, { chapterIndex: 0, chunkIndex: 0, isParagraphEnd: true });
      // Queue Chunk 1 of next paragraph
      player.queuePcmChunk(pcm2, 24000, { chapterIndex: 0, chunkIndex: 1, isParagraphEnd: false });

      expect(startedTimes.length).toBe(2);
      const chunk0Start = startedTimes[0];
      const chunk1Start = startedTimes[1];
      // Chunk 0 duration is 1.0s. Chunk 1 should start at chunk0Start + 1.0s + 0.5s = +1.5s
      const gap = chunk1Start - (chunk0Start + 1.0);
      expect(gap).toBeCloseTo(0.5, 2);
    });

    it('maintains gapless stitching (0ms silence) between SSE deltas within the same chunk', async () => {
      await player.init();
      const startedTimes: number[] = [];
      mockAudioContext.createBufferSource = vi.fn().mockImplementation(() => {
        const source = {
          buffer: null,
          connect: vi.fn(),
          start: vi.fn().mockImplementation((time: number) => startedTimes.push(time)),
          stop: vi.fn(),
          playbackRate: { value: 1.0 },
        };
        return source;
      });

      // 0.5s delta each
      const delta1 = new Int16Array(12000).buffer;
      const delta2 = new Int16Array(12000).buffer;

      // Both belong to the same chunk (chapterIndex: 0, chunkIndex: 0)
      player.queuePcmChunk(delta1, 24000, { chapterIndex: 0, chunkIndex: 0 });
      player.queuePcmChunk(delta2, 24000, { chapterIndex: 0, chunkIndex: 0 });

      expect(startedTimes.length).toBe(2);
      const delta1Start = startedTimes[0];
      const delta2Start = startedTimes[1];
      // Delta 2 should start exactly at delta1Start + 0.5s with zero extra silence gap
      expect(delta2Start - (delta1Start + 0.5)).toBeCloseTo(0.0, 2);
    });
  });

  describe('Lookahead Scheduler & Dynamic Speed Adjustment', () => {
    it('keeps future chunks in pending queue until currentTime enters lookahead window', async () => {
      await player.init();
      mockAudioContext.currentTime = 10.0;
      // Default window is 0.15s (150ms)
      expect(player.lookaheadWindowSec).toBe(0.15);

      const startedTimes: number[] = [];
      mockAudioContext.createBufferSource = vi.fn().mockImplementation(() => {
        const source = {
          buffer: null,
          connect: vi.fn(),
          start: vi.fn().mockImplementation((time: number) => startedTimes.push(time)),
          stop: vi.fn(),
          playbackRate: { value: 1.0 },
        };
        return source;
      });

      // Chunk 0: 1.0s audio -> plays from 10.03 to 11.03
      const pcm1 = new Int16Array(24000).buffer;
      // Chunk 1: 1.0s audio -> scheduled after Chunk 0 (+0.25s silence) = 11.28
      const pcm2 = new Int16Array(24000).buffer;

      player.queuePcmChunk(pcm1, 24000, { chapterIndex: 0, chunkIndex: 0 });
      player.queuePcmChunk(pcm2, 24000, { chapterIndex: 0, chunkIndex: 1 });

      // Chunk 0 is scheduled (within [10.0, 10.15])
      // Chunk 1 is at 11.28 (> 10.15), so it must be pending
      expect(startedTimes.length).toBe(1);
      expect(player.pendingBufferQueue.length).toBe(1);

      // Advance time to 10.80 -> window is [10.80, 10.95]. Next chunk is at 11.03 (> 10.95)
      mockAudioContext.currentTime = 10.80;
      player.pumpLookaheadScheduler();
      expect(startedTimes.length).toBe(1);
      expect(player.pendingBufferQueue.length).toBe(1);

      // Advance time to 10.95 -> window is [10.95, 11.10]. 11.03 <= 11.10
      mockAudioContext.currentTime = 10.95;
      player.pumpLookaheadScheduler();
      expect(startedTimes.length).toBe(2);
      expect(player.pendingBufferQueue.length).toBe(0);
      expect(startedTimes[1]).toBeCloseTo(startedTimes[0] + 1.0 + 0.25, 2);
    });

    it('immediately rescales active chunk and schedules next chunk without 1x gap when speed changes', async () => {
      await player.init();
      mockAudioContext.currentTime = 10.0;

      const startedSources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; playbackRate: { value: number } }> = [];
      mockAudioContext.createBufferSource = vi.fn().mockImplementation(() => {
        const source = {
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          playbackRate: { value: 1.0 },
        };
        startedSources.push(source);
        return source;
      });

      // 1.0s chunk at 1.0x (from 10.03 to 11.03)
      const pcm1 = new Int16Array(24000).buffer;
      // 1.0s chunk
      const pcm2 = new Int16Array(24000).buffer;

      player.queuePcmChunk(pcm1, 24000, { chapterIndex: 0, chunkIndex: 0, isParagraphEnd: false });
      player.queuePcmChunk(pcm2, 24000, { chapterIndex: 0, chunkIndex: 1, isParagraphEnd: false });

      expect(startedSources.length).toBe(1);
      const chunk0Source = startedSources[0];

      // Play 0.5s at 1.0x (advance to 10.53)
      mockAudioContext.currentTime = 10.53;

      // Increase speed to 2.0x
      player.setSpeed(2.0);

      // Active node's playbackRate is updated immediately to 2.0
      expect(chunk0Source.playbackRate.value).toBe(2.0);

      // Remaining duration of chunk 0 at 2.0x is (11.03 - 10.53) * (1.0 / 2.0) = 0.25s
      // Plus silence padding: in setSpeed, nextStartTime is aligned to chunk0's new end = 10.53 + 0.25 = 10.78
      // Lookahead window is now [10.53, 10.53 + 0.15 = 10.68].
      // When time advances past 10.65, Chunk 1 will be scheduled around 10.78 + silence
      mockAudioContext.currentTime = 10.70;
      player.pumpLookaheadScheduler();

      expect(startedSources.length).toBe(2);
      const chunk1Source = startedSources[1];
      expect(chunk1Source.playbackRate.value).toBe(2.0);
      // Verify Chunk 1 start time was called around 10.78 + (0.25 / 2.0 = 0.125) = ~10.90
      // In the old implementation at 1x, chunk 1 would have had to wait until 11.28!
      const chunk1StartTime = chunk1Source.start.mock.calls[0][0];
      expect(chunk1StartTime).toBeLessThan(11.0);
    });

    it('cancels and reschedules already-scheduled future node when speed changes', async () => {
      await player.init();
      mockAudioContext.currentTime = 10.0;
      // Expand lookahead window so both chunks are scheduled in advance
      player.lookaheadWindowSec = 3.0;

      const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; playbackRate: { value: number } }> = [];
      mockAudioContext.createBufferSource = vi.fn().mockImplementation(() => {
        const source = {
          buffer: null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          playbackRate: { value: 1.0 },
        };
        sources.push(source);
        return source;
      });

      const pcm1 = new Int16Array(24000).buffer;
      const pcm2 = new Int16Array(24000).buffer;

      player.queuePcmChunk(pcm1, 24000, { chapterIndex: 0, chunkIndex: 0 });
      player.queuePcmChunk(pcm2, 24000, { chapterIndex: 0, chunkIndex: 1 });

      // Both chunks scheduled because lookaheadWindowSec = 3.0
      expect(sources.length).toBe(2);
      const chunk1SourceOld = sources[1];

      // Time advances to 10.5 (midway through chunk 0)
      mockAudioContext.currentTime = 10.5;

      // User changes speed to 1.5x
      player.setSpeed(1.5);

      // The old scheduled future chunk 1 must be cancelled with stop()
      expect(chunk1SourceOld.stop).toHaveBeenCalled();

      // And a new source node must be created and started for Chunk 1 with playbackRate 1.5
      expect(sources.length).toBe(3);
      const chunk1SourceNew = sources[2];
      expect(chunk1SourceNew.playbackRate.value).toBe(1.5);
    });

    it('maintains continuous getCurrentTime() across speed changes', async () => {
      await player.init();
      mockAudioContext.currentTime = 10.0;

      const pcm = new Int16Array(48000).buffer; // 2.0s of audio
      player.queuePcmChunk(pcm, 24000, { chapterIndex: 0, chunkIndex: 0 });

      // Start time is around 10.03
      // Advance to 10.53 -> 0.5s has elapsed at 1.0x
      mockAudioContext.currentTime = 10.53;
      const timeBefore = player.getCurrentTime();
      expect(timeBefore).toBeCloseTo(0.5, 1);

      // Change speed to 2.0x
      player.setSpeed(2.0);

      // Immediately after setSpeed, getCurrentTime() must be continuous (still ~0.5s)
      const timeImmediatelyAfter = player.getCurrentTime();
      expect(timeImmediatelyAfter).toBeCloseTo(timeBefore, 2);

      // Advance by another 0.25s in AudioContext time
      mockAudioContext.currentTime = 10.78;
      // In audio time at 2.0x, 0.25s of context time = 0.5s of played audio
      // Total played = 0.5 + 0.5 = 1.0s
      const timeLater = player.getCurrentTime();
      expect(timeLater).toBeCloseTo(1.0, 1);
    });
  });
});


