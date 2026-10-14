# Design

## Context

In `src/presentation/hooks/useMediaSession.ts`, action handlers and metadata synchronization are currently bundled together inside a single `useEffect` dependent on `[book, currentChapterIndex, currentChunkIndex]`:
- Each chunk boundary transition or seek re-runs the effect, unregistering all action handlers with `navigator.mediaSession.setActionHandler(action, null)` before registering them again.
- In Chromium on Android, unregistering and re-registering handlers causes the native `MediaSessionCompat` and `MediaStyle` notification to be dismantled and recreated, causing the Android notification drawer to lose focus and automatically collapse.
- The registration of `stop` triggers OS-level notification dismissal in Android SystemUI.
- Registering 6 actions (`previoustrack`, `seekbackward`, `play`/`pause`, `seekforward`, `nexttrack`, `stop`) leads to cramped buttons with tiny touch targets.

See `proposal.md` for motivation and `specs/audio-streaming/spec.md` for requirements.

## Goals / Non-Goals

**Goals:**
- Provide a clean 3-button audiobook layout: [Rewind 10s] [Play/Pause] [Forward 10s], plus timeline seeking (`seekto`).
- Keep the Android notification shade expanded and accessible across multiple consecutive button taps.
- Ensure zero handler rebuilds during playback by moving action handler registration to an isolated mount lifecycle.
- Update book and chapter title/artwork metadata independently without affecting registered action handlers.

**Non-Goals:**
- Implementing native Android APK code (solutions must strictly leverage the web standard W3C Media Session API supported by mobile browsers).

## Decisions

### Decision 1: 3-Button Audiobook Action Set
- **Choice**: Register only:
  - `'seekbackward'`: Skips backward by 10 seconds.
  - `'seekforward'`: Skips forward by 10 seconds.
  - `'play'` / `'pause'`: Toggles or explicit play/pause.
  - `'seekto'`: Maps timeline drags on lockscreen to chapter timestamps.
  - Remove `'previoustrack'`, `'nexttrack'`, and `'stop'`.
- **Rationale**:
  - Audiobook and podcast listeners primarily need short replay/skip intervals (10s) to re-listen to missed sentences.
  - Pruning unnecessary actions increases touch target widths by >50%, preventing accidental taps on the notification background.
  - Eliminating `stop` stops Android SystemUI from treating interaction as a session termination.

### Decision 2: Decoupled Action Handler Mount Lifecycle
- **Choice**:
  - Register action handlers once when the hook mounts: `useEffect(() => { ... }, [])`.
  - Inside each action handler, invoke the latest callback through `callbacksRef.current[action]`.
- **Rationale**:
  - Because `callbacksRef.current` is updated on every render, action handlers always execute the latest application logic without needing re-registration.
  - Android Chrome never receives `setActionHandler(action, null)` during playback, preserving the notification session and keeping the notification shade open.

### Decision 3: Independent Metadata Effect
- **Choice**:
  - Move `navigator.mediaSession.metadata = new window.MediaMetadata(...)` to its own `useEffect` with dependency array `[book, currentChapterIndex, currentChunkIndex]`.
- **Rationale**:
  - Updating metadata alters only the notification's display text and artwork without disrupting registered actions or causing Android SystemUI to drop shade focus.

```
+-----------------------------------------------------------------------------------------+
|                              MEDIA SESSION HOOK LIFECYCLE                               |
+-----------------------------------------------------------------------------------------+

  Mount Lifecycle (runs once on mount, cleanups on unmount):
  ---------------------------------------------------------
  [Mount] ──> setActionHandler('play')
          ──> setActionHandler('pause')
          ──> setActionHandler('seekbackward')
          ──> setActionHandler('seekforward')
          ──> setActionHandler('seekto')
          (Never unregisters during playback -> Notification shade stays open!)

  Metadata Lifecycle (runs on chapter/chunk change):
  --------------------------------------------------
  [Chunk/Chapter Change] ──> navigator.mediaSession.metadata = new MediaMetadata(...)
                             (Updates title/cover in-place without rebuilding actions)

  Playback State Lifecycle (runs on isPlaying change):
  ---------------------------------------------------
  [isPlaying Change] ──> navigator.mediaSession.playbackState = 'playing' | 'paused'
```

## Risks / Trade-offs

- **[Risk] Track jump buttons absent from notification**:
  - *Mitigation*: Audiobooks operate on long text chapters; jumping full chunks or chapters is rarely desired from a lockscreen notification where visual context is hidden. In-app player controls retain dedicated chapter and chunk jump buttons.
- **[Risk] Browser garbage collection of unreferenced action callbacks**:
  - *Mitigation*: `callbacksRef` keeps strong references throughout the component lifecycle, and handlers are only cleared on full hook unmount.
