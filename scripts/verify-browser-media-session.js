/**
 * verify-browser-media-session.js
 * 
 * Script kiểm tra E2E tự động tầng Browser cho Media Session & Silent Audio Loop Bridge.
 * Bạn có thể dán script này vào Chrome DevTools Console khi app đang chạy
 * hoặc chạy qua Playwright/Puppeteer.
 */

(function runMediaSessionVerification() {
  console.log('%c[E2E Verification] Bắt đầu kiểm tra Media Session & Audio Bridge...', 'color: #3b82f6; font-weight: bold; font-size: 14px;');

  const results = [];
  function assert(condition, message) {
    results.push({ passed: !!condition, message });
    if (condition) {
      console.log(`%c✓ PASS: ${message}`, 'color: #10b981;');
    } else {
      console.error(`%c✗ FAIL: ${message}`, 'color: #ef4444;');
    }
  }

  // 1. Kiểm tra API Navigator MediaSession
  assert('mediaSession' in navigator, 'Browser hỗ trợ navigator.mediaSession');

  // 2. Kiểm tra thẻ Audio Bridge
  const bridge = document.getElementById('background-audio-bridge');
  assert(bridge !== null, 'Thẻ <audio id="background-audio-bridge"> tồn tại trong DOM');

  if (bridge) {
    assert(bridge.src.includes('silence-10s.wav'), `Audio bridge có src trỏ tới file silence (${bridge.src})`);
    assert(bridge.loop === true, 'Audio bridge được cấu hình loop = true');
    assert(bridge.muted === false, 'Audio bridge không bị muted (để giữ thông báo OS)');
    console.log(`[Audio Bridge State] Paused: ${bridge.paused}, CurrentTime: ${bridge.currentTime.toFixed(2)}s`);
  }

  // 3. Kiểm tra MediaSession Metadata
  if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
    const meta = navigator.mediaSession.metadata;
    assert(!!meta.title, `Metadata Title tồn tại: "${meta.title}"`);
    assert(!!meta.artist, `Metadata Artist tồn tại: "${meta.artist}"`);
    assert(meta.artwork && meta.artwork.length > 0, `Metadata Artwork tồn tại (${meta.artwork?.length || 0} images)`);
  } else {
    console.warn('[Cảnh báo] Chưa có metadata. Hãy bấm chọn 1 đoạn sách để tải metadata.');
  }

  // 4. Kiểm tra PlaybackState
  if ('mediaSession' in navigator) {
    console.log(`[MediaSession PlaybackState]: "${navigator.mediaSession.playbackState}"`);
    assert(['playing', 'paused', 'none'].includes(navigator.mediaSession.playbackState), 'playbackState có giá trị hợp lệ');
  }

  // Tổng kết
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  console.log(`%c[Kết quả kiểm tra] Đạt: ${passed}/${total} tiêu chí.`, 'font-weight: bold; font-size: 13px;');
})();
