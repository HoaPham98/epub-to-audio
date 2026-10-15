# Tasks

## 1. Viewport Scroll Decoupling in Reader

- [x] 1.1 Remove `isPlaying` from `scrollIntoView` dependency array in `src/presentation/components/Reader.tsx` and guard execution with `document.visibilityState === 'visible'`
- [x] 1.2 Verify in browser that toggling play/pause does not trigger viewport scroll movements

## 2. MediaSession Position Throttling

- [x] 2.1 Implement minimum 500ms throttling on `navigator.mediaSession.setPositionState` using `lastPositionUpdateRef` in `src/presentation/hooks/useMediaSession.ts`
- [x] 2.2 Ensure immediate `setPositionState` dispatch occurs when explicit seeks or chapter/chunk transitions take place

## 3. Integration & Build Verification

- [x] 3.1 Run `pnpm build` with Turbopack and verify clean compilation without TypeScript or lint errors
- [x] 3.2 Verify tapping Play/Pause, Rewind 10s, and Forward 10s on the notification shade executes commands without causing the Android notification drawer to collapse
