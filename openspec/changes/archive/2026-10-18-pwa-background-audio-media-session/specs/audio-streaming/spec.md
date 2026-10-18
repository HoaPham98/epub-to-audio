# audio-streaming Specification Delta

## ADDED Requirements

### Requirement: Screen-Off Background Audio Playback via HTMLMediaElement Bridge
The system SHALL route Web Audio API (`AudioContext`) output to a `MediaStreamAudioDestinationNode` connected to an HTML `<audio>` element (`srcObject = destination.stream`), keeping the OS background audio session alive when the screen is turned off or when the application is placed in the background on mobile and desktop browsers.

#### Scenario: Continuous background playback when device screen locks
- **WHEN** audio is actively playing or streaming a book chunk
- **AND** the user locks the mobile device or switches to another application
- **THEN** audio continues playing seamlessly through the bridged HTML `<audio>` element without stopping or stuttering
- **AND** the system continues receiving and scheduling sequential audio chunks over the network.

#### Scenario: Audio pipeline initialization on user gesture
- **WHEN** the user initiates playback for the first time
- **THEN** both the `AudioContext` and the bridged HTML `<audio>` element are unlocked simultaneously within the user gesture handler
- **AND** the `<audio>` element plays silence or the piped media stream without throwing autoplay errors.

### Requirement: Media Session API Integration for System Notification and Lock Screen Controls
The system SHALL synchronize playback state, track metadata, and hardware/notification controls via `navigator.mediaSession`, allowing the user to view track information and control playback from the system notification shade and lock screen.

#### Scenario: Displaying rich book and chunk metadata
- **WHEN** audio playback starts or transitions to chunk $Y$ of chapter $X$ in book $B$
- **THEN** the system sets `navigator.mediaSession.metadata` with:
  - `title`: `[Tên chương] - Đoạn Y/TotalChunks`
  - `artist`: `[Tên tác giả]`
  - `album`: `[Tên sách]`
  - `artwork`: The book cover URL (if present) and fallback high-resolution application icons.

#### Scenario: Controlling playback via notification Play/Pause action
- **WHEN** the user triggers the `play` or `pause` action on the system notification or lock screen
- **THEN** the system toggles `AudioPlayer` state between playing and paused
- **AND** updates `navigator.mediaSession.playbackState` to reflect `'playing'` or `'paused'`.

#### Scenario: Navigating chunks via notification Next/Previous Track action
- **WHEN** the user triggers `nexttrack` from the lock screen or notification
- **THEN** the system advances to chunk $Y+1$ (or chunk 0 of chapter $X+1$ if at the end of the chapter)
- **AND** when the user triggers `previoustrack`, the system navigates to chunk $Y-1$ (or the previous chapter if at the start).

#### Scenario: Relative seeking via notification Seek Backward/Forward action
- **WHEN** the user triggers `seekbackward` or `seekforward` with an offset (defaulting to 10 seconds)
- **THEN** the player adjusts playback position backward or forward by the specified amount
- **AND** updates `navigator.mediaSession.setPositionState` with the new position and duration.

### Requirement: Audio Interruption and Audio Focus Handling
The system SHALL automatically respond to external audio interruptions and device audio route changes, pausing audio cleanly when headphones or Bluetooth devices disconnect.

#### Scenario: Headphone or Bluetooth disconnection
- **WHEN** audio is playing and the output audio device is disconnected (headphone unplugged or Bluetooth turned off)
- **THEN** the system pauses audio playback automatically
- **AND** updates the UI and notification state to paused to prevent sudden loudspeaker playback.

#### Scenario: Audio focus loss due to incoming call
- **WHEN** the operating system interrupts the audio session (e.g. incoming call or another media app starts)
- **THEN** the bridged `<audio>` element receives the pause/interruption event
- **AND** the system transitions to paused state, preserving the exact resume position.
