# Tasks

## 1. Core Implementation

- [x] 1.1 Modify `WebAudioStreamPlayer.pause()` in `src/infrastructure/audio/WebAudioStreamPlayer.ts` to suspend `AudioContext` without pausing the background audio bridge element, and verify that `stop()` continues to pause the bridge element.
- [x] 1.2 Modify `useMediaSession.ts` in `src/presentation/hooks/useMediaSession.ts` to set `playbackRate: 0` when `isPlaying` is false in `navigator.mediaSession.setPositionState`, and verify the calculation in development build.

## 2. Unit Testing & Verification

- [x] 2.1 Update and run unit tests in `tests/unit/WebAudioStreamPlayer.test.ts` to verify `audioElement` remains active during `pause()` and is paused during `stop()`.
- [x] 2.2 Update and run unit tests in `tests/unit/useMediaSession.test.ts` to verify `playbackRate: 0` when paused and verify all test suites pass via `npm run test:unit`.
