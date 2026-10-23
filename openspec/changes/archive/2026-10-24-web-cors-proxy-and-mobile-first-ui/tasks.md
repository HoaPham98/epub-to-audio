# Tasks

## 1. Domain & Infrastructure: Web CORS Proxy Integration

- [x] 1.1 Add `useCorsProxy` and `corsProxyUrl` fields to `TTSSettings` domain entity with JSON serialization, copying, and defaults, verifying with `flutter test`
- [x] 1.2 Implement `resolveTTSUrl` utility in Infrastructure and update `VieNeuStreamTTSClient` and `StandardOpenAITTSClient` to route requests via the CORS proxy prefix on Web, verifying with unit tests

## 2. Presentation: Mobile-First Responsive UI & Mini Player

- [x] 2.1 Create compact `MiniPlayerBar` (~64px height) with top-edge progress indicator, single-line text row, and touch controls for mobile viewports (< 768px), preventing character squishing
- [x] 2.2 Create `FullPlayerSheet` modal bottom sheet opened by tapping the Mini Player bar, featuring full scrubber slider, chapter skip buttons, auto-next toggle, and speed selector
- [x] 2.3 Update `HomeScreen` with `Scaffold.drawer` for mobile chapter navigation on hamburger button (`☰`) tap, and compact icon-only buttons in `Header`
- [x] 2.4 Update `SettingsModal` with Web-only CORS proxy switch and proxy URL input, and wrap `SettingsModal` and `CacheModal` in responsive bottom sheet presentation on mobile

## 3. Verification & Chrome Mobile Inspection

- [x] 3.1 Run full test suite with `flutter test` verifying clean pass across all domain, application, and presentation tests
- [x] 3.2 Build web bundle with `flutter build web --release` and verify mobile UI layout on Chrome DevTools MCP with 390x844 mobile viewport, asserting zero overflow errors and clean visual layout
