# Proposal

## Why

Interacting with media notification controls (Play, Pause, Rewind 10s, Forward 10s) on Android currently causes the notification shade (drawer) to unexpectedly collapse and close, forcing the user to repeatedly swipe down to access playback controls again. 

Investigation revealed that:
1. `Reader.tsx` attaches `scrollIntoView` to `[currentChapterIndex, currentChunkIndex, isPlaying]`. Every time the user pauses or plays from the notification shade, `isPlaying` flips, triggering a smooth viewport scroll on the foreground web page underneath. Android SystemUI interprets viewport scrolling in the foreground window as an active user interaction with the underlying page, and immediately collapses the notification drawer.
2. `useMediaSession.ts` synchronizes `setPositionState` on every `currentTime` update (fired every 50ms / 20 times per second by `WebAudioStreamPlayer`), flooding Android's `MediaSessionCompat` IPC during touch interactions.

Fixing the viewport scroll trigger and throttling `setPositionState` ensures the Android notification drawer remains stably open across all media control interactions.

## What Changes

- **Decouple Viewport Scrolling from Playback State**:
  - In `src/presentation/components/Reader.tsx`, remove `isPlaying` from the auto-scroll dependency array so that pausing or resuming audio never triggers a viewport scroll.
  - Guard `scrollIntoView` to only execute when `document.visibilityState === 'visible'` and chunk/chapter actually changes.
- **Throttle MediaSession Position State Synchronization**:
  - In `src/presentation/hooks/useMediaSession.ts`, throttle calls to `navigator.mediaSession.setPositionState` (e.g. at intervals of 500ms–1000ms or on explicit seek/chunk transition) rather than every 50ms ticker tick, preventing SystemUI IPC saturation and widget layout jitter.
- **Stable Notification Shade UX**:
  - Retain the streamlined 3-button layout ([Rewind 10s] [Play/Pause] [Forward 10s]) while ensuring tapping buttons maintains persistent notification shade expansion.

## Capabilities

### New Capabilities
<!-- None: all changes refine existing audio-streaming and notification synchronization capabilities. -->

### Modified Capabilities
- `audio-streaming`: Update `Timeline-Based Reader Highlighting Synchronization` and `System and Notification Playback State Synchronization` requirements to decouple viewport scroll events from playback state toggles and throttle position state dispatch to prevent notification drawer collapse.

## Impact

- `src/presentation/components/Reader.tsx`: Auto-scroll effect refinement.
- `src/presentation/hooks/useMediaSession.ts`: Throttled `setPositionState` synchronization.
