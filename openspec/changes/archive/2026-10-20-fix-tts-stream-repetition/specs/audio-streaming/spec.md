# Spec Delta: audio-streaming

## MODIFIED Requirements

### Requirement: Low-Latency SSE Audio Streaming
The system SHALL ingest audio chunks streamed via Server-Sent Events (SSE) from the TTS endpoint (`POST /v1/audio/speech` with `stream_format=sse` and `response_format=pcm`) and dispatch audio deltas immediately to the playback pipeline, without enforcing low character limits (`max_chars`) that cause server-side phoneme re-segmentation and repetition.

#### Scenario: Successful SSE stream ingestion
- **WHEN** the user initiates playback for a text chunk
- **THEN** the system sends a request with `stream_format=sse` and `response_format=pcm`
- **AND** processes each `speech.audio.delta` base64 payload as it arrives

#### Scenario: Stream completion
- **WHEN** the server sends `speech.audio.done`
- **THEN** the system marks the streaming phase complete and triggers cache persistence

#### Scenario: Prevention of redundant server-side chunk splitting
- **WHEN** a client-side chunk is dispatched for streaming synthesis
- **THEN** the client does NOT pass a restrictive `max_chars` threshold (e.g. 200) in the request body
- **AND** the server relies on the client's semantic chunk boundaries without splitting phonemized text mid-sentence or repeating phrases
