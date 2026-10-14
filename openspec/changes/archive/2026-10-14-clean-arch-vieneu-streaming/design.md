# Design: Clean Architecture & VieNeu-TTS Streaming

## Context

See `proposal.md` for motivation. Currently, the application ties TTS generation, audio playback, storage, and UI into tightly-coupled modules (`src/lib/tts.ts`, `src/hooks/useAudioPlayer.ts`). Playback relies on HTMLAudioElement with fully downloaded Blobs, which eliminates streaming benefits and creates high initial delay.

VieNeu-TTS provides an OpenAI-compatible API (`POST /v1/audio/speech`) supporting Server-Sent Events (SSE) with raw PCM s16le audio chunks. In CPU-only deployments configured with `max_streams=1` and `max_queue=5`, RTF ranges around 0.35–0.55 (generating 1s of audio in ~350–550ms). Strict concurrency control and timeline scheduling are required to eliminate inter-chunk pauses without overwhelming server capacity.

## Goals / Non-Goals

**Goals:**
- Implement a 4-layer Clean Architecture (`src/domain`, `src/application`, `src/infrastructure`, `src/presentation`) with strict inward dependency rules.
- Build a Web Audio API (`AudioContext`) streaming playback engine that begins playback after a 300ms lead-in buffer and schedules seamless gapless transitions across chunks and chapters.
- Connect to VieNeu-TTS via SSE streaming (`stream_format=sse`, `response_format=pcm`).
- Enforce strict sequential chaining: trigger chunk $N+1$ immediately upon chunk $N$ network reception completion (`speech.audio.done`), never launching concurrent network streams (`max_streams=1`).
- Maintain continuous audio queue without resetting `AudioContext` or audio nodes at chunk boundaries, tracking chunk timeline boundaries (`{ chapterIndex, chunkIndex, startTime, endTime }`) to fire `onChunkChange` events for accurate UI highlighting.
- Free server slots immediately using `AbortController.abort()` upon user pause, seek, or chapter/chunk skip.
- Upgrade `/api/tts-proxy` to support real-time `ReadableStream` passthrough for CORS-restricted environments.
- Maintain IndexedDB audio caching by accumulating streamed PCM buffers and saving them as audio Blobs upon completion.
- Support natural sentence chunking (~200–300 chars) matching VieNeu's `max_chars` parameter.

**Non-Goals:**
- Modifying the underlying VieNeu-TTS Python server implementation.
- Overlapping parallel TTS streams on CPU (parallel generation causes queue delays and degrades RTF > 1.0).
- Building a full backend server or custom WebSocket protocol (pure client-side architecture with lightweight Next.js proxy).
- Real-time word-level text highlighting during streaming (VieNeu-TTS SSE currently provides chunk deltas and usage, not word alignment timestamps).

## Decisions

### 1. Four-Layer Clean Architecture Layout
- **Domain Layer (`src/domain/`)**:
  - Entities: `Book`, `Chapter`, `Chunk`, `AudioTrack`, `AudioChunk`, `TTSSettings`, `VoiceOption`, `ModelOption`.
  - Ports (Interfaces): `ITTSStreamingService`, `IAudioStreamPlayer`, `IAudioCacheRepository`, `IBookRepository`, `ITextChunkerService`.
- **Application Layer (`src/application/`)**:
  - Use Cases: `StreamAndPlayChunkUseCase`, `PipelineNextChunkUseCase`, `ParseAndLoadBookUseCase`, `ManageAudioCacheUseCase`, `AbortActiveStreamUseCase`.
- **Infrastructure Layer (`src/infrastructure/`)**:
  - TTS: `VieNeuStreamTTSClient` (SSE + PCM), `StandardOpenAITTSClient`, `TTSClientFactory`.
  - Audio Engine: `WebAudioStreamPlayer` (AudioContext, PCM s16le stream decoding, buffer scheduling, boundary tracking).
  - Storage: `IndexedDBAudioCache`, `IndexedDBBookRepository`, `LocalStorageSettingsRepository`.
  - Text & Parser: `SentenceBoundaryChunker`, `EpubJsParserAdapter`.
