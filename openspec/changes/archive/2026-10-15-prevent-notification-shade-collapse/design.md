# Design

## Context

See [proposal.md](file:///home/ubuntu/antigravity/adventurous-einstein/epub-to-audio/openspec/changes/prevent-notification-shade-collapse/proposal.md) for motivation.

In the current implementation:
1. `Reader.tsx` defines an auto-scroll effect:
   ```ts
   useEffect(() => {
     if (activeChunkRef.current) {
       activeChunkRef.current.scrollIntoView({
         behavior: 'smooth',
         block: 'center',
       });
     }
   }, [currentChapterIndex, currentChunkIndex, isPlaying]);
   ```
   When the user taps any notification control while the notification shade is pulled down over Chrome, `isPlaying` or chunk index changes. Calling `scrollIntoView` triggers a smooth viewport scroll in the foreground window. Android SystemUI detects viewport movement in the underlying activity and immediately collapses the notification drawer.
2. `WebAudioStreamPlayer.ts` runs a 50ms ticker interval for time updates. In `useMediaSession.ts`, an effect runs on every `currentTime` update and dispatches `navigator.mediaSession.setPositionState` 20 times per second, flooding Android's `MediaSessionCompat` IPC during user touch events.

## Goals / Non-Goals

**Goals:**
- Keep the Android notification shade expanded and accessible across all media button interactions (Play, Pause, Rewind 10s, Forward 10s).
- Eliminate unnecessary viewport scroll animations when pausing or resuming playback.
- Guard reading text auto-scroll so it only executes when the page is actively visible.
- Throttle `navigator.mediaSession.setPositionState` to a stable interval (500ms) without reducing in-app progress bar smoothness.

**Non-Goals:**
- Modifying audio streaming, caching, or TTS synthesis pipelines.
- Replacing the W3C Media Session API with native wrapper code.

## Decisions

### 1. Viewport Scroll Isolation in `Reader.tsx`
- **Choice**:
  - Remove `isPlaying` from `scrollIntoView`'s dependency array in `src/presentation/components/Reader.tsx`.
  - Add a check for `document.visibilityState === 'visible'` before triggering `scrollIntoView`.
- **Rationale**:
  - Pausing or resuming audio does not change the reading location; scrolling on play/pause is redundant and actively harmful on mobile.
  - Checking `visibilityState` ensures that background chunk advances (e.g. while the phone is locked or another app is open) do not trigger unseen layout calculations or window focus requests.
- **Alternatives Considered**:
  - *Keep `isPlaying` with instant scroll (`behavior: 'auto'`) instead of `smooth`*: Still triggers window viewport scroll events, which can cause Android SystemUI to dismiss overlays. Removing `isPlaying` completely is simpler and semantically correct.

### 2. Throttled Position State Synchronization in `useMediaSession.ts`
- **Choice**:
  - Introduce `lastPositionUpdateRef` in `useMediaSession.ts`.
  - In the position state effect, only dispatch `navigator.mediaSession.setPositionState` if:
    - At least 500ms have elapsed since the last update, OR
    - Playback state (`isPlaying`) changed, OR
    - A seek action occurred (large time jump).
- **Rationale**:
  - `WebAudioStreamPlayer`'s 50ms ticker remains unchanged, preserving smooth 20fps progress bar animations in the in-app `AudioPlayerBar`.
  - MediaSession timeline resolution does not need 50ms precision; 500ms throttling reduces IPC overhead by 90% and prevents SystemUI layout recalculation stalls when tapping notification buttons.
- **Alternatives Considered**:
  - *Reducing the ticker rate in `WebAudioStreamPlayer` to 500ms*: Degrades visual smoothness of in-app scrubber and chunk progress bars. Throttling at the MediaSession adapter level isolates the constraint.

```
+-------------------------------------------------------------------------------+
|                            INPUT & EVENT FLOW                                 |
+-------------------------------------------------------------------------------+

  Notification Button Click (Android Notification Shade)
               │
               ▼
  useMediaSession Action Handler (play / pause / seekbackward / seekforward)
               │
               ├──> isPlaying / currentChunkIndex state updates
               │       │
               │       ├──> Reader.tsx: Only scrolls if (chunk changed AND visible)
               │       │    (NO scroll on play/pause -> Shade stays open!)
               │       │
               │       └──> useMediaSession.ts: Throttled setPositionState (>= 500ms)
               │            (No IPC flood -> SystemUI does not re-layout/collapse)
               │
               ▼
  Notification Shade REMAINS EXPANDED
```

## Risks / Trade-offs

- **[Risk] Lockscreen timeline bar advances in 500ms increments**:
  - *Mitigation*: The OS lockscreen scrubber interpolates playback timing based on the reported `playbackRate`. Setting position state every 500ms is standard for mobile media players and yields a completely smooth lockscreen progress bar.
