# Design

## Context

See `proposal.md` for background and motivation. The Flutter multiplatform codebase currently routes all remote TTS requests directly to the endpoint URL. On Flutter Web, requests fail when remote endpoints lack CORS headers. Furthermore, the UI was designed desktop-first, causing broken text wrapping on mobile viewports and rendering the chapter sidebar inaccessible on mobile devices.

## Goals / Non-Goals

**Goals:**
- Provide a seamless Web-only CORS proxy integration defaulting to `https://proxy.corsfix.com/?`, with user-configurable toggle and custom proxy URL in Settings.
- Overhaul mobile layouts (< 768px):
  - Compact bottom Mini Player (~64-70px) with single-line chapter/chunk info and touch-friendly controls.
  - Expandable Full Player Modal Bottom Sheet with large scrubber, chapter navigation, and playback options.
  - Responsive chapter navigation drawer (`Scaffold.drawer`) activated by the hamburger button on mobile.
  - Compact iconified header buttons to maximize book title display space.
  - Responsive modals (`showModalBottomSheet` on mobile, `Dialog` on desktop).
- Automated visual and functional verification via Chrome DevTools MCP on emulated mobile viewports.

**Non-Goals:**
- Applying CORS proxy to native platforms (Windows, Android, iOS), where browser SOP does not apply.
- Replacing existing Clean Architecture layers or adding third-party state management libraries.

## Decisions

### Decision 1: Proxy URL Resolution Helper
- **Approach**: Introduce a pure function in Infrastructure/TTS:
  ```dart
  String resolveTTSUrl(String targetUrl, TTSSettings settings) {
    if (kIsWeb && settings.useCorsProxy && settings.corsProxyUrl.trim().isNotEmpty) {
      final prefix = settings.corsProxyUrl.trim();
      return prefix.endsWith('?') || prefix.endsWith('/') ? '$prefix$targetUrl' : '$prefix/$targetUrl';
    }
    return targetUrl;
  }
  ```
- **Rationale**: Isolates proxy prefixing logic, ensuring consistent URL formation across `/audio/speech`, `/voices`, and `/models`.
- **Alternatives Considered**: In-browser Service Worker proxy interception (more complex to maintain than direct client-side URL prefixing).

### Decision 2: Mobile Viewport Threshold and Mini Player Architecture
- **Approach**: Define `final isMobile = screenWidth < 768;` in `HomeScreen`.
  - When `isMobile`: Render `MiniPlayerBar` at the bottom of the screen.
  - The `MiniPlayerBar` features a thin `LinearProgressIndicator` on its top border, single-line text row with `Flexible(Text(..., overflow: TextOverflow.ellipsis))`, and touch-friendly buttons (`-10s`, `Play/Pause`, `+10s`, `SpeedChip`).
  - Tapping the `MiniPlayerBar` body invokes `showModalBottomSheet` rendering `FullPlayerSheet`.
- **Rationale**: Follows modern audiobook and podcast conventions (Spotify, Audible, Apple Podcasts) providing persistent controls while maximizing reading canvas space.

### Decision 3: Adaptive Navigation Drawer
- **Approach**: Attach `Sidebar` to `Scaffold.drawer` when on mobile:
  ```dart
  Scaffold(
    key: _scaffoldKey,
    drawer: isMobile ? Drawer(child: SafeArea(child: Sidebar(...))) : null,
    ...
  )
  ```
  Tapping `☰` opens the drawer via `_scaffoldKey.currentState?.openDrawer()`.
- **Rationale**: Reuses the tested `Sidebar` widget without duplicating chapter selection or EPUB loading code.

### Decision 4: Adaptive Dialog/BottomSheet Helper
- **Approach**: In `SettingsModal` and `CacheModal`, evaluate screen width: if `< 768`, display as `showModalBottomSheet(isScrollControlled: true, shape: RoundedRectangleBorder(...))`; otherwise display as standard centered `Dialog`.
- **Rationale**: Dramatically improves ergonomic touch usability and keyboard handling on mobile devices.

## Risks / Trade-offs

- **[Risk] Public CORS proxy rate limiting or latency**:
  - *Mitigation*: The default `https://proxy.corsfix.com/?` is free and reliable, but users can enter any custom proxy URL (e.g. self-hosted Cloudflare Worker or CORS Anywhere instance) in Settings.
- **[Risk] Mini Player overlapping system gesture pill or navigation bar on mobile**:
  - *Mitigation*: Wrap Mini Player inside `SafeArea(top: false, child: ...)`.
