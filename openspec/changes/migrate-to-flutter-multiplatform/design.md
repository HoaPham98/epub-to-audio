# Design

## Context

See `proposal.md` for motivation. The existing project is a Next.js 16 / React 19 / TypeScript web application structured around a 4-layer Clean Architecture (`src/domain`, `src/application`, `src/infrastructure`, `src/presentation`). We are replacing the Next.js codebase in-place with a single multi-platform **Flutter** codebase supporting **Windows, Web, Android, and iOS**.

`package:vieneu_tts` v0.1.1 (`https://github.com/HoaPham98/vieneu-tts-modal/tree/main/packages/vieneu_tts`) uses Dart Native Assets (`hooks` + `code_assets` + `flutter_rust_bridge: 2.13.0`) to bundle prebuilt C++/Rust binaries (`rust_lib_vieneu_tts.dll` on Windows, `librust_lib_vieneu_tts.so` on Android/Linux, `librust_lib_vieneu_tts.dylib` on iOS/macOS). Version 0.1.1 natively exposes `TtsSynthesisOptions` in Rust/Dart, supporting on-the-fly 24kHz Mono decimation, raw PCM (`s16le`) streaming, and sampling parameters (`temperature`, `top_k`, `top_p`, `repetition_penalty`, `max_chars`, `seed`). Because `dart:io` and FFI are unavailable on Flutter Web (`dart2js` / `dart2wasm`), the Flutter Web build uses conditional exports and never transitively imports `package:vieneu_tts`.

## Goals / Non-Goals

**Goals:**
- Preserve the 4-layer Clean Architecture (`lib/domain`, `lib/application`, `lib/infrastructure`, `lib/presentation`) in pure Dart so business rules (`SentenceBoundaryChunker`, sliding-window prefetch 800–1,200 chars, timeline synchronization) are 100% shared across Windows, Web, and Mobile.
- Provide zero-latency 100% offline TTS on Windows and Mobile via `package:vieneu_tts` 0.1.1 with on-demand downloading of `vieneu-v3-turbo-q8_0.gguf` (~188 MB) and `sea_g2p.bin` (~60 MB), native 24kHz Mono PCM streaming, and optional fallback to Remote HTTP/SSE TTS.
- Implement a robust, OOM-safe storage architecture: native file-system `.wav` files with LRU size cap (200MB Mobile/Web, 500MB Desktop) and sliding TTL (7 days) on Windows/Mobile, and browser IndexedDB on Web.
- Keep full feature parity on Flutter Web using direct HTTP/SSE streaming (`POST /v1/audio/speech`) and Web Audio API playback without a backend CORS proxy.
- Verify the complete end-to-end flow—from model/dictionary download and engine initialization to EPUB chunking, real-time audio streaming, and player state transitions—via automated `integration_test` suites.

**Non-Goals:**
- Maintaining the legacy Next.js server or `/api/*-proxy` CORS routes.
- Running `audio.cpp` / GGUF inference inside the browser via WebAssembly (Web continues to use remote HTTP/SSE TTS endpoints).
- Storing binary audio blobs inside in-memory NoSQL databases (e.g. `sembast`) on native platforms.

## Decisions

### 1. Conditional Imports for `vieneu_tts` Isolation (`Web` vs `Native`)
- **Decision**: Define a platform-neutral `ITTSStreamingService` port and `OnDeviceTtsBridge` interface in `lib/domain/ports/`. In `lib/infrastructure/tts/`, use Dart conditional exports:
  ```dart
  export 'on_device_tts_stub.dart'
      if (dart.library.io) 'on_device_tts_native.dart';
  ```
  Only `on_device_tts_native.dart` imports `package:vieneu_tts/vieneu_tts.dart` and `dart:io`.
- **Rationale**: Prevents Flutter Web compilation from pulling in `dart:io` or `flutter_rust_bridge` FFI symbols while allowing Windows, Android, and iOS to invoke `VieneuTts.downloadModel`, `VieneuTts.downloadDictionary`, `VieneuTts.init`, `VieneuTts.stream`, and `VieneuTts.availableVoices` directly.
- **Alternatives Considered**: Separate Flutter apps for Web and Native—rejected because 90% of Domain, Application, and Presentation code is identical.

