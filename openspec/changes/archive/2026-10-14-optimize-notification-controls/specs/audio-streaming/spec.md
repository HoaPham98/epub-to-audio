# Spec Delta

## MODIFIED Requirements

### Requirement: System and Notification Playback State Synchronization
The system SHALL maintain synchronous and bidirectional playback state alignment between the Web Audio player, the application UI state, and the native operating system MediaSession notification, presenting a streamlined 3-button audiobook control layout and maintaining a persistent action handler lifecycle that prevents notification drawer collapse.

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