- **Presentation Layer (`src/presentation/`)**:
  - Hooks: `useAudioStreamer`, `useBookReader`, `useSettings`.
  - Components: `AudioPlayerBar`, `Reader`, `Sidebar`, `SettingsModal`, `CacheModal`, `Header`.
- *Rationale*: Enforces clean boundaries and inversion of control, making the audio streaming engine easily testable and replaceable.

### 2. Playback Engine: Web Audio API with Continuous Timeline Queue
- **Decision**: Use Web Audio API (`AudioContext`) with continuous timeline scheduling (`nextStartTime`).
- *Rationale*: HTMLAudioElement cannot ingest live PCM buffers without packaging them into complete media containers (WAV/MSE), introducing parsing overhead and latency. `AudioContext` allows sub-millisecond scheduling, 300ms lead-in buffering, and 0ms gapless transitions between successive text chunks.
- *Continuous Timeline Scheduling*: When chunk $N+1$ begins receiving PCM deltas, they are scheduled seamlessly at `this.nextStartTime` on the existing timeline without resetting the player or clearing the audio queue.
- *Boundary Tracking*: `WebAudioStreamPlayer` records `{ chapterIndex, chunkIndex, startTime, endTime }` for each scheduled chunk. A lightweight RAF/interval checks `currentTime` against scheduled intervals and emits `onChunkChange(chapterIndex, chunkIndex)`, keeping the reading highlight in sync.

### 3. Concurrency & Immediate Chaining for CPU-Only Server (`max_streams=1`)
- **Decision**: Strict sequential network execution with immediate chaining.
- *Rationale*: With CPU-only deployment and `max_streams=1`, triggering chunk $N+1$ while chunk $N$ is still generating would hit the server queue (`max_queue=5`) or trigger slot thrashing. Because RTF on CPU is ~0.35–0.55, chunk $N$'s stream finishes over the network well before the chunk finishes playing on the speaker (e.g. 10s of audio finishes downloading in ~4s; remaining playback buffer is ~6s).
- *Mechanism*: The moment chunk $N$ receives `speech.audio.done`, the network is idle. The client immediately dispatches the request for chunk $N+1$. While chunk $N$ continues playing its remaining buffer on speakers, chunk $N+1$ streams into the queue, achieving 100% gapless continuous playback with zero queue congestion.

### 4. Transport Protocol: SSE over Raw Chunked Binary
- **Decision**: Standardize on SSE (`stream_format: sse`, `response_format: pcm`).
- *Rationale*: SSE events provide explicit boundaries (`speech.audio.delta`, `speech.audio.done`), error propagation, and metadata handling without ambiguity. It proxies cleanly through Next.js route handlers.

### 5. Next.js Streaming Proxy Passthrough
- **Decision**: In `/api/tts-proxy`, return `new Response(response.body, { headers: { 'Content-Type': 'text/event-stream' } })` using web standard `ReadableStream`.
- *Rationale*: Eliminates the memory-heavy and blocking `await response.arrayBuffer()` step, preserving low TTFA even through proxy.

## Risks / Trade-offs

- **[Browser AudioContext Autoplay Policy]** → Browser requires user interaction before activating `AudioContext`. Mitigation: Resume/initialize `AudioContext` during the first user click on Play or Chunk.
- **[CPU Jitter causing Audio Buffer Underflow]** → CPU fluctuations or network latency may exhaust the audio queue. Mitigation: Maintain a 300ms lead-in buffer (at least 4 frames on 24kHz) before playback starts.
- **[Memory footprint of accumulated PCM deltas]** → Storing raw PCM in memory could grow with very long chapters. Mitigation: Text chunks are restricted to ~200–300 chars, so each chunk's PCM buffer is small (< 1 MB). Assembled chunks are persisted to IndexedDB and cleared from active memory.
- **[429 Too Many Requests under server load]** → TTS server continuous batching slots may be temporarily full. Mitigation: Strict sequential chaining ensures `activeNetworkStreams <= 1`, eliminating concurrency-induced 429 errors.
