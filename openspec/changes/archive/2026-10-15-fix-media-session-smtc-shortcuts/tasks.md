# Tasks

## 1. MediaSession Action Handlers

- [x] 1.1 Add `previoustrack` and `nexttrack` action handlers in `src/presentation/hooks/useMediaSession.ts` to map to `callbacksRef.current.onPrevChunk()` and `callbacksRef.current.onNextChunk()`, verifying handlers are registered without runtime errors.
- [x] 1.2 Verify `useMediaSession` cleans up `previoustrack` and `nexttrack` on unmount and properly synchronizes `playbackState` with active playback.

## 2. Silent Audio Loop Bridge & Audio Routing

- [x] 2.1 Refactor `WebAudioStreamPlayer.ts` to set `<audio id="background-audio-bridge">` `src` to `/silence-10s.wav` with `loop = true`, removing `MediaStreamDestination` routing and connecting `gainNode` directly to `audioContext.destination`.
- [x] 2.2 Synchronize `play()`, `pause()`, `stop()`, and volume controls in `WebAudioStreamPlayer.ts` so `audioElement` and `audioContext` pause and resume atomically while keeping `audioElement.muted = false`.
- [x] 2.3 Ensure `audioPlayer.ensureAudioElementPlaying()` and `audioPlayer.init()` are called synchronously inside user click handlers (`playChunk`, `resumeAudio`, `togglePlayPause`, `handleChunkClick`) in `src/presentation/hooks/useAudioStreamer.ts` to capture the user gesture before async TTS fetch.

## 3. Automated E2E & OS Verification Scripts

- [x] 3.1 Create Windows OS-level media keys automation script `scripts/test-media-keys.ps1` using Win32 `keybd_event` (`VK_MEDIA_PLAY_PAUSE`, `VK_MEDIA_NEXT_TRACK`, `VK_MEDIA_PREV_TRACK`) to simulate global hardware keys and verify player reactions.
- [x] 3.2 Create browser-level E2E verification test or script to spy on `navigator.mediaSession.setActionHandler` and verify `<audio id="background-audio-bridge">` attributes (`src`, `loop`, `paused === false`).

## 4. Build & System Verification

- [x] 4.1 Run `pnpm run build` or `pnpm tsc --noEmit` to verify type safety and build integrity with Turbopack.
- [x] 4.2 Execute the end-to-end verification checklist on Chrome desktop Windows, confirming SMTC media overlay appears, hardware media keys respond, and `test-media-keys.ps1` successfully controls playback.
