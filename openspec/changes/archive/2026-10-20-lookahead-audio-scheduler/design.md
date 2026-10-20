# Design: Lookahead Audio Scheduler

## Context

Xem [proposal.md](file:///D:/projects/epub_to_audio/openspec/changes/lookahead-audio-scheduler/proposal.md) để biết nguyên nhân và phân tích lỗi.

Hiện tại trong `WebAudioStreamPlayer.ts`:
- Khi nhận được PCM chunks từ stream SSE hoặc cache IndexedDB, player lập tức giải mã thành `AudioBuffer` và gọi `source.start(scheduledStart)` ngay cho tất cả các buffer (kể cả buffer cách xa 5–15 giây trong tương lai).
- Điểm yếu cốt tử của Web Audio API là hàm `AudioBufferSourceNode.start(when)` khi đã gọi thì mốc `when` (tính theo `AudioContext.currentTime`) là bất biến.
- Khi người dùng nâng tốc độ (ví dụ lên 2.0x), hàm `setSpeed` chỉ gán `node.playbackRate.value = 2.0`. Node đang phát kết thúc sau một nửa thời gian (ví dụ 4.5s thay vì 9.0s), nhưng node của chunk tiếp theo vẫn được lập lịch cứng ở giây thứ 9.0s! Do đó người dùng nghe hết lời ở giây 4.5 nhưng phải chờ thêm 4.5 giây im lặng (đúng thời gian 1x) thì chunk tiếp theo mới phát.

## Goals / Non-Goals

**Goals:**
- Triển khai cơ chế Lookahead Scheduler (Just-In-Time Scheduling) cho `WebAudioStreamPlayer`: chỉ lập lịch `source.start()` vào Web Audio Context trong một cửa sổ nhìn trước ngắn (~150ms).
- Khi người dùng thay đổi tốc độ đọc (`setSpeed`), toàn bộ các buffer trong hàng đợi chưa phát sẽ được tính toán mốc thời gian phát tiếp theo theo tốc độ mới, chuyển chunk ngay khi dứt lời mà không có bất kỳ khoảng lặng nào.
- Đồng bộ lại `chunkBoundaries` khi thay đổi tốc độ để sự kiện `onChunkChange` và thanh scrubber phản ánh chính xác tiến độ theo tốc độ mới.
- Đảm bảo tính năng dừng (`pause`), tiếp tục (`play`), tua (`seek`), và khoảng lặng tự nhiên (`silenceDuration`) hoạt động chuẩn xác với cơ chế mới.

**Non-Goals:**
- Chuyển đổi định dạng audio sang Opus (giữ nguyên PCM cho streaming SSE; Opus sẽ được xem xét sau).
- Song song hóa nhiều luồng tải TTS từ server (giữ nguyên cơ chế tuần tự hiện tại).

## Decisions

### 1. Kiến trúc Lookahead Scheduler (JIT Scheduling)
- **Quyết định**: 
  - Tạo hàng đợi bộ nhớ `pendingBufferQueue: Array<{ buffer: AudioBuffer; meta?: ChunkMeta; silenceBefore: number }>` lưu trữ các buffer đã giải mã nhưng chưa được đưa vào `AudioContext`.
  - Bộ lập lịch chạy bằng timer định kỳ `LOOKAHEAD_INTERVAL_MS = 25` (25ms).
  - Cửa sổ nhìn trước: `LOOKAHEAD_WINDOW_SEC = 0.15` (150ms).
  - Tại mỗi nhịp timer (hoặc khi có buffer mới vào queue):
    Trong khi `this.nextStartTime < this.audioContext.currentTime + LOOKAHEAD_WINDOW_SEC` và `pendingBufferQueue.length > 0`:
    1. Lấy buffer tiếp theo từ `pendingBufferQueue`.
    2. Tạo `source = this.audioContext.createBufferSource()`.
    3. Gán `source.playbackRate.value = this.playbackSpeed`.
    4. Thêm khoảng lặng `silenceBefore / this.playbackSpeed` nếu chuyển chunk/đoạn văn.
    5. Gọi `source.start(this.nextStartTime)`.
    6. Cập nhật `durationScaled = buffer.duration / this.playbackSpeed` và `this.nextStartTime += durationScaled`.
    7. Lưu ranh giới chunk vào `chunkBoundaries`.
- **Lý do**:
  - Web Audio Context chỉ giữ những node sẽ phát trong vòng 150ms tới. 
  - 150ms đủ dài để chống giật âm thanh (jank) nếu luồng JS bận, nhưng đủ ngắn để tai người hoàn toàn không cảm nhận được độ trễ khi chuyển đổi tốc độ.

### 2. Xử lý thay đổi tốc độ tức thì (`setSpeed`)
- **Quyết định**:
  Khi `setSpeed(newSpeed)` được gọi:
  1. Cập nhật `this.playbackSpeed = newSpeed`.
  2. Với các node đang phát dở (trong activeSourceNodes): gán `node.playbackRate.value = newSpeed`.
  3. Tính lại `this.nextStartTime`:
     Nếu có node đang phát dở tại thời điểm `now`:
     Thời lượng còn lại của node được co giãn: `const remainingTime = (nodeEndTime - now) * (oldSpeed / newSpeed)`.
     `this.nextStartTime = now + remainingTime`.
  4. Các buffer trong `pendingBufferQueue` chưa bị lập lịch cứng, nên nhịp timer tiếp theo sẽ tự động lập lịch chúng nối tiếp ngay sau `this.nextStartTime` mới!
  5. Cập nhật lại các mốc thời gian trong `chunkBoundaries` để phản ánh đúng thời điểm kết thúc theo `newSpeed`.
- **So sánh lựa chọn khác**:
  - *Dừng toàn bộ node và lập lịch lại (Stop & Reschedule)*: Rất dễ gây tiếng nổ (click/pop) hoặc gián đoạn node đang phát dở.
  - *Lookahead JIT*: Êm ái, mượt mà, không cắt ngang node đang phát, và các node tương lai tự động gối đầu hoàn hảo.

## Risks / Trade-offs

- **[Risk] Giật lag luồng giao diện chính (Main thread jank) khiến timer 25ms bị trễ**:
  - *Mitigation*: Cửa sổ lookahead 150ms với chu kỳ timer 25ms cung cấp biên độ an toàn gấp 6 lần. Kể cả khi main thread bị block 100ms, hàng đợi phần cứng của Web Audio vẫn có đủ dữ liệu để phát liên tục không bị ngắt.
