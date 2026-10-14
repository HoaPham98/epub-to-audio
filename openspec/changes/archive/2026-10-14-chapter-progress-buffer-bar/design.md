# Design

## Context

In the current architecture, two areas require refinement:
1. `AudioPlayerBar` relies directly on raw properties from `WebAudioStreamPlayer`:
   - `currentTime`: Time elapsed in the current `AudioContext` session.
   - `duration`: `totalQueuedDuration`, which accumulates every chunk scheduled since the user pressed play.
   - `bufferedTime`: The end time of the active queue, which equals `totalQueuedDuration`.
   Because `bufferedTime` equals `duration`, `bufferPercent = (bufferedTime / duration) * 100` remains at 100% during continuous playback. Furthermore, the scrubber track is unbounded, continuously expanding as chunks are appended, keeping the scrubber thumb pinned near the far right.
2. `useMediaSession` and `WebAudioStreamPlayer`:
   - When pausing from Android notification shade, `callbacksRef.current.onPause()` invokes `togglePlayPause()`, calling React's `setIsPlaying(false)`.
   - React state update is asynchronous and deferred, while Android Chrome queries `navigator.mediaSession.playbackState` synchronously upon return of the native action event. Android OS therefore observes `playing` and keeps the pause button displayed.
   - External pause events on the `<audio>` element (OS notification, Bluetooth disconnect, headphone unplug) trigger `audioElement.onpause`, which suspends `AudioContext` but does not notify React or `useAudioStreamer`, leaving `isPlaying` stuck at `true`.

See `proposal.md` for the motivation and `specs/audio-streaming/spec.md` for behavioral requirements.

## Goals / Non-Goals

**Goals:**
- Present an intuitive, bounded timeline spanning from `00:00` to the total duration of the active chapter.
- Clearly display the forward prefetch window as a secondary colored buffer layer ahead of the playhead.
- Provide a clean forward buffer badge (`Đệm trước: +Xs`).
- Allow smooth seeking by clicking or dragging anywhere on the chapter scrubber bar, snapping to the corresponding chunk and scrolling the Reader.
- Automatically reset the scrubber timeline to `00:00` when advancing to the next chapter.
- Ensure instantaneous and bidirectional play/pause synchronization between Android notification shade/lockscreen controls and React app state.

**Non-Goals:**
- Book-wide timeline (books have dozens of hours of speech; chapter-level navigation matches physical audiobooks and EPUB reading conventions).
- Re-architecting Web Audio node graph (the engine retains its low-latency PCM streaming, while the timeline model is lifted to chapter scope in the presentation layer).

## Decisions

### Decision 1: Chapter Timeline Model in `useAudioStreamer`
- **Choice**: Compute chapter-level metrics in `useAudioStreamer`:
  - `chapterDurations`: Array of chunk durations for the active chapter. Initialized using `estimateSpeechDuration(charCount, 16)`, updating with actual decoded audio duration as chunks finish playback or decoding.
  - `chapterTotalDuration`: $\sum \text{chapterDurations}$.
  - `chapterCurrentTime`: $\sum_{i=0}^{\text{currentChunkIndex}-1} \text{chapterDurations}[i] + \text{withinChunkOffset}$.
  - `chapterBufferedTime`:
    - If `latestQueuedTarget` is in a later chapter: equals `chapterTotalDuration`.
    - If in current chapter: $\sum_{i=0}^{\text{latestQueuedTarget.chunkIndex}} \text{chapterDurations}[i]$.
  - `forwardBufferSeconds`: $\max(0, \text{chapterBufferedTime} - \text{chapterCurrentTime})$.
- **Rationale**:
  - Encapsulates all chapter coordinate math in the application hook, keeping `AudioPlayerBar` purely presentational.
  - Guarantees `bufferPercent` accurately reflects how much of the chapter is buffered ahead.

