# EPUB to Audio Reader (OpenAI TTS)

Một ứng dụng web Next.js hiện đại cho phép bạn tải lên sách điện tử EPUB, tùy chỉnh endpoint OpenAI TTS (`/v1/audio/speech`), duyệt mục lục (Table of Contents), nghe từng chương với cơ chế streaming ngầm và tính năng **Auto Next** tự động chuyển sang chương tiếp theo khi kết thúc.

Sẵn sàng triển khai 1-click lên **Vercel**.

---

## ✨ Tính năng nổi bật

- 📖 **Đọc và Phân tích EPUB ngay trên trình duyệt (Client-side):**
  - Tải lên tệp `.epub` và giải mã siêu tốc bằng `JSZip` & DOMParser.
  - Hỗ trợ cả chuẩn EPUB 2 (`toc.ncx`) và EPUB 3 (`nav.xhtml`).
  - Tự động trích xuất cấu trúc mục lục (ToC), ảnh bìa sách và thứ tự các chương.
  - Có sẵn nút thử nghiệm ngay với sách mẫu *"Hoàng Tử Bé"* không cần chuẩn bị file.

- 🎙️ **Tương thích hoàn toàn với OpenAI Speech API (`/v1/audio/speech`):**
  - Cấu hình tùy biến Base Endpoint URL: Dùng trực tiếp OpenAI chính thức hoặc các dịch vụ tương thích như Groq, OpenRouter, Local vLLM, Reverse Proxy...
  - Nhập API Key bảo mật (chỉ lưu trong `localStorage` của trình duyệt).
  - Chọn model (`tts-1`, `tts-1-hd` hoặc tên model bất kỳ).
  - Chọn giọng đọc chuẩn (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`) hoặc gõ tên giọng riêng.
  - Tích hợp công cụ **Kiểm tra kết nối** (Test Connection) để test nhanh endpoint và API key trước khi nghe sách.

- ✂️ **Chia nhỏ văn bản thông minh (Smart Chunking < 4000 ký tự):**
  - Tách nội dung theo dấu ngắt đoạn và ranh giới câu, đảm bảo luôn nhỏ hơn giới hạn 4096 ký tự của OpenAI TTS mà không bị cụt câu.
  - **Queue & Prefetch:** Bắt đầu phát ngay khi đoạn 1 sẵn sàng, đồng thời tự động gọi ngầm đoạn 2, 3... để trải nghiệm nghe liền mạch không bị khựng.

- ⚡ **Auto-Next (Tự động chuyển chương):**
  - Nút bật/tắt **Auto Next** nổi bật trên thanh điều khiển.
  - Khi hoàn thành đoạn cuối của chương hiện tại, trình phát sẽ tự động chuyển tiếp sang chương kế tiếp và tiếp tục phát.

- 💾 **Bộ nhớ đệm âm thanh IndexedDB ($0 chi phí khi nghe lại):**
  - Tự động lưu cache các đoạn audio blob vào IndexedDB trên máy của bạn.
  - Tua lại hoặc nghe lại bất kỳ lúc nào với độ trễ 0s và không tốn token gọi API lần hai.
  - Hỗ trợ xem dung lượng lưu trữ và xóa sạch cache khi cần.

- 🛡️ **Tích hợp Next.js Serverless CORS Proxy (`/api/tts-proxy`):**
  - Tránh lỗi CORS `TypeError: Failed to fetch` khi gọi đến các endpoint tự dựng (self-hosted) hoặc bên thứ 3 không cấu hình CORS cho trình duyệt.

---

## 🚀 Hướng dẫn Chạy Thử trên Máy Cục bộ (Local)

Dự án sử dụng **pnpm** (phiên bản 12):

1. **Cài đặt các gói phụ thuộc:**
   ```bash
   pnpm install
   ```

2. **Khởi chạy máy chủ phát triển:**
   ```bash
   pnpm dev
   ```

3. Mở trình duyệt và truy cập `http://localhost:3000`.

---

## 🌐 Hướng dẫn Triển khai lên Vercel (Zero-Config)

### Cách 1: Qua giao diện Vercel Dashboard
1. Đẩy mã nguồn dự án lên GitHub / GitLab / Bitbucket của bạn:
   ```bash
   git add .
   git commit -m "feat: EPUB to Audio reader with OpenAI TTS & Auto Next"
   git push origin main
   ```
2. Truy cập [vercel.com](https://vercel.com) và chọn **"Add New Project"**.
3. Chọn kho lưu trữ vừa tải lên. Vercel sẽ tự động nhận diện **Next.js**.
4. Nhấn **Deploy**. Quá trình build sẽ hoàn tất chỉ trong ~1 phút!

### Cách 2: Sử dụng Vercel CLI
```bash
npm i -g vercel
vercel
```

---

## 🛠️ Công nghệ Sử dụng

- **Framework:** Next.js (App Router, Turbopack)
- **Ngôn ngữ:** TypeScript
- **Styling:** Tailwind CSS v4
- **Biểu tượng:** Lucide React
- **EPUB Engine:** JSZip
- **Lưu trữ cục bộ:** `idb` (IndexedDB Wrapper) & `localStorage`
