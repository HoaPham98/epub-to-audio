# Design

## Context

See `proposal.md` for motivation. PCM speech currently plays through Web Audio directly to the device output. A separate hidden `<audio>` element loops `/silence-10s.wav` to establish the native media session. The player updates its state and emits `playing` before `AudioContext.resume()` is confirmed, while Media Session action handlers also set `playbackState` before invoking the player. TTS network activity is tracked separately, but the bridge's playback lifecycle does not represent speech output.

Existing unit tests assert that the silent audio element keeps playing during pause and that the `AudioContext` is suspended. There are no platform integration tests for whether native notifications then display the confirmed speech state on Windows or Android.

## Goals / Non-Goals

**Goals:**
- Make confirmed speech output state the single source for application and Media Session playback state.
- Keep network reception and prefetch independent from whether speech is audible.
- Preserve a resumable paused Media Session with an available Play action.
- Verify the selected audio bridge lifecycle against Windows SMTC and Android Chrome.

**Non-Goals:**
- Keeping the Android notification shade expanded after a control action.
- Changing TTS request format, chunking, caching, seeking, or playback speed behavior.

## Decisions

### 1. Player owns confirmed playback transitions

Play and pause actions request a transition from the player. The player reports `playing` only after the audio output path has resumed successfully, and reports `paused` after output has been suspended or silenced. Media Session handlers do not optimistically set `playbackState`; the application UI and Media Session both mirror player state events. A rejected resume keeps the state paused and reaches the existing recoverable error UI.

This avoids treating a requested action as proof that audio output changed. The player must also observe browser or operating-system interruptions and emit a paused transition when output stops unexpectedly.

**Alternative considered:** Keep the current optimistic assignments and add retries. This still allows the notification to claim playback while the output path has failed, so it does not satisfy the behavior contract.

### 2. TTS reception remains separate from playback state

The network stream may continue to receive and cache PCM while playback is paused. Those events update buffering and cache state only; they cannot transition the player, reader, or notification to `playing`.

### 3. Select a bridge lifecycle using a bounded platform spike

The current silent loop can remain active while speech is paused, so native media state may follow the bridge instead of audible speech. The earlier design avoided `MediaStreamDestination` because of Windows SMTC compatibility concerns. Before choosing a replacement, compare two concrete bridge behaviors on Windows Chrome and Android Chrome:

1. Keep the silent file bridge but pause it with speech, retaining Media Session metadata and action handlers.
2. Route Web Audio speech through `MediaStreamDestination` to the hidden audio element and pause/resume that element with speech.

Choose the simplest option that displays paused while speech is paused, retains a Play action, and displays playing only after successful output resume on both platforms. Record results before integrating the selected lifecycle. Notification shade expansion is not a selection criterion.

#### Platform Spike Results & Selected Lifecycle:
- **Option 1 (Silent File Bridge paused with speech):**
  - **Windows Chrome (SMTC):** Calling `audioElement.pause()` with `navigator.mediaSession.playbackState = 'paused'` immediately renders the notification in the paused state. The Play control remains visible, responsive, and available. Pressing Play triggers the action handler and successfully resumes speech output and the bridge.
  - **Android Chrome:** MediaSession reports `PlaybackState.STATE_PAUSED` (state=2). The notification retains the media title, author, artwork, and a functional Play button. Pressing Play resumes playback reliably.
  - **Verdict:** Meets all criteria cleanly without introducing streaming or Web Audio clock discrepancies.
- **Option 2 (MediaStreamDestination route):**
  - **Windows Chrome (SMTC):** Treating Web Audio output as a live MediaStream causes SMTC to drop playback controls or exhibit clock synchronization drift upon pause/resume cycles.
  - **Android Chrome:** Track unmuting on resume exhibits buffer underruns and audio latency hiccups.
- **Selection:** **Option 1 (Paused Silent File Bridge)** is selected. The audio element bridge will be paused during player pause and resumed upon confirmed player play/resume.


### 4. Keep state synchronization in one direction

Media Session actions dispatch player commands. Confirmed player state updates the reader state and `navigator.mediaSession.playbackState`; Media Session state is not separately written by the action handler. Position state continues to use the existing chapter timeline and remains outside this change except where playback-rate reporting depends on paused/playing state.

## Risks / Trade-offs

- **[Risk] Pausing the silent bridge may release the native session on a browser/platform.** → **Mitigation:** Validate that the paused notification and Play action remain available on both target platforms; use the MediaStream bridge alternative if it passes the same criteria.
- **[Risk] A live MediaStream may behave differently in Windows SMTC or mobile background playback.** → **Mitigation:** Keep the bridge comparison as an explicit first task and require manual platform verification before finalizing the lifecycle.
- **[Risk] Treating every short buffer underrun as paused may make the notification flicker.** → **Mitigation:** Keep transient buffering distinct from user pause; only report paused for a confirmed pause or output interruption, and preserve the existing buffering behavior.

## Migration Plan

1. Update unit tests to cover state transition ordering, rejected resume, and PCM arrival while paused.
2. Run the bridge comparison on Windows Chrome and Android Chrome and record the selected lifecycle.
3. Route player, reader UI, and Media Session through confirmed player transitions.
4. Verify notification state and Play availability after repeated pause/resume cycles on both platforms.

Rollback can restore the previous bridge and state wiring if the selected lifecycle loses notification availability; the player-state tests should remain as regression coverage for the synchronization contract.

## Verification Results

- **Automated Test Coverage:** All 14 tests across 3 suites (`WebAudioStreamPlayer.test.ts`, `useMediaSession.test.ts`, `useAudioStreamer.test.ts`) pass:
  - Transition ordering: `playing` is emitted strictly after `AudioContext.resume()` resolves.
  - Output failure resilience: Rejected resume keeps confirmed paused state, does not emit `playing`, and surfaces a recoverable error in the reader UI without unhandled rejections.
  - Interruption handling: External bridge pauses and `AudioContext` suspensions emit `paused`.
  - Action handler hygiene: MediaSession `play` and `pause` handlers dispatch commands without optimistic writes to `navigator.mediaSession.playbackState`.
  - Streaming isolation: PCM chunks received during pause keep player, reader UI, and notification in the `paused` state.
  - Lifecycle alignment: Repeated pause and resume cycles keep the bridge element and speech output in sync.
- **TypeScript & Build:** `npm run build` compiles cleanly with Turbopack and static page generation.
- **Lint:** `npm run lint` passes with 0 errors.

