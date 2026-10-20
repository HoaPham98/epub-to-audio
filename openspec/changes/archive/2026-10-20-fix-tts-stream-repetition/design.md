# Design: Fix TTS Streaming Chunk Repetition

## Context

Xem [proposal.md](file:///D:/projects/epub_to_audio/openspec/changes/fix-tts-stream-repetition/proposal.md) để biết lý do và phân tích nguyên nhân lỗi.

Hiện tại:
- `SentenceBoundaryChunker` trên frontend chia văn bản thành các chunk câu hoàn chỉnh từ 150–250 ký tự (chuẩn 200 ký tự).
- Tuy nhiên, `VieNeuStreamTTSClient` khi gọi `streamSpeech` lại truyền trường `max_chars: settings.maxChars || 200` vào request body gửi lên `/audio/speech`. Phía server, chuỗi âm vị IPA nở ra khoảng 1.3 - 1.5 lần độ dài text thô tiếng Việt. Khi nhận `max_chars: 200`, server bị ép cắt đôi chuỗi IPA ở ký tự thứ ~200 (ngay giữa câu/mệnh đề), dẫn đến mảnh cuối bị lặp từ (hallucination / overlap) trong quá trình stream.
- Mặt khác, trong `SentenceBoundaryChunker`, việc xử lý cô lập từng đoạn văn (`rawParagraphs = cleanText.split(/\n+/)`) khiến:
  1. Các đoạn phân cách chỉ chứa dấu chấm (`...`, `.`) hay ký tự trang trí (`* * *`, `---`) bị tạo thành các chunk độc lập, khiến TTS model phát ra tiếng xì hoặc lắp bắp vô nghĩa.
  2. Các đoạn thoại ngắn liên tiếp (ví dụ: *"- Cậu đến rồi à?", "- Ừ."*) không được gom lại, tạo ra các chunk siêu ngắn (4–15 ký tự) làm gián đoạn nhịp đọc.

## Goals / Non-Goals

**Goals:**
- Đảm bảo các chunk câu được `SentenceBoundaryChunker` phân đoạn (150–250 ký tự) được server TTS tổng hợp trọn vẹn trong một lượt, không bị cắt khúc hay gối đầu.
- Loại bỏ hoàn toàn lỗi lặp từ ("đến bệnh viện thăm... đến bệnh viện thăm") khi nghe sách qua stream SSE.
- Loại bỏ các chunk rác không chứa từ ngữ (chỉ có dấu `.`, `...`, `***`, v.v.).
- Tích lũy các câu thoại ngắn liên tiếp xuyên qua các dòng mới (`\n`) để đạt kích thước tối ưu 150–250 ký tự, giữ nguyên `\n` trong chunk text.
- Cập nhật `SettingsModal` để người dùng hiểu và quản lý tham số an toàn `max_chars` đúng mục đích.

**Non-Goals:**
- Thay đổi cấu trúc Server-Sent Events (SSE) hoặc Web Audio buffer player.
- Bỏ qua các dấu chấm lửng nằm bên trong câu văn có nghĩa (ví dụ: *"Cô ấy ngập ngừng... rồi bước đi."* vẫn được giữ nguyên).

## Decisions

### 1. Phân định ranh giới Chunking: Frontend là Single Source of Truth
- **Quyết định**: Trong `VieNeuStreamTTSClient.ts`, loại bỏ `max_chars: settings.maxChars || 200`. Chỉ gửi `max_chars` khi `settings.maxChars` được truyền vào và > 0 (với giá trị mặc định là 512 nếu cần, hoặc không gửi để server tự áp dụng ngưỡng 512).
- **Lý do**:
  - `SentenceBoundaryChunker` đã đảm bảo mỗi chunk gửi lên server là một đơn vị ngữ nghĩa hoàn chỉnh có độ dài an toàn <= 250 ký tự (trần cứng 350 ký tự).
  - Server `audio.cpp` và `openai_speech.py` đều có trần an toàn mặc định là 256–512 ký tự. Với ngưỡng 512, chuỗi âm vị IPA (thường <= 350 ký tự) sẽ không bao giờ bị server cắt đôi.

### 2. Cập nhật SettingsModal và TTSSettings Entity
- **Quyết định**:
  - Trong `SettingsModal.tsx`, slider `max_chars` được nâng dải chọn lên `min: 256, max: 512, default: 512`.
  - Cập nhật chú thích trong UI: *"Ngưỡng trần bảo vệ server (khuyến nghị 512). Frontend đã tự động phân đoạn câu ngữ nghĩa 150–250 ký tự; để giá trị cao giúp server không cắt đôi các chunk câu."*
  - Cập nhật type definition trong `src/domain/entities/tts.ts`: `maxChars?: number; // 256 - 512, default 512`.

### 3. Lọc bỏ các đoạn không chứa ký tự chữ/số (Non-speech Filter)
- **Quyết định**: Trong `SentenceBoundaryChunker.ts`, khi duyệt các đoạn văn hoặc đơn vị câu, kiểm tra xem đoạn đó có chứa ít nhất một ký tự chữ cái hoặc chữ số hay không bằng biểu thức chính quy:
  ```typescript
  const HAS_ALPHANUMERIC = /[a-zA-Z0-9à-ỹÀ-Ỹ]/;
  if (!HAS_ALPHANUMERIC.test(rawSentence)) continue;
  ```
- **Lý do**: Các dòng như `...`, `. . .`, `***`, `---` chỉ mang tính chất ngắt trang/ngắt cảnh thị giác. Loại bỏ chúng giúp loại trừ triệt để hiện tượng TTS model đọc ra tiếng xì hoặc lắp bắp vô nghĩa.

### 4. Thuật toán gom câu xuyên đoạn văn (Cross-Paragraph Accumulation)
- **Quyết định**:
  - Thay vì ngắt cứng chunk ở mỗi cuối đoạn văn (`\n`), bộ phân đoạn tích lũy các đơn vị câu hợp lệ vào một mảng toàn chương (`allAtomicUnits` kèm metadata về vị trí ngắt dòng `\n`).
  - Gom các đơn vị liên tiếp hướng tới ngưỡng tối ưu 150–250 ký tự.
  - Khi hai đơn vị thuộc hai đoạn văn khác nhau được gom chung vào một chunk, chúng được nối với nhau bằng ký tự `\n` thay vì dấu cách đơn thuần để giữ nguyên giao diện hiển thị thụt dòng của sách.
  - Đánh dấu `isParagraphEnd: true` nếu chunk kết thúc tại ranh giới của một đoạn văn gốc.

## Risks / Trade-offs

- **[Risk] Các đoạn ngắt cảnh bị loại bỏ làm mất nhịp nghỉ của câu chuyện**
  - *Mitigation*: Khi các câu trước và sau thuộc hai đoạn văn khác nhau được gom chung, ký tự xuống dòng `\n` và cơ chế silence padding giữa các chunk vẫn đảm bảo nhịp ngắt tự nhiên trong giọng đọc.
