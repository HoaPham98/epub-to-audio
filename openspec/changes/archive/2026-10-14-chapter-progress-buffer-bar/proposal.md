# Proposal

## Why

Currently, two key issues affect the playback experience:
1. **Unbounded Progress & Buffer Bar**: The playback progress bar and buffer indicator in `AudioPlayerBar` are tied to the cumulative duration of audio buffers scheduled since playback started (`totalQueuedDuration`), rather than the actual chapter.
   - The progress bar bounds expand indefinitely while the scrubber thumb continuously hovers near the far right (80–90%).
   - The buffer indicator is virtually always at 100% of the active queue, failing to communicate actual forward buffer depth relative to the chapter.
   - The user cannot see how far they have progressed in the current chapter or how much of the chapter remains.
2. **Android Media Notification State Desynchronization**: When pausing playback from the Android notification shade or lockscreen controls, the audio output stops, but the notification status remains stuck as `playing` (showing a Pause button instead of a Play button). This happens because:
   - React state updates (`setIsPlaying(false)`) are batched asynchronously, whereas Android Chrome expects `navigator.mediaSession.playbackState` to update synchronously upon action return.
   - When the underlying `<audio>` bridge element is paused directly by external events (OS notification, Bluetooth disconnect, headphone unplug), `WebAudioStreamPlayer` has no event callback to notify React's `useAudioStreamer`, leaving `isPlaying` set to `true`.

Transitioning to a **Chapter-Scoped Timeline** with **Synchronous MediaSession Synchronization** resolves both issues: the scrubber bar accurately reflects chapter progress and buffer health, while lockscreen and notification media controls reflect instant, bidirectional play/pause states.

## What Changes

- **Chapter-Scoped Scrubber Timeline**: Redefine `currentTime`, `duration`, and `bufferedTime` presented to the UI so that they reflect progress within the **current chapter**:
  - `chapterTotalDuration`: Sum of all chunk durations in the chapter (estimated based on characters at $\sim 16\text{ chars/s}$, refining as chunks finish decoding).
  - `chapterCurrentTime`: Accumulated duration of completed chunks in the chapter plus playback offset within the current chunk.
  - `chapterBufferedTime`: Cumulative duration of all prefetched chunks queued within the chapter.
- **Accurate Buffer Visualization & Badge**:
  - Render the buffer layer across the chapter track proportional to `chapterBufferedTime / chapterTotalDuration * 100`.
  - Provide an explicit badge indicating forward buffer health: `Đệm trước: +Xs` (or `Đã nạp hết chương` if the prefetch sliding window has crossed into the next chapter).
- **Chapter-Level Scrubbing / Seeking**:
  - Clicking or dragging the scrubber bar maps the target chapter timestamp to the corresponding chunk, jumps playback to that chunk, and synchronizes the Reader text position.
- **Automatic Chapter Transition Reset**:
  - When playback transitions across chapter boundaries, the scrubber timeline resets smoothly to 0:00 for the new chapter.
- **Android MediaSession & System Playback State Synchronization**:
  - Synchronously update `navigator.mediaSession.playbackState` inside `useMediaSession` action handlers (`'play'` and `'pause'`) to provide immediate feedback to Android OS.
  - Add `onPlaybackStateChange` callback to `IAudioStreamPlayer` and implement it in `WebAudioStreamPlayer` to report external pause/play events (OS notification shade, Bluetooth disconnect, headphone unplug) to React.
  - Separate `onPlay` and `onPause` into explicit `resumeAudio()` and `pauseAudio()` handlers in `useAudioStreamer` to avoid toggle race conditions.

## Capabilities

### New Capabilities
<!-- None: all changes refine existing audio streaming, scrubber, and playback presentation capabilities. -->

### Modified Capabilities
- `audio-streaming`: Update duration, scrubber, and speech duration buffer estimation requirements to operate on a chapter-scoped timeline, and synchronize notification playback state bidirectionally with native OS media sessions.

## Impact

- `src/domain/ports/audio.ts`: Add `onPlaybackStateChange` to `IAudioStreamPlayer`.
- `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Implement `onPlaybackStateChange` and notify listeners on `play()`, `pause()`, and native `audioElement.onpause`.
- `src/presentation/hooks/useMediaSession.ts`: Add synchronous `playbackState` updates in `actionHandlers`.
- `src/presentation/hooks/useAudioStreamer.ts`: Compute chapter-scoped timeline properties (`chapterCurrentTime`, `chapterDuration`, `chapterBufferedTime`, `forwardBufferSeconds`), listen to `audioPlayer.onPlaybackStateChange`, and provide explicit `resumeAudio` / `pauseAudio` handlers.
- `src/presentation/components/AudioPlayerBar.tsx`: Bind the scrubber bar, time labels, buffer track width, and buffer status badge to chapter-scoped metrics.
