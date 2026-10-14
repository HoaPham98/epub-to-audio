# Design: Pause Buffering State Machine & Scrubber UX Optimization

## Context
See [proposal.md](proposal.md) for background and motivation. The system uses a 4-layer Clean Architecture with `WebAudioStreamPlayer` (infrastructure), `StreamAndPlayChunkUseCase` (application), and `useAudioStreamer` (presentation).

## Goals / Non-Goals
**Goals:**
- Provide instantaneous pause capability as soon as audio starts streaming (~300ms lead-in) by separating initial connection state from playing state.
- Guarantee that background buffering while paused never causes `AudioContext` to un-suspend or play unwanted sound.
- Synchronize chunk interaction in Reader: clicking playing chunk pauses; clicking paused chunk resumes.
- Accurately estimate chunk speech duration (~16 chars/s) so the scrubber buffer bar visibly advances in real time.
- Scope pre-buffering badges cleanly to the next chunk ($N+1$), eliminating "Đang nạp đệm ngầm" from paused chunk $N$.

**Non-Goals:**
- Multi-chapter continuous buffer cache loading (kept to chunk $N$ + $N+1$ to respect single-stream CPU server constraints).
- Changing the underlying SSE protocol or proxy route.

## Decisions

### 1. First-Packet State Transition (`onFirstData`)
- **Approach**: In `StreamAndPlayParams`, add optional callback `onFirstData?: () => void`. When `StreamAndPlayChunkUseCase` receives its first `chunk.pcmBuffer` from the SSE iterator:
  1. Queues buffer to `audioPlayer`.
  2. Fires `onFirstData()`.
- In `useAudioStreamer`, when `onFirstData` fires:
  - If user hasn't paused (`!isPausedByUserRef.current`), set `isPlaying = true`, `isLoading = false`.
  - The pause button in `AudioPlayerBar` becomes active and enabled immediately.
- **Alternative considered**: Polling `audioPlayer.isPlaying()`. Rejected because callback is deterministic and zero-latency.

### 2. Strict AudioContext Suspension Lock
- **Approach**: Add `isAudioContextSuspended` / `playerState: 'idle' | 'playing' | 'paused'` to `WebAudioStreamPlayer`.
  - In `pause()`: set state to `'paused'`, suspend `audioContext`.
  - In `queuePcmChunk()` and `scheduleBuffer()`: if state is `'paused'`, schedule buffer on the timeline but DO NOT resume `audioContext`.
  - In `init()`: only call `resume()` if state is NOT `'paused'`.
  - Only `play()` is authorized to transition state to `'playing'` and call `resume()`.
- **Alternative considered**: Discarding buffers while paused. Rejected because the whole purpose of pause is to buffer ahead without re-requesting.

### 3. Unified Reader Chunk Actions
- **Approach**: In `Reader.tsx` and `useAudioStreamer.ts`:
  - When user clicks chunk index `K`:
    - If `K === currentChunkIndex`:
      - If `isPlaying` $\to$ call `togglePlayPause()` (pauses).
      - If `!isPlaying` $\to$ call `togglePlayPause()` (resumes).
    - If `K !== currentChunkIndex`:
      - Call `playChunk(chIdx, K)` to switch to chunk $K$.
  - Render labels:
    - Playing chunk: `[⏸ Tạm dừng]` with active indigo styling.
    - Paused chunk: `[▶ Tiếp tục]` with indigo outline.
    - Initial connecting: `Đang kết nối...`
    - Next chunk pre-buffering: `Đang nạp sẵn...`
    - Ready chunk: `[✓ Đã nạp sẵn]` / `[▶ Phát ngay]`.

### 4. Scrubber Duration Estimation & Buffer Ratio
- **Approach**:
  - In `useAudioStreamer`, compute `estimatedDuration`:
    - When chunk stream starts: $T_{\text{est}} = \max(\text{charCount} / 16, \text{queuedDuration})$.
    - When `onNetworkDone` fires: $T_{\text{est}} = \text{audioPlayer.getDuration()}$ (exact).
  - Compute `bufferPercent`:
    - `Math.min(100, (bufferedTime / estimatedDuration) * 100)`.
  - Scrubber displays:
    - Thumb position: `currentTime / duration`.
    - Buffer layer: `bufferPercent%`.
    - Badge on Footer: `Đã đệm: ${bufferedTime.toFixed(1)}s / ~${estimatedDuration.toFixed(1)}s`.

## Risks / Trade-offs
- [Risk] Character-to-second ratio variance between fast/slow speakers $\to$ Mitigation: Vietnamese speech is consistent around 15–18 chars/sec. Once `onNetworkDone` fires, the scrubber immediately snaps to exact duration.
- [Risk] Rapid pause/play toggle while network is actively yielding SSE deltas $\to$ Mitigation: AudioContext state promises (`suspend`/`resume`) are serialized cleanly to prevent race conditions.
