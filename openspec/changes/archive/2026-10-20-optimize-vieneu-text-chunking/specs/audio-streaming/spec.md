# Spec Delta: audio-streaming

## ADDED Requirements

### Requirement: Natural Silence Padding Between Audio Chunks
The system SHALL insert configurable silence padding when scheduling and concatenating audio chunks in the Web Audio stream player, applying 250ms–300ms pause between sentence-level chunks and 400ms–600ms pause between paragraph breaks.

#### Scenario: Inter-sentence silence padding
- **WHEN** subsequent sentence-level chunks within the same paragraph are scheduled for playback
- **THEN** the audio player schedules a 250ms–300ms silence gap between the end of the previous chunk and the start of the next chunk

#### Scenario: Paragraph boundary silence padding
- **WHEN** subsequent chunks cross a paragraph break
- **THEN** the audio player schedules a 400ms–600ms silence gap to provide a natural cadence break
