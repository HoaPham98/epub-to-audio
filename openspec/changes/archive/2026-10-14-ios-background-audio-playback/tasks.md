# Tasks: iOS Background Audio Playback Support

## 1. MediaStream Audio Bridge Implementation

- [x] 1.1 In `src/infrastructure/audio/WebAudioStreamPlayer.ts`, instantiate `audioContext.createMediaStreamDestination()`, connect `gainNode` into `mediaStreamDestination`, and assign `mediaStreamDestination.stream` to `this.audioElement.srcObject` (with fallback to `audioContext.destination` if unsupported). Verify via unit tests/mock assertions that audio node routing connects to the MediaStream.
- [x] 1.2 Configure W3C AudioSession intent by setting `navigator.audioSession.type = 'playback'` in `WebAudioStreamPlayer.init()` when `navigator.audioSession` is supported. Verify with a feature check test.
- [x] 1.3 Remove `/silence-10s.wav` assignment on `this.audioElement`, ensuring real audio feeds the bridge, and refine the `audioElement` `pause` listener to avoid cancelling playback during platform lockscreen transitions.

## 2. Audio Lifecycle & Integration Verification

- [x] 2.1 Implement `visibilitychange` listener to auto-resume `AudioContext` if it enters a suspended state while `playerState === 'playing'`, ensuring smooth recovery when returning from background.
- [x] 2.2 Run full project build (`pnpm build`) and linting to ensure zero regressions across audio playback, scrubber, and notification control hooks.
