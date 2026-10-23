# Spec Delta

## MODIFIED Requirements

### Requirement: TTS Client Factory and Provider Abstraction
The Infrastructure layer SHALL provide a platform-aware TTS client factory using Dart conditional imports that instantiates the appropriate adapter (`OnDeviceVieNeuTTSClient` on Windows/Mobile, or `VieNeuStreamTTSClient` / `StandardOpenAITTSClient` for remote HTTP endpoints) based on platform capabilities and configuration settings, supporting configurable Web CORS proxy routing.

#### Scenario: Offline on-device configuration on Windows and Mobile
- **WHEN** the application runs on Windows, Android, or iOS with Offline On-Device mode enabled
- **THEN** the factory instantiates `OnDeviceVieNeuTTSClient` backed by `package:vieneu_tts`

#### Scenario: VieNeu endpoint configuration
- **WHEN** the application runs on Flutter Web or uses Remote Server mode targeting a VieNeu-TTS endpoint
- **THEN** the factory instantiates `VieNeuStreamTTSClient` configured for direct HTTP or Web CORS-proxied SSE and PCM streaming based on CORS proxy settings (defaulting to `https://proxy.corsfix.com/?` on Web)

#### Scenario: Fallback for standard OpenAI endpoints
- **WHEN** settings target a remote endpoint without SSE streaming support
- **THEN** the factory instantiates `StandardOpenAITTSClient` ensuring backward compatibility
