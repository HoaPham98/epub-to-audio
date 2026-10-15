# Proposal

## Why

When a user pauses playback on Windows Desktop (Chrome / Chromium), the Windows System Media Transport Controls (SMTC) volume flyout and notification widget disappear immediately. Consequently, hardware media shortcuts (Play/Pause, Headset buttons) and OS media controls cannot be used to resume playback.

This happens because `WebAudioStreamPlayer.pause()` was actively calling `audioElement.pause()`, causing Chromium to drop the active media session anchor when both Web Audio is suspended and all `<audio>` elements are paused. Additionally, `useMediaSession.ts` was reporting a non-zero `playbackRate` (e.g. 1.0) while in `playbackState: 'paused'`, causing Windows SMTC timeline property validation conflicts.

## What Changes

- Keep the silent audio bridge (`/silence-10s.wav` loop on `<audio id="background-audio-bridge">`) running in the background when playback is paused:
  - User pause suspends `AudioContext` to halt spoken audio immediately, but keeps the zero-audibility silent loop playing.
  - `navigator.mediaSession.playbackState` is updated to `'paused'`.
  - Windows SMTC retains the active media session and displays the Play button instead of discarding the flyout.
  - When the user presses the OS shortcut or clicks Play, the MediaSession `'play'` action handler resumes `AudioContext` and toggles `playbackState` back to `'playing'`.
- Only pause the silent audio bridge element when playback is explicitly stopped (`stop()`) or when leaving the reading view.
- Update `setPositionState` in `useMediaSession.ts` so `playbackRate` is `0` when paused (`isPlaying === false`), and reflects `playbackSpeed` only when playing.

## Capabilities

### Modified Capabilities

- `audio-streaming`: Update the requirements for System and Notification Playback State Synchronization (valid `playbackRate` during pause) and Multiplatform Background Audio Continuity (retaining silent audio bridge playback during pause to anchor OS media controls).

## Impact

- `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Modify `pause()` to keep the background audio bridge playing while suspending `AudioContext`, and ensure `stop()` pauses the bridge.
- `src/presentation/hooks/useMediaSession.ts`: Set `playbackRate: isPlaying ? speed : 0` in `setPositionState`.
- `tests/unit/useMediaSession.test.ts` & `tests/unit/WebAudioStreamPlayer.test.ts`: Verify persistent SMTC bridge behavior and accurate paused `playbackRate`.
