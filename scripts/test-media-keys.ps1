# test-media-keys.ps1
# Script tự động giả lập bấm phím Media cứng của Windows (SMTC)
# Dùng để kiểm tra E2E việc Chrome / Windows OS bắt trình phát và điều khiển pause/play/next/prev.

$Signature = @"
[DllImport("user32.dll", SetLastError=true)]
public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
"@
Add-Type -MemberDefinition $Signature -Name "Win32Key" -Namespace "MediaKeyAutomation"

$KEYEVENTF_EXTENDEDKEY = 0x0001
$KEYEVENTF_KEYUP       = 0x0002

$VK_MEDIA_PLAY_PAUSE   = 0xB3
$VK_MEDIA_NEXT_TRACK   = 0xB0
$VK_MEDIA_PREV_TRACK   = 0xB1

function Send-MediaKey([byte]$vk, [string]$name) {
    Write-Host "[Windows OS Media Key] Bấm phím: $name (0x$($vk.ToString('X2')))" -ForegroundColor Cyan
    # Press down
    [MediaKeyAutomation.Win32Key]::keybd_event($vk, 0, $KEYEVENTF_EXTENDEDKEY, 0)
    Start-Sleep -Milliseconds 60
    # Release key
    [MediaKeyAutomation.Win32Key]::keybd_event($vk, 0, $KEYEVENTF_EXTENDEDKEY -bor $KEYEVENTF_KEYUP, 0)
}

param (
    [string]$Action = "all"
)

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  KIỂM THỬ PHÍM TẮT HỆ ĐIỀU HÀNH (WINDOWS SMTC MEDIA KEYS)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Lưu ý: Đảm bảo bạn đã mở ứng dụng trên Chrome và đã bấm Play ít nhất 1 lần để tab giữ session." -ForegroundColor Yellow
Write-Host ""

switch ($Action.ToLower()) {
    "playpause" {
        Send-MediaKey $VK_MEDIA_PLAY_PAUSE "PLAY/PAUSE"
    }
    "next" {
        Send-MediaKey $VK_MEDIA_NEXT_TRACK "NEXT TRACK (Đoạn tiếp theo)"
    }
    "prev" {
        Send-MediaKey $VK_MEDIA_PREV_TRACK "PREVIOUS TRACK (Đoạn trước đó)"
    }
    "all" {
        Write-Host "1. Giả lập bấm phím Play/Pause..." -ForegroundColor White
        Send-MediaKey $VK_MEDIA_PLAY_PAUSE "PLAY/PAUSE"
        Start-Sleep -Seconds 3

        Write-Host "2. Giả lập bấm phím Play/Pause lần nữa để tiếp tục..." -ForegroundColor White
        Send-MediaKey $VK_MEDIA_PLAY_PAUSE "PLAY/PAUSE"
        Start-Sleep -Seconds 3

        Write-Host "3. Giả lập bấm phím Next Track để chuyển sang đoạn tiếp theo..." -ForegroundColor White
        Send-MediaKey $VK_MEDIA_NEXT_TRACK "NEXT TRACK"
        Start-Sleep -Seconds 3

        Write-Host "4. Giả lập bấm phím Previous Track để quay lại đoạn trước..." -ForegroundColor White
        Send-MediaKey $VK_MEDIA_PREV_TRACK "PREVIOUS TRACK"
        Start-Sleep -Seconds 1
    }
    default {
        Write-Host "Tùy chọn không hợp lệ. Sử dụng: -Action [playpause | next | prev | all]" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Hoàn tất kịch bản giả lập phím Windows Media!" -ForegroundColor Green
