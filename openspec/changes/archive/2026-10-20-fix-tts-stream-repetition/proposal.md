# Proposal: Fix TTS Streaming Chunk Repetition

## Why

Khi stream audio qua Server-Sent Events (SSE) với VieNeu-TTS (đặc biệt là các backend như audio.cpp GGUF C++ hoặc VieNeu API), xảy ra hai vấn đề ảnh hưởng nghiêm trọng đến trải nghiệm nghe:
1. **Lặp từ ở ranh giới chunk**: Một số câu văn bị lặp từ (ví dụ: *"đến bệnh viện thăm"* bị phát lặp lại 2 lần trước khi đọc tiếp *"Trương Nhất Ngang"*), trong khi gọi API thông thường không stream thì bình thường. Nguyên nhân do client gửi `max_chars: 200` khiến server áp đặt giới hạn 200 ký tự lên chuỗi âm vị IPA (dài 225 ký tự) và cắt đôi câu văn.
2. **Chunk bị xé quá vụn và xuất hiện chunk rác chỉ có dấu chấm (`.`, `...`)**: Do `SentenceBoundaryChunker` tách đoạn độc lập theo `\n+` và không lọc ký tự không lời, các dòng ngắt cảnh (`...`, `. . .`, `***`) biến thành các chunk độc lập khiến model TTS phát ra tiếng xì/lắp bắp, đồng thời các câu thoại ngắn liên tiếp bị tách thành các chunk 4–15 ký tự giật cục.

## What Changes

- **Bỏ gửi `max_chars` cứng (200) từ `VieNeuStreamTTSClient`**: Mặc định không gửi `max_chars` lên server (để server sử dụng ngưỡng trần an toàn mặc định 512). Chỉ gửi nếu người dùng cố ý cấu hình tùy chỉnh.
- **Cập nhật `SettingsModal`**: Điều chỉnh dải chọn slider `max_chars` từ 256 đến 512 (mặc định 512) với nhãn hướng dẫn rõ ràng.
- **Lọc bỏ các đoạn rác không lời trong `SentenceBoundaryChunker`**: Bỏ qua các đoạn không chứa ký tự chữ cái hoặc số (`!/[a-zA-Z0-9à-ỹÀ-Ỹ]/.test(text)`), loại bỏ hoàn toàn các chunk chỉ có mỗi dấu chấm hoặc ký tự trang trí.
- **Gom câu và đoạn thoại ngắn xuyên dòng (Cross-paragraph accumulation)**: Cho phép tích lũy các câu thoại ngắn liên tiếp qua các dòng mới cho đến khi đạt ngưỡng tối ưu 150–250 ký tự, giữ nguyên `\n` trong chunk để giao diện Reader hiển thị đúng cấu trúc đoạn văn.

## Capabilities

### Modified Capabilities
- `audio-streaming`: Cập nhật đặc tả yêu cầu cho streaming client để loại bỏ việc gửi giới hạn `max_chars` thấp gây phân mảnh chuỗi âm vị.
- `clean-architecture`: Cập nhật đặc tả `Natural Sentence Chunking Service` để lọc bỏ các đoạn văn bản chỉ chứa dấu câu/ký tự phân cách không có lời, và gom các câu thoại ngắn xuyên đoạn văn.

## Impact

- **Affected code**:
  - `src/infrastructure/tts/VieNeuStreamTTSClient.ts`: Điều chỉnh request payload gửi lên `/audio/speech`.
  - `src/presentation/components/SettingsModal.tsx`: Điều chỉnh UI slider và default values cho `maxChars`.
  - `src/domain/entities/tts.ts`: Cập nhật typing docstring của `TTSSettings.maxChars`.
  - `src/infrastructure/chunker/SentenceBoundaryChunker.ts`: Thêm bộ lọc ký tự không lời và thuật toán gom câu xuyên đoạn văn.
  - `tests/unit/SentenceBoundaryChunker.test.ts`: Bổ sung unit tests kiểm thử bộ lọc và gom câu thoại.
- **Breaking changes**: Không có. Tương thích ngược hoàn toàn với dữ liệu sách và API hiện tại.
