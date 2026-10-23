# Spec Delta

## MODIFIED Requirements

### Requirement: Low-Latency SSE Audio Streaming
The system SHALL ingest audio chunks streamed either via direct HTTP or Web CORS-proxied Server-Sent Events (SSE) from the remote TTS endpoint (`POST /v1/audio/speech` with `stream_format=sse` and `response_format=pcm` on Web and Remote mode) or via on-device `vieneu_tts` v0.1.1 24 kHz Mono raw PCM stream chunks on Windows and Mobile, dispatching audio deltas immediately to the playback pipeline without enforcing low server-side character limits (`max_chars`) that cause phoneme re-segmentation and repetition.

#### Scenario: Successful SSE stream ingestion
- **WHEN** the user initiates playback for a text chunk on Flutter Web or in Remote Server mode
- **THEN** the system sends a request (routed via CORS proxy prefix on Web when enabled) with `stream_format=sse` and `response_format=pcm`
- **AND** processes each `speech.audio.delta` base64 payload as it arrives

#### Scenario: Stream completion
- **WHEN** the remote server sends `speech.audio.done` or the on-device `VieneuTts.stream` completes
- **THEN** the system marks the streaming phase complete and triggers cache persistence

#### Scenario: Prevention of redundant server-side chunk splitting
- **WHEN** a client-side chunk is dispatched for streaming synthesis
- **THEN** the client does NOT pass a restrictive `max_chars` threshold (e.g. 200) in the request body
- **AND** the synthesizer relies on the client's semantic chunk boundaries without splitting phonemized text mid-sentence or repeating phrases
