# audio-streaming Specification

## Purpose

Enables low-latency real-time audio playback using Web Audio API streaming from VieNeu-TTS via Server-Sent Events (SSE) with lead-in pre-buffering, gapless chunk transitions, and immediate server slot cancellation.

## Requirements

### Requirement: Low-Latency SSE Audio Streaming
The system SHALL ingest audio chunks streamed via Server-Sent Events (SSE) from the TTS endpoint (`POST /v1/audio/speech` with `stream_format=sse` and `response_format=pcm`) and dispatch audio deltas immediately to the playback pipeline.

#### Scenario: Successful SSE stream ingestion
- **WHEN** the user initiates playback for a text chunk
- **THEN** the system sends a request with `stream_format=sse` and `response_format=pcm`
- **AND** processes each `speech.audio.delta` base64 payload as it arrives

#### Scenario: Stream completion
- **WHEN** the server sends `speech.audio.done`
- **THEN** the system marks the streaming phase complete and triggers cache persistence

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

### Requirement: Timeline-Based Reader Highlighting Synchronization
The system SHALL track timeline boundaries `{ chapterIndex, chunkIndex, startTime, endTime }` for all scheduled chunks in the audio player and notify presentation components as playback transitions across chunk boundaries.

#### Scenario: Chunk boundary transition
- **WHEN** the current playback time crosses the start time of the next scheduled chunk
- **THEN** the system fires an `onChunkChange` event
- **AND** the Reader component updates active highlight and scrolls into view without interrupting audio playback

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

### Requirement: Streaming Proxy Passthrough
The local API proxy (`/api/tts-proxy`) SHALL stream data chunks directly to the client via `ReadableStream` without buffering the entire response in server memory, and forward request abort signals upstream.

#### Scenario: Proxying SSE stream without buffering
- **WHEN** a client sends a streaming TTS request via `/api/tts-proxy`
- **THEN** the proxy passes the upstream response body as a real-time stream with matching content type headers

#### Scenario: Upstream abort signal forwarding
- **WHEN** a client aborts the proxy HTTP connection
- **THEN** the proxy immediately aborts the upstream fetch request to terminate server-side generation

### Requirement: Audio Cache Persistence
The system SHALL collect received PCM audio deltas into a complete audio file in IndexedDB once streaming completes, allowing instantaneous replay without network requests.

#### Scenario: Replaying a previously cached chunk
- **WHEN** playback is requested for a chunk already present in the IndexedDB cache
- **THEN** the system plays the cached audio immediately without contacting the TTS server

### Requirement: Server Busy and HTTP 429 Resilience
The system SHALL intercept HTTP 429 (Too Many Requests) and server busy responses, executing automatic exponential backoff retries without crashing or requiring application reload.

#### Scenario: Automatic retry on HTTP 429 response
- **WHEN** the TTS endpoint returns HTTP 429
- **THEN** the client waits for the delay specified in `Retry-After` (or exponential backoff intervals of 1s, 2s, 4s) and retries the request up to 3 times
- **AND** displays an informative status message to the user during the retry interval

#### Scenario: Recovery after retries exhausted
- **WHEN** all automatic retries fail
- **THEN** the system displays a clear error message with a manual "Thử lại" action button that restarts the stream without requiring a full page refresh

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
The system SHALL present playback progress and buffer depth relative to the active chapter duration, estimating total chapter duration from chunk character counts (~16 chars/second) and dynamically refining as chunks decode.

#### Scenario: Visual buffer bar progression during stream reception
- **WHEN** audio packets arrive or chunks are prefetched into the active chapter queue
- **THEN** the scrubber bar displays a buffered range overlay proportional to `chapterBufferedTime / chapterTotalDuration`
- **AND** displays an informative status badge `Đệm trước: +Xs` indicating forward buffer seconds ahead of current playback position

#### Scenario: Snapping to exact duration on stream completion
- **WHEN** a chunk finishes decoding or streaming
- **THEN** the system updates the chapter duration table with the exact decoded audio length, refining total chapter duration without jitter

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

### Requirement: Chapter-Scoped Scrubbing and Playhead Mapping
The system SHALL map scrubber seek actions across the entire active chapter, jumping playback to the corresponding chunk and synchronizing Reader highlighting.

#### Scenario: User seeks across chapter timeline
- **WHEN** the user drags or clicks on the chapter scrubber bar at timestamp $T$
- **THEN** the system calculates which chunk in the chapter contains timestamp $T$
- **AND** jumps playback to that chunk, scrolling the Reader view to the active text position
- **AND** cancels any stale prefetch streams to begin streaming fresh from the target chunk

#### Scenario: Chapter transition resets timeline
- **WHEN** playback naturally completes the final chunk of a chapter and transitions to the next chapter
- **THEN** the chapter scrubber resets its timeline to `00:00` spanning the duration of the new chapter

### Requirement: System and Notification Playback State Synchronization
The system SHALL maintain synchronous and bidirectional playback state alignment between the Web Audio player, the application UI state, and the native operating system MediaSession notification.

#### Scenario: User pauses playback from Android notification shade
- **WHEN** the user taps the pause action on the Android notification or lockscreen controls
- **THEN** the system immediately and synchronously sets `navigator.mediaSession.playbackState = 'paused'`
- **AND** suspends audio output and updates the application playback state `isPlaying` to `false`

#### Scenario: External hardware or OS pause event
- **WHEN** the underlying audio playback is paused by the operating system (e.g. headphone unplug, Bluetooth disconnection, or native audio focus interruption)
- **THEN** the audio player dispatches a playback state change notification
- **AND** the application state synchronizes `isPlaying` to `false` and reflects `paused` across the UI and MediaSession
