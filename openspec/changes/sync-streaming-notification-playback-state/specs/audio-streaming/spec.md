# Spec Delta

## MODIFIED Requirements

### Requirement: iOS and Multiplatform Background Audio Continuity
The system SHALL maintain active OS media session continuity and background audio playback across desktop and mobile platforms, using an HTML5 audio element bridge that represents the actual speech playback state and remains available for system media controls while paused.

#### Scenario: iOS background playback on device lock
- **WHEN** audio playback is actively progressing and the user locks the mobile device (e.g. iOS Safari) or minimizes the browser
- **THEN** audio playback continues through the audio element bridge without suspension
- **AND** the system does not prematurely cancel or pause the playback queue

#### Scenario: AudioSession playback mode configuration
- **WHEN** the audio player initializes on a platform supporting W3C AudioSession (`navigator.audioSession`)
- **THEN** the system sets `navigator.audioSession.type = 'playback'`
- **AND** playback is not interrupted by physical silent/mute switches

#### Scenario: Real media stream binding replaces dummy silence bridge
- **WHEN** a platform spike confirms that a MediaStream-backed audio element can retain system media controls and accurately represent speech state
- **THEN** the system routes speech audio through that media element bridge
- **AND** does not use a separately playing silent loop to represent speech playback

#### Scenario: Silent audio loop bridge with immediate user gesture unlock
- **WHEN** a platform requires a silent audio loop bridge to establish system media controls
- **THEN** the system starts the bridge during the initial user gesture
- **AND** its reported playback state is synchronized with confirmed speech playback

#### Scenario: Silent audio bridge retention on pause
- **WHEN** the silent audio loop is the selected supported bridge and speech playback is paused
- **THEN** the bridge lifecycle preserves an available paused media session with a Play action
- **AND** the notification reports paused rather than playing

#### Scenario: Media bridge follows confirmed speech state
- **WHEN** speech playback is paused or resumed
- **THEN** the HTML audio bridge and Media Session report the confirmed speech playback state
- **AND** the paused media session remains available with a Play action
- **AND** the chosen bridge lifecycle is verified on Windows Chrome and Android Chrome

#### Scenario: Bridge paused on explicit stop
- **WHEN** playback is explicitly stopped or reset by the reader
- **THEN** the HTML audio element bridge is paused and the media session is released

## ADDED Requirements

### Requirement: Notification Playback State Follows Confirmed Speech Output
The system SHALL keep the reader and native media notification aligned with confirmed speech playback state, independently of TTS network streaming or prefetch activity.

#### Scenario: Pausing while TTS data continues to arrive
- **WHEN** speech playback is paused while a TTS request or prefetch is still receiving audio data
- **THEN** the reader and media notification remain in the paused state
- **AND** incoming data does not change playback state to playing

#### Scenario: Paused notification remains resumable
- **WHEN** speech playback is paused from the reader or a system media control
- **THEN** the media notification shows the paused state and provides a Play action while the media session remains available

#### Scenario: Successful resume from a media control
- **WHEN** the user requests Play from a notification or hardware media control
- **AND** speech audio output resumes successfully
- **THEN** the reader and media notification report playing
- **AND** the notification does not report playing before output has resumed

#### Scenario: Resume fails
- **WHEN** the user requests Play but audio output cannot resume
- **THEN** the reader and media notification remain paused
- **AND** the reader presents a recoverable playback error

#### Scenario: Playback is interrupted externally
- **WHEN** the browser or operating system suspends speech output while playback is reported as playing
- **THEN** the reader and media notification transition to paused
