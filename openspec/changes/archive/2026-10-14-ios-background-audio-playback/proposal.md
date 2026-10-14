# Proposal: iOS Background Audio Playback Support

## Why

Currently, when the user locks the screen or minimizes Safari on iOS (iPhone/iPad), audio playback immediately ceases. This occurs because the speech synthesis pipeline outputs audio directly to `audioContext.destination`, which WebKit suspends instantly upon screen lock to conserve battery, while the dummy `/silence-10s.wav` background bridge is both ignored and vulnerable to false-positive pause events. Providing continuous background audio across all platforms, including iOS Safari, is essential for an audiobook reader PWA.

## What Changes

- **MediaStream Destination Bridge**: Route the Web Audio API output graph through `audioContext.createMediaStreamDestination()` and feed its stream into the HTML5 `<audio>` element via `srcObject` instead of relying solely on `audioContext.destination`.
- **W3C AudioSession API Support**: Declare `navigator.audioSession.type = 'playback'` on supported platforms (iOS Safari 16.4+) to prevent mute-switch interference and signal true background playback intent to iOS.
- **Eliminate Dummy Silence File Dependency**: Replace `/silence-10s.wav` playback with real audio streamed through the `<audio>` element bridge, ensuring both Android and iOS treat the element as an active media playback pipeline.
- **Robust Lockscreen Event Handling**: Ensure the audio element's event listeners distinguish genuine external pauses (e.g. headphone unplug, Bluetooth disconnect) from system screen lock/unlock transitions, preventing premature cancellation of the playback session.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `audio-streaming`: Add requirements and scenarios for iOS and multiplatform background audio continuity via MediaStream bridging and AudioSession configuration.

## Impact

- `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Refactor audio output routing from `audioContext.destination` to `createMediaStreamDestination()`, bind to `audioElement.srcObject`, configure `navigator.audioSession`, and streamline pause/play lifecycle.
- `src/domain/ports/audio.ts`: Verify port contracts support audio session lifecycle if needed.
- `public/silence-10s.wav`: Can be deprecated/removed as dummy bridge file.
