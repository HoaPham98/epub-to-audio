# Spec Delta

## MODIFIED Requirements

### Requirement: Low-Latency SSE Audio Streaming
The system SHALL ingest audio chunks streamed either via direct HTTP Server-Sent Events (SSE) from the remote TTS endpoint (`POST /v1/audio/speech` with `stream_format=sse` and `response_format=pcm` on Web and Remote mode) or via on-device `vieneu_tts` v0.1.1 24 kHz Mono raw PCM stream chunks on Windows and Mobile, dispatching audio deltas immediately to the playback pipeline without enforcing low server-side character limits (`max_chars`) that cause phoneme re-segmentation and repetition.

#### Scenario: Successful SSE stream ingestion
- **WHEN** the user initiates playback for a text chunk on Flutter Web or in Remote Server mode
- **THEN** the system sends a direct HTTP request with `stream_format=sse` and `response_format=pcm`
- **AND** processes each `speech.audio.delta` base64 payload as it arrives

#### Scenario: Stream completion
- **WHEN** the remote server sends `speech.audio.done` or the on-device `VieneuTts.stream` completes
- **THEN** the system marks the streaming phase complete and triggers cache persistence

#### Scenario: Prevention of redundant server-side chunk splitting
- **WHEN** a client-side chunk is dispatched for streaming synthesis
- **THEN** the client does NOT pass a restrictive `max_chars` threshold (e.g. 200) in the request body
- **AND** the synthesizer relies on the client's semantic chunk boundaries without splitting phonemized text mid-sentence or repeating phrases

### Requirement: Audio Cache Persistence
The system SHALL collect completed audio chunks into standard 24 kHz Mono 16-bit WAV files stored directly on the local filesystem on Windows and Mobile (or in IndexedDB on Web), indexing entries with a speed-independent cache key, and enforcing an LRU quota (200MB Mobile/Web, 500MB Desktop) and a 7-day sliding TTL based on last access time.

#### Scenario: Replaying a previously cached chunk
- **WHEN** playback is requested for a chunk already present in the local audio cache
- **THEN** the system plays the cached audio immediately without invoking `vieneu_tts` inference or contacting the remote TTS server

#### Scenario: Playback speed adjustment reuses cached audio
- **WHEN** the user modifies playback speed (e.g. 1.25x or 1.5x) for a previously cached chunk
- **THEN** the system retrieves the existing 1.0x cached WAV audio and scales playback dynamically in the player
- **AND** does NOT re-synthesize or create duplicate cache entries for different speeds

#### Scenario: Automatic LRU eviction and sliding TTL cleanup
- **WHEN** the total audio cache size exceeds the configured quota (200 MB on Mobile/Web, 500 MB on Desktop) or chunks have not been accessed for more than 7 days
- **THEN** the system automatically purges the oldest accessed audio cache files from disk

## REMOVED Requirements

### Requirement: Streaming Proxy Passthrough
**Reason**: The Next.js backend and `/api/tts-proxy` CORS proxy route are replaced by a single client-side Flutter codebase that connects directly to remote TTS servers on Web or uses on-device `vieneu_tts` on Windows and Mobile.
**Migration**: Configure remote TTS servers with standard CORS headers for Web clients and connect directly to `POST /v1/audio/speech` without `useProxy`.
