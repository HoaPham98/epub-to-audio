# Tasks

## 1. Core Lookahead Scheduler in WebAudioStreamPlayer

- [x] 1.1 Khai báo cấu trúc dữ liệu `pendingBufferQueue` cùng các hằng số `LOOKAHEAD_INTERVAL_MS = 25` và `LOOKAHEAD_WINDOW_SEC = 0.15` trong `src/infrastructure/audio/WebAudioStreamPlayer.ts`.
- [x] 1.2 Triển khai cơ chế `pumpLookaheadScheduler()` và vòng lặp timer lookahead để chỉ gọi `source.start()` cho các buffer trong cửa sổ 150ms tới.
- [x] 1.3 Cập nhật `queuePcmChunk` và `playCachedBlob` để đẩy buffer vào `pendingBufferQueue` và kích hoạt pump lookahead thay vì lên lịch cứng xa.

## 2. Dynamic Speed Adjustment & Boundary Synchronization

- [x] 2.1 Cập nhật `setSpeed(speed)` trong `WebAudioStreamPlayer.ts`: co giãn thời gian còn lại của node đang chạy, tính lại `nextStartTime` cho các buffer chờ, và cập nhật lại `chunkBoundaries` theo tốc độ mới.
- [x] 2.2 Cập nhật các phương thức vòng đời `pause()`, `stop()`, `clearQueue()`, và `seek()` để làm việc nhất quán với `pendingBufferQueue` và timer lookahead.

## 3. Unit Testing & Verification

- [x] 3.1 Bổ sung các unit test trong `tests/unit/WebAudioStreamPlayer.test.ts` kiểm thử Lookahead Scheduler, kiểm tra việc đổi tốc độ không sinh ra khoảng lặng thời gian 1x, và `onChunkChange` được kích hoạt đúng thời điểm.
- [x] 3.2 Chạy `pnpm test` và `npx tsc --noEmit` để đảm bảo 100% test case vượt qua và không có lỗi TypeScript.

