import { ChunkMeta, IAudioStreamPlayer } from '@/domain';

interface ChunkBoundary {
  chapterIndex: number;
  chunkIndex: number;
  startTime: number;
  endTime: number;
}

interface QueuedItem {
  buffer: AudioBuffer;
  meta?: ChunkMeta;
}

export class WebAudioStreamPlayer implements IAudioStreamPlayer {
  private audioContext: AudioContext | null = null;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private isCurrentlyPlaying = false;
  private playerState: 'idle' | 'playing' | 'paused' = 'idle';
  private playbackSpeed = 1.0;
  private nextStartTime = 0;
  private accumulatedLeadInSeconds = 0;
  private leadInThresholdSeconds = 0.3; // 300ms pre-buffer lead-in (optimized for CPU deployment profile)
  private queuedItems: QueuedItem[] = [];
  private isLeadInBuffered = false;

  private totalQueuedDuration = 0;
  private playbackStartTime = 0;
  private pausedAtTime = 0;

  // Boundary tracking for synchronized UI chunk highlighting
  private chunkBoundaries: ChunkBoundary[] = [];
  private currentActiveChapterIndex: number | null = null;
  private currentActiveChunkIndex: number | null = null;

  private timeUpdateCallbacks: Set<(t: number) => void> = new Set();
  private chunkChangeCallbacks: Set<(chapterIndex: number, chunkIndex: number) => void> = new Set();
  private endedCallbacks: Set<() => void> = new Set();
  private errorCallbacks: Set<(e: Error) => void> = new Set();
  private tickerInterval: number | null = null;

  async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (!this.audioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
    }

    // Strict suspension lock: if player is paused, do NOT resume audioContext
    if (this.playerState !== 'paused' && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
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

    if (!this.isLeadInBuffered) {
      this.queuedItems.push({ buffer: audioBuffer, meta });
      this.accumulatedLeadInSeconds += audioBuffer.duration;

      // When accumulated lead-in threshold is reached
      if (this.accumulatedLeadInSeconds >= this.leadInThresholdSeconds) {
        this.isLeadInBuffered = true;
        this.flushQueuedBuffers();
      }
    } else {
      this.scheduleBuffer(audioBuffer, meta);
    }
  }

  private flushQueuedBuffers(): void {
    while (this.queuedItems.length > 0) {
      const item = this.queuedItems.shift()!;
      this.scheduleBuffer(item.buffer, item.meta);
    }
  }

  private scheduleBuffer(buffer: AudioBuffer, meta?: ChunkMeta): void {
    if (!this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.playbackSpeed;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + 0.03; // 30ms safety margin
      if (this.playbackStartTime === 0) {
        this.playbackStartTime = this.nextStartTime;
      }
    }

    const scheduledStart = this.nextStartTime;
    const durationScaled = buffer.duration / this.playbackSpeed;
    const scheduledEnd = scheduledStart + durationScaled;

    source.start(scheduledStart);
    this.activeSourceNodes.push(source);

    // Record or extend chunk boundary
    if (meta) {
      const existing = this.chunkBoundaries.find(
        b => b.chapterIndex === meta.chapterIndex && b.chunkIndex === meta.chunkIndex
      );
      if (existing) {
        existing.endTime = Math.max(existing.endTime, scheduledEnd);
      } else {
        this.chunkBoundaries.push({
          chapterIndex: meta.chapterIndex,
          chunkIndex: meta.chunkIndex,
          startTime: scheduledStart,
          endTime: scheduledEnd,
        });
      }
    }

    this.nextStartTime = scheduledEnd;

    source.onended = () => {
      const idx = this.activeSourceNodes.indexOf(source);
      if (idx !== -1) {
        this.activeSourceNodes.splice(idx, 1);
      }
      if (
        this.activeSourceNodes.length === 0 &&
        this.queuedItems.length === 0 &&
        this.isCurrentlyPlaying
      ) {
        this.isCurrentlyPlaying = false;
        this.stopTicker();
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
      this.startTicker();
    }
  }

  async play(): Promise<void> {
    this.playerState = 'playing';
    await this.init();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (err) {
        console.warn('Failed to resume AudioContext', err);
      }
    }
    if (this.queuedItems.length > 0 && !this.isLeadInBuffered) {
      this.isLeadInBuffered = true;
      this.flushQueuedBuffers();
    }
    this.isCurrentlyPlaying = true;
    this.startTicker();
  }

  async pause(): Promise<void> {
    this.playerState = 'paused';
    this.isCurrentlyPlaying = false;
    this.stopTicker();
    if (this.audioContext && this.audioContext.state === 'running') {
      try {
        await this.audioContext.suspend();
      } catch (err) {
        console.warn('Failed to suspend AudioContext', err);
      }
    }
  }

  stop(): void {
    this.playerState = 'idle';
    this.isCurrentlyPlaying = false;
    this.stopTicker();
    this.clearQueue();
    this.stopAllNodes();
    this.totalQueuedDuration = 0;
    this.playbackStartTime = 0;
    this.nextStartTime = 0;
    this.pausedAtTime = 0;
    this.chunkBoundaries = [];
    this.currentActiveChapterIndex = null;
    this.currentActiveChunkIndex = null;
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    this.timeUpdateCallbacks.forEach(cb => cb(0));
  }

  seek(seconds: number): void {
    this.pausedAtTime = seconds;
    this.timeUpdateCallbacks.forEach(cb => cb(seconds));
  }

  setSpeed(speed: number): void {
    this.playbackSpeed = speed;
    for (const node of this.activeSourceNodes) {
      try {
        node.playbackRate.value = speed;
      } catch {
        // ignore
      }
    }
  }

  getCurrentTime(): number {
    if (!this.audioContext || this.playbackStartTime === 0) {
      return this.pausedAtTime;
    }
    const elapsed = (this.audioContext.currentTime - this.playbackStartTime) * this.playbackSpeed;
    return Math.max(0, Math.min(elapsed, this.totalQueuedDuration));
  }

  getDuration(): number {
    return this.totalQueuedDuration;
  }

  getBufferedTime(): number {
    if (!this.audioContext || this.playbackStartTime === 0) {
      return 0;
    }
    const buffered = (this.nextStartTime - this.playbackStartTime) * this.playbackSpeed;
    return Math.max(0, Math.min(buffered, this.totalQueuedDuration));
  }

  getRemainingBufferedTime(): number {
    if (!this.audioContext) return 0;
    return Math.max(0, (this.nextStartTime - this.audioContext.currentTime) * this.playbackSpeed);
  }

  isPlaying(): boolean {
    return this.isCurrentlyPlaying;
  }

  getPlayerState(): 'idle' | 'playing' | 'paused' {
    return this.playerState;
  }

  clearQueue(): void {
    this.queuedItems = [];
    this.accumulatedLeadInSeconds = 0;
    this.isLeadInBuffered = false;
  }

  async playCachedBlob(
    blob: Blob,
    speed?: number,
    append = false,
    meta?: ChunkMeta
  ): Promise<void> {
    await this.init();
    if (!append) {
      this.stop();
    }

    if (speed !== undefined) {
      this.playbackSpeed = speed;
    }

    if (!this.audioContext) return;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.totalQueuedDuration += audioBuffer.duration;
      this.isLeadInBuffered = true;
      this.scheduleBuffer(audioBuffer, meta);
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

  private stopAllNodes(): void {
    for (const node of this.activeSourceNodes) {
      try {
        node.onended = null;
        node.stop();
        node.disconnect();
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
        const activeBoundary = this.chunkBoundaries.find(
          b => now >= b.startTime && now < b.endTime
        );
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
