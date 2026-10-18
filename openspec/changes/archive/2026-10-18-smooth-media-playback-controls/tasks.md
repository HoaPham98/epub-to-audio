# Tasks

## 1. WebAudio Stream Player Pause/Resume Pipeline (Option A)

- [x] 1.1 Update `WebAudioStreamPlayer.pause()` to use soft muting (`gainNode.gain.value = 0`) instead of calling `audioContext.suspend()` and `audioElement.pause()`, keeping the live MediaStream bridge active with digital silence to prevent Android notification dismissal.
- [x] 1.2 Update `WebAudioStreamPlayer.play()` to restore `gainNode.gain.value = this.volume`, restart the playback ticker, and resume playback cleanly.
- [x] 1.3 Implement buffer expiration detection in `WebAudioStreamPlayer`: check if scheduled audio nodes expired during a prolonged pause, and provide a callback/event to signal rehydration needed.

## 2. Audio Streamer Hook State Synchronization

- [x] 2.1 Refactor `resumeAudio()` in `src/presentation/hooks/useAudioStreamer.ts` to call `audioPlayer.play()` directly, eliminating the `playerState === 'paused'` deadlock in `init()` and `ensureAudioElementPlaying()`.
- [x] 2.2 Handle buffer expiration in `useAudioStreamer` upon resume: if the remaining playable buffer is depleted while paused, trigger seamless re-streaming from the current chapter and chunk position.
- [x] 2.3 Refine `pauseAudio()` in `useAudioStreamer` to ensure immediate and synchronous alignment of `isPlaying = false`, `isPausedByUserRef.current = true`, and `navigator.mediaSession.playbackState = 'paused'`.

## 3. MediaSession Action Handlers Expansion

- [x] 3.1 Register `previoustrack` and `nexttrack` action handlers in `src/presentation/hooks/useMediaSession.ts` to support Bluetooth headsets and notification previous/next track controls.
- [x] 3.2 Ensure all MediaSession action handlers cleanly dispatch callbacks without tearing down or rebuilding action listeners.

## 4. Desktop Keyboard Shortcuts

- [x] 4.1 Create `src/presentation/hooks/useDesktopShortcuts.ts` supporting Space (Play/Pause), ArrowLeft/ArrowRight (Seek +/-10s), ArrowUp/ArrowDown (Volume +/-5%), 'M' (Mute toggle), and '[' / ']' (Previous/Next chapter).
- [x] 4.2 Add focus safety checks in `useDesktopShortcuts` to bypass shortcut handling when focus is inside text inputs, textareas, select elements, or active modals, and prevent page scrolling on Spacebar.
- [x] 4.3 Integrate `useDesktopShortcuts` into `src/app/page.tsx` and export from `src/presentation/hooks/index.ts`.

## 5. Verification and Integration

- [x] 5.1 Run project build or TypeScript check to ensure all types, hooks, and player components compile with zero errors.
- [x] 5.2 Verify that pausing on Android/mobile keeps the notification shade open with the play icon, resuming continues playback immediately, and desktop shortcuts operate smoothly.
