# Proposal: Clean Architecture & VieNeu-TTS Streaming Optimization

## Why

The current audiobook reading application suffers from tight coupling across UI components, playback logic, caching, and network requests, making feature additions and maintenance difficult. Furthermore, audio generation previously experienced jarring audio pauses and buffer stalls between chunks, disrupting the listening flow—especially on CPU-only VieNeu-TTS deployments constrained to `max_streams=1` and `max_queue=5`.

By refactoring to a 4-layer Clean Architecture and implementing a True Gapless Continuous Queue with Strict Sequential Chaining, the application achieves ultra-low TTFA (~105–150ms), 0ms gapless continuous reading across sentences and chapters, and strict compliance with CPU-only server constraints.

## What Changes

- **Clean Architecture Refactoring**: Restructure `src/` into 4 decoupled layers: `domain`, `application`, `infrastructure`, and `presentation`.
- **True Gapless Continuous Playback Engine**: Implement a Web Audio API (`AudioContext`) engine that chains successive chunk audio buffers directly onto the audio timeline (`nextStartTime`) without stopping between chunks.
- **Strict Sequential Chaining (CPU-safe)**: For single-stream backends (`max_streams=1`), immediately chain the network request for chunk $N+1$ when chunk $N$'s stream finishes on the wire (`speech.audio.done`). Ensures exactly $\le 1$ active network stream at all times, preventing queue timeouts and 429 errors.
- **Adaptive Lead-In Buffering**: Configure a 300ms lead-in threshold for CPU deployments (150ms for GPU) to absorb CPU scheduling jitter, with graceful re-buffering if server generation falls behind.
- **Timeline-Based Reader Synchronization**: Track `{ chapterIndex, chunkIndex, startTime, endTime }` in the audio player to smoothly advance Reader highlighting and scrolling as audio crosses chunk boundaries.
- **VieNeu-TTS Streaming Protocol**: Connect to VieNeu-TTS `POST /v1/audio/speech` using `stream_format=sse` and `response_format=pcm`, handling `speech.audio.delta` and `speech.audio.done` events.
- **Dynamic Stream Lifecycle & Cancellation**: Integrate `AbortController` to immediately abort ongoing TTS streams on user pause, seek, or chapter jump, freeing CPU/GPU slots on the server without delay.
- **Streaming Proxy Passthrough**: Support real-time streaming via `ReadableStream` in `/api/tts-proxy` without buffering in server memory.
- **Stream Caching**: Collect streamed PCM chunks in memory and assemble them into a cached audio blob in IndexedDB upon completion for instant offline replay.
- **Enhanced Settings UI**: Provide an expandable "Advanced (VieNeu-TTS)" settings section for sample rate (24kHz/48kHz), temperature, top_k, and max_chars.

## Capabilities

### New Capabilities
- `audio-streaming`: Real-time streaming audio playback via Web Audio API, SSE stream ingestion, lead-in pre-buffering, gapless chunk scheduling, and GPU-slot cancellation via AbortController.
- `clean-architecture`: Separation of core domain logic, use-case interactors, infrastructure adapters (TTS clients, audio player, IndexedDB), and presentation hooks/components.

### Modified Capabilities
<!-- None: This project currently has no existing specs in openspec/specs/. -->

## Impact

- **Affected Code**: `src/infrastructure/audio/WebAudioStreamPlayer.ts`, `src/presentation/hooks/useAudioStreamer.ts`, `src/application/usecases/StreamAndPlayChunkUseCase.ts`, `src/presentation/components/Reader.tsx`.
- **APIs**: Enhanced `/api/tts-proxy` with streaming response passthrough; `/v1/audio/speech` client requests with SSE and PCM.
- **Dependencies**: Uses native Web Audio API (`AudioContext`) and Fetch Streams API. No heavy external audio runtime libraries required.