### 2. Dual-Mode TTS Provider & Unified 24kHz Mono PCM Streaming
- **Decision**: `vieneu_tts` 0.1.1 outputs native 24kHz Mono raw PCM (`s16le`) via `responseFormat: AudioResponseFormat.pcm`, `sampleRate: 24000`, `channels: 1`.
  - `OnDeviceVieNeuTTSClient` (Native Offline): Invokes `VieneuTts.stream(text: text, options: TtsSynthesisOptions(...))` with settings mapped directly from `TTSSettings` (including `voice`, `speed`, `sampleRate: 24000`, `channels: 1`, `responseFormat: AudioResponseFormat.pcm`, `temperature`, `topK`, `topP`, `repetitionPenalty`, `maxChars`). It yields `AudioChunk(pcmBuffer, sampleRate: 24000, channels: 1)` in real time.
  - `VieNeuStreamTTSClient` (Web & Native Remote): Uses `package:fetch_client` (on Web) or `package:http` `Client.send` (on Native) to ingest SSE `speech.audio.delta` events and yields `AudioChunk(pcmBuffer, sampleRate: 24000, channels: 1)`.
- **Rationale**: Both On-Device and Remote providers produce the identical 24kHz Mono PCM stream (48 KB/s), allowing the player pipeline to be 100% agnostic to the audio source.
- **Alternatives Considered**: Keeping 48kHz Stereo on native—rejected because it consumes 4x RAM and disk storage (192 KB/s) without improving Vietnamese speech comprehension.

### 3. OOM-Safe Storage & LRU/TTL Audio Cache Architecture
- **Decision**: Decouple binary audio storage from metadata indexing:
  - **Native (Windows, Android, iOS)**:
    - Audio chunks are saved as discrete `.wav` files directly in `getApplicationCacheDirectory()/audio_cache/`.
    - An index table (key, bookId, chapterIndex, chunkIndex, filePath, sizeBytes, lastAccessedAt) is maintained via SQLite (`sqflite_common_ffi`) or a lightweight JSON index file.
    - Books and progress are stored in `getApplicationSupportDirectory()`.
    - Avoid `idb_shim` with `sembast` for audio blobs on native platforms to prevent loading hundreds of MBs into memory.
  - **Web**:
    - Uses native browser IndexedDB (`idb_shim` / `package:web`) to store blobs as handled natively by browser storage engines.
  - **Cache Eviction Policy**:
    - **Key Normalization**: `speed` is excluded from the cache key because playback speed scaling (1.0x to 2.0x) is performed dynamically by the player (`just_audio.setSpeed()` / `AudioContext.playbackRate`).
    - **Max Size Quota (LRU)**: 200 MB on Mobile/Web (~70 minutes of speech), 500 MB on Windows Desktop (~175 minutes). Evicts oldest accessed chunks when quota is exceeded.
    - **Sliding TTL**: Chunks with `lastAccessedAt` older than 7 days (Mobile/Web) or 14 days (Desktop) are purged upon app launch.
    - **Book Cleanup**: Deleting or replacing a book immediately deletes all corresponding cached audio files.

### 4. On-Demand Model & Dictionary Manager (`model.gguf` + `sea_g2p.bin`)
- **Decision**: `OfflineModelManagerService` in Infrastructure stores files in `getApplicationSupportDirectory()/vieneu_models/`:
  1. Downloads `model.gguf` (`VieneuTts.downloadModel`) and `sea_g2p.bin` (`VieneuTts.downloadDictionary`) with combined and per-file progress callbacks (`0.0` to `1.0`).
  2. Supports custom/override model URLs or local file paths for fast testing in CI/integration tests.
  3. Calls `VieneuTts.init(modelPath: modelPath, dictPath: dictPath, threads: settings.threads)` once both files are verified.
- **Rationale**: `vieneu_tts` requires both the 188 MB GGUF weights and the 60 MB `sea_g2p.bin` dictionary for accurate Vietnamese G2P phonemization. Deferring download until the user starts playback or opens the Model Manager ensures instant app startup and immediate EPUB reading.

### 5. Unified Audio Stream Player & OS Media Session Architecture
- **Decision**: Implement `IAudioStreamPlayer` with two platform adapters behind a single interface:
  - **Flutter Web (`WebAudioStreamPlayerAdapter`)**: Uses `dart:js_interop` and `package:web` to drive the browser's `AudioContext`, dynamic lookahead scheduler (100–200ms), 150–300ms lead-in buffer, silence padding (250ms sentence / 500ms paragraph), HTML `<audio>` `MediaStreamAudioDestinationNode` bridge, and `navigator.mediaSession`.
  - **Windows & Mobile (`NativeAudioStreamPlayerAdapter`)**: Streams synthesized 24kHz Mono PCM/WAV chunks into `just_audio` (with silence padding: 250ms sentence / 500ms paragraph), integrated with `audio_service` (Android Foreground Service & iOS `MPNowPlayingInfoCenter`) and `smtc_windows` (Windows 10/11 SMTC).
