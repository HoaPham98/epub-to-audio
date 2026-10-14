# Tasks

## 1. MediaSession Action Handlers Lifecycle Refactor

- [x] 1.1 Decouple action handler registration into a mount-only `useEffect(..., [])` using `callbacksRef` in `src/presentation/hooks/useMediaSession.ts`
- [x] 1.2 Restrict registered actions to `seekbackward`, `play`, `pause`, `seekforward`, and `seekto`, removing `stop`, `previoustrack`, and `nexttrack`
- [x] 1.3 Separate `MediaMetadata` synchronization into an isolated `useEffect` keyed to `[book, currentChapterIndex, currentChunkIndex]`

## 2. Notification Behavior & Verification

- [x] 2.1 Verify notification displays the streamlined 3-button audiobook layout ([Rewind 10s] [Play/Pause] [Forward 10s]) with lockscreen scrubber support
- [x] 2.2 Verify tapping notification buttons executes commands without triggering notification shade collapse
- [x] 2.3 Run `pnpm build` with Turbopack and verify clean compilation without TypeScript errors
