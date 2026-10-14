# Proposal: Pause Buffering & 429 Resilience

## Why

When network speed fluctuates or the CPU-only VieNeu-TTS server generates slower than real-time playback, users want to pause audio output temporarily to let the background stream accumulate a larger buffer. Currently, pausing tears down all Web Audio source nodes and aborts the in-flight network request. Resuming forces the player to restart the chunk from the beginning, and because the upstream proxy failed to forward the abort signal, the server is still rendering the previous request, causing HTTP 429 (Too Many Requests) errors and locking up the app until a full page reload.

## What Changes

- **AudioContext Suspend/Resume on Pause**: Instead of calling `stopAllNodes()` and resetting playback, pausing now calls `audioContext.suspend()`, freezing audio output cleanly while preserving scheduled nodes and timeline in memory. Unpausing calls `audioContext.resume()` to instantly continue playback from the exact paused millisecond.
- **Background Pre-Buffering During Pause**: While paused, the SSE network stream remains active, buffering the remainder of the current chunk and up to 1 subsequent chunk ($N+1$) into the Web Audio timeline and IndexedDB cache before going idle.
- **Upstream Abort Signal Forwarding in TTS Proxy**: `/api/tts-proxy` now passes `req.signal` to `fetch(targetUrl, { signal: req.signal })`, ensuring that genuine user skips (changing chunk/chapter) instantly terminate upstream Python generators and release the single CPU slot immediately.
- **HTTP 429 Backoff & Self-Healing**: Implement automatic exponential backoff retry for HTTP 429 errors (1s, 2s, 3s) with a user-friendly status badge ("Máy chủ đang bận, tự động thử lại sau Xs...") and a manual "Thử lại ngay" button, removing the need for page reloads.
- **Visual Buffer Range Indicator**: Display the buffered audio range directly on the scrubber bar in `AudioPlayerBar` and render a subtle "Đang nạp đệm..." status during background streaming while paused.

## Capabilities

### Modified Capabilities
- `audio-streaming`: Updates audio playback lifecycle to suspend/resume without teardown, allows background network pre-buffering while paused, propagates abort signals to upstream proxy, and introduces automatic 429 retry resilience.

## Impact

- `src/app/api/tts-proxy/route.ts`: Pass `req.signal` to upstream fetch.
- `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Refactor `pause()` and `play()` to leverage `audioContext.suspend()` and `audioContext.resume()`.
- `src/presentation/hooks/useAudioStreamer.ts`: Update pause/play handlers to preserve network streaming up to $N+1$, track buffered duration, and handle 429 retries gracefully.
- `src/infrastructure/tts/VieNeuStreamTTSClient.ts`: Add 429 interceptor with exponential backoff.
- `src/presentation/components/AudioPlayerBar.tsx`: Add buffered progress bar overlay on the scrubber and buffering status indicator.
