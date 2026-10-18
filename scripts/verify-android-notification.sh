#!/usr/bin/env bash

# ==============================================================================
# verify-android-notification.sh
#
# Script kiểm tra tự động trạng thái MediaSession & Notification Shade trên Android qua ADB.
#
# Yêu cầu:
# 1. Điện thoại Android đã bật "USB Debugging" (hoặc Wireless Debugging).
# 2. Cắm cáp USB hoặc kết nối qua `adb connect <IP>:5555`.
# 3. Trình duyệt Chrome trên Android đang mở ứng dụng epub-to-audio.
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== KIỂM TRA TỰ ĐỘNG ANDROID MEDIA SESSION & NOTIFICATION ===${NC}\n"

# 1. Kiểm tra thiết bị ADB
echo -e "${YELLOW}[1/5] Kiểm tra kết nối thiết bị Android...${NC}"
DEVICE=$(adb devices | grep -v "List" | grep "device" | head -n 1 | awk '{print $1}')
if [ -z "$DEVICE" ]; then
  echo -e "${RED}[LỖI] Không tìm thấy thiết bị Android nào qua ADB!${NC}"
  echo "Vui lòng bật USB Debugging và cắm cáp kết nối."
  exit 1
fi
echo -e "${GREEN}✓ Đã kết nối với thiết bị: $DEVICE${NC}\n"

# 2. Mở thanh thông báo (Notification Shade)
echo -e "${YELLOW}[2/5] Mở thanh Notification Shade trên Android...${NC}"
adb -s "$DEVICE" shell cmd statusbar expand-notifications
sleep 1

# 3. Kiểm tra MediaSession của Chrome trước khi Pause
echo -e "${YELLOW}[3/5] Đọc trạng thái MediaSession hiện tại...${NC}"
CHROME_SESSION=$(adb -s "$DEVICE" shell dumpsys media_session | grep -A 8 "package=com.android.chrome" || true)

if [ -z "$CHROME_SESSION" ]; then
  echo -e "${RED}[CẢNH BÁO] Chưa tìm thấy MediaSession của Chrome.${NC}"
  echo "Vui lòng mở web trên điện thoại và bấm Play một đoạn sách trước."
  exit 1
fi

echo "$CHROME_SESSION"
echo -e "${GREEN}✓ MediaSession của Chrome đang hoạt động.${NC}\n"

# 4. Gửi sự kiện bấm phím PAUSE
echo -e "${YELLOW}[4/5] Giả lập bấm nút PAUSE từ thanh thông báo...${NC}"
adb -s "$DEVICE" shell input keyevent KEYCODE_MEDIA_PAUSE
sleep 2

# 5. Kiểm tra lại trạng thái MediaSession và Notification sau khi Pause
echo -e "${YELLOW}[5/5] Kiểm tra xem MediaSession có còn tồn tại không...${NC}"
AFTER_PAUSE=$(adb -s "$DEVICE" shell dumpsys media_session | grep -A 8 "package=com.android.chrome" || true)

if [ -z "$AFTER_PAUSE" ]; then
  echo -e "${RED}[THẤT BẠI] MediaSession của Chrome ĐÃ BỊ HỦY / COLLAPSE khi bấm Pause!${NC}"
  exit 1
fi

STATE_LINE=$(echo "$AFTER_PAUSE" | grep "state=" || true)
echo "Trạng thái sau Pause: $STATE_LINE"

if echo "$STATE_LINE" | grep -q "state=2"; then
  echo -e "\n${GREEN}======================================================${NC}"
  echo -e "${GREEN}✓ THÀNH CÔNG RỰC RỠ!${NC}"
  echo -e "${GREEN}MediaSession vẫn tồn tại ở trạng thái PAUSED (state=2).${NC}"
  echo -e "${GREEN}Notification shade trên Android KHÔNG BỊ COLLAPSE!${NC}"
  echo -e "${GREEN}======================================================${NC}"
else
  echo -e "\n${YELLOW}[CẢNH BÁO] MediaSession tồn tại nhưng state không phải 2 (PAUSED): $STATE_LINE${NC}"
fi