- **Rationale**: Real OS background services on Mobile eliminate the need for the web silence bridge workaround, providing true background playback resilience.

### 6. Pure-Dart EPUB Parsing
- **Decision**: Port `EpubParserAdapter` to pure Dart using `package:archive` (`ZipDecoder`), `package:xml` (`XmlDocument` for `container.xml`, `.opf`, `.ncx`), and `package:html` (for DOM stripping and paragraph extraction). Works identically on Windows, Web, Android, and iOS using `Uint8List` file bytes from `file_picker` or bundled `assets/sample-book.epub`.

### 7. End-to-End Integration Testing Strategy (`integration_test`)
- **Decision**: Build an `integration_test/app_e2e_test.dart` suite executable via `flutter test integration_test/app_e2e_test.dart -d windows` (and mobile targets) that tests two complete E2E flows:
  1. **Real Native On-Device E2E Flow**:
     - Verifies model and dictionary download via `VieneuTts.downloadModel` and `VieneuTts.downloadDictionary` (checking progress callbacks `0.0 -> 1.0` and file existence/size in support directory).
     - Initializes `VieneuTts.init(modelPath: ..., dictPath: ...)`.
     - Loads `assets/sample-book.epub`, verifies `SentenceBoundaryChunker` produces valid chunks (20–350 chars), initiates playback on Chunk 0, streams real audio bytes from `VieneuTts.stream` with `TtsSynthesisOptions(sampleRate: 24000, channels: 1, responseFormat: AudioResponseFormat.pcm)`, verifies `AudioChunk` emission (`24000 Hz`, non-empty bytes), verifies player transitions (`isLoading -> isPlaying`), and verifies filesystem audio cache persistence.
  2. **Remote SSE Streaming E2E Flow**:
     - Spins up an in-process local mock HTTP SSE server (`HttpServer.bind(InternetAddress.loopbackIPv4, 0)`) emitting `speech.audio.delta` PCM events and `speech.audio.done`, verifying `VieNeuStreamTTSClient` streaming, sliding-window prefetching (800–1,200 chars), and player timeline synchronization.
  3. **Web Chrome Verification Flow**:
     - Launches the Flutter Web build on Google Chrome (`flutter run -d chrome` or `flutter test integration_test/app_e2e_test.dart -d chrome`) to verify EPUB reading, direct HTTP SSE streaming playback, Web Audio context lookahead scheduling, MediaSession synchronization, and browser console clean state without CORS or FFI errors.

## Risks / Trade-offs

- **[Risk] Native Assets compilation on fresh setups** → **Mitigation**: `vieneu_tts` 0.1.1 uses `flutter_rust_bridge_hooks: 2.13.0` and prebuilt binary archives in `hook/build.dart`. Verified automatically via CI scripts.
- **[Risk] First-time download of ~248 MB (`model.gguf` + `sea_g2p.bin`)** → **Mitigation**: Atomic `.part` downloads with percentage progress bar, cancellable, cached locally forever unless manually wiped.
- **[Risk] Accidental `dart:io` import on Web** → **Mitigation**: Strict conditional exports in `lib/infrastructure/tts/` and `lib/infrastructure/storage/`, verified with `flutter build web` and `flutter analyze`.

## Migration Plan

1. Back up existing `openspec/` and `public/sample-book.epub`, remove legacy Next.js files (`src/`, `package.json`, `next.config.ts`, `tsconfig.json`, `node_modules/`), and initialize the Flutter project in the repository root with `windows`, `web`, `android`, and `ios` platforms enabled.
2. Add `vieneu_tts` git dependency (`https://github.com/HoaPham98/vieneu-tts-modal.git`, `path: packages/vieneu_tts`, ref `main` / `v0.1.1`).
3. Implement Domain, Application, Infrastructure (Native File/Web IDB Storage, `vieneu_tts` 0.1.1 adapter, player adapters), and Presentation layers in `lib/`.
4. Run unit tests (`flutter test`), E2E integration tests (`flutter test integration_test/app_e2e_test.dart -d windows`), and web build verification (`flutter build web`).
