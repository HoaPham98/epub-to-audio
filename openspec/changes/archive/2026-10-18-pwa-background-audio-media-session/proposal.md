# Proposal: PWA Support, Screen-Off Background Audio & Media Notification Controls

## Why

Currently, the audiobook player relies purely on the Web Audio API (`AudioContext`). While this provides ultra-low latency streaming for raw PCM chunks from the TTS service, mobile operating systems (iOS Safari and Android Chrome) aggressively freeze and suspend `AudioContext` as soon as the screen is turned off or the browser is minimized.

In addition:
1. **No System Notifications or Lock Screen Controls**: Users cannot control audio (pause/play, jump chunks, skip 10s) from the notification shade or lock screen without unlocking the phone.
2. **Not Installable as a PWA**: The application lacks a Web App Manifest and Service Worker, preventing users from installing it to their home screen as a standalone app.
3. **No Offline App Shell**: Users cannot launch the app or listen to previously cached audio chunks and books stored in IndexedDB when offline.

By bridging Web Audio to an HTML `<audio>` element via `MediaStreamDestination`, integrating the **Media Session API**, and adding **PWA support with Serwist Service Worker**, users will be able to install the app on their device, listen to continuous audiobooks even when the screen is locked, and control playback directly from their system media notification.

## What Changes

- **Background Audio Bridge (`MediaStreamDestination`)**:
  - Connect `WebAudioStreamPlayer`'s `AudioContext` to a `MediaStreamAudioDestinationNode`.
  - Pipe the resulting `MediaStream` into a hidden HTML `<audio>` element (`srcObject = dest.stream`).
  - Keep the browser's background audio session alive across screen-off and tab-switching events without re-architecting the low-latency PCM streaming pipeline.
- **Media Session API Integration**:
  - Implement a dedicated `useMediaSession` hook to manage `navigator.mediaSession`.
  - Display rich `MediaMetadata`:
    - `title`: `[Tên chương] - Đoạn X/Y`
    - `artist`: `[Tên tác giả]`
    - `album`: `[Tên sách]`
    - `artwork`: Book cover URL (if available) with fallback to PWA app icon.
  - Implement system action handlers:
    - `play` / `pause`: Toggle streaming audio playback.
    - `previoustrack` / `nexttrack`: Navigate to previous/next text chunk (auto-rolling across chapter boundaries).
    - `seekbackward` / `seekforward`: Skip backward/forward by 10–15 seconds.
    - `setPositionState`: Sync lock screen timeline/scrubber position and playback rate.
- **Audio Interruption & Audio Focus Handling**:
  - Detect audio interruptions (headphone/Bluetooth disconnect, incoming calls) and automatically pause playback cleanly to prevent unwanted loudspeaker playback.
- **PWA & Serwist Service Worker**:
  - Configure `@serwist/next` with Next.js 16 App Router for automated Workbox precaching of the App Shell and static assets.
  - Implement Web App Manifest (`src/app/manifest.ts`) supporting standalone display mode, theme colors, and icons (192x192, 512x512).
  - Offline readiness: Allow users to open the app, browse imported books, and listen to cached audio from IndexedDB while offline.
- **Install Prompt UI**:
  - Capture `beforeinstallprompt` on Android and Chromium browsers to display a contextual "Cài đặt ứng dụng" button in the Header/Settings.
  - Provide an iOS Safari helper modal instructing users how to "Add to Home Screen".

## Capabilities

### New Capabilities
- `pwa-offline`: Progressive Web App manifest, Serwist Service Worker caching, offline shell loading, and contextual install prompt.

### Modified Capabilities
- `audio-streaming`: Enhanced with background playback via `MediaStreamDestination` `<audio>` bridge, Media Session notification controls, lock screen metadata synchronization, and audio interruption handling.

## Impact

- **Affected Code**:
  - `src/domain/ports/audio.ts`: Add stream destination and media element binding methods if required.
  - `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Initialize `MediaStreamDestination` and connect audio output.
  - `src/presentation/hooks/useAudioStreamer.ts`: Connect Media Session state, handle chunk-level navigation, and sync duration/position.
  - `src/presentation/components/AudioPlayerBar.tsx`: Bind hidden audio element and integrate volume/mute controls.
  - `src/presentation/components/Header.tsx`: Add "Cài đặt ứng dụng" button.
  - `src/app/layout.tsx`: Add PWA metadata, apple-touch-icon, theme color.
  - `next.config.ts`: Integrate Serwist plugin.
  - `package.json`: Add `@serwist/next` dependency.
- **APIs**: Standard browser `navigator.mediaSession`, `AudioContext.createMediaStreamDestination()`, and Service Worker APIs.
