# Design

## Context

In the current implementation ([`useAudioStreamer.ts`](file:///home/ubuntu/antigravity/adventurous-einstein/epub-to-audio/src/presentation/hooks/useAudioStreamer.ts)), pre-buffering operates on a rigid per-chunk basis:
- When paused: It stops immediately once chunk $N+1$ completes downloading (`onNetworkDone`).
- When playing: It chains sequentially chunk by chunk. However, when chunks are very short (e.g. dialogue, section headers consisting of 10–30 characters), the single $N+1$ chunk drains in 1–2 seconds, causing audible stalls before subsequent TTS requests return.

This design specifies a token/character-based sliding window that evaluates the cumulative unplayed text depth ahead of the playhead to guarantee uninterrupted continuous playback.

## Goals / Non-Goals

**Goals:**
- Maintain a safe sliding buffer window of **800 – 1,200 characters** (equivalent to $\sim 40 - 60$ seconds of speech) ahead of the playhead.
- Provide a unified sliding window policy across both **Playing** (pre-fetching as buffer drains) and **Paused** (pre-buffering until safe threshold is met, then halting).
- Seamlessly traverse chapter boundaries when `autoNext` is enabled and the current chapter has insufficient remaining text to fill the buffer threshold.
- Preserve strict sequential single-stream execution ($\le 1$ active network request) to avoid TTS server overload and HTTP 429 rate limits.
- Accurately expose chunk statuses (`ready`, `buffering`, `playing`) to the Reader interface.

**Non-Goals:**
- Full-chapter or full-book aggressive prefetching (wastes API quota and network bandwidth if user exits).
- Concurrent parallel TTS network streams (increases risk of server rate limits on CPU-based TTS deployments).
- Custom client-side BPE tokenizers (precomputed `charCount` on `TextChunk` is accurate and zero-overhead).

## Decisions

### Decision 1: Use `charCount` as Buffer Metric instead of Heavy Tokenizer Library
- **Choice**: Measure buffer depth using cumulative `charCount` with threshold `MIN_BUFFER_CHARS = 800` and `MAX_BUFFER_CHARS = 1200`.
- **Rationale**:
  - Every `TextChunk` in `EpubChapter` already contains a precomputed `charCount` property ([`src/domain/entities/book.ts`](file:///home/ubuntu/antigravity/adventurous-einstein/epub-to-audio/src/domain/entities/book.ts)).
  - At standard speech rate ($\sim 16$ characters/second), 800 characters equals $\sim 50$ seconds of audio. This provides a direct, linear mapping to physical playback duration without loading heavy tokenizer dependencies into client bundles.
- **Alternatives considered**:
  - Token-based counting using `@dqbd/tiktoken` or HuggingFace tokenizers. Rejected: adds hundreds of kilobytes to client bundle for no perceptible gain over `charCount`.

### Decision 2: Sequential Sliding Chain over Concurrent Multi-Fetch
- **Choice**: Fetch chunks sequentially in priority order ($N+1 \to N+2 \to \dots$) via `onNetworkDone` loops.
- **Rationale**:
  - TTS inference takes $\sim 0.5 - 1.0\text{s}$ per chunk, while speech duration is $\sim 12 - 18\text{s}$ per 250-character chunk.
  - Sequential prefetching runs $10\times$ faster than real-time playback. A 1,000-character buffer is easily filled within $3 - 4$ seconds.
  - Preserves compatibility with backend CPU endpoints and single-stream limits (`max_streams=1`), completely avoiding HTTP 429 (Too Many Requests).
- **Alternatives considered**:
  - Parallel dispatch (e.g., fetching $N+1$ and $N+2$ simultaneously). Rejected: risk of rate limits, race conditions in PCM timeline ordering, and wasted computation if user navigates away.

### Decision 3: Forward Buffer Calculator and Sliding Window Traversal
- **Choice**: Implement `calculateForwardBufferedChars(currentChap, currentChunk, queuedChap, queuedChunk, book)`:
  - Traverses the chunk sequence from the current playhead forward to `latestQueuedTarget`.
  - Calculates the total character length of chunks already queued in audio memory.
  - If cumulative length $< 800$ chars, determines the next target chunk (including next chapter if `autoNext` is true) and continues prefetching.
  - If cumulative length $\ge 800$ chars, rests until playhead advances.
- **Alternatives considered**:
  - Static lookahead count (e.g. fixed 3 chunks). Rejected: 3 dialogue chunks of 15 chars would only provide 45 chars ($\sim 3$ seconds of audio), failing to prevent underruns.

```
+-----------------------------------------------------------------------------------------+
|                                SLIDING PREFETCH ENGINE                                  |
+-----------------------------------------------------------------------------------------+
                                             |
                                  [Playback / TimeUpdate]
                                             |
                                             v
                           +-----------------------------------+
                           | Calculate unplayed chars in queue |
                           | forwardChars = sum(queued.chars)  |
                           +-----------------------------------+
                                             |
                      +----------------------+----------------------+
                      |                                             |
             forwardChars < 800                            forwardChars >= 800
                      |                                             |
                      v                                             v
           Is network stream active?                       [Prefetch Resting]
                      |                                   (Wait for playback
             +--------+--------+                           to drain buffer)
            No                Yes
             |                 |
             v                 v
   [Trigger next chunk]   [Wait for onNetworkDone]
```

## Risks / Trade-offs

- **[Risk] High API quota usage if user rapidly jumps between chapters**
  - *Mitigation*: When user triggers manual chunk/chapter navigation or seeks, `AbortActiveStreamUseCase` immediately cancels active HTTP requests and resets the prefetch target queue. The upper limit `MAX_BUFFER_CHARS = 1200` ensures at most $\sim 1$ minute of audio is pre-buffered.
- **[Risk] Memory pressure on low-end mobile devices**
  - *Mitigation*: Memory footprint of 1,200 chars of decoded PCM audio is only $\sim 3 - 4 \text{ MB}$, well within standard mobile browser heap limits. Chunks that finish playback are garbage-collected and retained on disk in IndexedDB.
