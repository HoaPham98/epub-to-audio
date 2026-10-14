# Proposal

## Why

Currently, interacting with audio controls on the Android notification shade and lockscreen presents two major usability issues:
1. **Crowded Control Layout**: The MediaSession registers 6 separate action handlers (`previoustrack`, `seekbackward`, `play`/`pause`, `seekforward`, `nexttrack`, and `stop`). On mobile screens, this crowds the notification card, compresses touch targets, and causes frequent accidental touches outside the button boundaries.
2. **Notification Shade Dismissal on Interaction**: Each time the user taps any media button on the notification shade, the shade collapses or closes, forcing the user to swipe down again from the top. This occurs because action handlers were bundled in an effect dependent on chunk and chapter indexes (`[book, currentChapterIndex, currentChunkIndex]`), causing handlers to be nullified and recreated upon every chunk progress or action event. Re-registering handlers causes Chromium Android to recycle the `MediaSessionCompat` instance and drop notification focus. In addition, the `stop` action triggers OS-level dismissal.

Optimizing the notification layout to a focused 3-button audiobook configuration and stabilizing action handler registration will ensure a smooth, uninterrupted playback control experience from the lockscreen and notification panel.

## What Changes

- **Streamlined 3-Button Audiobook Layout**:
  - Keep `seekbackward` (rewind 10s), `play` / `pause`, and `seekforward` (fast-forward 10s).
  - Retain `seekto` for scrubbing the lockscreen timeline.
  - Remove `previoustrack`, `nexttrack`, and `stop` actions from the MediaSession notification.
- **Persistent Media Action Handler Lifecycle**:
  - Separate action handler registration from metadata synchronization.
  - Register action handlers once on mount using stable callback refs so that handlers are never unregistered and rebuilt during playback.
  - Update `navigator.mediaSession.metadata` (title, author, cover artwork) in an isolated effect that updates only when book or chapter metadata changes.
- **Accidental Collapse Prevention**:
  - Eliminating handler re-binding and removing the `stop` command prevents Android SystemUI from collapsing or dismissing the notification shade when user interacts with controls.

## Capabilities

### New Capabilities
<!-- None: all changes refine existing audio streaming and media session controls. -->

### Modified Capabilities
- `audio-streaming`: Update MediaSession action registration requirements to maintain a streamlined 3-button layout and persistent handler lifecycle that prevents notification shade collapse.

## Impact

- `src/presentation/hooks/useMediaSession.ts`: Refactor action handler registration to a persistent mount-only lifecycle and prune unused actions (`stop`, `previoustrack`, `nexttrack`).
