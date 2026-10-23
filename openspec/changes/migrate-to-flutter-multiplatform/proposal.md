# Proposal

## Why

Ứng dụng đọc sách EPUB thành giọng nói (`epub_to_audio`) hiện là một webapp Next.js phụ thuộc hoàn toàn vào kết nối mạng tới máy chủ TTS từ xa. Việc chuyển đổi toàn bộ sang một codebase **Flutter đa nền tảng duy nhất (Windows, Web, Android, iOS)** kết hợp với thư viện native [`vieneu_tts`](https://github.com/HoaPham98/vieneu-tts-modal/tree/main/packages/vieneu_tts) cho phép chạy **TTS tiếng Việt 100% offline trên thiết bị (On-Device)** đối với Windows và Mobile, đồng thời giữ nguyên trải nghiệm đọc và stream TTS qua HTTP/SSE trực tiếp trên nền tảng Web mà không cần duy trì backend proxy.

## What Changes

- **BREAKING**: Thay thế hoàn toàn codebase Next.js/React/TypeScript hiện tại bằng một codebase **Flutter/Dart duy nhất** hỗ trợ các nền tảng **Windows, Web, Android và iOS**, tuân thủ kiến trúc Clean Architecture 4 tầng (`domain`, `application`, `infrastructure`, `presentation`).
- **BREAKING**: Loại bỏ các Next.js API CORS Proxy routes (`/api/tts-proxy`, `/api/voices-proxy`, `/api/models-proxy`) và cờ `useProxy`; bản Web kết nối trực tiếp tới TTS HTTP/SSE endpoint.
- Tích hợp package `vieneu_tts` (từ `https://github.com/HoaPham98/vieneu-tts-modal/tree/main/packages/vieneu_tts`) thông qua **Dart Conditional Imports** cho Windows và Mobile:
  - Hỗ trợ tải on-demand model `vieneu-v3-turbo-q8_0.gguf` (~188 MB) và từ điển phát âm `sea_g2p.bin` (~60 MB) kèm theo dõi tiến trình (`onProgress`).
  - Khởi tạo engine native in-process (`VieneuTts.init`) với 25 giọng đọc tiếng Việt nhúng sẵn (`VieneuTts.availableVoices`).
  - Thực hiện tổng hợp và stream âm thanh 48kHz stereo WAV/PCM trực tiếp trên thiết bị (`VieneuTts.stream` / `VieneuTts.synthesize`), kèm tùy chọn chuyển đổi sang Remote HTTP TTS Server khi cần.
- Giữ nguyên chức năng trên nền tảng **Flutter Web**: phân tích file EPUB (`.epub`), chia câu tiếng Việt tự nhiên (`SentenceBoundaryChunker` 150–250 ký tự), stream PCM qua SSE (`POST /v1/audio/speech`), sliding-window prefetch (800–1,200 ký tự), cache âm thanh & sách cục bộ, đồng bộ highlight câu đang đọc và điều khiển qua phím tắt / MediaSession.
- Xây dựng bộ **End-to-End Integration Tests (`integration_test`)** tự động kiểm thử toàn trình từ bước tải model + từ điển (`downloadModel`, `downloadDictionary`), khởi tạo engine (`VieneuTts.init`), tách câu EPUB đến streaming âm thanh thực tế (`VieneuTts.stream`) và phát qua Audio Player pipeline.
- Bổ sung bước kiểm thử và xác thực trực quan/tích hợp trên **Google Chrome (`-d chrome`)** cho nền tảng Web bên cạnh bộ E2E integration test trên Windows/Mobile.

## Capabilities

### New Capabilities
- `on-device-tts`: Tích hợp `vieneu_tts` cho Windows và Mobile để quản lý tải model GGUF + từ điển SEA-G2P, khởi tạo native engine, cung cấp 25 giọng đọc nhúng sẵn, tổng hợp/stream giọng nói offline trên thiết bị, và kiểm thử tích hợp end-to-end (integration test) từ lúc tải model đến khi streaming.

### Modified Capabilities
- `clean-architecture`: Chuyển đổi kiến trúc 4 tầng (`domain`, `application`, `infrastructure`, `presentation`) sang Dart/Flutter, sử dụng conditional imports để tách biệt adapter `vieneu_tts` (FFI/Native) trên Windows/Mobile với HTTP SSE adapter trên Web, và loại bỏ phụ thuộc vào proxy route.
- `audio-streaming`: Mở rộng pipeline phát âm thanh và streaming để hỗ trợ cả luồng byte WAV/PCM 48kHz từ `vieneu_tts` trên Windows/Mobile lẫn luồng SSE PCM 24kHz trực tiếp (không qua `/api/tts-proxy`) trên Web, đồng bộ với hệ thống thông báo âm thanh nền (OS Media Controls / `audio_service` / Web MediaSession).
- `desktop-playback-shortcuts`: Ánh xạ hệ thống phím tắt điều khiển phát âm thanh (`Space`, `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `M`, `[`, `]`) sang cơ chế quản lý focus và bàn phím của Flutter trên Windows và Web.
- `pwa-offline`: Chuyển đổi cơ chế lưu trữ sách EPUB, tiến độ đọc và cache âm thanh sang tầng lưu trữ đa nền tảng của Flutter (hoạt động offline trên cả Windows, Mobile và Flutter Web PWA).

## Impact

- **Codebase & Tech Stack**: Chuyển từ Next.js 16 / React 19 / TypeScript sang Flutter (Dart SDK `>=3.5.0 <4.0.0`, kích hoạt `native-assets` cho `vieneu_tts`).
- **Dependencies chính**:
  - `vieneu_tts` (git dependency trỏ tới `https://github.com/HoaPham98/vieneu-tts-modal.git`, path `packages/vieneu_tts`).
  - Giải nén & đọc EPUB: `archive`, `xml`, `html` (pure Dart, chạy mọi nền tảng Web/Windows/Mobile).
  - Phát âm thanh & Media Notification: `just_audio` / PCM stream source kết hợp `audio_service` / `audio_session` và Web Audio interop.
  - Lưu trữ đa nền tảng: `shared_preferences`, `path_provider`, `idb_shim` / file system cache.
  - Kiểm thử: `flutter_test` và `integration_test` cho luồng E2E từ tải model tới streaming.
