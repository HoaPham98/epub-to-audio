# Design

## Context

See `proposal.md` for motivation. Currently, `WebAudioStreamPlayer` feeds decoded PCM chunks through a `GainNode` into a `MediaStreamAudioDestinationNode`, which is connected to an HTML5 `<audio id="background-audio-bridge">` element. On mobile platforms (particularly Android Chrome), invoking `audioElement.pause()` on a live `MediaStream` and suspending `AudioContext` causes the browser to detect an ended stream and dismiss the OS notification shade.

Additionally, desktop browser users lack keyboard shortcuts to control playback without clicking the bottom bar buttons.

## Goals / Non-Goals

**Goals:**
- Maintain an active MediaSession notification on Android during pause without collapsing the system notification shade.
- Eliminate pause/resume deadlocks and handle expired buffer nodes gracefully upon resume.
- Support `previoustrack` and `nexttrack` MediaSession actions for Bluetooth headsets and native notification controls.
- Provide responsive desktop keyboard shortcuts (Space, Arrow keys, Mute, Chapter jump) with focus safety guards.

**Non-Goals:**
- Modifying the underlying TTS API streaming protocols or chunk segmentation logic.
- Adding complex key remapping configurations or custom shortcut bindings in user settings.

## Decisions

### Decision 1: Soft-Mute on Pause (Option A)
Instead of calling `audioContext.suspend()` and `audioElement.pause()`, `WebAudioStreamPlayer.pause()` will:
1. Transition `playerState` to `'paused'`.
2. Ramp `gainNode.gain` to `0` immediately to mute output without acoustic popping.
3. Pause the internal ticker interval (`stopTicker()`).
4. Keep `audioElement` and `audioContext` running so the live `MediaStream` continuously outputs digital silence, keeping Android's media session notification alive.
5. Explicitly notify `navigator.mediaSession.playbackState = 'paused'`.

*Alternatives considered:*
- *Dual Source / Switching to silence.wav on pause*: Switching `audioElement.srcObject` back and forth to an audio file URL causes measurable delay (100–300ms) and can trigger audio focus contention on Android.
- *Full AudioContext suspend*: Causes immediate notification shade collapse on Android Chrome.

### Decision 2: Resume Handling and Buffer Expiration Recovery
When `resumeAudio()` is called:
1. `WebAudioStreamPlayer.play()` sets `playerState = 'playing'`, restores `gainNode.gain.value = this.volume`, and restarts the ticker.
2. The player checks `getRemainingBufferedTime()`. If scheduled buffer nodes ran out or expired while the user was paused, the player detects this and invokes a fallback callback to re-stream the current chunk seamlessly from its last reported timestamp.
3. Synchronously set `navigator.mediaSession.playbackState = 'playing'`.

### Decision 3: Desktop Shortcuts Hook (`useDesktopShortcuts`)
A dedicated custom hook `useDesktopShortcuts` will attach a `window` `keydown` listener:
- **Space**: Toggle Play/Pause (`e.preventDefault()` prevents page scroll).
- **ArrowLeft / ArrowRight**: Skip relative -10s / +10s.
- **ArrowUp / ArrowDown**: Increase / decrease volume by 5% (clamped between 0 and 1).
- **'m' / 'M'**: Toggle Mute.
- **'[' / ']'**: Jump to previous / next chapter.
- **Safety check**: If `document.activeElement` is an `INPUT`, `TEXTAREA`, `SELECT`, or `isContentEditable`, the event is ignored to allow normal text entry.

### Decision 4: Expanded MediaSession Action Handlers
In `useMediaSession.ts`, register handlers for `previoustrack` and `nexttrack` in addition to `seekbackward` and `seekforward`:
- `previoustrack`: calls `onPrevChunk` (or previous chapter when at chunk 0).
- `nexttrack`: calls `onNextChunk` (or next chapter when at last chunk).

## Risks / Trade-offs

- **[Risk] Minor battery drain from keeping AudioContext running while muted** → *Mitigation*: When no audio buffer nodes are playing, `AudioContext` processing load is near zero (less than 0.1% CPU).
- **[Risk] Spacebar double-triggering if a button currently has focus** → *Mitigation*: The shortcut handler calls `e.preventDefault()`, and if `document.activeElement instanceof HTMLButtonElement`, it blurs the button or prevents the duplicate click action.
- **[Risk] Audio buffer timing jitter after long pause** → *Mitigation*: When unmuted, the elapsed time check determines whether to resume existing scheduled nodes or restart the active chunk cleanly.
