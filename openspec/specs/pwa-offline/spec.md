# pwa-offline Specification

## Purpose

Enables Progressive Web App (PWA) installation, Service Worker asset precaching via Serwist, and full offline accessibility for reading EPUB books and listening to previously cached audio chunks from IndexedDB without internet access.

## Requirements

### Requirement: Web App Manifest and PWA Installation
The system SHALL provide a valid Web App Manifest (`manifest.json` / `manifest.webmanifest`) declaring application identity, icons, theme colors, and standalone display mode to support native-like installation on Android, iOS, and Desktop platforms.

#### Scenario: Valid manifest retrieval
- **WHEN** a browser requests the manifest metadata
- **THEN** the system returns a JSON response containing `name: "EPUB to Audio Reader"`, `short_name: "EPUB Audio"`, `display: "standalone"`, `start_url: "/"`, `theme_color: "#0a0a0a"`, and responsive icons (192x192, 512x512, maskable).

#### Scenario: Standalone launch
- **WHEN** the user launches the installed PWA from their device home screen or app launcher
- **THEN** the application opens in standalone mode without browser URL bars or navigational chrome.

### Requirement: Service Worker App Shell Caching and Offline Assets
The system SHALL bundle a Web App Manifest (`web/manifest.json`) and PWA Service Worker on Flutter Web to precache static assets, fonts, and the application shell, while providing native offline binary execution on Windows, Android, and iOS.

#### Scenario: Offline application load
- **WHEN** the user opens the application with no internet connectivity on Windows, Mobile, or an installed Flutter Web PWA
- **THEN** the application shell and UI assets load completely from local storage or the PWA cache without displaying an offline error page

#### Scenario: Background Service Worker update
- **WHEN** a new version of the Flutter Web application is deployed
- **THEN** the Service Worker installs updates in the background and activates when old tabs are closed

### Requirement: In-App PWA Install Prompt and iOS Safari Guidance
The system SHALL detect PWA installability and provide a clean, non-intrusive in-app install trigger for supported browsers, as well as an explanatory guide for iOS Safari users.

#### Scenario: Triggering custom install prompt on Chromium browsers
- **WHEN** the browser fires the `beforeinstallprompt` event
- **THEN** the system captures the event and displays an "Cài đặt ứng dụng" button in the application Header and Settings modal
- **AND** clicking the button prompts the native browser installation dialog.

#### Scenario: Displaying iOS Safari "Add to Home Screen" instructions
- **WHEN** an iOS Safari user clicks the install button
- **THEN** the application displays a friendly modal guiding the user to tap the Share button and select "Add to Home Screen".

### Requirement: Offline Reading and Audio Playback from IndexedDB
The system SHALL allow reading imported EPUB books across all platforms offline, synthesizing new chunks offline via `vieneu_tts` on Windows and Mobile, and playing previously cached audio chunks offline on Web, Windows, and Mobile without contacting external TTS servers.

#### Scenario: Playing cached chunk while offline
- **WHEN** the device has no network connection
- **AND** the user plays a chunk that has already been persisted in local audio cache (IndexedDB on Web or local file cache on Windows/Mobile)
- **THEN** the system retrieves the cached audio and plays it immediately
- **AND** updates Reader highlights in sync without displaying network errors

#### Scenario: Synthesizing un-cached chunk while offline on Windows and Mobile
- **WHEN** the device is offline on Windows or Mobile with the `vieneu_tts` model downloaded
- **AND** the user reaches a chunk not yet in the audio cache
- **THEN** the system synthesizes and streams the chunk on-device via `vieneu_tts` without requiring network connectivity

#### Scenario: Attempting to stream un-cached chunk while offline
- **WHEN** the device is offline on Flutter Web (or in Remote Server mode without local model) and the user reaches a chunk not yet cached
- **THEN** the system informs the user that network connectivity is required to synthesize new chunks, without crashing the player state machine
