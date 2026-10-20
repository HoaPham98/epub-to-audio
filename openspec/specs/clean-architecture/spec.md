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
The system SHALL provide a text chunking service in Infrastructure that segments Vietnamese text into units of 150–250 characters (default target: 200 characters) aligned with natural linguistic boundaries, enforcing a minimum chunk length of 20 characters and a hard safety ceiling of 350–400 characters to optimize VieNeu-TTS synthesis stability, while filtering out non-speech punctuation lines and accumulating short dialogue lines across paragraphs.

#### Scenario: Chunking chapter text
- **WHEN** a book chapter's raw text is processed
- **THEN** chunks are generated targeting 150–250 characters (default: 200 characters) at sentence boundaries without splitting words or clauses mid-sentence

#### Scenario: Hierarchical delimiter splitting for long sentences
- **WHEN** a single sentence exceeds 250 characters
- **THEN** the chunker splits along clause boundaries (commas `,`, semicolons `;`, colons `:`, or em dashes `—`) before resorting to whitespace word boundaries
- **AND** no chunk exceeds the safe maximum limit of 350–400 characters

#### Scenario: Merging ultra-short sentences
- **WHEN** a sentence or exclamation is shorter than 20 characters (such as "Vâng.", "Thật sao?")
- **THEN** the chunker merges it into the adjacent sentence to ensure sufficient phonetic context for VieNeu-TTS and prevent babbling or stuttering

#### Scenario: Filtering out non-speech punctuation lines
- **WHEN** a paragraph block contains only punctuation marks, ellipses, or decorative dividers without any alphanumeric characters (e.g. `...`, `.`, `* * *`, `---`)
- **THEN** the chunker skips the block and does NOT produce standalone non-speech chunks

#### Scenario: Cross-paragraph accumulation for short dialogue lines
- **WHEN** consecutive dialogue or narrative lines across paragraph breaks (`\n`) are shorter than the optimal target length (< 150 characters)
- **THEN** the chunker accumulates them into a single coherent chunk separated by newline whitespace until the optimal 150–250 character window is reached
- **AND** preserves newline characters in the chunk text to maintain visual book formatting
