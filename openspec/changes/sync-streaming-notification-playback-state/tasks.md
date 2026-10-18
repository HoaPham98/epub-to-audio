# Tasks

## 1. Reproduce and choose media bridge lifecycle

- [x] 1.1 Add regression coverage showing PCM received during pause does not emit a playing transition and verify it passes against the player state contract.
- [x] 1.2 Compare pausing the silent-file bridge with pausing a MediaStream-backed audio element on Windows Chrome and Android Chrome; record paused notification state, Play action availability, and successful resume behavior in the change notes.

## 2. Confirmed player state and error handling

- [x] 2.1 Update player transitions so `playing` is emitted only after output resume succeeds and `paused` is emitted after pause or external interruption; verify ordering and rejected-resume behavior in `WebAudioStreamPlayer` unit tests.
- [x] 2.2 Keep bridge lifecycle aligned with speech playback using the option selected in 1.2; verify repeated pause/resume and bridge interruption behavior in player unit tests.
- [x] 2.3 Surface a rejected resume as a recoverable reader error without changing the confirmed paused state; verify with hook-level coverage or an existing player integration test.

## 3. Synchronize UI and Media Session

- [x] 3.1 Make Media Session play/pause handlers dispatch player commands without optimistic state writes; verify handler tests show playback state changes only after confirmed player events.
- [x] 3.2 Keep reader and notification playback state sourced from player transitions while TTS streaming and prefetch remain independent; verify paused PCM arrival leaves both states paused in hook tests.
- [x] 3.3 Verify on Windows Chrome and Android Chrome that repeated notification/headphone Play and Pause actions keep the notification icon, reader control, and actual speech output aligned after both successful and failed resume attempts.
