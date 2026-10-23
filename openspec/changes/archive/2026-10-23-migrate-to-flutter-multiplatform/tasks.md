# Tasks

## 1. Flutter Project Scaffolding & Multi-Platform Setup

- [x] 1.1 Archive/remove legacy Next.js files (`src/`, `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`) while preserving `openspec/`, `.agents/`, and `sample-book.epub`, then scaffold the Flutter project at repository root with `windows`, `web`, `android`, and `ios` targets and verify `flutter pub get` succeeds
- [x] 1.2 Configure `pubspec.yaml` with `vieneu_tts: ^0.1.1` (`git: url: https://github.com/HoaPham98/vieneu-tts-modal.git, path: packages/vieneu_tts`), `archive`, `xml`, `html`, `http`, `fetch_client`, `path_provider`, `shared_preferences`, `sqflite_common_ffi`, `file_picker`, `just_audio`, `audio_service`, `lucide_icons_flutter`, `flutter_test`, and `integration_test`, enable `native-assets`, bundle `assets/sample-book.epub`, and verify `flutter analyze` passes

## 2. Domain & Application Layers (Pure Dart)

- [x] 2.1 Implement pure-Dart Domain entities (`EpubBook`, `EpubChapter`, `TextChunk`, `TTSSettings`, `TtsMode`, `VoiceOption`, `ModelOption`, `AudioChunk`, `ChunkStatus`, `PlaybackProgress`) and ports (`ITTSStreamingService`, `IAudioStreamPlayer`, `IAudioCacheRepository`, `IBookRepository`, `ITextChunkerService`, `IOfflineModelManager`) under `lib/domain/` with speed-independent cache key generation, and verify zero platform/UI imports via `flutter analyze`
- [x] 2.2 Port `SentenceBoundaryChunker` to Dart (`lib/infrastructure/chunker/sentence_boundary_chunker.dart`) supporting 150–250 char optimal window, clause splitting, short-sentence merging (< 20 chars), non-speech punctuation filtering, and cross-paragraph dialogue accumulation, and verify all scenarios pass with `flutter test test/unit/sentence_boundary_chunker_test.dart`
- [x] 2.3 Implement Application use cases (`ParseAndLoadBookUseCase`, `ManageAudioCacheUseCase`, `StreamAndPlayChunkUseCase`, `StreamLifecycleUseCases`, `ManageOfflineModelUseCase`) with token-based sliding-window prefetch (800–1,200 chars) and cross-chapter continuity under `lib/application/`, and verify unit tests pass with `flutter test test/unit/application_usecases_test.dart`

## 3. Infrastructure: EPUB Parser & OOM-Safe Cross-Platform Storage

- [x] 3.1 Implement `EpubParserAdapter` in pure Dart (`lib/infrastructure/parser/epub_parser_adapter.dart`) using `package:archive`, `package:xml`, and `package:html` to parse `META-INF/container.xml`, OPF spine/manifest, NCX/nav TOC titles, cover image bytes, and chapter chunks, and verify parsing `assets/sample-book.epub` passes with `flutter test test/unit/epub_parser_adapter_test.dart`
- [x] 3.2 Implement OOM-safe `AudioCacheRepository` and `BookRepository` (`lib/infrastructure/storage/`) saving individual 24 kHz Mono `.wav` files on native filesystem (`getApplicationCacheDirectory()`) with SQLite/JSON metadata index, speed-independent keying, LRU size cap (200MB Mobile/Web, 500MB Desktop), and 7-day sliding TTL cleanup (with IndexedDB fallback on Web), and verify cache eviction and persistence pass with `flutter test test/unit/storage_repositories_test.dart`

## 4. Infrastructure: Conditional TTS Providers (`vieneu_tts` v0.1.1 On-Device & Direct HTTP SSE)

