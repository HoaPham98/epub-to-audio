# Design

## Context

See `proposal.md` for motivation. Currently, the application utilizes `WebAudioStreamPlayer` for streaming TTS audio via Web Audio API (`AudioContext`), anchored to the native OS MediaSession and Windows SMTC through an HTML5 `<audio id="background-audio-bridge">` playing `/silence-10s.wav`.

When the user pauses, `WebAudioStreamPlayer.pause()` suspends `AudioContext` and calls `audioElement.pause()`. On Chromium on Windows, having all media elements in a paused state releases the SMTC OS controls handle, causing the Windows volume flyout/notification widget to vanish immediately. Additionally, `useMediaSession` passes a non-zero `playbackRate` to `setPositionState` while paused, which conflicts with Windows SMTC timeline validation.

## Goals / Non-Goals

**Goals:**
- Maintain persistent Windows SMTC widget presence when audio is paused, displaying the Play button.
- Ensure OS hardware shortcuts (Play/Pause media keys, Bluetooth buttons) can resume playback after pausing.
- Ensure `navigator.mediaSession.setPositionState` strictly supplies `playbackRate: 0` when `isPlaying === false`.

**Non-Goals:**
- Modifying TTS streaming chunk ingestion or IndexedDB audio caching logic.
- Keeping the audio bridge playing after the user completely exits or stops playback (`stop()`).

## Decisions

### Decision 1: Maintain Silent Audio Bridge Playback During User Pause
- **Choice**: During `WebAudioStreamPlayer.pause()`, suspend `AudioContext` (which stops speech output immediately) but leave `this.audioElement` playing `/silence-10s.wav` in the background. Set `navigator.mediaSession.playbackState = 'paused'`.
- **Rationale**:
  - Chromium Windows SMTC requires an active `HTMLAudioElement` in the page to maintain its active session focus.
  - Because `/silence-10s.wav` is 100% digital silence (amplitude 0), running the loop consumes near-zero CPU and produces zero audible sound or background noise.
  - Setting `playbackState = 'paused'` causes Windows SMTC and mobile notification shades to render the **Play (▶️)** button.
  - When the user presses the OS shortcut or clicks Play, Windows sends the `'play'` action handler to `useMediaSession`, which triggers `resumeAudio()`, calling `audioContext.resume()` and resuming speech seamlessly.
- **Alternatives Considered**:
  - *Attempting to resurrect the session on keypress*: Impossible on Windows because once SMTC drops the session, global keyboard shortcuts are no longer routed to the browser tab.
  - *Muting the audio element*: Setting `muted = true` or `volume = 0` causes Chrome Android to hide the notification drawer, so playing digital silence without pausing the element is the cross-platform standard pattern.

### Decision 2: Report `playbackRate = 0` on Paused Position State
- **Choice**: In `useMediaSession.ts`, pass `playbackRate: isPlaying ? Math.max(0.25, Math.min(3.0, playbackSpeed || 1.0)) : 0` to `navigator.mediaSession.setPositionState`.
- **Rationale**: The W3C Media Session specification and Windows SMTC `TimelineProperties` specify that when playback is paused, the timeline rate of progress is 0. Passing a positive rate while paused leads to timeline verification warnings or teardown in Windows SMTC.

### Decision 3: Explicit Stop and Reset Behavior
- **Choice**: In `WebAudioStreamPlayer.stop(pauseBridge = true)`, actively pause `this.audioElement` and reset timeline states.
- **Rationale**: When playback finishes or the reader is closed/unmounted, system resources and media session locks must be cleanly released.

## Risks / Trade-offs

- **[Risk]** Unintentional background battery drain if user leaves the tab paused indefinitely.
  - **Mitigation**: `/silence-10s.wav` is a tiny looping WAV of pure zeroes decoded into memory, incurring negligible CPU impact. If the tab or component is unmounted, cleanup routines and `stop()` actively pause the element.
- **[Risk]** External pause events (e.g. Bluetooth disconnection, OS audio interrupt) triggering unintended state loops.
  - **Mitigation**: The `audioElement`'s `'pause'` listener checks `if (this.playerState === 'playing' && !this.isInternalPauseAction)` before syncing. When paused deliberately by the app, `isInternalPauseAction` prevents recursive triggers.
