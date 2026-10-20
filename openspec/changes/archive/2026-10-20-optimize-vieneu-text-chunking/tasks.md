# Tasks: Optimize VieNeu-TTS Text Chunking Strategy & Audio Silence Padding

## 1. Domain Entities & Chunker Port Enhancements

- [x] 1.1 Extend `TextChunk` and `ChunkMeta` interfaces in `src/domain/entities/book.ts` and `src/domain/ports/audio.ts` to include `isParagraphEnd?: boolean`, and verify with TypeScript compilation (`pnpm build`).
- [x] 1.2 Expand `ITextChunkerService` in `src/domain/ports/chunker.ts` to accept enhanced options (`minChars`, `targetChars`, `maxChars`, `safeMaxChars`, `mergeShortSentences`) and verify domain layer exports.

## 2. Sentence & Clause Boundary Chunker Implementation

- [x] 2.1 Refactor `SentenceBoundaryChunker.ts` to implement the 4-tier hierarchical segmentation pipeline: paragraph breaks (`\n`) → sentence terminators (`.`, `?`, `!`, `...`) → clause delimiters (`,`, `;`, `:`, `—`) for long sentences (> 250 characters) → word boundaries, enforcing target size 150–250 characters (default: 200) and safe maximum ceiling (350–400 characters).
- [x] 2.2 Implement short sentence merging in `SentenceBoundaryChunker.ts` to automatically merge units under 20 characters into adjacent context, and assign `isParagraphEnd: boolean`.
- [x] 2.3 Create/update unit tests for `SentenceBoundaryChunker` in `tests/SentenceBoundaryChunker.test.ts` covering normal sentences, compound sentences with clauses, ultra-short sentences (< 20 chars), and paragraph endings, verifying with `pnpm test`.

## 3. Natural Silence Padding in Audio Playback Pipeline

- [x] 3.1 Update `WebAudioStreamPlayer.ts` to insert natural silence padding (250ms–300ms inter-sentence, 400ms–600ms inter-paragraph, scaled by `playbackSpeed`) between consecutive audio chunks while preserving gapless stitching for intra-chunk SSE deltas.
- [x] 3.2 Adjust `chunkBoundaries` calculation and timeline tracking in `WebAudioStreamPlayer.ts` to incorporate inter-chunk silence offsets so Reader highlighting and scrubbing remain strictly synchronized.
- [x] 3.3 Verify audio stream player queuing and silence gap calculation with unit tests in `tests/WebAudioStreamPlayer.test.ts`.

## 4. UI Defaults, Settings & VieNeu Client Alignment

- [x] 4.1 Update default `max_chars` in `src/infrastructure/tts/VieNeuStreamTTSClient.ts` to 200 characters.
- [x] 4.2 Update `src/presentation/components/SettingsModal.tsx` to set default `maxChars` to 200, adjust the slider range (150–350), and display recommendation guidance for VieNeu-TTS v3 Turbo.
- [x] 4.3 Update `src/app/page.tsx` chunking options for EPUB import and IndexedDB re-chunking verification, ensuring books are processed with the new 200-character standard.
- [x] 4.4 Run full regression test suite and build check (`pnpm test` and `pnpm build`) to ensure all components integrate cleanly.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result with `openspec validate`.
