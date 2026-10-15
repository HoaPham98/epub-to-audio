# Proposal: Fix Media Session & Windows SMTC OS Shortcuts

## Why

On Chrome Desktop on Windows (and other desktop environments), users cannot control audio playback using operating system media shortcuts (e.g. keyboard Play/Pause, Next Track, Previous Track keys, Bluetooth headset media buttons, or the Windows System Media Transport Controls volume flyout overlay) because the browser fails to register an active OS media session.

This occurs due to three fundamental issues:
1. The previous implementation attempts to route Web Audio through `MediaStreamAudioDestinationNode` to an `<audio>` element without a standard media file `src`. Chromium treats `srcObject = MediaStream` as a live WebRTC/capture stream, failing to register with Windows SMTC.
2. When starting playback, the `<audio>` element was immediately paused via `audioPlayer.stop()` before initiating the network TTS stream. By the time PCM audio arrives 500ms–2000ms later, the browser's user activation (transient gesture token) has expired, causing Chrome to block asynchronous `<audio>.play()` attempts.
3. MediaSession action handlers for `previoustrack` and `nexttrack` were completely omitted, disabling OS-level next/previous media keys.

Fixing this now restores full desktop OS integration, hardware media key shortcuts, and background media controls across Windows, macOS, Android, and iOS.

## What Changes

- **Silent Audio Loop Bridge**: Use the existing `/silence-10s.wav` as a persistent looping audio bridge (`<audio src="/silence-10s.wav" loop>`) to securely lock user activation immediately on user click and maintain an active, audible HTMLMediaElement recognized by Windows SMTC and macOS Now Playing.
- **Direct Web Audio Output**: Connect the Web Audio `gainNode` directly to `audioContext.destination` so speech audio plays natively with zero latency, uninhibited by MediaStream capture constraints.
- **Immediate User Gesture Unlock**: Ensure `audioElement.play()` and `audioContext.resume()` are triggered synchronously within the user interaction event before any asynchronous network TTS streaming commences, eliminating `NotAllowedError` autoplay blockages.
- **Complete MediaSession Action Handlers**: Register `previoustrack` (navigating to previous chunk or previous chapter) and `nexttrack` (navigating to next chunk or next chapter) handlers alongside existing `play`, `pause`, `seekbackward`, `seekforward`, and `seekto` handlers.
- **Bi-directional State Synchronization**: Keep the silent audio bridge in sync with the Web Audio playback state (`play`, `pause`, `stop`) so that OS-level controls accurately reflect whether playback is active or paused.
- **Automated E2E Verification Scripts**: Provide `scripts/test-media-keys.ps1` for Win32 OS hardware media key automation and browser-level MediaSession verification.

## Capabilities

### New Capabilities
<!-- None: This builds on top of the existing audio-streaming capability -->

### Modified Capabilities
- `audio-streaming`: Update requirements for MediaSession action handlers to register `previoustrack` and `nexttrack` for OS shortcuts, and update background audio continuity to utilize the HTML5 silent audio loop bridge for robust Windows SMTC and multiplatform OS media integration.

## Impact

- `src/presentation/hooks/useMediaSession.ts`: Add `previoustrack` and `nexttrack` action handler registrations.
- `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Refactor HTML5 audio bridge to load `/silence-10s.wav` with `loop = true`, connect Web Audio `gainNode` directly to `audioContext.destination`, and ensure atomic play/pause/stop synchronization.
- `src/presentation/hooks/useAudioStreamer.ts`: Ensure user gesture unlock is called synchronously before async TTS stream calls.
- `scripts/test-media-keys.ps1`: Windows OS hardware media key simulation script for automated testing.
- `openspec/specs/audio-streaming/spec.md`: Synchronize requirement changes with delta specs.

