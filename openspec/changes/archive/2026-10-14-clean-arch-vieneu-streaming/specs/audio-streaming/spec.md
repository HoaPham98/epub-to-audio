# Spec Delta: audio-streaming

## Purpose

Enables low-latency real-time audio playback using Web Audio API streaming from VieNeu-TTS via Server-Sent Events (SSE) with lead-in pre-buffering, gapless chunk transitions, and immediate server slot cancellation.

## ADDED Requirements

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
The system SHALL use Web Audio API (`AudioContext`) with a configurable 150–300ms lead-in buffer (300ms for CPU backends) to schedule PCM s16le audio playback smoothly without network jitter stalls.

#### Scenario: Starting playback after lead-in buffer
- **WHEN** incoming streamed PCM audio reaches the lead-in buffer threshold (150–300ms)
- **THEN** playback starts immediately through AudioContext before the rest of the stream finishes

#### Scenario: Graceful re-buffering on buffer underrun
- **WHEN** the audio queue becomes empty before the next chunk buffer arrives
- **THEN** the system pauses audio output cleanly without pops or crackles and resumes once 300ms lead-in buffer is refilled

### Requirement: Strict Sequential Chaining for Single-Stream Endpoints
The system SHALL support strict sequential chaining for CPU-only backends with `max_streams=1`, initiating the stream for chunk $N+1$ immediately after chunk $N$'s stream finishes on the wire, ensuring exactly $\le 1$ active network request at all times.

#### Scenario: Immediate chaining of next chunk stream
- **WHEN** chunk $N$ completes receiving `speech.audio.done` from the server while audio is still playing on speaker
- **THEN** the system immediately starts streaming chunk $N+1$ and appends its audio buffers to the active AudioContext timeline

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
The system SHALL immediately abort in-flight TTS streaming requests and halt active playback nodes when the user pauses, seeks, or jumps to another chunk or chapter.

#### Scenario: User pauses during streaming
- **WHEN** playback is paused while a TTS stream is active
- **THEN** the system calls `abort()` on the active request's AbortController and stops audio output

#### Scenario: User skips to a different chunk
- **WHEN** the user clicks on a different chunk while another chunk is streaming
- **THEN** the previous stream is cancelled immediately to release the TTS server GPU/CPU slot and the new chunk stream begins

### Requirement: Streaming Proxy Passthrough
The local API proxy (`/api/tts-proxy`) SHALL stream data chunks directly to the client via `ReadableStream` without buffering the entire response in server memory.

#### Scenario: Proxying SSE stream without buffering
- **WHEN** a client sends a streaming TTS request via `/api/tts-proxy`
- **THEN** the proxy passes the upstream response body as a real-time stream with matching content type headers

### Requirement: Audio Cache Persistence
The system SHALL collect received PCM audio deltas into a complete audio file in IndexedDB once streaming completes, allowing instantaneous replay without network requests.

#### Scenario: Replaying a previously cached chunk
- **WHEN** playback is requested for a chunk already present in the IndexedDB cache
- **THEN** the system plays the cached audio immediately without contacting the TTS server
