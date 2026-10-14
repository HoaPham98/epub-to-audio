# clean-architecture Specification

## Purpose

Establishes a 4-layer Clean Architecture (Domain, Application, Infrastructure, Presentation) to decouple core business entities, use-case interactors, TTS/Audio infrastructure, and React presentation components.

## Requirements

### Requirement: Four-Layer Directory and Dependency Separation
The system SHALL organize frontend source code into four discrete layers (`domain`, `application`, `infrastructure`, `presentation`) adhering strictly to the Dependency Inversion Principle.

#### Scenario: Layer dependency hierarchy
- **WHEN** components or modules are imported across layers
- **THEN** dependencies only point inwards toward the Domain layer
- **AND** the Domain layer contains zero references to external frameworks, React hooks, or browser-specific APIs

### Requirement: Domain Interfaces for External Services
The Domain layer SHALL define abstract interfaces (Ports) for audio streaming, audio playback, cache storage, book persistence, and text chunking.

#### Scenario: Interface abstraction
- **WHEN** a use case requires TTS synthesis or audio playback
- **THEN** it communicates solely via `ITTSStreamingService` or `IAudioStreamPlayer` interfaces without binding to concrete implementations

### Requirement: TTS Client Factory and Provider Abstraction
The Infrastructure layer SHALL provide a TTS client factory that instantiates the appropriate adapter (`VieNeuStreamTTSClient` or `StandardOpenAITTSClient`) based on configuration settings.

#### Scenario: VieNeu endpoint configuration
- **WHEN** settings configure an endpoint compatible with VieNeu-TTS
- **THEN** the factory instantiates `VieNeuStreamTTSClient` configured for SSE and PCM streaming

#### Scenario: Fallback for standard OpenAI endpoints
- **WHEN** settings target an endpoint without SSE streaming support
- **THEN** the factory instantiates `StandardOpenAITTSClient` ensuring backward compatibility

### Requirement: Natural Sentence Chunking Service
The system SHALL provide a text chunking service in Infrastructure that splits text into units of 200–300 characters aligned with natural sentence boundaries and VieNeu's `max_chars` parameter.

#### Scenario: Chunking chapter text
- **WHEN** a book chapter's raw text is processed
- **THEN** chunks are generated targeting 200–300 characters at sentence boundaries without splitting words or clauses mid-sentence
