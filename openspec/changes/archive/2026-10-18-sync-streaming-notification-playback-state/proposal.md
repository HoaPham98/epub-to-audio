# Proposal

## Why

Playback controls can report different states: the reader shows paused while the Windows or Android media notification returns to playing, and a Play action can mark the session as playing before audio output has resumed. The UI, player, and Media Session need one confirmed playback state so notification controls represent whether speech audio is actually playing or paused.

## What Changes

- Separate speech playback state from ongoing TTS network streaming and prefetching; receiving PCM while paused must not make the notification report playing.
- Make the player the authority for playback transitions and synchronize the reader UI and Media Session from confirmed player state.
- Report Play only after audio output has resumed successfully; keep or restore the paused state when resume fails, and reconcile browser or operating-system playback interruptions.
- Align the HTML audio bridge's reported playback state with speech playback so its silent loop cannot override the actual player state.
- Keep notification-shade persistence and collapse behavior out of scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `audio-streaming`: Require notification and reader playback state to reflect confirmed speech playback independently of network streaming, including failed resume and external interruption scenarios.

## Impact

- `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Own confirmed output state and bridge lifecycle.
- `src/presentation/hooks/useAudioStreamer.ts`: Synchronize application state from player transitions and distinguish playback from active network streaming.
- `src/presentation/hooks/useMediaSession.ts`: Route actions to the player and reflect confirmed state rather than optimistically changing notification state.
- `tests/unit/WebAudioStreamPlayer.test.ts` and `tests/unit/useMediaSession.test.ts`: Cover confirmed pause/resume state and failures.
- Windows SMTC and Android Chrome Media Session notifications.
