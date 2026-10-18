# Proposal

## Why

On mobile devices (notably Android Chrome) and desktop browsers, pausing audio playback currently causes the native notification shade to collapse unexpectedly. Because the background bridge is connected via a live `MediaStreamDestination`, fully suspending `AudioContext` and calling `audioElement.pause()` signals to the operating system that the media stream has terminated, causing Android to dismiss the media notification. When users reopen the notification shade, state synchronization deadlocks and expired audio buffer nodes prevent playback from resuming. Additionally, desktop users lack standard keyboard shortcuts (e.g., Space to toggle play/pause, arrow keys to seek), hindering the feel of a native, smooth audio player.

## What Changes

- **Active Silence / Gain Muting for Pause (Option A)**: Update `WebAudioStreamPlayer` to keep the `AudioContext` and `HTMLAudioElement` pipeline active upon pause by muting audio output (`gainNode.gain.value = 0`) and setting `navigator.mediaSession.playbackState = 'paused'`, rather than tearing down or suspending the stream. This maintains active Android media session presence without collapsing the notification center.
- **Reliable Play/Pause State Synchronization**: Resolve the `playerState` deadlock during `resumeAudio()` and implement buffer freshness validation upon resume. If scheduled buffer time has elapsed while paused, immediately rehydrate or re-stream from the current chunk position.
- **MediaSession Navigation Extensions**: Wire `previoustrack` and `nexttrack` action handlers in `useMediaSession` to support headphone and notification previous/next controls alongside existing 10-second seek buttons.
- **Desktop Keyboard Shortcuts**: Introduce a keyboard shortcut manager (`useDesktopShortcuts`) supporting Space (Play/Pause), Left/Right Arrows (Seek 10s), Up/Down Arrows (Volume), 'M' (Mute toggle), and '[' / ']' (Previous/Next Chapter), with proper input focus guards.

## Capabilities

### New Capabilities
- `desktop-playback-shortcuts`: Keyboard shortcuts and media key integration for hands-free audio playback control on desktop platforms.

### Modified Capabilities
- `audio-streaming`: Refine notification lifecycle and playback state synchronization requirements so pause actions maintain notification shade visibility without auto-dismissal, and resume actions reliably continue stream playback.

## Impact

- `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Modify `pause()`, `play()`, and buffer playback routines to use soft mute/unmute and prevent expired buffer dropouts.
- `src/presentation/hooks/useAudioStreamer.ts`: Adjust `resumeAudio()` and `pauseAudio()` flow to avoid state race conditions.
- `src/presentation/hooks/useMediaSession.ts`: Register `previoustrack` and `nexttrack` actions and improve state synchronization.
- `src/presentation/hooks/useDesktopShortcuts.ts`: New React hook for desktop keyboard shortcut handling.
- `src/app/page.tsx`: Connect desktop keyboard shortcut hook to audio streamer actions.
