import { ChunkMeta, IAudioStreamPlayer } from '@/domain';

export const LOOKAHEAD_INTERVAL_MS = 25;
export const LOOKAHEAD_WINDOW_SEC = 0.15;

interface ChunkBoundary {
  chapterIndex: number;
  chunkIndex: number;
  startTime: number;
  endTime: number;
  isParagraphEnd?: boolean;
}

interface PendingBufferItem {
  buffer: AudioBuffer;
  meta?: ChunkMeta;
}

interface ActiveNodeItem {
  source: AudioBufferSourceNode;
  buffer: AudioBuffer;
  scheduledStart: number;
  scheduledEnd: number;
  meta?: ChunkMeta;
}

export class WebAudioStreamPlayer implements IAudioStreamPlayer {
  private audioContext: AudioContext | null = null;
  private activeSourceNodes: ActiveNodeItem[] = [];
  private isCurrentlyPlaying = false;
  private playerState: 'idle' | 'playing' | 'paused' = 'idle';
  private playbackSpeed = 1.0;
  private nextStartTime = 0;
  private accumulatedLeadInSeconds = 0;
  private leadInThresholdSeconds = 0.3; // 300ms pre-buffer lead-in (optimized for CPU deployment profile)
  private isLeadInBuffered = false;

  public pendingBufferQueue: PendingBufferItem[] = [];
  private lookaheadTimer: number | null = null;
  public lookaheadWindowSec: number = LOOKAHEAD_WINDOW_SEC;

  private totalQueuedDuration = 0;
  private playbackStartTime = 0;
  private basePlayedTime = 0;
  private pausedAtTime = 0;

  // Boundary tracking for synchronized UI chunk highlighting
  private chunkBoundaries: ChunkBoundary[] = [];
  private currentActiveChapterIndex: number | null = null;
  private currentActiveChunkIndex: number | null = null;
  private lastScheduledMeta: ChunkMeta | null = null;

  private timeUpdateCallbacks: Set<(t: number) => void> = new Set();
  private chunkChangeCallbacks: Set<(chapterIndex: number, chunkIndex: number) => void> = new Set();
  private playbackStateCallbacks: Set<(state: 'idle' | 'playing' | 'paused') => void> = new Set();
  private endedCallbacks: Set<() => void> = new Set();
  private errorCallbacks: Set<(e: Error) => void> = new Set();
  private bufferExpiredCallbacks: Set<() => void> = new Set();
  private tickerInterval: number | null = null;
  private hasBoundVisibilityListener = false;
  private gainNode: GainNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isInternalPauseAction = false;
  private volume = 1.0;

  private notifyPlaybackState(state: 'idle' | 'playing' | 'paused'): void {
    this.playbackStateCallbacks.forEach(cb => {
      try {
        cb(state);
      } catch (e) {
        console.warn('Error in playbackState callback', e);
      }
    });
  }

  async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (!this.audioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (typeof this.audioContext.addEventListener === 'function') {
        this.audioContext.addEventListener('statechange', () => {
          if (
            this.playerState === 'playing' &&
            !this.isInternalPauseAction &&
            (this.audioContext?.state === 'suspended' || (this.audioContext?.state as string) === 'interrupted')
          ) {
            this.pause().catch(() => {});
          }
        });
      }
    }

