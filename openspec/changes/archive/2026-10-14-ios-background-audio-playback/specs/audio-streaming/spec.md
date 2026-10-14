# Spec Delta: audio-streaming

## ADDED Requirements

### Requirement: iOS and Multiplatform Background Audio Continuity
The system SHALL route Web Audio synthesized speech output through an HTML5 audio element bridge backed by a MediaStream destination, and SHALL configure AudioSession playback intent so that playback persists seamlessly when mobile device screens lock or applications transition to the background.

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
- **THEN** it connects the Web Audio graph's gain node to a `MediaStreamAudioDestinationNode`
- **AND** assigns the resulting stream to the HTML5 audio element's `srcObject`
- **AND** does not require fetching or looping static `/silence-10s.wav` audio files