- [x] 4.1 Implement platform-isolated `OnDeviceVieNeuTTSClient` and `OfflineModelManagerService` (`lib/infrastructure/tts/on_device_tts_native.dart` & `on_device_tts_stub.dart`) using Dart conditional exports (`if (dart.library.io)`) wrapping `vieneu_tts` 0.1.1 `VieneuTts.downloadModel`, `VieneuTts.downloadDictionary`, `VieneuTts.init`, `VieneuTts.resolveVoiceId`, and `VieneuTts.stream` emitting native 24 kHz Mono PCM `s16le` with `TtsSynthesisOptions`, and verify unit tests pass with `flutter test test/unit/on_device_tts_test.dart`
- [x] 4.2 Implement direct `VieNeuStreamTTSClient` and `StandardOpenAITTSClient` (`lib/infrastructure/tts/`) without CORS proxy routes, supporting real-time SSE `speech.audio.delta` base64 24 kHz PCM decoding, HTTP 429 exponential backoff retries, and `TTSClientFactory` mode switching, and verify SSE stream parsing and 429 retry logic pass with `flutter test test/unit/remote_tts_client_test.dart`

## 5. Infrastructure: Multi-Platform Audio Stream Player & Media Session

- [x] 5.1 Implement `WebAudioStreamPlayerAdapter` (`lib/infrastructure/audio/web_audio_player_web.dart` via `dart:js_interop` / `package:web`) and `NativeAudioStreamPlayerAdapter` (`lib/infrastructure/audio/native_audio_player_io.dart` via `just_audio` + `audio_service` / `smtc_windows`) supporting 24 kHz Mono PCM/WAV chunk queueing, 250ms sentence / 500ms paragraph silence padding, instant playback speed scaling, chapter timeline boundary tracking, and OS media notifications, and verify player timeline and state machine tests pass with `flutter test test/unit/audio_stream_player_test.dart`

## 6. Presentation Layer (Flutter UI, Offline Model Modal & Shortcuts)

- [x] 6.1 Implement `Header`, `Sidebar`, `Reader`, and `AudioPlayerBar` widgets (`lib/presentation/widgets/`) with chapter selection, EPUB file upload (`file_picker`), sample book loading, active chunk highlighting, contextual chunk buttons (`Tạm dừng`, `Tiếp tục`, `Đang nạp sẵn...`), chapter scrubber bar with forward buffer badge (`Đệm trước: +Xs`), and speed/volume controls, and verify widget rendering passes with `flutter test test/widget/reader_and_player_widget_test.dart`
- [x] 6.2 Implement `SettingsModal`, `OfflineModelDownloadModal`, and `CacheModal` (`lib/presentation/widgets/`) supporting Dual-Mode switching (`Offline On-Device` vs `Remote Server API` on Windows/Mobile), 25 embedded voice selector with diacritic-tolerant matching, CPU thread configuration, real-time model + dictionary download progress bar (`model.gguf` + `sea_g2p.bin`), and desktop keyboard shortcuts (`Space`, `ArrowLeft/Right`, `ArrowUp/Down`, `M`, `[`, `]`) with focus isolation, and verify widget tests pass with `flutter test test/widget/settings_and_shortcuts_test.dart`

## 7. End-to-End Integration Verification & Multi-Platform Build Checks

- [x] 7.1 Implement `integration_test/app_e2e_test.dart` covering the complete end-to-end flow: downloading/verifying `model.gguf` and `sea_g2p.bin` with progress tracking, initializing `VieneuTts.init`, loading and chunking `assets/sample-book.epub`, streaming 24 kHz Mono PCM audio chunks via `VieneuTts.stream` (on-device) with `TtsSynthesisOptions` and local SSE stream (remote mode), playing audio through the player pipeline, and caching completed 24 kHz WAV chunks to filesystem with LRU tracking, and verify the E2E suite passes via `flutter test integration_test/app_e2e_test.dart -d windows`
- [x] 7.2 Verify multi-platform compilation and PWA configuration by running `flutter analyze`, `flutter test`, and `flutter build web`, confirming zero `dart:io` leakage on Web and valid PWA `web/manifest.json` generation
- [x] 7.3 Verify Web application functionality in Google Chrome by launching the Flutter Web build (`flutter run -d chrome` or `flutter test integration_test/app_e2e_test.dart -d chrome`), confirming EPUB book loading, Reader highlighting, Web Audio API streaming playback, and MediaSession controls without browser console errors
