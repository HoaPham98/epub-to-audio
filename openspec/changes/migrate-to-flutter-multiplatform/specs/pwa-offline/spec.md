# Spec Delta

## MODIFIED Requirements

### Requirement: Service Worker App Shell Caching and Offline Assets
The system SHALL bundle a Web App Manifest (`web/manifest.json`) and PWA Service Worker on Flutter Web to precache static assets, fonts, and the application shell, while providing native offline binary execution on Windows, Android, and iOS.

#### Scenario: Offline application load
- **WHEN** the user opens the application with no internet connectivity on Windows, Mobile, or an installed Flutter Web PWA
- **THEN** the application shell and UI assets load completely from local storage or the PWA cache without displaying an offline error page

#### Scenario: Background Service Worker update
- **WHEN** a new version of the Flutter Web application is deployed
- **THEN** the Service Worker installs updates in the background and activates when old tabs are closed

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
