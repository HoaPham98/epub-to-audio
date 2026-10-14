# Design: iOS Background Audio Playback Support

## Context

Currently, `WebAudioStreamPlayer` creates an `AudioContext` and connects `gainNode` directly to `audioContext.destination`. In parallel, it creates an `<audio id="background-audio-bridge">` element that loops `/silence-10s.wav` as a dummy bridge for Android MediaSession.

On iOS (Safari/WebKit), Web Audio API is treated as ambient sound:
1. When the screen locks or Safari is minimized, iOS immediately suspends `AudioContext.destination`. Since speech chunks are scheduled directly in `AudioContext`, all audio cuts out instantly.
2. The dummy `/silence-10s.wav` is flagged or paused by iOS power management, which triggers the `audioElement` pause event listener and cancels the entire playback session.
3. Without `navigator.audioSession.type = 'playback'`, iOS treats the web session as ambient, muting it whenever the screen locks or the hardware mute switch is engaged.

## Goals / Non-Goals

**Goals:**
- Provide uninterrupted background playback on iOS Safari / PWA when the device is locked or minimized.
- Route synthesized PCM audio directly into the HTML5 `<audio>` element via `MediaStreamAudioDestinationNode`.
- Eliminate the static `/silence-10s.wav` dummy audio bridge.
- Declare W3C AudioSession intent (`navigator.audioSession.type = 'playback'`) for iOS 16.4+.
- Maintain full parity and compatibility with Android Chrome MediaSession and desktop browsers.

**Non-Goals:**
- Replacing the Web Audio PCM streaming pipeline with native MP3 blob URLs (preserving low-latency ~300ms chunk streaming).
- Bypassing user-directed app termination (when Safari is force-quit from the iOS App Switcher).

## Decisions

### 1. Route Web Audio Graph through MediaStreamDestination to HTMLAudioElement
- **Choice**: Create `mediaStreamDestination = audioContext.createMediaStreamDestination()`, connect `gainNode` to `mediaStreamDestination`, and set `audioElement.srcObject = mediaStreamDestination.stream`.
- **Why**: iOS WebKit treats an `<audio>` element playing a `MediaStream` as an active real-time media stream (equivalent to WebRTC/live media), preventing WebKit from suspending the audio pipeline when the screen turns off.
- **Single Output**: Do not connect `gainNode` to `audioContext.destination` simultaneously, avoiding echo or double-volume playback; the `<audio>` element serves as the primary device speaker output.
- **Alternatives considered**:
  - *Keep silence looping file*: Fails because iOS suspends `AudioContext.destination` regardless of background `<audio>` status.
  - *Convert chunks to WAV/MP3 Blobs for standard `<audio src="blob:...">`*: Introduces re-encoding latency, breaks precise chunk boundary scheduling, and causes audible gaps between chunks.

### 2. AudioSession Category Configuration (`navigator.audioSession`)
- **Choice**: If `'audioSession' in navigator`, set `(navigator as any).audioSession.type = 'playback'`.
- **Why**: Signals to iOS Safari that the web application is a dedicated media player (audiobook/music), ensuring it does not pause on lockscreen and respects media routing.

### 3. Deprecate and Remove `/silence-10s.wav`
- **Choice**: Clear `audioElement.src` and rely purely on `audioElement.srcObject = mediaStreamDestination.stream`.
- **Why**: Real speech audio now passes directly through the `<audio>` element, rendering the dummy silence file obsolete.

### 4. Resilient Lifecycle and Interruption Handling
- **Choice**:
  - Ensure `audioElement.play()` and `audioContext.resume()` are initialized within user touch/click handlers.
  - When paused intentionally: call `audioElement.pause()` and `audioContext.suspend()`.
  - When resumed: call `audioContext.resume()` and `audioElement.play()`.
  - Listen to `visibilitychange`: if document becomes visible while player state is `'playing'` and `audioContext.state === 'suspended'`, resume the context seamlessly.

## Risks / Trade-offs

- **[Risk] Autoplay policy restrictions on `audioElement.play()` with `srcObject`**  
  → *Mitigation*: Initialize and invoke `audioElement.play()` inside the explicit user interaction handler (e.g. initial play button click) before streaming begins.

- **[Risk] Browser compatibility differences with `createMediaStreamDestination`**  
  → *Mitigation*: Fall back gracefully to `audioContext.destination` on legacy environments where `createMediaStreamDestination` or `srcObject` is unsupported.
