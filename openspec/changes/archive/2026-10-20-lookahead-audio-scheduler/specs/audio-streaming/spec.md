# Spec Delta: audio-streaming

## MODIFIED Requirements

### Requirement: Pre-Buffered Web Audio Playback
The system SHALL use Web Audio API (`AudioContext`) with a configurable 150–300ms lead-in buffer (300ms for CPU backends) to schedule PCM s16le audio playback smoothly without network jitter stalls, utilizing an in-memory buffer queue and a dynamic lookahead scheduler (100–200ms lookahead window) that adapts instantly to playback speed adjustments without generating silence gaps, and support non-destructive suspend/resume state on pause with a strict audio output suspension lock.

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
- **WHEN** playback is paused while a chunk stream is in progress or subsequent chunks are being pre-buffered
- **THEN** the system continues sequentially receiving and queueing streamed audio deltas for upcoming chunks until the total buffered text length reaches the target prefetch threshold (800–1,200 characters)
- **AND** once the threshold is satisfied, the system stops prefetching to conserve network bandwidth and API quota
- **AND** the system strictly maintains `AudioContext` in suspended state so that background buffers never produce unexpected audible sound

#### Scenario: Dynamic lookahead scheduling without eager timeline lock
- **WHEN** audio buffers for future chunks or deltas are received from network or cache
- **THEN** the system enqueues them into an in-memory buffer queue and dispatches nodes to `AudioContext` only within a short lookahead window (100–200ms)
- **AND** does NOT eagerly commit nodes seconds into the future at rigid absolute timestamps

#### Scenario: Instant playback speed adjustment across queued buffers
- **WHEN** the user modifies playback speed (e.g. from 1.0x to 1.5x or 2.0x) during active playback or while paused
- **THEN** the active playing node's playback rate is updated immediately
- **AND** subsequent queued buffers in the in-memory queue are scheduled with their duration scaled by the new playback speed
- **AND** the next chunk starts immediately upon conclusion of the current chunk's scaled speech output without waiting for the 1.0x duration to elapse

### Requirement: Timeline-Based Reader Highlighting Synchronization
The system SHALL track timeline boundaries `{ chapterIndex, chunkIndex, startTime, endTime }` for all scheduled chunks in the audio player and notify presentation components as playback transitions across chunk boundaries, isolating viewport auto-scrolling to chunk index changes while suppressing scroll events during playback state toggles, and dynamically recalculating boundary end times when playback speed changes.

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

#### Scenario: Recalculating boundary timestamps on speed adjustment
- **WHEN** playback speed is changed while chunk boundaries are tracked in the player
- **THEN** the player recalculates remaining boundary durations and end times according to the new speed
- **AND** dispatches `onChunkChange` and scrubber progress synchronously when the audio reaches the actual end of the current chunk at the new speed
