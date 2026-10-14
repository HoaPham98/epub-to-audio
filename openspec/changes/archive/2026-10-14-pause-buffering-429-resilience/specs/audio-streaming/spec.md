# Spec Delta: audio-streaming

## MODIFIED Requirements

### Requirement: Pre-Buffered Web Audio Playback
The system SHALL use Web Audio API (`AudioContext`) with a configurable 150–300ms lead-in buffer (300ms for CPU backends) to schedule PCM s16le audio playback smoothly without network jitter stalls, and support non-destructive suspend/resume state on pause.

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
- **WHEN** playback is paused while a chunk stream is in progress
- **THEN** the system continues receiving and queueing streamed audio deltas for the active chunk and up to 1 subsequent chunk ($N+1$) before entering idle state

### Requirement: Immediate Stream Cancellation on User Action
The system SHALL abort in-flight TTS streaming requests and halt active playback nodes when the user seeks or jumps to another chunk or chapter, while preserving in-flight streams on pause.

#### Scenario: User pauses during streaming
- **WHEN** playback is paused while a TTS stream is active
- **THEN** the system suspends audio output but keeps the network stream active to buffer ahead

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

## ADDED Requirements

### Requirement: Server Busy and HTTP 429 Resilience
The system SHALL intercept HTTP 429 (Too Many Requests) and server busy responses, executing automatic exponential backoff retries without crashing or requiring application reload.

#### Scenario: Automatic retry on HTTP 429 response
- **WHEN** the TTS endpoint returns HTTP 429
- **THEN** the client waits for the delay specified in `Retry-After` (or exponential backoff intervals of 1s, 2s, 4s) and retries the request up to 3 times
- **AND** displays an informative status message to the user during the retry interval

#### Scenario: Recovery after retries exhausted
- **WHEN** all automatic retries fail
- **THEN** the system displays a clear error message with a manual "Thử lại" action button that restarts the stream without requiring a full page refresh
