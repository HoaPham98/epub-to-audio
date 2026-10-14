# Proposal: Optimize Pause Buffering State Machine & Scrubber UX

## Why
When users listen to EPUB chunks streamed from VieNeu-TTS (especially on CPU-only deployments with `max_streams=1`), clicking pause currently produces erratic behavior:
1. The active chunk mistakenly displays "Đang nạp đệm ngầm..." instead of "Tạm dừng", causing confusion about whether playback actually paused.
2. Play/Pause buttons in the footer and Reader can become stuck in a `loading` state throughout streaming because the state machine only switched to `playing` after the entire chunk download finished (rather than upon first audio packet delivery).
3. Footer Play/Pause was `disabled` during `isLoading`, preventing users from pausing during network streaming.
4. Clicking the active chunk in Reader restarted the stream and triggered HTTP aborts instead of toggling pause/resume.
5. In `WebAudioStreamPlayer`, background pre-buffering of chunk $N+1$ inadvertently resumed suspended AudioContext, unpausing audio output unexpectedly.
6. The Scrubber progress bar calculated `bufferedPercent = bufferedTime / duration * 100%`, which always yielded 100% virtual buffer because duration grew dynamically with queued audio, hiding true buffering progress.

## What Changes
- **Explicit 4-State Player Machine**: Transition from `connecting` to `playing` as soon as the first audio packet (~300ms lead-in) is decoded and queued (`onFirstData`), immediately enabling the user to pause.
- **AudioContext Suspension Lock**: Guarantee that `WebAudioStreamPlayer` strictly preserves suspended state when paused; background pre-buffering of chunk $N$ or $N+1$ MUST NOT call `AudioContext.resume()`.
- **Reader & Footer 1:1 Unified Controls**:
  - Clicking the currently playing chunk in Reader triggers `togglePlayPause()` to PAUSE (not restart stream).
  - Clicking the paused chunk in Reader triggers `togglePlayPause()` to RESUME from the paused position.
  - Reader chunk button contextual labels: `[⏸ Tạm dừng]`, `[▶ Tiếp tục]`, `Đang kết nối...`, `[✓ Đã nạp sẵn]`.
- **Scrubber & Buffering Real-Time Progress Visualization**:
  - Estimate chunk speech duration based on character count ($~16$ chars/second) until network stream completes (`onNetworkDone`), allowing the buffer bar to visibly fill from $0\% \to 100\%$ in real time.
  - Display informative badge on Footer: `Đã đệm: X.Xs / ~Y.Ys` while buffering, and `Đang nạp sẵn đoạn tiếp theo...` when chunk $N+1$ buffers in background.
  - Remove confusing "Đang nạp đệm ngầm..." label from the currently paused chunk.

## Capabilities

### Modified Capabilities
- `audio-streaming`: Update requirements to specify first-packet playback transition, strict pause suspension lock during background buffering, unified contextual play/pause chunk actions, and real-time buffer progress estimation.

## Impact
- **Affected Code**:
  - `src/domain/ports/audio.ts` (first data callback interface & player state contract)
  - `src/infrastructure/audio/WebAudioStreamPlayer.ts` (state lock preventing resume on background prebuffer, first packet event)
  - `src/application/usecases/StreamAndPlayChunkUseCase.ts` (`onFirstData` callback propagation)
  - `src/presentation/hooks/useAudioStreamer.ts` (first-packet transition, contextual play/pause chunk dispatcher, estimated duration tracking)
  - `src/presentation/components/AudioPlayerBar.tsx` (unlocked pause button, accurate buffer progress, buffer badge)
  - `src/presentation/components/Reader.tsx` (contextual buttons `[⏸ Tạm dừng]`, `[▶ Tiếp tục]`, isolated pre-buffer badge on next chunk)
