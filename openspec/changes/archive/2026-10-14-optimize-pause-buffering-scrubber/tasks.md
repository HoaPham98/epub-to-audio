# Tasks: Optimize Pause Buffering State Machine & Scrubber UX

## 1. Domain & Infrastructure Audio Player Enhancements

- [x] 1.1 Update `StreamAndPlayParams` with `onFirstData?: () => void` in `src/application/usecases/StreamAndPlayChunkUseCase.ts` and verify invocation on first PCM packet
- [x] 1.2 Implement strict AudioContext suspension lock and `playerState: 'idle' | 'playing' | 'paused'` in `src/infrastructure/audio/WebAudioStreamPlayer.ts` to prevent background buffers from un-suspending audio
- [x] 1.3 Add duration estimate helper and verify type definitions in `src/domain/ports/audio.ts`

## 2. Presentation Hook & State Machine Synchronization

- [x] 2.1 Update `useAudioStreamer.ts` to transition `isLoading = false` and `isPlaying = true` immediately upon `onFirstData`
- [x] 2.2 Wire contextual chunk click handler in `useAudioStreamer.ts`: active playing chunk calls `pause()`, active paused chunk calls `play()`, inactive chunk switches chunk
- [x] 2.3 Compute real-time `estimatedDuration` based on character count ($~16$ chars/s) and update scrubber ratio calculation `bufferedTime / estimatedDuration`

## 3. Reader & AudioPlayerBar Component Updates

- [x] 3.1 Update `src/presentation/components/Reader.tsx` with contextual action buttons (`[⏸ Tạm dừng]`, `[▶ Tiếp tục]`, `Đang kết nối...`, `[✓ Đã nạp sẵn]`) and isolate pre-buffer badge away from paused chunk
- [x] 3.2 Update `src/presentation/components/AudioPlayerBar.tsx` to unlock Pause button immediately during streaming, render real-time buffer progress, and display buffer text badge
- [x] 3.3 Verify full application compilation with `npx tsc --noEmit` and production build with `npm run build`
