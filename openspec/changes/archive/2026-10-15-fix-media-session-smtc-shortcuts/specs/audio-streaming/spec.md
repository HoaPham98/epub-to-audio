# Spec Delta

## MODIFIED Requirements

### Requirement: System and Notification Playback State Synchronization
The system SHALL maintain synchronous and bidirectional playback state alignment between the Web Audio player, the application UI state, and the native operating system MediaSession notification, throttling timeline updates, supporting full OS media transport shortcuts (including previous and next track navigation), and maintaining a persistent action handler lifecycle that prevents notification drawer collapse.

#### Scenario: User pauses playback from Android notification shade
- **WHEN** the user taps the pause action on the Android notification or lockscreen controls
- **THEN** the system immediately and synchronously sets `navigator.mediaSession.playbackState = 'paused'`
- **AND** suspends audio output and updates the application playback state `isPlaying` to `false`

#### Scenario: External hardware or OS pause event
- **WHEN** the underlying audio playback is paused by the operating system (e.g. headphone unplug, Bluetooth disconnection, or native audio focus interruption)
- **THEN** the audio player dispatches a playback state change notification
- **AND** the application state synchronizes `isPlaying` to `false` and reflects `paused` across the UI and MediaSession

#### Scenario: Persistent notification shade across media control interactions
- **WHEN** the user taps any media control button (play, pause, rewind 10s, fast-forward 10s, prev track, next track) on the notification shade
- **THEN** the system executes the requested action without tearing down or rebuilding MediaSession action handlers
- **AND** the notification shade remains expanded for subsequent user interactions without auto-closing

#### Scenario: Focused 3-button audiobook notification layout
- **WHEN** the media session notification is displayed on Android or desktop OS
- **THEN** it exposes rewind 10s (`seekbackward`), play/pause (`play`, `pause`), fast-forward 10s (`seekforward`), plus timeline scrubbing (`seekto`), and registers `previoustrack` and `nexttrack`
- **AND** maps physical hardware media keys and OS transport buttons to chunk/chapter navigation without collapsing the notification drawer

#### Scenario: Full media session action handlers for OS shortcuts and hardware media keys
- **WHEN** the media session initializes
- **THEN** the system registers action handlers for `play`, `pause`, `previoustrack`, `nexttrack`, `seekbackward`, `seekforward`, and `seekto`
- **AND** hardware media keys (Play/Pause, Previous Track, Next Track) and Windows SMTC / macOS / mobile OS controls map directly to chunk navigation and audio playback controls

#### Scenario: Throttled MediaSession position synchronization
- **WHEN** the Web Audio player ticks high-frequency playback time updates (50ms)
- **THEN** `navigator.mediaSession.setPositionState` dispatches are throttled to a minimum interval of 500ms
- **AND** full position state is synchronized immediately upon explicit user seek or chunk change

### Requirement: iOS and Multiplatform Background Audio Continuity
The system SHALL maintain active OS media session continuity and background audio playback across desktop and mobile platforms via an HTML5 audio element bridge playing a looping silent audio track (`/silence-10s.wav`), unlocked synchronously within the initial user gesture, while Web Audio delivers speech audio directly to `audioContext.destination`.

#### Scenario: iOS background playback on device lock
- **WHEN** audio playback is actively progressing and the user locks the mobile device (e.g. iOS Safari) or minimizes the browser
- **THEN** audio playback continues through the audio element bridge without suspension
- **AND** the system does not prematurely cancel or pause the playback queue

#### Scenario: AudioSession playback mode configuration
- **WHEN** the audio player initializes on a platform supporting W3C AudioSession (`navigator.audioSession`)
- **THEN** the system sets `navigator.audioSession.type = 'playback'`
- **AND** playback is not interrupted by physical silent/mute switches

#### Scenario: Real media stream binding replaces dummy silence bridge
- **WHEN** the audio player initializes its audio pipeline
- **THEN** it routes Web Audio directly to `audioContext.destination` and bridges background playback through a dedicated HTML5 silent audio loop element (`/silence-10s.wav`)
- **AND** replaces live `MediaStreamAudioDestinationNode` constraints to ensure Windows SMTC compatibility and immediate user activation retention

#### Scenario: Silent audio loop bridge with immediate user gesture unlock
- **WHEN** the user initiates playback by clicking play or selecting a chunk
- **THEN** the HTML5 audio element bridge immediately starts playing `/silence-10s.wav` in a loop within the synchronous user interaction
- **AND** claims an active OS media session with Windows SMTC and mobile notification systems
- **AND** the Web Audio pipeline routes speech audio directly to `audioContext.destination` without MediaStream constraints