### Decision 2: Chunk-Aware Chapter Seeking
- **Choice**: When user interacts with the chapter scrubber at timestamp $T$:
  - Walk `chapterDurations` to find the target chunk $k$ where $\sum_{i=0}^{k-1} d_i \le T < \sum_{i=0}^{k} d_i$.
  - Invoke `playChunk(currentChapterIndex, k)`.
- **Rationale**:
  - TTS audio streams are synthesized and cached on a per-chunk basis. Snapping to the chunk boundary guarantees instant playback (or immediate streaming) without requiring partial-chunk slice math or mid-sentence re-synthesis.
  - Automatically scrolls the Reader interface to the target chunk for synchronized visual reading.

### Decision 3: Visual Scrubber Layers
- **Choice**:
  - Background track (gray/dark gray): 100% chapter duration.
  - Buffer layer (soft indigo/purple): Width set to `(chapterBufferedTime / chapterTotalDuration) * 100%`.
  - Foreground scrubber input: Thumb set to `chapterCurrentTime`, min `0`, max `chapterTotalDuration`.
  - Badge next to chapter info:
    - If buffer has reached the end of the chapter: `Đã nạp hết chương`.
    - Otherwise: `Đệm trước: +${forwardBufferSeconds}s`.
- **Rationale**:
  - Follows standard media player conventions (YouTube/Podcasts) while providing explicit numeric feedback on prefetch buffer safety.

```
+-----------------------------------------------------------------------------------------+
|                               CHAPTER TIMELINE SCRUBBER                                 |
+-----------------------------------------------------------------------------------------+
00:00                     03:15          04:45                                   12:30
  +─────────────────────────●──────────────|───────────────────────────────────────+
  |    Played (26%)         | Buffer (+90s)|             Unbuffered (62%)          |
  +─────────────────────────●──────────────|───────────────────────────────────────+
                            ^              ^
                       Playhead      Buffer Limit
```

### Decision 4: Synchronous MediaSession Feedback & External State Bridge
- **Choice**:
  1. In `useMediaSession.ts`, synchronously update `navigator.mediaSession.playbackState` inside action handlers before delegating to React callbacks:
     ```ts
     ['play', () => {
       try { navigator.mediaSession.playbackState = 'playing'; } catch {}
       callbacksRef.current.onPlay();
     }],
     ['pause', () => {
       try { navigator.mediaSession.playbackState = 'paused'; } catch {}
       callbacksRef.current.onPause();
     }],
     ```
  2. Add `onPlaybackStateChange(cb: (state: 'playing' | 'paused' | 'idle') => void): () => void` to `IAudioStreamPlayer` and `WebAudioStreamPlayer`. Whenever `audioElement` pauses (e.g. from notification or hardware disconnect) or `pause()`/`play()` is called, notify subscribers.
  3. In `useAudioStreamer.ts`, subscribe to `audioPlayer.onPlaybackStateChange` to immediately reconcile `isPlaying = false` when paused externally.
  4. Separate `useMediaSession` bindings to use explicit `resumeAudio` and `pauseAudio` functions instead of a shared toggle.
- **Rationale**:
  - Immediate synchronous assignment guarantees Android OS media notification receives the correct playback state without waiting for React's deferred render cycle.
  - Subscription bridge ensures OS-initiated pause events (headphone unplug, notification dismiss, audio focus loss) are faithfully mirrored in React UI.

## Risks / Trade-offs

- **[Risk] Total chapter duration estimation variance**
  - *Mitigation*: Vietnamese speech rate at standard pace is remarkably consistent ($\sim 15 - 17$ characters per second). Using 16 chars/s yields $\pm 5\%$ accuracy across full chapters. As chunks decode, durations snap to exact millisecond audio lengths, smoothing out variance.
- **[Risk] Scrubber seek while prefetch stream is active**
  - *Mitigation*: Seeking dispatches `playChunk`, which immediately invokes `AbortActiveStreamUseCase`, cancelling any background prefetch and resetting the prefetch pipeline to the user's chosen chunk.
