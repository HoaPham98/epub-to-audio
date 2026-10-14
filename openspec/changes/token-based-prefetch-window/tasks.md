# Tasks

## 1. Sliding Window Buffer Calculator

- [x] 1.1 Define prefetch constants (`MIN_PREFETCH_CHARS = 800`, `MAX_PREFETCH_CHARS = 1200`) and verify their character-to-duration mappings (~40-60s)
- [x] 1.2 Implement helper functions `calculateForwardBufferedChars` and `getNextPrefetchTarget` in `useAudioStreamer.ts` to compute unplayed text depth ahead of the playhead

## 2. Prefetch Chaining & Cross-Chapter Logic

- [x] 2.1 Update `onNetworkDone` in `useAudioStreamer.ts` to evaluate cumulative forward buffer depth and trigger the next sequential chunk if below `MIN_PREFETCH_CHARS`
- [x] 2.2 Update paused prefetch handling to continue sequential buffering until `MIN_PREFETCH_CHARS` is reached, then cleanly rest
- [x] 2.3 Extend `getNextPrefetchTarget` to cross chapter boundaries into chunk 0 of the next chapter when `autoNext` is enabled and remaining chapter text is insufficient

## 3. Playhead-Driven Sliding Evaluation

- [x] 3.1 Hook into `onChunkChange` / `onTimeUpdate` to trigger prefetching when playback advances and the forward buffer falls below `MIN_PREFETCH_CHARS`
- [x] 3.2 Verify cancellation on manual skip: ensure `AbortActiveStreamUseCase` resets prefetch targets immediately when user seeks or selects a new chapter

## 4. UI Feedback & Verification

- [x] 4.1 Update chunk status mapping in `useAudioStreamer.ts` so actively buffering chunks display `buffering` and cached/queued chunks display `ready`
- [x] 4.2 Run `pnpm build` with Turbopack and verify clean compilation without TypeScript errors
