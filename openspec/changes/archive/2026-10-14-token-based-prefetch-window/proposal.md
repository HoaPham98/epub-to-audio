# Proposal

## Why

Currently, the audio playback engine uses a rigid pre-buffering rule that strictly pre-fetches only a single adjacent chunk ($N+1$). When dialogue, chapter headings, or short sentences produce small chunks (e.g., 10–30 characters, lasting under 1–2 seconds), chunk $N+1$ drains almost immediately upon playback, causing audible playback interruptions while the system waits for subsequent TTS network requests.

Implementing a token/character-based sliding prefetch window ensures that the audio buffer consistently maintains a safe minimum depth of text ($\sim 800 - 1.200$ characters, equivalent to $40 - 60$ seconds of speech) ahead of the playhead, eliminating playback underruns while avoiding unbounded API quota consumption.

## What Changes

- **Token/Character Sliding Prefetch Window**: Replace the fixed $N+1$ prefetch constraint with a dynamic buffer evaluator that maintains $\sim 800 - 1.200$ characters ahead of the current playback position.
- **Sliding Prefetch across States**:
  - When actively playing: maintain the sliding window forward. As the playhead advances and remaining buffered characters drop below the minimum threshold, sequentially fetch subsequent chunks.
  - When paused: continue sequential prefetching until the buffered text ahead meets the safe threshold ($\sim 800 - 1.200$ characters), then cleanly stop to conserve network bandwidth and TTS API quota.
- **Cross-Chapter Boundary Prefetching**: When the remaining text in the active chapter is shorter than the prefetch threshold and `autoNext` is enabled, seamlessly prefetch the opening chunks of the subsequent chapter for gapless transitions.
- **Sequential Queue Chaining**: Maintain sequential prefetching (one chunk stream at a time) to prevent HTTP 429 rate-limiting while leveraging high TTS generation speeds ($\sim 1\text{s}$ synthesis vs $\sim 15\text{s}$ speech) to rapidly fill the prefetch window.
- **Visual Buffer & Chunk State Indicators**: Provide clear visual feedback in the Reader interface indicating which chunks are actively buffering (`buffering`) versus ready in IndexedDB/WebAudio (`ready`).

## Capabilities

### New Capabilities
<!-- None: all requirements update the existing audio streaming and playback capability. -->

### Modified Capabilities
- `audio-streaming`: Update pre-buffering and chaining requirements from fixed single chunk ($N+1$) to a dynamic token/character sliding window with cross-chapter continuity and buffer threshold evaluation.

## Impact

- `src/presentation/hooks/useAudioStreamer.ts`: Update chaining logic in `onNetworkDone` and pause handlers to calculate cumulative buffered text length across queued chunks instead of checking only chunk $N+1$.
- `src/domain/ports/audio.ts` & `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Enhance buffer inspection helpers if needed to query queued chunk boundaries and durations.
- Presentation / Reader components: Reflect `ready` and `buffering` states across multiple prefetched chunks accurately.
