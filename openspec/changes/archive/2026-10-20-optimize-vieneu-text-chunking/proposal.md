# Proposal: Optimize VieNeu-TTS Text Chunking Strategy and Audio Silence Padding

## Why

VieNeu-TTS (đặc biệt là phiên bản v3 Turbo) yêu cầu độ dài phân đoạn văn bản (chunk size) tối ưu trong khoảng 150–250 ký tự (chuẩn 200 ký tự) để duy trì nhịp điệu tự nhiên, tránh hiện tượng đọc dồn tăng tốc, hụt hơi hoặc lặp từ (hallucination) ở câu quá dài (> 350–400 ký tự vượt quá frame budget ~300 frames), đồng thời ngăn ngừa hiện tượng nói lắp (stutter) hoặc kéo dài âm vô nghĩa (babble) khi gặp câu quá ngắn (< 20 ký tự). Ngoài ra, khi ghép các đoạn âm thanh lại với nhau, việc thiếu khoảng lặng đệm (silence padding) giữa các câu và đoạn văn khiến nhịp đọc bị dính liền và thiếu tự nhiên.

## What Changes

- **Chuẩn hóa ngưỡng độ dài phân đoạn văn bản**:
  - Đặt độ dài tối ưu mặc định `maxChars` thành 200 ký tự (khoảng 150–250 ký tự, ~30–50 từ tiếng Việt hoặc 5–12 giây âm thanh).
  - Thiết lập ngưỡng trần an toàn cứng (hard maximum safety limit) không vượt quá 350–400 ký tự để không bao giờ vượt qua frame budget (~300 frames, ~24 giây) của mô hình.
  - Thiết lập ngưỡng sàn độ dài tối thiểu `text_chunk_min = 20` ký tự (~4–5 từ).
- **Chiến lược phân tách đoạn (Hierarchical Chunking Strategy)**:
  - Tuyệt đối không cắt cứng theo số ký tự (cắt thô kiểu `text.slice(0, 200)`).
  - Áp dụng thứ tự ưu tiên điểm cắt văn bản:
    1. Xuống dòng / ngắt đoạn (`\n`).
    2. Dấu kết thúc câu (`.`, `?`, `!`, `...`).
    3. Dấu ngắt mệnh đề (`,`, `;`, `:`, `—`) khi câu đơn vượt quá ngưỡng 250 ký tự.
    4. Khoảng trắng giữa các từ (chỉ sử dụng khi từ ngữ không có dấu phân tách).
- **Cơ chế gộp câu siêu ngắn (Short Sentence Merging)**:
  - Tự động nhận diện các câu cảm thán, câu cụt hoặc đối thoại ngắn dưới 20 ký tự (ví dụ: *"Thật sao?"*, *"Vâng."*, *"Đúng vậy!"*) và ghép nối chúng vào câu liền kề trước hoặc sau để đảm bảo mô hình có đủ ngữ cảnh phát âm.
- **Chèn khoảng lặng đệm tự nhiên (Silence Padding)**:
  - Khi lên lịch phát hoặc ghép nối audio giữa các chunks trong Web Audio pipeline, tự động chèn khoảng lặng đệm:
    - 250ms – 300ms giữa các câu / chunk liền kề.
    - 400ms – 600ms giữa các đoạn văn (paragraph breaks) hoặc phân tách ngữ cảnh lớn.
- **Cập nhật cài đặt mặc định UI & đồng bộ VieNeu v3 Turbo**:
  - Điều chỉnh giá trị mặc định `maxChars` trong `SettingsModal` và `VieNeuStreamTTSClient` từ 256/300 về 200 ký tự, hiển thị thông tin khuyến nghị chuẩn cho VieNeu v3 Turbo.

## Capabilities

### New Capabilities

*(Không có capability mới; tái sử dụng các capabilities hiện có của hệ thống)*

### Modified Capabilities

- `clean-architecture`: Cập nhật yêu cầu `Natural Sentence Chunking Service` với các ngưỡng độ dài mới (chuẩn 200 ký tự, min 20 ký tự với cơ chế gộp câu ngắn, max an toàn 350–400 ký tự) cùng thứ tự ưu tiên điểm cắt phân cấp.
- `audio-streaming`: Bổ sung yêu cầu về chèn khoảng lặng tự nhiên (`Silence Padding`) 250ms–300ms giữa các câu và 400ms–600ms giữa các đoạn văn khi lên lịch phát và ghép nối audio chunks.

## Impact

- **Mã nguồn bị ảnh hưởng**:
  - `src/infrastructure/chunker/SentenceBoundaryChunker.ts`: Triển khai lại logic chia câu, chia mệnh đề, lọc ngưỡng 20 ký tự và gộp câu ngắn.
  - `src/domain/ports/chunker.ts`: Mở rộng cấu hình tùy chọn chunker (minChars, maxChars, safeMaxChars, mergeShortSentences).
  - `src/infrastructure/audio/WebAudioStreamPlayer.ts`: Bổ sung logic delay/silence gap giữa các chunks dựa trên ngữ cảnh (câu vs đoạn).
  - `src/infrastructure/tts/VieNeuStreamTTSClient.ts`: Cập nhật `max_chars` mặc định về 200.
  - `src/presentation/components/SettingsModal.tsx`: Điều chỉnh UI slider/input maxChars khuyến nghị mốc 150–250 (chuẩn 200).
  - `src/app/page.tsx`: Cập nhật logic re-chunking mặc định khi tải sách.
- **Dependencies / API Compatibility**: Hoàn toàn tương thích ngược với API OpenAI và VieNeu v3 Turbo SSE streaming; tối ưu hóa hiệu năng và chất lượng giọng đọc tự nhiên.
