// TỰ CHO MÁY NGỦ khi mọi việc nền của Claude Code đã xong (Tuấn hỏi 27/07).
// Theo dõi: tiến trình node/python/ffmpeg đang chạy tool trong các dự án + lệnh shell của Claude.
// Đủ YÊN LẶNG liên tiếp (mặc định 3 phút) -> pmset sleepnow. Có báo Telegram trước khi ngủ.
//
// Chạy nền:  node tools/ngu-khi-xong.mjs &        (mặc định: yên 3 phút thì ngủ, tối đa canh 6 tiếng)
//            node tools/ngu-khi-xong.mjs 5 8      (yên 5 phút mới ngủ · canh tối đa 8 tiếng)
// DỪNG:      pkill -f ngu-khi-xong
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';

const KEY = (() => {   // khoá GAS đọc từ file config (khoá cũ từng nằm CÔNG KHAI trong repo GitHub)
  const _f = homedir() + '/.config/claude-bds/gas.env';
  try { return (readFileSync(_f, 'utf8').match(/GAS_KEY[^"]*"([^"]+)"/) || [])[1].trim(); }
  catch (e) { console.error('Thieu khoa - tao ' + _f + ' voi dong: GAS_KEY="..."'); process.exit(1); }
})();

const YEN_PHUT = parseFloat(process.argv[2] || '3');
const TRAN_GIO = parseFloat(process.argv[3] || '6');
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('vi-VN');
const log = (...a) => console.log(`[${now()}]`, ...a);

// việc NỀN đang chạy? (bỏ qua chính mình + tiến trình hệ thống)
function viecDangChay() {
  try {
    const out = execSync(
      `ps -eo pid,command | grep -E "(node|python3|ffmpeg|clasp)" | grep -Ei "(My Projects|claude-bds|podcast-pipeline|tools/)" | grep -v "ngu-khi-xong" | grep -v grep || true`,
      { encoding: 'utf8' });
    return out.split('\n').map(s => s.trim()).filter(Boolean);
  } catch (e) { return []; }
}

// Tuấn có đang đụng máy không? (phím/chuột yên bao nhiêu phút)
function nguoiYenPhut() {
  try {
    const s = execSync(`ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF; exit}'`, { encoding: 'utf8' }).trim();
    return (parseInt(s, 10) || 0) / 1e9 / 60;   // nano giây -> phút
  } catch (e) { return 999; }
}

log(`canh việc nền · yên ${YEN_PHUT} phút + Tuấn không đụng máy thì cho ngủ · tối đa canh ${TRAN_GIO} tiếng · dừng: pkill -f ngu-khi-xong`);
const t0 = Date.now();
let yenTu = 0, daThayViec = false;
for (;;) {
  const viec = viecDangChay();
  if (viec.length) {
    if (yenTu) log(`có việc chạy lại (${viec.length}) — đếm lại từ đầu`);
    yenTu = 0; daThayViec = true;
    log(`đang chạy ${viec.length} việc: ${viec[0].slice(0, 90)}`);
  } else if (!daThayViec) {
    log('chưa từng thấy việc nào chạy — chưa ngủ (tránh ngủ oan lúc vừa bật)');
  } else {
    if (!yenTu) { yenTu = Date.now(); log('không còn việc nền — bắt đầu đếm giờ yên'); }
    const yen = (Date.now() - yenTu) / 60000, nguoiYen = nguoiYenPhut();
    if (nguoiYen < YEN_PHUT) { log(`việc xong nhưng Tuấn vừa đụng máy ${nguoiYen.toFixed(1)} phút trước — chưa ngủ`); }
    else if (yen >= YEN_PHUT) {
      log(`✅ yên ${yen.toFixed(1)} phút — CHO MÁY NGỦ`);
      try {
        await fetch(`${GAS}?action=notify&key=${KEY}&t=${encodeURIComponent('💤 Mọi việc nền đã xong — Claude cho máy ngủ lúc ' + now())}`);
      } catch (e) {}
      await sleep(3000);
      try { execSync('pmset sleepnow'); } catch (e) { log('pmset lỗi:', String(e).slice(0, 80)); }
      process.exit(0);
    }
    else log(`yên ${yen.toFixed(1)}/${YEN_PHUT} phút (Tuấn rời máy ${nguoiYen.toFixed(1)} phút)...`);
  }
  if ((Date.now() - t0) / 3600000 >= TRAN_GIO) { log(`hết ${TRAN_GIO} tiếng canh — thôi, không ngủ nữa`); process.exit(0); }
  await sleep(30000);
}
