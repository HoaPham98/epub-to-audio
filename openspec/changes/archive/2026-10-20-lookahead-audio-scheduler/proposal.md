# Proposal: Lookahead Audio Scheduler

## Why

Khi người dùng tăng tốc độ đọc (ví dụ lên 1.5x hoặc 2.0x) trong trình phát audio, âm thanh của chunk hiện tại phát nhanh hơn và kết thúc sớm (ví dụ 4.5s thay vì 9.0s). Tuy nhiên, do `WebAudioStreamPlayer` hiện tại lập lịch phát (schedule) toàn bộ các AudioBuffer trong tương lai theo mốc thời gian tuyệt đối cố định (`source.start(absoluteTime)`), mốc bắt đầu của chunk kế tiếp bị gán cứng theo thời gian của tốc độ 1x cũ. Hậu quả là người nghe gặp phải một khoảng lặng kéo dài (chờ đủ 9s như tốc độ 1x) thì chunk tiếp theo mới bắt đầu phát, đồng thời UI highlight cũng bị đứng yên không chuyển chunk.

Thay vì lập lịch trước (eager scheduling) vào Web Audio Context ở tương lai xa, hệ thống cần một bộ lập lịch nhìn trước (Lookahead / JIT Scheduler) để chỉ đưa buffer vào audio context ngay trước khi cần phát (~100–200ms). Khi người dùng đổi tốc độ, hàng đợi buffer trong bộ nhớ sẽ tự động cập nhật thời gian nối tiếp ngay lập tức, triệt tiêu hoàn toàn khoảng lặng và giúp chuyển chunk trơn tru ở mọi tốc độ đọc.

## What Changes

- Chuyển đổi cơ chế phát của `WebAudioStreamPlayer` từ **Eager Scheduling** (lập lịch cứng xa) sang **Lookahead Scheduler** (Just-In-Time Scheduling với cửa sổ nhìn trước ~100–200ms).
- Giữ các `AudioBuffer` đã giải mã trong hàng đợi bộ nhớ JS (`bufferQueue`) thay vì gọi `source.start()` ngay lập tức.
- Triển khai một timer lookahead định kỳ (mỗi ~25–50ms) để đẩy buffer từ hàng đợi vào Web Audio Context khi thời gian phát của nó nằm trong cửa sổ lookahead.
- Cập nhật hàm `setSpeed(speed)` để khi thay đổi tốc độ:
  - Cập nhật `playbackRate.value = speed` cho source node đang phát.
  - Tự động tính toán lại mốc `nextStartTime` cho các buffer trong hàng đợi chưa schedule, đảm bảo buffer kế tiếp phát gối đầu ngay khi buffer hiện tại dứt lời ở tốc độ mới.
  - Cập nhật lại `chunkBoundaries` để thời gian chuyển chunk trên UI (`onChunkChange`) và thanh scrubber phản ánh chính xác tốc độ mới.
- Đảm bảo tính năng dừng (`pause`), xóa hàng đợi (`clearQueue`, `stop`), và phát tiếp tục hoạt động mượt mà với hàng đợi Lookahead.

## Capabilities

### Modified Capabilities
- `audio-streaming`: Cập nhật yêu cầu về lập lịch đệm âm thanh (`Pre-Buffered Web Audio Playback`) và đồng bộ ranh giới thời gian (`Timeline-Based Reader Highlighting Synchronization`) để áp dụng cơ chế Lookahead Scheduler, hỗ trợ thay đổi tốc độ đọc động tức thì mà không tạo khoảng lặng hoặc chờ mốc thời gian 1x.

## Impact

- **Affected Code**:
  - `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Tái cấu trúc cơ chế lập lịch sang hàng đợi Lookahead Scheduler.
  - `tests/unit/WebAudioStreamPlayer.test.ts`: Bổ sung kiểm thử cho việc thay đổi tốc độ tức thì và kiểm tra không có khoảng lặng giữa các chunk.
- **Dependencies & APIs**: Không thêm thư viện ngoài; sử dụng chuẩn Web Audio API thuần (`AudioContext`, `AudioBufferSourceNode`, timers).
- **Audio Codec**: Giữ nguyên định dạng PCM cho streaming SSE; việc chuyển đổi sang Opus sẽ được xem xét ở giai đoạn tối ưu cache tiếp theo.
