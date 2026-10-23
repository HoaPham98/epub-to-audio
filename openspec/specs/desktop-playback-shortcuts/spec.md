# desktop-playback-shortcuts Specification

## Purpose

Provides keyboard shortcut bindings and media key integration for hands-free audio playback control on desktop browsers.

## Requirements

### Requirement: Desktop Keyboard Playback Controls
The system SHALL bind keyboard shortcuts for toggling play/pause, relative timeline seeking, chapter navigation, and volume adjustments when an EPUB book is loaded.

#### Scenario: Spacebar toggles playback
- **WHEN** the user presses the Spacebar key and no form input or modal dialog has active focus
- **THEN** the system toggles playback between play and pause without scrolling the page container

#### Scenario: Arrow keys seek audio timeline
- **WHEN** the user presses ArrowLeft or ArrowRight while not focused on a text input or interactive range slider
- **THEN** the system seeks audio playback backward or forward by 10 seconds respectively

#### Scenario: Volume adjustment via arrow keys
- **WHEN** the user presses ArrowUp or ArrowDown while not focused on a form input
- **THEN** the system increments or decrements the audio player volume by 5% within the valid range of 0.0 to 1.0

#### Scenario: Mute shortcut toggle
- **WHEN** the user presses the 'M' or 'm' key while not focused on a form input
- **THEN** the system toggles mute state on the active audio player

#### Scenario: Chapter navigation shortcuts
- **WHEN** the user presses the '[' or ']' key while not focused on a form input
- **THEN** the system navigates to the previous or next chapter respectively

### Requirement: Focus Safety and Input Isolation
The system SHALL suppress audio playback keyboard shortcuts when the user is actively typing within Flutter text fields (`TextField`, `EditableText`), dropdown menus, or open modal dialogs across Windows and Web platforms.

#### Scenario: Typing inside settings or text inputs
- **WHEN** a `TextField`, `EditableText`, or modal dialog input has active focus
- **THEN** all keyboard events are passed directly to the focused widget and not intercepted by the audio player shortcuts
