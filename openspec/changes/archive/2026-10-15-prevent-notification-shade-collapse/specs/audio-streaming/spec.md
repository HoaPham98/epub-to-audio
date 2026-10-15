# Spec Delta

## MODIFIED Requirements

### Requirement: Timeline-Based Reader Highlighting Synchronization
The system SHALL track timeline boundaries `{ chapterIndex, chunkIndex, startTime, endTime }` for all scheduled chunks in the audio player and notify presentation components as playback transitions across chunk boundaries, isolating viewport auto-scrolling to chunk index changes while suppressing scroll events during playback state toggles.

#### Scenario: Chunk boundary transition
- **WHEN** the current playback time crosses the start time of the next scheduled chunk
- **THEN** the system fires an `onChunkChange` event
- **AND** the Reader component updates active highlight and scrolls into view without interrupting audio playback

#### Scenario: Play and pause state toggles suppress viewport scroll
- **WHEN** the user toggles play or pause state via the UI, MediaSession, or hardware controls without changing the active chunk
- **THEN** the reader updates playback state indicators without executing any viewport scroll animation

#### Scenario: Background chunk transition suppresses auto-scroll
- **WHEN** audio playback transitions chunk boundaries while the tab is hidden or backgrounded
- **THEN** the reader updates active chunk indexes without executing `scrollIntoView`

### Requirement: System and Notification Playback State Synchronization
The system SHALL maintain synchronous and bidirectional playback state alignment between the Web Audio player, the application UI state, and the native operating system MediaSession notification, throttling timeline updates and maintaining a persistent action handler lifecycle that prevents Android notification drawer collapse.

#### Scenario: User pauses playback from Android notification shade
- **WHEN** the user taps the pause action on the Android notification or lockscreen controls
- **THEN** the system immediately and synchronously sets `navigator.mediaSession.playbackState = 'paused'`
- **AND** suspends audio output and updates the application playback state `isPlaying` to `false`

#### Scenario: External hardware or OS pause event
- **WHEN** the underlying audio playback is paused by the operating system (e.g. headphone unplug, Bluetooth disconnection, or native audio focus interruption)
- **THEN** the audio player dispatches a playback state change notification
- **AND** the application state synchronizes `isPlaying` to `false` and reflects `paused` across the UI and MediaSession

#### Scenario: Persistent notification shade across media control interactions
- **WHEN** the user taps any media control button (play, pause, rewind 10s, fast-forward 10s) on the Android notification shade
- **THEN** the system executes the requested action without tearing down or rebuilding MediaSession action handlers
- **AND** the Android notification shade remains expanded for subsequent user interactions without auto-closing

#### Scenario: Focused 3-button audiobook notification layout
- **WHEN** the media session notification is displayed on Android
- **THEN** it exposes only rewind 10s (`seekbackward`), play/pause (`play`, `pause`), and fast-forward 10s (`seekforward`), plus timeline scrubbing (`seekto`)
- **AND** omits `stop`, `previoustrack`, and `nexttrack` to maximize touch target size and prevent accidental notification dismissal

#### Scenario: Throttled MediaSession position synchronization
- **WHEN** the Web Audio player ticks high-frequency playback time updates (50ms)
- **THEN** `navigator.mediaSession.setPositionState` dispatches are throttled to a minimum interval of 500ms
- **AND** full position state is synchronized immediately upon explicit user seek or chunk change
