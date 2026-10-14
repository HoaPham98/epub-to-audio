# Tasks: Clean Architecture & VieNeu-TTS Streaming

## 1. Domain Layer Scaffolding

- [x] 1.1 Define core domain entities in `src/domain/entities/` (`Book`, `Chapter`, `Chunk`, `AudioTrack`, `AudioChunk`, `TTSSettings`, `VoiceOption`, `ModelOption`). Verify TypeScript types export cleanly.
- [x] 1.2 Define domain interfaces (ports) in `src/domain/ports/` (`ITTSStreamingService`, `IAudioStreamPlayer`, `IAudioCacheRepository`, `IBookRepository`, `ITextChunkerService`). Verify zero external library or framework dependencies.

## 2. Infrastructure Layer: Streaming & Audio Engine

- [x] 2.1 Implement `SentenceBoundaryChunker` in `src/infrastructure/chunker/` targeting 200–300 character chunks at natural sentence boundaries. Verify chunking behavior with multi-sentence text.
- [x] 2.2 Implement `VieNeuStreamTTSClient` in `src/infrastructure/tts/` connecting to `/v1/audio/speech` with `stream_format=sse` and `response_format=pcm`, handling `speech.audio.delta` and `speech.audio.done`. Verify SSE event parsing and AbortSignal support.
- [x] 2.3 Implement `StandardOpenAITTSClient` and `TTSClientFactory` in `src/infrastructure/tts/` for fallback when connecting to non-VieNeu endpoints. Verify factory instantiates appropriate client based on endpoint configuration.
- [x] 2.4 Implement `WebAudioStreamPlayer` in `src/infrastructure/audio/` using Web Audio API (`AudioContext`) with 150–300ms lead-in buffering, PCM s16le decoding, gapless node scheduling, and immediate cancellation on stop. Verify playback starts smoothly on audio chunk arrival.
- [x] 2.5 Update Next.js route `/api/tts-proxy` to stream chunks in real-time via `ReadableStream` passthrough without server-side array buffer accumulation. Verify proxy stream response headers and chunked transfer.
- [x] 2.6 Implement `IndexedDBAudioCache` and `IndexedDBBookRepository` in `src/infrastructure/storage/`. Verify persistence and cache retrieval.

## 3. Application Layer: Use Cases

- [x] 3.1 Implement `StreamAndPlayChunkUseCase` in `src/application/usecases/` coordinating cache lookup, SSE streaming, real-time audio queuing, PCM buffer accumulation, and IndexedDB saving upon completion. Verify flow from cache-miss to playback.
- [x] 3.2 Implement `PipelineNextChunkUseCase` and `AbortActiveStreamUseCase` in `src/application/usecases/` to trigger pre-streaming of chunk $N+1$ and cancel active in-flight streams on pause/skip. Verify abort signal propagation to the TTS client.
- [x] 3.3 Implement `ParseAndLoadBookUseCase` and `ManageAudioCacheUseCase` in `src/application/usecases/`. Verify book parsing and cache management.

## 4. Presentation Layer & UI Integration

- [x] 4.1 Implement `useAudioStreamer` hook in `src/presentation/hooks/` connecting React components to Application use cases, exposing playback state, current chunk, progress, and actions.
- [x] 4.2 Update `Reader.tsx` and `AudioPlayerBar.tsx` in `src/presentation/components/` to consume `useAudioStreamer`, maintaining 1:1 chunk highlight synchronization and gapless playback.
- [x] 4.3 Update `SettingsModal.tsx` in `src/presentation/components/` to include an expandable "Advanced (VieNeu-TTS)" section for sample rate (24k/48k), temperature, top_k, and max_chars.
- [x] 4.4 Update `src/app/page.tsx` to coordinate the new Clean Architecture hooks and components.

## 5. Verification & Initial Validation

- [x] 5.1 Run type-check and linting (`npm run lint` / `tsc --noEmit`) to verify zero errors across all layers.
- [x] 5.2 Run Next.js production build (`npm run build`) to ensure all client/server components and streaming proxy routes compile properly.

## 6. Gapless Inter-Chunk Playback & CPU Streaming Optimization

- [x] 6.1 Update `WebAudioStreamPlayer` with continuous audio timeline scheduling (`nextStartTime` without reset across chunks), multi-chunk boundary tracking (`{ chapterIndex, chunkIndex, startTime, endTime }`), 300ms CPU lead-in buffer, and `onChunkChange` event callback.
- [x] 6.2 Update `StreamAndPlayChunkUseCase` and `useAudioStreamer` to chain chunk $N+1$ immediately upon chunk $N$ network completion (`speech.audio.done`), while strictly enforcing `max_streams=1` (no concurrent network requests to VieNeu server).
- [x] 6.3 Update `Reader.tsx` and `AudioPlayerBar.tsx` to handle gapless continuous chapter/chunk transitions and keep chunk highlighting in sync via `onChunkChange`.
- [x] 6.4 Verification: Run `tsc --noEmit`, `eslint`, and Next.js build; verify seamless audio playback with no pause between chunks.
