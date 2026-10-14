# Tasks: PWA Support, Screen-Off Background Audio & Media Notification Controls

## 1. Dependencies & PWA Assets Setup

- [x] 1.1 Install `@serwist/next` via pnpm and verify `package.json` and lockfile updates
- [x] 1.2 Create PWA icons (`icon-192x192.png`, `icon-512x512.png`, `maskable-icon-512x512.png`) in `public/icons/` and verify files exist

## 2. Background Audio Playback Engine

- [x] 2.1 Update `WebAudioStreamPlayer.ts` to create `MediaStreamAudioDestinationNode` and bridge to an HTML `<audio>` element
- [x] 2.2 Bind the hidden `<audio>` element in `AudioPlayerBar.tsx` / `useAudioStreamer.ts` with dual `AudioContext` and `<audio>` unlock on user interaction
- [x] 2.3 Implement audio interruption handling (auto-pause on headphone/Bluetooth disconnect or loss of audio focus) and verify state sync

## 3. Media Session Notification & Lock Screen Controls

- [x] 3.1 Implement `useMediaSession` hook and sync metadata (`title: "[Tên chương] - Đoạn X/Y"`, `artist`, `album`, `artwork`)
- [x] 3.2 Wire action handlers (`play`, `pause`, `previoustrack`, `nexttrack`, `seekbackward`, `seekforward`, `setPositionState`) in `useAudioStreamer.ts`
- [x] 3.3 Verify chunk navigation and relative seek (10s) trigger smoothly from system notification events

## 4. PWA Manifest & Serwist Service Worker

- [x] 4.1 Create `src/app/manifest.ts` defining metadata, standalone display mode, theme colors, and icons
- [x] 4.2 Configure Serwist service worker in `src/app/sw.ts` and integrate with `next.config.ts` for App Shell and asset precaching
- [x] 4.3 Update `src/app/layout.tsx` with PWA meta tags, theme color, and apple-touch-icon links

## 5. In-App Install Prompt & Offline Integration

- [x] 5.1 Implement `usePwaInstall` hook to capture `beforeinstallprompt` and render "Cài đặt ứng dụng" button in `Header.tsx`
- [x] 5.2 Add iOS Safari "Thêm vào Màn hình chính" guidance modal when clicked on iOS devices
- [x] 5.3 Build application and verify offline launch, cached book reading, and cached audio playback from IndexedDB
