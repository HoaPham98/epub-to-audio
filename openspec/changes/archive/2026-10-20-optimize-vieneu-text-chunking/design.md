# Design: VieNeu-TTS Text Chunking Strategy & Audio Silence Padding

## Context

VieNeu-TTS (đặc biệt là phiên bản v3 Turbo) là mô hình Text-to-Speech tiếng Việt ngoại tuyến chất lượng cao. Khác với các mô hình TTS thương mại như OpenAI TTS có thể tiếp nhận văn bản hàng ngàn ký tự trong một request, kiến trúc Transformer / Conformer và frame budget của VieNeu-TTS v3 Turbo hoạt động hiệu quả nhất ở cửa sổ 150–250 ký tự (chuẩn 200 ký tự, tương đương 30–50 từ hoặc 5–12 giây âm thanh).
- Khi đoạn văn vượt quá 350–400 ký tự (vượt giới hạn ~300 frames hay ~24 giây audio), mô hình dễ bị hụt hơi, đọc tăng tốc bất thường, lặp từ (hallucination) hoặc âm thanh bị cắt cụt.
- Khi đoạn văn quá ngắn (< 20 ký tự, như 1–2 âm tiết đứng lẻ), mô hình thiếu ngữ cảnh âm vị học dẫn đến lỗi lắp bắp (stutter) hoặc phát ra âm vô nghĩa (babble) ở đuôi câu.
- Khi phát các đoạn audio liên tiếp, việc lên lịch phát dính liền (0ms gap) làm mất nhịp ngắt nghỉ tự nhiên của tiếng Việt.

