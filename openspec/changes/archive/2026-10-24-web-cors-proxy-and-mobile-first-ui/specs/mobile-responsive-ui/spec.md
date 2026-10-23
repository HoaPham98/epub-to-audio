# mobile-responsive-ui Specification

## Purpose

Provides a mobile-first responsive reader and audio playback interface, featuring a compact bottom Mini Player, an expandable full-screen player bottom sheet, an adaptive chapter navigation drawer, and touch-optimized responsive bottom sheets for Settings and Cache.

## ADDED Requirements

### Requirement: Mobile Mini Player Bar
The system SHALL render a compact Mini Player bar (~64px height) docked at the bottom of the viewport on mobile screens (< 768px width), displaying a thin top-edge progress line, truncated chapter and chunk information, and touch-friendly controls (rewind 10s, play/pause, fast-forward 10s, and speed chip) without vertical character wrapping.

#### Scenario: Rendering compact player on mobile viewports
- **WHEN** the application is displayed on a mobile viewport (< 768px width)
- **THEN** the system displays the compact Mini Player bar pinned above the bottom safe area
- **AND** formats chapter title and chunk indicator on a single horizontal line without character squishing

#### Scenario: Primary touch playback controls
- **WHEN** the user taps Rewind 10s, Play/Pause, Fast-Forward 10s, or the Speed chip on the Mini Player
- **THEN** the system executes the corresponding playback action immediately with active visual touch feedback

### Requirement: Expandable Full Player Bottom Sheet
The system SHALL present an expandable modal bottom sheet when the user taps the Mini Player info area, displaying an enlarged chapter title, high-resolution scrubber slider, chapter navigation controls (`|<`, `>|`), playback speed selector, volume slider, and auto-next toggle.

#### Scenario: Expanding full player sheet from mini player
- **WHEN** the user taps on the Mini Player bar body
- **THEN** the system slides up the Full Player modal bottom sheet with drag handle and backdrop dimming

#### Scenario: Controlling playback and scrubbing within full sheet
- **WHEN** the user drags the scrubber slider or taps chapter skip buttons inside the Full Player sheet
- **THEN** the system updates playback position or navigates chapters in sync with the audio player and reader

### Requirement: Mobile Navigation Drawer for Book Chapters
The system SHALL display an adaptive navigation drawer on mobile viewports when the user triggers the menu button (`☰`), presenting the book table of contents, reading progress, EPUB file picker, and sample book loader.

#### Scenario: Opening chapter drawer on mobile screen
- **WHEN** the user taps the menu button (`☰`) on a mobile screen (< 768px width)
- **THEN** the system opens a slide-over navigation drawer displaying all book chapters and active reading indicators

#### Scenario: Selecting chapter from mobile drawer
- **WHEN** the user taps a chapter item in the mobile drawer
- **THEN** the system loads the selected chapter, scrolls the reader to chunk 0, and closes the drawer

### Requirement: Touch-First Iconified Header and Responsive Modals
The system SHALL render header actions as compact touch icon buttons (`IconButton`) on mobile screens to preserve title space, and present Settings and Cache modals as scrollable bottom sheets (`showModalBottomSheet`) with drag handles on mobile viewports.

#### Scenario: Compact iconified header layout
- **WHEN** the application is displayed on a mobile screen (< 768px width)
- **THEN** the header renders icon-only buttons for menu, cache (with count badge), and settings, allocating maximum width for the book title

#### Scenario: Opening settings as a mobile bottom sheet
- **WHEN** the user taps the settings icon on a mobile screen
- **THEN** the system presents the settings interface inside a scrollable bottom sheet with rounded top corners and drag handle
