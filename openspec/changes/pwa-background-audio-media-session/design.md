# Design: PWA, Background Audio & Media Session

## Context

See [proposal.md](file:///home/ubuntu/antigravity/adventurous-einstein/epub-to-audio/openspec/changes/pwa-background-audio-media-session/proposal.md) for motivation.

The existing application plays streaming audio chunks by feeding raw PCM s16le buffers directly into `AudioContext` destination nodes in `WebAudioStreamPlayer.ts`. While this achieves sub-200ms latency, mobile operating systems suspend Web Audio contexts when the screen turns off or the tab is hidden, because Web Audio by itself does not claim a mobile OS audio playback session.

Additionally, Next.js 16 (App Router) is used with Turbopack for compilation, and audio/book caches are stored locally in IndexedDB (`IndexedDBAudioCache`, `IndexedDBBookRepository`).

## Goals / Non-Goals

**Goals:**
- Provide uninterrupted background audio playback when the mobile screen is locked or the browser tab is hidden.
- Expose full OS-level notification controls and lock screen widgets via the Media Session API (`play`, `pause`, `previoustrack`, `nexttrack`, `seekbackward`, `seekforward`, `setPositionState`).
- Package the web application as an installable PWA with offline shell caching via Serwist (`@serwist/next`).
- Enable offline reading of imported EPUB books and listening to previously synthesized/cached audio chunks from IndexedDB.
- Provide custom in-app install triggers (`beforeinstallprompt` on Android/Chrome, modal guidance on iOS).

**Non-Goals:**
- Offline TTS synthesis: Synthesizing new (uncached) text chunks still requires network connectivity to the TTS proxy/endpoint.
- Native mobile app wrapper: The application remains a pure web application (PWA) without Capacitor/Cordova wrappers.

## Decisions

### 1. Web Audio to HTMLMediaElement Bridge (`MediaStreamDestination`)

- **Decision**: In `WebAudioStreamPlayer`, create a `MediaStreamAudioDestinationNode` via `this.audioContext.createMediaStreamDestination()`. Connect all scheduled `AudioBufferSourceNode`s to both `this.audioContext.destination` (or solely to the stream destination) and pipe the stream into a hidden `<audio>` element (`audioElement.srcObject = dest.stream`).
- **Rationale**:
  - HTMLMediaElement (`<audio>`) is recognized by iOS WebKit and Android Chrome as an active media playback entity, which prevents the OS from suspending the background tab and keeps the audio session alive during lock screen.
  - Preserves the existing raw PCM streaming, lead-in buffering (300ms), and gapless queue logic without needing to transcode PCM to Blob URLs or re-encode to AAC/MP3 on the fly.
- **Alternatives Considered**:
  - *Silent Audio Keep-Alive Hack*: Playing a silent audio loop on `<audio>` while Web Audio plays in parallel. Rejected because iOS audio ducking/mixing can silence or desync the Web Audio context, and lock screen scrubbers cannot track actual track duration.
  - *Blob URL / MediaSource on `<audio>`*: Assembling audio chunks into WAV/MP3 Blobs. Rejected because streaming latency increases (cannot start playback on the first 300ms PCM delta without chunk encoding overhead), and MediaSource Extensions (MSE) for audio has poor support on iOS Safari.

### 2. Media Session Controller Hook & Event Synchronization

- **Decision**: Introduce a `useMediaSession` hook in presentation layer (or integrate into `useAudioStreamer.ts`) that manages `navigator.mediaSession`:
  - **Metadata**: Updates on active chunk or chapter changes:
    - `title`: `${currentChapter.title} - Đoạn ${currentChunkIndex + 1}/${totalChunks}`
    - `artist`: `book.author || 'Tác giả không xác định'`
    - `album`: `book.title`
    - `artwork`: `[{ src: book.coverUrl || '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }]`
  - **Action Handlers**:
    - `play`: Resumes player.
    - `pause`: Suspends player.
    - `previoustrack`: Navigates to previous chunk (`chapIdx, chunkIdx - 1`), auto-rolling to previous chapter end if at index 0.
    - `nexttrack`: Navigates to next chunk (`chapIdx, chunkIdx + 1`), auto-rolling to next chapter if at end of chapter.
    - `seekbackward`: `onSkipRelative(-10)`.
    - `seekforward`: `onSkipRelative(10)`.
  - **Timeline Scrubber Sync**: When chunk changes or time updates, invokes `navigator.mediaSession.setPositionState({ duration, playbackRate, position })`.
- **Alternatives Considered**:
  - *Chapter-only track jumps*: Mapping `previoustrack`/`nexttrack` to whole chapters. Rejected because user specifically preferred sentence/chunk navigation from the lock screen, with auto-advance across chapter boundaries.

### 3. PWA Architecture & Serwist Service Worker

- **Decision**:
  - Use `@serwist/next` with a service worker file (`src/app/sw.ts` or `public/sw.js`).
  - Configure `src/app/manifest.ts` returning standard webmanifest data:
    - `name: "EPUB to Audio Reader"`, `short_name: "EPUB Audio"`, `display: "standalone"`, `start_url: "/"`.
    - Colors: `theme_color: "#0a0a0a"`, `background_color: "#0a0a0a"`.
    - Icons: 192x192, 512x512, maskable icons in `public/icons/`.
  - In `next.config.ts`, integrate `@serwist/next` to generate precache manifests for App Shell, CSS, and fonts.
- **Rationale**:
  - Provides reliable caching for offline launch while ensuring Next.js static chunks are precached per build.

### 4. PWA Installation UX

- **Decision**:
  - Create `usePwaInstall` hook listening for window `beforeinstallprompt`.
  - Display an "Cài đặt ứng dụng" button in `Header.tsx` and `SettingsModal.tsx`.
  - For iOS Safari (which lacks `beforeinstallprompt`), clicking the button displays an instructional sheet demonstrating the "Share -> Add to Home Screen" action.

## Risks / Trade-offs

- **[Risk] Mobile Browser Autoplay Restrictions**:
  - *Issue*: Browsers reject `<audio>.play()` if not triggered directly by user gesture.
  - *Mitigation*: Initialize and unlock both `AudioContext` and the hidden `<audio>` element simultaneously inside the first user click handler (`togglePlayPause`).
- **[Risk] Interruption / Bluetooth Disconnect**:
  - *Issue*: If Bluetooth headphones disconnect, audio could unintentionally broadcast over speaker.
  - *Mitigation*: Attach listener to `<audio>` element's `pause` event and `navigator.mediaSession` to cleanly sync application pause state when external audio focus is lost.
- **[Risk] Next.js 16 Turbopack Compatibility**:
  - *Issue*: Some Webpack-based service worker generators fail under Turbopack in `next dev`.
  - *Mitigation*: Configure Serwist with `disable: process.env.NODE_ENV === 'development'` or provide standalone service worker fallback during development to avoid blocking Turbopack workflows.

## Migration Plan

1. Install dependencies (`@serwist/next`, icons).
2. Implement `MediaStreamDestination` bridge in `WebAudioStreamPlayer.ts`.
3. Implement `useMediaSession` hook and bind to `useAudioStreamer.ts`.
4. Add PWA manifest (`src/app/manifest.ts`) and Serwist service worker configuration.
5. Create PWA install UI banner and components.
6. Verify background playback with screen locked on real mobile device or simulated throttled browser tab.