Xem thêm [proposal.md](file:///d:/projects/epub_to_audio/openspec/changes/optimize-vieneu-text-chunking/proposal.md) và các đặc tả tại [clean-architecture spec](file:///d:/projects/epub_to_audio/openspec/changes/optimize-vieneu-text-chunking/specs/clean-architecture/spec.md) cùng [audio-streaming spec](file:///d:/projects/epub_to_audio/openspec/changes/optimize-vieneu-text-chunking/specs/audio-streaming/spec.md).

## Goals / Non-Goals

**Goals:**
- Tái cấu trúc bộ phân đoạn `SentenceBoundaryChunker` theo mô hình phân cấp 4 tầng: Ngắt đoạn (`\n`) → Dấu kết câu (`.`, `?`, `!`, `...`) → Dấu ngắt mệnh đề (`,`, `;`, `:`, `—`) nếu câu > 250 ký tự → Khoảng trắng giữa các từ.
- Đặt ngưỡng tối ưu 150–250 ký tự (mặc định chuẩn: 200 ký tự), ngưỡng sàn tối thiểu 20 ký tự (gộp các câu ngắn vào câu liền trước/sau), ngưỡng trần an toàn cứng 350–400 ký tự.
- Gắn cờ metadata `isParagraphEnd?: boolean` trên mỗi `TextChunk` và `ChunkMeta` để đánh dấu ranh giới đoạn văn.
- Tích hợp cơ chế chèn khoảng lặng tự nhiên (`Silence Padding`) vào `WebAudioStreamPlayer`: 250ms–300ms giữa các câu trong cùng một đoạn, và 400ms–600ms giữa các đoạn văn.
- Cập nhật các cấu hình mặc định trong UI (`SettingsModal`) và TTS Client (`VieNeuStreamTTSClient`).

**Non-Goals:**
- Thay đổi kiến trúc phía server của VieNeu-TTS hoặc can thiệp vào mã nguồn gốc của model.
- Áp dụng các ngưỡng ép buộc này cho OpenAI TTS (OpenAI vẫn giữ cấu hình độc lập nếu không dùng VieNeu).
- Tạo ra mảng đệm PCM silence giả gây tốn bộ nhớ IndexedDB; thay vào đó sử dụng Web Audio API audio clock scheduling (`nextStartTime`).

## Decisions

### 1. Thuật toán phân đoạn phân cấp (Hierarchical Segmentation Pipeline)
- **Quyết định**: Thay vì chỉ dùng regex đơn giản gom câu, chia quy trình thành 3 bước:
  1. **Tách đoạn và đơn vị hạt nhân (Atomic Units)**: Tách theo `\n+` để giữ ranh giới đoạn. Trong mỗi đoạn, tách theo dấu câu kết thúc (`[.!?]+["']?`). Nếu một câu vượt quá 250 ký tự, tách tiếp theo dấu mệnh đề (`[,;:—]`). Chỉ khi một mệnh đề vẫn vượt quá trần an toàn mới chia theo từ.
  2. **Gộp câu siêu ngắn (< 20 ký tự)**: Trước khi gom chunk, duyệt qua các câu: nếu độ dài < 20 ký tự (như *"Vâng."*, *"Thật sao?"*, *"Được thôi!"*), gộp vào câu liền trước (nếu cùng đoạn) hoặc liền sau để đảm bảo ngữ cảnh ngữ âm học.
  3. **Gom thành chunks tối ưu**: Lần lượt cộng dồn các atomic units sao cho độ dài nằm trong khoảng 150–250 ký tự (mục tiêu chuẩn 200 ký tự). Mỗi chunk khi kết thúc đoạn văn sẽ được đánh dấu `isParagraphEnd = true`.
- **Giải pháp thay thế đã cân nhắc**: Cắt cứng theo số lượng ký tự (`text.slice(0, 200)`). Bị loại bỏ vì làm đứt rời từ và ngữ nghĩa câu.

### 2. Chèn khoảng lặng tự nhiên bằng Web Audio API timeline scheduling
- **Quyết định**: Trong `WebAudioStreamPlayer.scheduleBuffer`, khi bắt đầu phát một audio buffer của chunk mới ($chunk_i \to chunk_{i+1}$):
  - Kiểm tra xem chunk mới có phải là chunk tiếp theo không (khác chunkIndex).
  - Nếu chuyển từ chunk kết thúc đoạn (`isParagraphEnd = true`), cộng thêm khoảng lặng đoạn $T_{gap} = 0.5s$ (500ms) vào `this.nextStartTime`.
  - Nếu chuyển giữa các câu thông thường trong cùng đoạn, cộng thêm khoảng lặng câu $T_{gap} = 0.25s$ (250ms) vào `this.nextStartTime`.
  - Các SSE audio deltas bên trong cùng một chunk vẫn được nối liền liên tục ($T_{gap} = 0$) để không gây giật cục giữa các gói tin.
- **Giải pháp thay thế đã cân nhắc**: Tự chèn byte 0 (silence PCM) vào ArrayBuffer trước khi nạp vào AudioContext hoặc IndexedDB. Bị loại bỏ vì làm phình to dung lượng bộ nhớ đệm và tốn CPU tính toán mảng PCM.

### 3. Đồng bộ hóa Timeline và Reader Highlighting
- **Quyết định**: `chunkBoundaries` trong `WebAudioStreamPlayer` lưu trữ `{ startTime, endTime }` của từng chunk. Khoảng lặng đệm được tính vào khoảng thời gian chuyển tiếp giữa `endTime` của chunk trước và `startTime` của chunk sau.
- **Giải pháp thay thế đã cân nhắc**: Kéo dài `endTime` của chunk trước để bao gồm cả khoảng lặng. Bị loại bỏ vì reader highlighting sẽ bị sáng chunk cũ trong suốt thời gian im lặng thay vì chuyển mượt mà.

### 4. Cấu hình mặc định hệ thống
- **Quyết định**:
  - `DEFAULT_TARGET_CHARS = 200`
  - `MIN_CHUNK_CHARS = 20`
  - `OPTIMAL_MIN_CHARS = 150`
  - `OPTIMAL_MAX_CHARS = 250`
  - `SAFE_MAX_CHARS = 350`
  - `SettingsModal`: Slider maxChars mặc định hiển thị 200 với nhãn hướng dẫn chuẩn cho VieNeu v3 Turbo (150–250 ký tự).

## Risks / Trade-offs

- **[Risk] Sách đã lưu trong IndexedDB với cấu trúc chunk cũ**
  - *Mitigation*: Trong `page.tsx`, khi load sách từ IndexedDB, kiểm tra nếu sách có chunk dài > 350 ký tự hoặc thiếu cờ paragraph, tự động chạy lại `chunker.chunkText` với các tùy chọn mới và cập nhật IndexedDB.
- **[Risk] Câu siêu ngắn đứng đơn độc ở đầu hoặc cuối chương không thể gộp**
  - *Mitigation*: Nếu không có câu nào phía trước để gộp, gộp về phía sau. Nếu là câu duy nhất còn lại ở cuối chương, chấp nhận chunk ngắn thay vì làm mất nội dung người đọc.
- **[Risk] Tốc độ đọc (speed) làm thay đổi độ dài khoảng lặng**
  - *Mitigation*: Khoảng lặng $T_{gap}$ được điều chỉnh theo `this.playbackSpeed` ($T_{scaled} = T_{gap} / this.playbackSpeed$) để nhịp nghỉ co giãn tự nhiên theo tốc độ đọc của người dùng.