    // Configure W3C AudioSession if available (e.g. iOS Safari 16.4+)
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        (navigator as unknown as { audioSession: { type: string } }).audioSession.type = 'playback';
      } catch (err) {
        console.warn('Failed to set navigator.audioSession.type to playback:', err);
      }
    }

    if (!this.gainNode) {
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.volume;
      this.gainNode.connect(this.audioContext.destination);
    }

    if (typeof document !== 'undefined') {
      if (!this.audioElement) {
        let el = document.getElementById('background-audio-bridge') as HTMLAudioElement | null;
        if (!el) {
          el = document.createElement('audio');
          el.id = 'background-audio-bridge';
          el.style.position = 'fixed';
          el.style.top = '-9999px';
          el.style.left = '-9999px';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          el.setAttribute('playsinline', 'true');
          el.setAttribute('webkit-playsinline', 'true');
          el.setAttribute('x-webkit-airplay', 'allow');
          el.preload = 'auto';
          el.loop = true;
          el.src = '/silence-10s.wav';
          document.body.appendChild(el);
        } else {
          el.loop = true;
          if (!el.src || !el.src.includes('/silence-10s.wav')) {
            el.src = '/silence-10s.wav';
          }
        }
        this.audioElement = el;

        // External pause listener (e.g. bluetooth disconnect, headphone unplugged, audio focus loss)
        this.audioElement.addEventListener('pause', () => {
          if (this.isCurrentlyPlaying && !this.isInternalPauseAction) {
            // Guard against lockscreen / background transient interruption on iOS/mobile
            if (typeof document !== 'undefined' && document.hidden) {
              this.ensureAudioElementPlaying().catch(() => {});
              return;
            }
            this.pause();
          }
        });

        // External play listener (e.g. bluetooth media button, headset resume)
        this.audioElement.addEventListener('play', () => {
          if (this.playerState === 'paused' && !this.isInternalPauseAction) {
            this.play();
          }
        });
      }

      // Auto-resume AudioContext on returning to foreground
      if (!this.hasBoundVisibilityListener) {
        this.hasBoundVisibilityListener = true;
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            if (this.playerState === 'playing' && this.audioContext && this.audioContext.state === 'suspended') {
              this.audioContext.resume().catch(e => {
                console.warn('Failed to auto-resume AudioContext on visibilitychange:', e);
              });
            }
            if (this.playerState === 'playing' && this.audioElement && this.audioElement.paused) {
              this.ensureAudioElementPlaying().catch(() => {});
            }
          }
        });
      }
    }

    // Strict suspension lock: if player is paused, do NOT resume audioContext
    if (this.playerState !== 'paused' && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (err) {
        console.warn('AudioContext resume in init was deferred or rejected:', err);
      }
    }
  }

  async ensureAudioElementPlaying(): Promise<void> {
    if (typeof window === 'undefined') return;
    await this.init();
    if (this.audioElement && this.audioElement.paused) {
      try {
        await this.audioElement.play();
      } catch (err) {
        console.warn('AudioElement play deferred or blocked:', err);
      }
    }
  }

  queuePcmChunk(pcmBuffer: ArrayBuffer, sampleRate = 24000, meta?: ChunkMeta): void {
    if (!this.audioContext) {
      this.init();
    }
    if (!this.audioContext) return;

    // Convert PCM s16le ArrayBuffer to AudioBuffer
    const audioBuffer = this.decodePcmS16le(pcmBuffer, sampleRate);
    this.totalQueuedDuration += audioBuffer.duration;

    this.pendingBufferQueue.push({ buffer: audioBuffer, meta });

    if (!this.isLeadInBuffered) {
      this.accumulatedLeadInSeconds += audioBuffer.duration;

      // When accumulated lead-in threshold is reached
      if (this.accumulatedLeadInSeconds >= this.leadInThresholdSeconds) {
        this.isLeadInBuffered = true;
        this.pumpLookaheadScheduler();
      }
    } else {
      this.pumpLookaheadScheduler();
    }
  }

  pumpLookaheadScheduler(): void {
    if (!this.audioContext || this.playerState === 'paused' || !this.isLeadInBuffered) {
      return;
    }

    const now = this.audioContext.currentTime;
    const windowEnd = now + this.lookaheadWindowSec;

    while (this.pendingBufferQueue.length > 0 && this.nextStartTime < windowEnd) {
      const item = this.pendingBufferQueue.shift()!;
      this.scheduleBuffer(item.buffer, item.meta);
    }
  }

  private startLookaheadTimer(): void {
    this.stopLookaheadTimer();
    this.lookaheadTimer = window.setInterval(() => {
      this.pumpLookaheadScheduler();
    }, LOOKAHEAD_INTERVAL_MS);
  }

  private stopLookaheadTimer(): void {
    if (this.lookaheadTimer !== null) {
      clearInterval(this.lookaheadTimer);
      this.lookaheadTimer = null;
    }
  }

  private scheduleBuffer(buffer: AudioBuffer, meta?: ChunkMeta): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + 0.03; // 30ms safety margin
      if (this.playbackStartTime === 0) {
        this.playbackStartTime = this.nextStartTime;
      }
    }

    // Natural silence padding between different chunks (inter-sentence 250ms, inter-paragraph 500ms)
    if (meta) {
      const isNewChunk =
        !this.lastScheduledMeta ||
        this.lastScheduledMeta.chapterIndex !== meta.chapterIndex ||
        this.lastScheduledMeta.chunkIndex !== meta.chunkIndex;

      if (isNewChunk && this.lastScheduledMeta && this.playbackStartTime > 0) {
        if (this.nextStartTime >= now) {
          const isParagraph = !!this.lastScheduledMeta.isParagraphEnd;
          const silenceDuration = (isParagraph ? 0.5 : 0.25) / this.playbackSpeed;
          this.nextStartTime += silenceDuration;
          this.totalQueuedDuration += silenceDuration;
        }
      }
      this.lastScheduledMeta = { ...meta };
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.playbackSpeed;
    const outputTarget = this.gainNode || this.audioContext.destination;
    source.connect(outputTarget);

    const scheduledStart = this.nextStartTime;
    const durationScaled = buffer.duration / this.playbackSpeed;
    const scheduledEnd = scheduledStart + durationScaled;

    source.start(scheduledStart);
    this.activeSourceNodes.push({
      source,
      buffer,
      scheduledStart,
      scheduledEnd,
      meta,
    });

    // Record or extend chunk boundary
    if (meta) {
      const existing = this.chunkBoundaries.find(
        b => b.chapterIndex === meta.chapterIndex && b.chunkIndex === meta.chunkIndex
      );
      if (existing) {
        existing.endTime = Math.max(existing.endTime, scheduledEnd);
        if (meta.isParagraphEnd !== undefined) {
          existing.isParagraphEnd = meta.isParagraphEnd;
        }
      } else {
        this.chunkBoundaries.push({
          chapterIndex: meta.chapterIndex,
          chunkIndex: meta.chunkIndex,
          startTime: scheduledStart,
          endTime: scheduledEnd,
          isParagraphEnd: meta.isParagraphEnd,
        });
      }
    }

    this.nextStartTime = scheduledEnd;

    source.onended = () => {
      const idx = this.activeSourceNodes.findIndex(item => item.source === source);
      if (idx !== -1) {
        this.activeSourceNodes.splice(idx, 1);
      }
      if (
        this.activeSourceNodes.length === 0 &&
        this.pendingBufferQueue.length === 0 &&
        this.isCurrentlyPlaying
      ) {
        this.isCurrentlyPlaying = false;
        this.stopTicker();
        this.stopLookaheadTimer();
        this.endedCallbacks.forEach(cb => cb());
      }
    };

    if (
      this.playerState !== 'paused' &&
      !this.isCurrentlyPlaying &&
      (!this.audioContext || this.audioContext.state !== 'suspended')
    ) {
      this.playerState = 'playing';
      this.isCurrentlyPlaying = true;
      this.ensureAudioElementPlaying().catch(() => {});
      this.startTicker();
      this.startLookaheadTimer();
    }
  }

  async play(): Promise<void> {
    await this.init();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (err) {
        console.warn('Failed to resume AudioContext', err);
        this.playerState = 'paused';
        this.isCurrentlyPlaying = false;
        const resumeError =
          err instanceof Error ? err : new Error('Failed to resume audio output');
        this.errorCallbacks.forEach(cb => cb(resumeError));
        throw resumeError;
      }
    }
    // Restore gain to this.volume
    if (this.gainNode && this.audioContext) {
      try {
        this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
      } catch {
        // ignore
      }
    }
    await this.ensureAudioElementPlaying();

    if (this.isBufferExpired()) {
      this.bufferExpiredCallbacks.forEach(cb => {
        try {
          cb();
        } catch (e) {
          console.warn('Error in bufferExpired callback', e);
        }
      });
    }

    if (this.pendingBufferQueue.length > 0 && !this.isLeadInBuffered) {
      this.isLeadInBuffered = true;
    }
    this.playerState = 'playing';
    this.isCurrentlyPlaying = true;
    this.startTicker();
    this.startLookaheadTimer();
    this.pumpLookaheadScheduler();
    this.notifyPlaybackState('playing');
  }

  async pause(): Promise<void> {
    this.isInternalPauseAction = true;
    this.playerState = 'paused';
    this.pausedAtTime = this.getCurrentTime();
    this.basePlayedTime = this.pausedAtTime;
    this.isCurrentlyPlaying = false;
    this.stopTicker();
    this.stopLookaheadTimer();
    // Soft mute via gainNode to silence audio output cleanly
    if (this.gainNode && this.audioContext) {
      try {
        this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      } catch {
        // ignore
      }
    }

    if (this.audioContext && this.audioContext.state === 'running') {
      try {
        await this.audioContext.suspend();
      } catch (err) {
        console.warn('Failed to suspend AudioContext', err);
      }
    }

    // Align bridge lifecycle with speech playback: pause audioElement
    if (this.audioElement && !this.audioElement.paused) {
      try {
        this.audioElement.pause();
      } catch (err) {
        console.warn('Failed to pause AudioElement bridge:', err);
      }
    }

    this.isInternalPauseAction = false;
    this.notifyPlaybackState('paused');
  }

  stop(pauseBridge = true): void {
    this.isInternalPauseAction = true;
    this.playerState = 'idle';
    this.notifyPlaybackState('idle');
    this.isCurrentlyPlaying = false;
    this.stopTicker();
    this.stopLookaheadTimer();
    if (pauseBridge && this.audioElement && !this.audioElement.paused) {
      try {
        this.audioElement.pause();
      } catch {
        // ignore
      }
    }
    this.clearQueue();
    this.stopAllNodes();
    this.totalQueuedDuration = 0;
    this.basePlayedTime = 0;
    this.playbackStartTime = 0;
    this.nextStartTime = 0;
    this.pausedAtTime = 0;
    this.chunkBoundaries = [];
    this.currentActiveChapterIndex = null;
    this.currentActiveChunkIndex = null;
    this.lastScheduledMeta = null;
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    this.timeUpdateCallbacks.forEach(cb => cb(0));
    this.isInternalPauseAction = false;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
    // Do not set audioElement.muted or audioElement.volume = 0
    // Chrome Android hides the media notification shade if the media element is muted.
    // The background audio bridge plays pure digital silence so it never produces audible sound.
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement;
  }

  seek(seconds: number): void {
    this.basePlayedTime = seconds;
    this.pausedAtTime = seconds;
    if (this.audioContext) {
      this.playbackStartTime = this.audioContext.currentTime;
    }
    this.timeUpdateCallbacks.forEach(cb => cb(seconds));
  }

  setSpeed(speed: number): void {
    if (speed <= 0 || speed === this.playbackSpeed) return;
    const oldSpeed = this.playbackSpeed;
    const newSpeed = speed;

    if (this.audioContext && this.playerState === 'playing' && this.playbackStartTime > 0) {
      this.basePlayedTime = this.getCurrentTime();
      this.playbackStartTime = this.audioContext.currentTime;
    }

    this.playbackSpeed = newSpeed;

    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    // 1. Separate nodes into currently playing vs future nodes
    const futureItems: ActiveNodeItem[] = [];
    const remainingActiveNodes: ActiveNodeItem[] = [];

    for (const item of this.activeSourceNodes) {
      if (item.scheduledStart > now) {
        try {
          item.source.onended = null;
          item.source.stop();
          item.source.disconnect();
        } catch {
          // ignore
        }
        futureItems.push(item);
      } else {
        try {
          item.source.playbackRate.value = newSpeed;
        } catch {
          // ignore
        }
        const remainingOld = Math.max(0, item.scheduledEnd - now);
        const remainingNew = remainingOld * (oldSpeed / newSpeed);
        item.scheduledEnd = now + remainingNew;
        remainingActiveNodes.push(item);
      }
    }

    this.activeSourceNodes = remainingActiveNodes;

    // Prepend futureItems in original order back to pendingBufferQueue
    if (futureItems.length > 0) {
      this.pendingBufferQueue = [
        ...futureItems.map(f => ({ buffer: f.buffer, meta: f.meta })),
        ...this.pendingBufferQueue,
      ];
    }

    // 2. Adjust nextStartTime to the end of the currently playing node (or now)
    if (this.activeSourceNodes.length > 0) {
      const lastNode = this.activeSourceNodes[this.activeSourceNodes.length - 1];
      this.nextStartTime = lastNode.scheduledEnd;
    } else {
      this.nextStartTime = now + 0.03;
    }

    // 3. Rescale chunkBoundaries
    for (const b of this.chunkBoundaries) {
      if (b.endTime > now) {
        if (b.startTime >= now) {
          b.startTime = now + (b.startTime - now) * (oldSpeed / newSpeed);
          b.endTime = now + (b.endTime - now) * (oldSpeed / newSpeed);
        } else {
          b.endTime = now + (b.endTime - now) * (oldSpeed / newSpeed);
        }
      }
    }

    // 4. Immediately pump lookahead scheduler to schedule pending buffers at new speed
    this.pumpLookaheadScheduler();
  }

  getCurrentTime(): number {
    if (this.playerState === 'paused' || !this.audioContext || this.playbackStartTime === 0) {
      return this.pausedAtTime;
    }
    const elapsed =
      this.basePlayedTime + (this.audioContext.currentTime - this.playbackStartTime) * this.playbackSpeed;
    return Math.max(0, Math.min(elapsed, this.totalQueuedDuration));
  }

  getDuration(): number {
    return this.totalQueuedDuration;
  }

  getBufferedTime(): number {
    return Math.min(this.totalQueuedDuration, this.getCurrentTime() + this.getRemainingBufferedTime());
  }

  getRemainingBufferedTime(): number {
    if (!this.audioContext) return 0;
    let pendingDuration = 0;
    for (const item of this.pendingBufferQueue) {
      pendingDuration += item.buffer.duration;
    }
    const scheduledRemaining = Math.max(0, (this.nextStartTime - this.audioContext.currentTime) * this.playbackSpeed);
    return scheduledRemaining + pendingDuration;
  }

  isBufferExpired(): boolean {
    if (!this.audioContext) return true;
    if (this.nextStartTime <= this.audioContext.currentTime && this.pendingBufferQueue.length === 0) {
      return true;
    }
    if (this.activeSourceNodes.length === 0 && this.pendingBufferQueue.length === 0) {
      return true;
    }
    return false;
  }

  onBufferExpired(callback: () => void): () => void {
    this.bufferExpiredCallbacks.add(callback);
    return () => this.bufferExpiredCallbacks.delete(callback);
  }

  isPlaying(): boolean {
    return this.isCurrentlyPlaying;
  }

  getPlayerState(): 'idle' | 'playing' | 'paused' {
    return this.playerState;
  }

  clearQueue(): void {
    this.pendingBufferQueue = [];
    this.accumulatedLeadInSeconds = 0;
    this.isLeadInBuffered = false;
    this.lastScheduledMeta = null;
  }

  async playCachedBlob(
    blob: Blob,
    speed?: number,
    append = false,
    meta?: ChunkMeta
  ): Promise<void> {
    await this.init();
    if (!append) {
      this.stop(false);
    }

    if (speed !== undefined) {
      this.setSpeed(speed);
    }

    if (!this.audioContext) return;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.totalQueuedDuration += audioBuffer.duration;
      this.isLeadInBuffered = true;
      this.pendingBufferQueue.push({ buffer: audioBuffer, meta });
      this.pumpLookaheadScheduler();
      await this.ensureAudioElementPlaying();
    } catch (err: unknown) {
      const error =
        err instanceof Error ? err : new Error('Không thể giải mã file âm thanh từ cache');
      this.errorCallbacks.forEach(cb => cb(error));
      throw error;
    }
  }

  onTimeUpdate(callback: (currentTime: number) => void): () => void {
    this.timeUpdateCallbacks.add(callback);
    return () => this.timeUpdateCallbacks.delete(callback);
  }

  onChunkChange(callback: (chapterIndex: number, chunkIndex: number) => void): () => void {
    this.chunkChangeCallbacks.add(callback);
    return () => this.chunkChangeCallbacks.delete(callback);
  }

  onEnded(callback: () => void): () => void {
    this.endedCallbacks.add(callback);
    return () => this.endedCallbacks.delete(callback);
  }

  onError(callback: (err: Error) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  onPlaybackStateChange(callback: (state: 'idle' | 'playing' | 'paused') => void): () => void {
    this.playbackStateCallbacks.add(callback);
    return () => this.playbackStateCallbacks.delete(callback);
  }

  getActiveChunkTime(): number {
    if (!this.audioContext || this.playbackStartTime === 0) {
      return 0;
    }
    const now = this.audioContext.currentTime;
    const activeBoundary = this.chunkBoundaries.find((b, idx) => {
      const nextB = this.chunkBoundaries[idx + 1];
      const effectiveEnd = nextB ? nextB.startTime : b.endTime;
      return now >= b.startTime && now < effectiveEnd;
    });
    if (activeBoundary) {
      return Math.max(0, (now - activeBoundary.startTime) * this.playbackSpeed);
    }
    return 0;
  }

  getChunkDuration(chapterIndex: number, chunkIndex: number): number | undefined {
    const boundary = this.chunkBoundaries.find(
      b => b.chapterIndex === chapterIndex && b.chunkIndex === chunkIndex
    );
    if (boundary) {
      return (boundary.endTime - boundary.startTime) * this.playbackSpeed;
    }
    return undefined;
  }

  private stopAllNodes(): void {
    for (const item of this.activeSourceNodes) {
      try {
        item.source.onended = null;
        item.source.stop();
        item.source.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeSourceNodes = [];
  }

  private startTicker(): void {
    this.stopTicker();
    this.tickerInterval = window.setInterval(() => {
      const cur = this.getCurrentTime();
      this.timeUpdateCallbacks.forEach(cb => cb(cur));

      // Boundary check for synchronized chunk highlight
      if (this.audioContext && this.chunkBoundaries.length > 0) {
        const now = this.audioContext.currentTime;
        const activeBoundary = this.chunkBoundaries.find((b, idx) => {
          const nextB = this.chunkBoundaries[idx + 1];
          const effectiveEnd = nextB ? nextB.startTime : b.endTime;
          return now >= b.startTime && now < effectiveEnd;
        });
        if (
          activeBoundary &&
          (activeBoundary.chapterIndex !== this.currentActiveChapterIndex ||
            activeBoundary.chunkIndex !== this.currentActiveChunkIndex)
        ) {
          this.currentActiveChapterIndex = activeBoundary.chapterIndex;
          this.currentActiveChunkIndex = activeBoundary.chunkIndex;
          this.chunkChangeCallbacks.forEach(cb =>
            cb(activeBoundary.chapterIndex, activeBoundary.chunkIndex)
          );
        }

        // Clean up completed past boundaries (keep last 10s margin)
        this.chunkBoundaries = this.chunkBoundaries.filter(b => b.endTime > now - 10);
      }
    }, 50);
  }

  private stopTicker(): void {
    if (this.tickerInterval !== null) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }

  private decodePcmS16le(pcmBuffer: ArrayBuffer, sampleRate: number): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext is not initialized');
    }

    const dataView = new DataView(pcmBuffer);
    const numSamples = Math.floor(pcmBuffer.byteLength / 2);
    const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const int16 = dataView.getInt16(i * 2, true); // Little-endian
      channelData[i] = int16 < 0 ? int16 / 32768.0 : int16 / 32767.0;
    }

    return audioBuffer;
  }
}
