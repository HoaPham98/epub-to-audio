# Spec Delta

## MODIFIED Requirements

### Requirement: Scrubber and Speech Duration Buffer Estimation
The system SHALL present playback progress and buffer depth relative to the active chapter duration, estimating total chapter duration from chunk character counts (~16 chars/second) and dynamically refining as chunks decode.

#### Scenario: Visual buffer bar progression during stream reception
- **WHEN** audio packets arrive or chunks are prefetched into the active chapter queue
- **THEN** the scrubber bar displays a buffered range overlay proportional to `chapterBufferedTime / chapterTotalDuration`
- **AND** displays an informative status badge `Đệm trước: +Xs` indicating forward buffer seconds ahead of current playback position

#### Scenario: Snapping to exact duration on stream completion
- **WHEN** a chunk finishes decoding or streaming
- **THEN** the system updates the chapter duration table with the exact decoded audio length, refining total chapter duration without jitter

## ADDED Requirements

### Requirement: Chapter-Scoped Scrubbing and Playhead Mapping
The system SHALL map scrubber seek actions across the entire active chapter, jumping playback to the corresponding chunk and synchronizing Reader highlighting.

#### Scenario: User seeks across chapter timeline
- **WHEN** the user drags or clicks on the chapter scrubber bar at timestamp $T$
- **THEN** the system calculates which chunk in the chapter contains timestamp $T$
- **AND** jumps playback to that chunk, scrolling the Reader view to the active text position
- **AND** cancels any stale prefetch streams to begin streaming fresh from the target chunk

#### Scenario: Chapter transition resets timeline
- **WHEN** playback naturally completes the final chunk of a chapter and transitions to the next chapter
- **THEN** the chapter scrubber resets its timeline to `00:00` spanning the duration of the new chapter

### Requirement: System and Notification Playback State Synchronization
The system SHALL maintain synchronous and bidirectional playback state alignment between the Web Audio player, the application UI state, and the native operating system MediaSession notification.

#### Scenario: User pauses playback from Android notification shade
- **WHEN** the user taps the pause action on the Android notification or lockscreen controls
- **THEN** the system immediately and synchronously sets `navigator.mediaSession.playbackState = 'paused'`
- **AND** suspends audio output and updates the application playback state `isPlaying` to `false`

#### Scenario: External hardware or OS pause event
- **WHEN** the underlying audio playback is paused by the operating system (e.g. headphone unplug, Bluetooth disconnection, or native audio focus interruption)
- **THEN** the audio player dispatches a playback state change notification
- **AND** the application state synchronizes `isPlaying` to `false` and reflects `paused` across the UI and MediaSession
