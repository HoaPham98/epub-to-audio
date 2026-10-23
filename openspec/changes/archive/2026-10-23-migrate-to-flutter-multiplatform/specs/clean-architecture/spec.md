# Spec Delta

## MODIFIED Requirements

### Requirement: Four-Layer Directory and Dependency Separation
The system SHALL organize application source code into four discrete layers (`domain`, `application`, `infrastructure`, `presentation`) under `lib/` in a single multi-platform Flutter codebase, adhering strictly to the Dependency Inversion Principle across Windows, Web, and Mobile targets.

#### Scenario: Layer dependency hierarchy
- **WHEN** modules or packages are imported across layers
- **THEN** dependencies only point inwards toward the Domain layer
- **AND** the Domain layer is written in pure Dart containing zero references to Flutter UI widgets, native FFI bindings (`dart:ffi` / `dart:io`), or browser-specific APIs (`dart:js_interop` / `package:web`)

### Requirement: TTS Client Factory and Provider Abstraction
The Infrastructure layer SHALL provide a platform-aware TTS client factory using Dart conditional imports that instantiates the appropriate adapter (`OnDeviceVieNeuTTSClient` on Windows/Mobile, or `VieNeuStreamTTSClient` / `StandardOpenAITTSClient` for remote HTTP endpoints) based on platform capabilities and configuration settings.

#### Scenario: Offline on-device configuration on Windows and Mobile
- **WHEN** the application runs on Windows, Android, or iOS with Offline On-Device mode enabled
- **THEN** the factory instantiates `OnDeviceVieNeuTTSClient` backed by `package:vieneu_tts`

#### Scenario: VieNeu endpoint configuration
- **WHEN** the application runs on Flutter Web or uses Remote Server mode targeting a VieNeu-TTS endpoint
- **THEN** the factory instantiates `VieNeuStreamTTSClient` configured for direct HTTP SSE and PCM streaming without a CORS proxy

#### Scenario: Fallback for standard OpenAI endpoints
- **WHEN** settings target a remote endpoint without SSE streaming support
- **THEN** the factory instantiates `StandardOpenAITTSClient` ensuring backward compatibility
