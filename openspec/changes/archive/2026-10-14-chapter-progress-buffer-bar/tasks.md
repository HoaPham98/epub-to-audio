# Tasks

## 1. Chapter Timeline State in Hook

- [x] 1.1 Compute chapter-scoped metrics (`chapterDurations`, `chapterTotalDuration`, `chapterCurrentTime`, `chapterBufferedTime`, `forwardBufferSeconds`) in `useAudioStreamer.ts`
- [x] 1.2 Implement `seekChapterTime(targetSeconds: number)` in `useAudioStreamer.ts` mapping chapter timestamps to target chunk indices
- [x] 1.3 Update `skipRelative(seconds: number)` to operate within the chapter timeline constraints [0, `chapterTotalDuration`]

## 2. AudioPlayerBar UI & Scrubber Layer

- [x] 2.1 Update `AudioPlayerBar.tsx` to bind the scrubber slider, time labels, and buffer track width to chapter-scoped metrics
- [x] 2.2 Render forward buffer health badge (`Đệm trước: +Xs` / `Đã nạp hết chương`) in `AudioPlayerBar.tsx`
- [x] 2.3 Ensure chapter transitions cleanly reset the scrubber timeline to `00:00` for the new chapter

## 3. MediaSession & Android Notification Playback Sync

- [x] 3.1 Add `onPlaybackStateChange` to `IAudioStreamPlayer` port in `src/domain/ports/audio.ts` and implement in `src/infrastructure/audio/WebAudioStreamPlayer.ts`
- [x] 3.2 Add synchronous `navigator.mediaSession.playbackState` assignments inside `'play'` and `'pause'` action handlers in `src/presentation/hooks/useMediaSession.ts`
- [x] 3.3 Separate explicit `resumeAudio` and `pauseAudio` in `src/presentation/hooks/useAudioStreamer.ts` and subscribe to `audioPlayer.onPlaybackStateChange` to reconcile `isPlaying`
- [x] 3.4 Wire `resumeAudio` and `pauseAudio` to `useMediaSession` to avoid toggle race conditions

## 4. Verification & Build

- [x] 4.1 Verify seeking across chapter timeline updates playhead, chunk playback, and Reader view
- [x] 4.2 Verify pausing from Android notification shade immediately switches icon to play and updates React app state
- [x] 4.3 Run `pnpm build` with Turbopack and verify clean compilation without TypeScript errors
