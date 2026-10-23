# Proposal

## Why

When running EPUB to Audio on Flutter Web, remote TTS servers (such as self-hosted VieNeu-TTS on Modal, RunPod, or VPS) are frequently blocked by browser Same-Origin Policy (SOP) unless a CORS proxy is employed. Additionally, visual inspection on mobile viewports reveals that the desktop-focused UI breaks on mobile screens: the audio player bar squishes chapter text into a vertical 1-character column, the hamburger menu fails to open a mobile chapter drawer, and fixed dialogs overflow small screens.

Introducing a configurable Web CORS Proxy (defaulting to Corsfix) and overhauling the UI to be Mobile-First with a bottom Mini-Player ensures smooth web audio streaming and a first-class mobile reading and listening experience.

## What Changes

- **Web CORS Proxy**:
  - Add `useCorsProxy: bool` (default `true` on Web when using Remote API, `false` on native desktop/mobile) and `corsProxyUrl: String` (default `'https://proxy.corsfix.com/?'`) to `TTSSettings`.
  - Expose CORS proxy toggle and custom proxy URL input in the Settings UI exclusively on Web.
  - Automatically prepend the CORS proxy prefix to remote TTS endpoints (`/audio/speech`, `/voices`, `/models`) when running on Web with CORS proxy enabled.
- **Mobile-First Responsive UI**:
  - **Mini Player**: Introduce a compact bottom player bar (~64px) for mobile viewports (< 768px) with top-edge progress bar, truncated chapter/chunk indicators, and prominent touch controls (Rewind 10s, Play/Pause, Fast-Forward 10s, Speed chip).
  - **Expandable Full Player Sheet**: Tapping the Mini Player opens a full-height Modal Bottom Sheet featuring full scrubber slider, chapter skips (`|<`, `>|`), Auto-Next toggle, and volume control.
  - **Mobile Chapter Drawer**: Update the hamburger menu (`☰`) to open a `Scaffold.drawer` or bottom sheet on mobile screens, enabling chapter selection, EPUB upload, and sample book loading.
  - **Header Iconification**: Replace bulky text buttons in the header with clean `IconButton` widgets (`Icons.menu`, `Icons.folder_outlined` with badge, `Icons.settings_outlined`) to preserve header title space on small screens.
  - **Responsive Modals**: Present Settings and Cache management as bottom sheets (`showModalBottomSheet`) on mobile viewports and centered dialogs on desktop.
- **Verification via Chrome Mobile**:
  - Verify all mobile layouts, drawer transitions, and mini-player interactions on an emulated 390x844 mobile viewport via Chrome DevTools MCP.

## Capabilities

### New Capabilities
- `mobile-responsive-ui`: Provides mobile-first adaptive UI layouts, bottom Mini-Player bar, expandable full-player bottom sheet, navigation drawer, and touch-optimized responsive bottom sheets for mobile viewports.

### Modified Capabilities
- `clean-architecture`: Adds Web CORS proxy URL resolution to the TTS Infrastructure client factory and remote streaming clients.
- `audio-streaming`: Specifies low-latency SSE stream delta ingestion through streaming-compatible CORS proxies on Web clients.

## Impact

- **Frontend Architecture**: `TTSSettings` entity, `SettingsModal`, `Header`, `AudioPlayerBar`, `HomeScreen`, `VieNeuStreamTTSClient`, `StandardOpenAITTSClient`.
- **Dependencies**: Pure Flutter & existing `http` package, no new external packages required.
- **Platforms**: Enhances Flutter Web usability and fixes mobile responsive layout across all mobile browsers and screens.
