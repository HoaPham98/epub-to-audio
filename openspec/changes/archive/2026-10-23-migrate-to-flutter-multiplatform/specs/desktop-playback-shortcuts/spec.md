# Spec Delta

## MODIFIED Requirements

### Requirement: Focus Safety and Input Isolation
The system SHALL suppress audio playback keyboard shortcuts when the user is actively typing within Flutter text fields (`TextField`, `EditableText`), dropdown menus, or open modal dialogs across Windows and Web platforms.

#### Scenario: Typing inside settings or text inputs
- **WHEN** a `TextField`, `EditableText`, or modal dialog input has active focus
- **THEN** all keyboard events are passed directly to the focused widget and not intercepted by the audio player shortcuts
