# Tasks: Pause Buffering & 429 Resilience

## 1. Upstream Abort Signal Forwarding & Audio Engine Pause/Resume

- [x] 1.1 In `src/app/api/tts-proxy/route.ts`, forward `signal: req.signal` to `fetch(targetUrl, { signal: req.signal })` to cancel upstream VieNeu-TTS execution on client abort. Verify aborted fetch terminates immediately.
- [x] 1.2 In `WebAudioStreamPlayer.ts`, implement non-destructive `pause()` via `audioContext.suspend()` and `play()` via `audioContext.resume()`, reserving `stopAllNodes()` for explicit stop/seek actions. Verify pause freezes audio instantly and play resumes smoothly without re-buffering from scratch.
- [x] 1.3 In `WebAudioStreamPlayer.ts`, expose `getBufferedTime()` to calculate the duration of scheduled audio ahead of the current playback position. Verify buffered time increments as new PCM deltas are queued while suspended.

## 2. Background Pre-Buffering During Pause & Concurrency Management

- [x] 2.1 In `useAudioStreamer.ts`, update `togglePlayPause` to pause audio output without aborting in-flight network streaming, allowing background pre-buffering of the current chunk and up to 1 subsequent chunk ($N+1$).
- [x] 2.2 In `useAudioStreamer.ts`, implement pause-aware sequential chaining that stops after chunk $N+1$ network download completes, remaining idle until user resumes playback.

## 3. HTTP 429 Resilience & Self-Healing

- [x] 3.1 In `VieNeuStreamTTSClient.ts`, add retry logic for HTTP 429 status codes with exponential backoff [1s, 2s, 4s] up to 3 attempts, parsing `Retry-After` if present.
- [x] 3.2 In `useAudioStreamer.ts`, expose retry countdown message and a non-fatal error state with a manual "Thử lại ngay" action instead of locking the UI.

## 4. UI Indicators & Visual Buffer Feedback

- [x] 4.1 In `AudioPlayerBar.tsx`, add a visual buffer progress bar layer behind the playhead scrubber using `bufferedTime / duration`.
- [x] 4.2 In `AudioPlayerBar.tsx` and `Reader.tsx`, display a subtle "Đang nạp đệm..." badge when background streaming is actively buffering while paused.

## 5. Verification & Validation

- [x] 5.1 Run type check (`npx tsc --noEmit`) and linter (`npm run lint`) to ensure zero errors.
- [x] 5.2 Run Next.js production build (`npm run build`) to ensure full compile compatibility.
