# Spec Delta

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
- **WHEN** playback is paused while a chunk stream is in progress or subsequent chunks are being pre-buffered
- **THEN** the system continues sequentially receiving and queueing streamed audio deltas for upcoming chunks until the total buffered text length reaches the target prefetch threshold (800–1,200 characters)
- **AND** once the threshold is satisfied, the system stops prefetching to conserve network bandwidth and API quota
- **AND** the system strictly maintains `AudioContext` in suspended state so that background buffers never produce unexpected audible sound

### Requirement: Strict Sequential Chaining for Single-Stream Endpoints
The system SHALL support strict sequential chaining for CPU-only backends with `max_streams=1`, initiating the stream for subsequent chunks sequentially whenever the forward buffer depth is below the target window, ensuring exactly $\le 1$ active network request at all times.

#### Scenario: Immediate chaining of next chunk stream
- **WHEN** a chunk stream completes receiving `speech.audio.done` from the server
- **AND** the total unplayed buffered text ahead of the playhead is less than the prefetch threshold (800–1,200 characters)
- **THEN** the system immediately starts streaming the next sequential chunk and appends its audio buffers to the active timeline

#### Scenario: Single active network stream guarantee
- **WHEN** a chunk is actively streaming from the server
- **THEN** no other prefetch or background requests are initiated until the current stream closes

## ADDED Requirements

### Requirement: Token-Based Sliding Window Prefetch Evaluation
The system SHALL calculate remaining unplayed text length in the forward buffer and trigger prefetching whenever unplayed buffered characters drop below the minimum threshold (800–1,200 characters).

#### Scenario: Maintaining forward buffer during playback
- **WHEN** audio playback advances and unplayed text in the forward buffer falls below 800 characters
- **AND** no TTS network stream is currently active
- **THEN** the system automatically dispatches a prefetch request for the next chunk to maintain continuous playback

#### Scenario: Throttling prefetch when safe threshold is met
- **WHEN** unplayed text in the forward audio buffer reaches or exceeds 1,200 characters
- **THEN** the system suspends further prefetch requests until playback drains the buffer below the minimum threshold

### Requirement: Cross-Chapter Prefetch Continuity
The system SHALL allow the prefetch sliding window to cross chapter boundaries when `autoNext` is enabled and remaining text in the active chapter is insufficient to satisfy the buffer threshold.

#### Scenario: Seamless prefetching across chapter boundaries
- **WHEN** the active chapter has fewer than 800 unplayed characters remaining across all its pending chunks
- **AND** `autoNext` is enabled and a subsequent chapter exists
- **THEN** the prefetch evaluator chains into chunk 0 of the next chapter without interrupting current audio playback

#### Scenario: Halting at chapter end when autoNext is disabled
- **WHEN** the active chapter ends and `autoNext` is disabled
- **THEN** the system does not prefetch into the next chapter and stops once the current chapter's chunks are fully queued
