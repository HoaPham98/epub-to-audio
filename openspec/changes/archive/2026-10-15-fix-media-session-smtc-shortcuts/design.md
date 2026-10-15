# Design: Fix Media Session & Windows SMTC OS Shortcuts

## Context

See [proposal.md](proposal.md) for motivation.

The application uses Web Audio API (`AudioContext`) to schedule real-time streaming PCM deltas from VieNeu-TTS. To integrate with operating system media controls and keep background playback alive on mobile platforms, an HTML5 `<audio>` element bridge is used alongside the W3C Media Session API (`navigator.mediaSession`).

However, on Chrome Desktop on Windows:
- Windows SMTC (System Media Transport Controls) ignores `<audio>` elements whose `srcObject` is a `MediaStream` from `createMediaStreamDestination()`, because Chromium's `WebMediaPlayerMS` treats it as a live capture/WebRTC stream without a standard finite timeline.
- Calling `audioPlayer.stop()` at the beginning of `StreamAndPlayChunkUseCase` pauses the `<audio>` element. After a 500ms–2s network delay for TTS generation, calling `play()` fails because the browser's transient user activation window has expired.
- Missing `previoustrack` and `nexttrack` handlers cause OS media key shortcuts to be disabled.

## Goals / Non-Goals

**Goals:**
- Enable Windows SMTC, keyboard media keys (Play/Pause, Next Track, Previous Track), and Bluetooth headset buttons to control playback on Chrome Desktop (Windows), macOS, Android, and iOS.
- Guarantee that the HTML5 audio bridge is unlocked immediately and synchronously within the user gesture event, preventing any `NotAllowedError` or autoplay rejections.
- Maintain seamless Web Audio low-latency playback by routing `gainNode` directly to `audioContext.destination`.
- Provide complete bidirectional synchronization between the silent bridge, Web Audio playback state, UI state, and OS MediaSession metadata/timeline.

**Non-Goals:**
- Modifying TTS streaming protocols (SSE PCM streaming remains unchanged).
- Altering the sliding prefetch window (800–1200 characters) or IndexedDB caching logic.

## Decisions

### 1. Replace MediaStream Bridge with Silent Audio Loop Bridge (`/silence-10s.wav`)

- **Decision**: In `WebAudioStreamPlayer`, configure the HTML5 bridge `<audio id="background-audio-bridge">` to use `src="/silence-10s.wav"` with `loop = true`. Connect the Web Audio `gainNode` directly to `this.audioContext.destination`.
- **Rationale**:
  - Chromium on Windows natively recognizes standard HTMLMediaElements with an audio file `src` and assigns them to Windows SMTC.
  - `/silence-10s.wav` is already bundled in `public/` and requires no runtime encoding overhead.
  - Playing pure digital silence on the bridge element avoids audio interference or ducking, while Web Audio delivers speech directly to the hardware audio output.
- **Alternatives Considered**:
  - *Keep `MediaStreamDestination`*: Rejected because Chromium's `WebMediaPlayerMS` causes persistent Windows SMTC integration bugs and timeline conflicts (`duration = Infinity` vs finite chapter duration).
  - *Data URI base64 silent WAV*: Usable, but `/silence-10s.wav` is already cached by Service Worker and available locally.

### 2. Synchronous User Gesture Preservation

- **Decision**:
  - In `useAudioStreamer.ts` (inside `togglePlayPause`, `playChunk`, `resumeAudio`, `handleChunkClick`), invoke `audioPlayer.ensureAudioElementPlaying()` synchronously within the click event.
  - In `WebAudioStreamPlayer.ts`, when `stop()` is invoked as part of a chunk transition (e.g., in `StreamAndPlayChunkUseCase`), keep the audio element playing or prepare it so that user activation is maintained, or only pause the Web Audio nodes while letting the silent bridge maintain the OS media session.
- **Rationale**:
  - Browsers allow HTMLMediaElement playback only within transient activation windows (typically 1–5 seconds from a physical click/keypress). Calling `audioElement.play()` synchronously during the click ensures the audio element enters the `playing` state before any asynchronous network delays.

### 3. Register Complete Action Handlers in `useMediaSession.ts`

- **Decision**: Register `previoustrack` and `nexttrack` in `actionHandlers`:
  ```typescript
  [
    'previoustrack',
    () => {
      callbacksRef.current.onPrevChunk();
    },
  ],
  [
    'nexttrack',
    () => {
      callbacksRef.current.onNextChunk();
    },
  ],
  ```
- **Rationale**:
  - Windows SMTC maps the hardware Previous Track and Next Track keys (`VK_MEDIA_PREV_TRACK`, `VK_MEDIA_NEXT_TRACK`) and the volume overlay skip buttons directly to these handlers.
  - Enables smooth chunk-by-chunk and chapter-by-chapter navigation from any OS shortcut.

## Risks / Trade-offs

- **[Risk] Multiple audio sources (Silent bridge + Web Audio output)**:
  - *Mitigation*: The silent bridge file contains zero-amplitude PCM samples. In `setVolume()`, adjust `gainNode` for speech audio while keeping `audioElement.muted = false` (as Chrome Android hides the media notification shade if the media element is muted).
- **[Risk] State desync between silent bridge and Web Audio playback**:
  - *Mitigation*: Centralize state transitions in `WebAudioStreamPlayer.play()`, `pause()`, and `stop()` so that `audioElement` and `audioContext` pause and resume atomically.

## Migration Plan

1. Update `useMediaSession.ts` to add `previoustrack` and `nexttrack` handlers.
2. Refactor `WebAudioStreamPlayer.ts` to load `/silence-10s.wav` on `audioElement`, connect `gainNode` to `audioContext.destination`, and cleanly manage pause/play synchronization.
3. Verify synchronous unlock in `useAudioStreamer.ts` on user interactions.
4. Add automated E2E scripts (`scripts/test-media-keys.ps1` for Windows global media keys and browser-level MediaSession verification).
5. Verify on Windows 10/11 Chrome Desktop (keyboard media keys, Windows volume flyout overlay) and mobile devices.

