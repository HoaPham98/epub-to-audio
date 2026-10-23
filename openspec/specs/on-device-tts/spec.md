# on-device-tts Specification

## Purpose

Provides 100% offline, on-device Vietnamese Text-to-Speech synthesis and real-time audio streaming on Windows and Mobile platforms using `package:vieneu_tts` v0.1.1 (`audio.cpp` + `sea-g2p`), including on-demand model and dictionary downloading, engine lifecycle management, embedded voice selection, native 24 kHz Mono PCM streaming, custom sampling options, and end-to-end integration test verification.

## Requirements

### Requirement: On-Demand Model and Dictionary Download Management
The system SHALL manage downloading and verifying the VieNeu-TTS v3 Turbo GGUF model (`model.gguf`, ~188 MB) and SEA-G2P dictionary (`sea_g2p.bin`, ~60 MB) into the device application support directory on Windows and Mobile platforms, reporting real-time download progress to the user interface.

#### Scenario: Downloading missing model and dictionary on first use
- **WHEN** the user triggers offline TTS playback or opens the Offline Model Manager on Windows or Mobile and `model.gguf` or `sea_g2p.bin` is missing
- **THEN** the system downloads `model.gguf` and `sea_g2p.bin` into the application support directory
- **AND** emits download progress updates from `0.0` to `1.0` for UI display

#### Scenario: Skipping download when valid files already exist
- **WHEN** `model.gguf` (>= 180 MB) and `sea_g2p.bin` (>= 50 MB) already exist in the application support directory
- **THEN** the system skips network downloading, reports progress `1.0`, and proceeds directly to engine initialization

#### Scenario: Atomic partial file cleanup on interrupted download
- **WHEN** a network error interrupts downloading `model.gguf` or `sea_g2p.bin`
- **THEN** the system writes to a `.part` temporary file and does NOT corrupt the target file path
- **AND** displays a retry action in the UI

### Requirement: Native TTS Engine Initialization and Lifecycle
The system SHALL initialize the native `vieneu_tts` inference engine with the local `model.gguf` and `sea_g2p.bin` paths and configurable CPU thread count before synthesizing speech, and cleanly dispose of native resources on shutdown.

#### Scenario: Initializing engine with local model and dictionary
- **WHEN** valid paths for `model.gguf` and `sea_g2p.bin` are available
- **THEN** the system initializes the native TTS engine with the configured thread count (defaulting to 4 threads) and marks the engine as ready

#### Scenario: Guarding synthesis before engine initialization
- **WHEN** speech synthesis or streaming is requested before the native engine is initialized
- **THEN** the system automatically initializes the engine if model files exist or prompts model download if missing

### Requirement: Embedded Vietnamese Voice Preset Catalog and Diacritic Resolution
The system SHALL expose the 25 embedded Vietnamese voice presets provided by `vieneu_tts` for offline selection on Windows and Mobile without requiring network requests, resolving user voice names case-insensitively and diacritic-insensitively.

#### Scenario: Listing offline voices in Settings
- **WHEN** the user opens TTS Settings in Offline On-Device mode on Windows or Mobile
- **THEN** the system populates the voice selector with all 25 embedded voice presets (including `minh_quan_pro`, `ngoc_huyen`, `mai_anh`, `thuy_dung`, `quang_son`, and regional story/news voices)

#### Scenario: Resolving user-selected voice names
- **WHEN** a voice is specified by display name, uppercase, or ID (such as `Mai Anh`, `MAI ANH`, or `mai_anh`)
- **THEN** the system resolves the voice canonical ID `mai_anh` via `VieneuTts.resolveVoiceId` without falling back to default

### Requirement: On-Device Speech Streaming with Normalized 24kHz Mono PCM
The system SHALL synthesize and stream Vietnamese text chunks into normalized 24 kHz Mono 16-bit raw PCM (`s16le`) audio on Windows and Mobile using `vieneu_tts` v0.1.1, passing custom sampling options and feeding audio chunks directly into the playback and cache pipeline.

#### Scenario: Streaming a book text chunk offline in 24kHz Mono PCM
- **WHEN** playback is requested for a `TextChunk` in Offline On-Device mode on Windows or Mobile
- **THEN** the system invokes `VieneuTts.stream` with `TtsSynthesisOptions` configured for `sampleRate: 24000`, `channels: 1`, `responseFormat: AudioResponseFormat.pcm`, and active sampling parameters (`temperature`, `topK`, `topP`, `repetitionPenalty`, `maxChars`)
- **AND** dispatches raw 24 kHz Mono `AudioChunk` bytes to the audio player and local audio cache without network calls

#### Scenario: Dual-mode switching between Offline On-Device and Remote API
- **WHEN** the user switches the TTS mode on Windows or Mobile between Offline On-Device (`vieneu_tts`) and Remote Server API
- **THEN** the system routes subsequent synthesis requests to the selected provider without losing reading progress

### Requirement: End-to-End Integration Testing from Model Download to Audio Streaming
The system SHALL include an automated integration test suite (`integration_test`) that verifies the complete end-to-end flow on target native platforms: downloading/resolving the GGUF model and SEA-G2P dictionary, initializing `VieneuTts`, chunking Vietnamese EPUB text, streaming 24 kHz Mono PCM audio chunks via `VieneuTts.stream`, and feeding the audio player pipeline.

#### Scenario: Full end-to-end offline TTS pipeline verification
- **WHEN** the integration test suite runs on Windows or Mobile
- **THEN** it verifies `downloadModel` and `downloadDictionary` completion and file integrity
- **AND** initializes `VieneuTts.init` with the downloaded files
- **AND** streams a Vietnamese book chunk via `VieneuTts.stream`, asserting non-empty 24 kHz Mono PCM audio chunks and valid player state transitions from loading to playing
