# Design: Pause Buffering & 429 Resilience

## Context

See `proposal.md` for motivation. In CPU-only deployments of VieNeu-TTS (`max_streams=1`), streaming generation can be slower than real-time if CPU load increases. Previously, clicking Pause invoked `audioPlayer.stopAllNodes()` and aborted the active network connection. Because `AudioBufferSourceNode`s are single-use, resuming required restarting the chunk from the beginning. Furthermore, `/api/tts-proxy` did not forward `req.signal` to the upstream fetch, causing the server to continue generating in the background. Immediate retries resulted in HTTP 429 (Too Many Requests), requiring full application reloads.

## Goals / Non-Goals

**Goals:**
- Implement non-destructive pause/resume in `WebAudioStreamPlayer` using `AudioContext.suspend()` and `AudioContext.resume()`.
- Keep the SSE network stream active during pause, pre-buffering the rest of chunk $N$ and up to 1 subsequent chunk ($N+1$) into the timeline and IndexedDB cache before entering idle state.
- Ensure `/api/tts-proxy` forwards client abort signals to the upstream VieNeu-TTS server (`signal: req.signal`) so genuine user skips release the CPU slot immediately.
- Implement self-healing exponential backoff retry for HTTP 429 errors (1s, 2s, 4s) with user-friendly non-blocking notifications and manual retry capability.
- Display a visual buffered progress range on the `AudioPlayerBar` scrubber and a buffering status indicator.

**Non-Goals:**
- Unbounded background prefetching across the entire book while paused (limited to chunk $N$ and $N+1$ to conserve server CPU and client memory).
- Allowing concurrent network streams to the VieNeu-TTS server (`max_streams=1` remains strictly enforced).

## Decisions

### 1. AudioContext Suspend/Resume for Playback Pause
- **Decision**: In `WebAudioStreamPlayer`, implement `pause()` by calling `this.audioContext.suspend()` and `play()` by calling `this.audioContext.resume()`. Reserve `stopAllNodes()` only for `stop()` (triggered when seeking, skipping chunks, or switching chapters).
- **Rationale**: Suspending `AudioContext` freezes hardware audio output instantly without discarding scheduled audio nodes or timeline state. Incoming audio chunks continue to be scheduled onto `this.nextStartTime`. When unpaused, `resume()` continues playback seamlessly from the exact paused millisecond.
- **Alternatives Considered**: Stopping all nodes and re-scheduling remaining slices upon resume (rejected: complex calculation, prone to pops/clicks and audio sync drift).

### 2. Controlled Background Pre-Buffering During Pause
- **Decision**: When the user pauses, do not call `abortActiveStream()`. Let chunk $N$ finish network streaming, and allow chaining to chunk $N+1$ with `append = true`. Once chunk $N+1$ finishes network streaming (`onNetworkDone`), do not chain to chunk $N+2$ until the user resumes playback.
- **Rationale**: Allows the user to deliberately pause audio playback to accumulate buffer when experiencing network or CPU jitter, directly fulfilling the user's need. Capping at $N+1$ prevents runaway CPU consumption on the server if the user leaves the tab paused.

### 3. Upstream Abort Signal Forwarding in Proxy
- **Decision**: In `src/app/api/tts-proxy/route.ts`, pass `signal: req.signal` to `fetch(targetUrl, { signal: req.signal })`.
- **Rationale**: When the client genuinely skips to another chunk or chapter, browser aborts the request. Forwarding this signal ensures the HTTP connection to VieNeu-TTS closes immediately, terminating Python's streaming generator and freeing the single CPU slot instantly.

### 4. HTTP 429 Resilience & Exponential Backoff
- **Decision**: In `VieNeuStreamTTSClient` and presentation error handling, intercept 429 status codes. Read `Retry-After` header or use backoff intervals [1s, 2s, 4s] up to 3 retry attempts. Expose retry countdown in UI.
- **Rationale**: Prevents unhandled error crashes when the server is temporarily occupied. A manual "Thử lại ngay" button allows instant recovery without browser refresh.

### 5. Visual Buffer Indicator on Scrubber
- **Decision**: In `WebAudioStreamPlayer`, expose `getBufferedTime()`: the end time of all scheduled buffers relative to the current playback origin. In `AudioPlayerBar`, render a secondary bar indicating the buffered audio percentage.
- **Rationale**: Gives users direct visibility into how much audio has been pre-buffered ahead of the playhead.

## Risks / Trade-offs

- **[Mobile Browser Background Audio Suspension]** → Browsers may throttle `AudioContext` timers in background tabs. Mitigation: Standard page lifecycle and wake lock API where applicable.
- **[Accidental CPU usage during long pause]** → User leaves page paused while pre-buffering runs. Mitigation: Pre-buffering strictly caps at chunk $N+1$, ensuring the server generates at most ~200–300 characters before stopping.
