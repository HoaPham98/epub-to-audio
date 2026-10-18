# Spec Delta

## MODIFIED Requirements

### Requirement: System and Notification Playback State Synchronization
The system SHALL maintain synchronous and bidirectional playback state alignment between the Web Audio player, the application UI state, and the native operating system MediaSession notification, keeping the background audio bridge active via gain-level muting during pause to prevent notification shade dismissal, and supporting responsive notification playback control.

#### Scenario: User pauses playback from Android notification shade
- **WHEN** the user taps the pause action on the Android notification or lockscreen controls
- **THEN** the system immediately and synchronously sets `navigator.mediaSession.playbackState = 'paused'`
- **AND** mutes audio output via the audio graph gain node without suspending the MediaStream or tearing down the audio element
- **AND** updates the application playback state `isPlaying` to `false`

#### Scenario: User resumes playback from Android notification shade
- **WHEN** the user taps the play action on the Android notification or lockscreen controls while paused
- **THEN** the system sets `navigator.mediaSession.playbackState = 'playing'`
- **AND** restores audio output volume and validates that scheduled audio buffers are valid
- **AND** if buffered audio nodes expired during the pause duration, seamlessly re-streams from the active playback position without stalling

#### Scenario: External hardware or OS pause event
- **WHEN** the underlying audio playback is paused by the operating system (e.g. headphone unplug, Bluetooth disconnection, or native audio focus interruption)
- **THEN** the audio player dispatches a playback state change notification
- **AND** the application state synchronizes `isPlaying` to `false` and reflects `paused` across the UI and MediaSession

#### Scenario: Persistent notification shade across media control interactions
- **WHEN** the user taps any media control button (play, pause, rewind 10s, fast-forward 10s, previous/next track) on the Android notification shade
- **THEN** the system executes the requested action without causing the MediaStream to terminate or the notification drawer to auto-close
- **AND** the Android notification shade remains expanded for subsequent user interactions

#### Scenario: Focused 3-button audiobook notification layout
- **WHEN** the media session notification is displayed on Android
- **THEN** it exposes rewind 10s (`seekbackward`), play/pause (`play`, `pause`), and fast-forward 10s (`seekforward`), plus timeline scrubbing (`seekto`) and track skip handlers (`previoustrack`, `nexttrack`)
- **AND** routes media hardware actions to their corresponding player navigation controls

#### Scenario: MediaSession action handler mapping for navigation and seeking
- **WHEN** the media session notification is displayed on Android or desktop
- **THEN** it exposes seek backward (`seekbackward`), seek forward (`seekforward`), play/pause (`play`, `pause`), timeline scrubbing (`seekto`), and chunk navigation (`previoustrack`, `nexttrack`)
- **AND** each registered handler routes to the corresponding audio streamer navigation routine

#### Scenario: Throttled MediaSession position synchronization
- **WHEN** the Web Audio player ticks high-frequency playback time updates (50ms)
- **THEN** `navigator.mediaSession.setPositionState` dispatches are throttled to a minimum interval of 500ms
- **AND** full position state is synchronized immediately upon explicit user seek or chunk change
