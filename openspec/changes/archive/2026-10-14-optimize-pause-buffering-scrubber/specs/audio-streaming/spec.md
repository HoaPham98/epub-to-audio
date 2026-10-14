# Spec Delta: audio-streaming

## MODIFIED Requirements

### Requirement: Pre-Buffered Web Audio Playback
The system SHALL use Web Audio API (`AudioContext`) with a configurable 150–300ms lead-in buffer (300ms for CPU backends) to schedule PCM s16le audio playback smoothly without network jitter stalls, and support non-destructive suspend/resume state on pause with a strict audio output suspension lock.

#### Scenario: Starting playback after lead-in buffer
- **WHEN** incoming streamed PCM audio reaches the lead-in buffer threshold (150–300ms)
- **THEN** playback starts immediately through AudioContext before the rest of the stream finishes

#### Scenario: Graceful re-buffering on buffer underrun
- **WHEN** the audio queue becomes empty before the next chunk buffer arrives
- **THEN** the system pauses audio output cleanly without pops or crackles and resumes once 300ms lead-in buffer is refilled

#### Scenario: Suspending and resuming audio on pause
- **WHEN** the user pauses playback while audio is actively playing or streaming
- **THEN** the system calls `AudioContext.suspend()` to freeze audio output while preserving scheduled nodes in memory
- **AND** when the user unpauses, the system calls `AudioContext.resume()` to immediately continue playback from the exact paused millisecond without re-fetching

#### Scenario: Background pre-buffering while paused
- **WHEN** playback is paused while a chunk stream is in progress or pre-buffering chunk $N+1$
- **THEN** the system continues receiving and queueing streamed audio deltas for the active chunk and subsequent chunk ($N+1$)
- **AND** the system strictly maintains `AudioContext` in suspended state so that background buffers never produce unexpected audible sound

### Requirement: Immediate Stream Cancellation on User Action
The system SHALL abort in-flight TTS streaming requests and halt active playback nodes when the user seeks or jumps to another chunk or chapter, while preserving in-flight streams on pause and toggling pause/resume when interacting with the active chunk.

#### Scenario: User pauses during streaming
- **WHEN** playback is paused while a TTS stream is active
- **THEN** the system suspends audio output but keeps the network stream active to buffer ahead

#### Scenario: User clicks active playing chunk in Reader
- **WHEN** the user clicks the action button of the chunk currently being played
- **THEN** the system pauses playback without aborting or restarting the active stream

#### Scenario: User clicks active paused chunk in Reader
- **WHEN** the user clicks the action button of the active chunk while paused
- **THEN** the system resumes playback from the exact paused position

#### Scenario: User skips to a different chunk
- **WHEN** the user clicks on a different chunk or navigates to another chapter while streaming
- **THEN** the previous stream is cancelled immediately via AbortSignal to release the TTS server slot and the new chunk stream begins

## ADDED Requirements

### Requirement: First-Packet Ready State and Contextual Chunk Playback Controls
The system SHALL transition the playback state machine from connecting to playing as soon as the first playable audio packet arrives, immediately unlocking user pause controls, and SHALL render contextual action labels on chunk items.

#### Scenario: Unlocking pause control upon first packet arrival
- **WHEN** audio streaming initiates and the first audio delta (~300ms lead-in) is decoded and queued
- **THEN** the system sets `isLoading = false` and `isPlaying = true`
- **AND** enables the Pause button in the audio player bar immediately without waiting for stream completion

#### Scenario: Contextual action labels on Reader chunks
- **WHEN** a chunk is currently playing
- **THEN** its action button displays `Tạm dừng`
- **AND** when the active chunk is paused, its action button displays `Tiếp tục`
- **AND** while a subsequent chunk is pre-buffering in background, it displays an isolated pre-buffering indicator `Đang nạp sẵn...` without marking the paused chunk as buffering

### Requirement: Scrubber and Speech Duration Buffer Estimation
The system SHALL estimate chunk duration based on character count ($~16$ characters per second) during initial stream download, dynamically rendering real-time buffer progress on the scrubber bar until stream completion.

#### Scenario: Visual buffer bar progression during stream reception
- **WHEN** audio packets arrive over the network while the chunk stream is in progress
- **THEN** the scrubber bar displays a buffered range overlay that visibly advances proportional to received audio versus estimated total duration
- **AND** displays an informative status badge `Đã đệm: X.Xs / ~Y.Ys`

#### Scenario: Snapping to exact duration on stream completion
- **WHEN** the server completes streaming the current chunk (`onNetworkDone`)
- **THEN** the system updates total chunk duration to the exact decoded audio length
- **AND** sets the current chunk buffered ratio to 100%
