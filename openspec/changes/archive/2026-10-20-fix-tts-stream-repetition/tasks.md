# Tasks

## 1. Domain & Infrastructure Updates

- [x] 1.1 Cập nhật `TTSSettings` trong `src/domain/entities/tts.ts` để ghi rõ giá trị mặc định cho `maxChars` là 512.
- [x] 1.2 Cập nhật `VieNeuStreamTTSClient.ts` trong `src/infrastructure/tts/VieNeuStreamTTSClient.ts`: loại bỏ việc ép giá trị mặc định `max_chars = 200`, chỉ truyền `max_chars` khi `settings.maxChars` được cấu hình rõ ràng (> 0).

## 2. Presentation Layer Updates

- [x] 2.1 Cập nhật `SettingsModal.tsx` trong `src/presentation/components/SettingsModal.tsx`: điều chỉnh dải chọn slider `max_chars` từ 256 đến 512 (mặc định 512) và cập nhật chú thích giải thích trong UI.

## 3. Verification & Validation (max_chars)

- [x] 3.1 Chạy type check (`pnpm typecheck` hoặc `tsc --noEmit`) và unit tests (`pnpm test`) để đảm bảo không có lỗi linter/type.
- [x] 3.2 Kiểm tra stream thử nghiệm câu văn mẫu trên endpoint Modal để đảm bảo thời lượng âm thanh đạt ~8.7s - 8.9s và không còn hiện tượng lặp từ.

## 4. Sentence Boundary Chunker Enhancements

- [x] 4.1 Cập nhật `SentenceBoundaryChunker.ts`: Thêm bộ lọc loại bỏ các đoạn văn bản chỉ chứa dấu chấm (`.`, `...`), chấm lửng, hoặc ký tự trang trí không chứa chữ cái hoặc số.
- [x] 4.2 Cập nhật `SentenceBoundaryChunker.ts`: Triển khai cơ chế gom câu thoại ngắn xuyên đoạn văn (cross-paragraph accumulation) hướng tới ngưỡng tối ưu 150–250 ký tự, nối bằng `\n` giữa các dòng.
- [x] 4.3 Cập nhật `tests/unit/SentenceBoundaryChunker.test.ts`: Bổ sung các unit test kiểm thử việc lọc bỏ đoạn chỉ có dấu `...` và gom các đoạn thoại ngắn liên tiếp.
- [x] 4.4 Chạy `vitest run` và type check để xác nhận toàn bộ unit test vượt qua.
