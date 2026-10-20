# Spec Delta: clean-architecture

## MODIFIED Requirements

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
