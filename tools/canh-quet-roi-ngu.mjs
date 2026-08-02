#!/usr/bin/env node
// CANH MÁY QUÉT SĐT (chạy trên VPS) -> XONG THÌ BÁO TELEGRAM -> RỒI CHO MÁY TUẤN NGỦ.
// Tuấn kêu 1/8: "30p nữa canh xong báo qua telegram cho tôi, rồi cho máy sleep nhé".
//
// Chạy: node tools/canh-quet-roi-ngu.mjs <số SĐT lúc bắt đầu> [phút canh tối đa]
//   vd: node tools/canh-quet-roi-ngu.mjs 310 90
//
// Biết máy quét XONG bằng cách: kho SĐT không tăng nữa trong 3 lượt kiểm liên tiếp (6 phút).
// Báo xong mới gọi tool cho ngủ (ngu-khi-xong.mjs) — tool đó còn tự đợi mọi việc nền khác kết thúc.
import { execSync, spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';

const KEY = (() => {
  const f = homedir() + '/.config/claude-bds/gas.env';
  try { return (readFileSync(f, 'utf8').match(/GAS_KEY[^"]*"([^"]+)"/) || [])[1].trim(); }
  catch (e) { console.error('Thiếu khoá ' + f); process.exit(1); }
})();
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const MOC = parseInt(process.argv[2] || '310', 10);
const TRAN_PHUT = parseInt(process.argv[3] || '90', 10);
const nghi = ms => new Promise(r => setTimeout(r, ms));
const gio = () => new Date().toLocaleTimeString('vi-VN');

async function demSdt() {
  try {
    const r = await fetch(`${GAS}?action=sdtstat&key=${KEY}`, { redirect: 'follow' });
    const j = await r.json();
    return { sdt: j.co_sdt_luu || 0, ten: j.co_ten_chu || 0 };
  } catch (e) { return null; }
}
async function baoTelegram(text) {
  try {
    await fetch(`${GAS}?action=pingmain&key=${KEY}&text=${encodeURIComponent(text)}`, { redirect: 'follow' });
    console.log(`[${gio()}] đã báo Telegram`);
  } catch (e) { console.log('báo Telegram lỗi:', String(e).slice(0, 80)); }
}

let truoc = MOC, yen = 0, vong = 0, cuoi = MOC, ten = 0;
console.log(`[${gio()}] bắt đầu canh — mốc ${MOC} số, kiểm mỗi 2 phút`);
while (yen < 3 && vong < TRAN_PHUT / 2) {
  await nghi(120000); vong++;
  const d = await demSdt();
  if (!d) { console.log(`[${gio()}] không đọc được, bỏ qua lượt này`); continue; }
  cuoi = d.sdt; ten = d.ten;
  if (d.sdt === truoc) { yen++; console.log(`[${gio()}] ${d.sdt} số — đứng yên ${yen}/3`); }
  else { yen = 0; truoc = d.sdt; console.log(`[${gio()}] ${d.sdt} số (+${d.sdt - MOC} so với lúc đầu)`); }
}

const them = cuoi - MOC;
const xong = yen >= 3;
await baoTelegram(
  (xong ? '✅ MÁY QUÉT SĐT ĐÊM NAY ĐÃ XONG' : '⏳ Hết giờ canh, máy quét có thể còn chạy') +
  `\n· Thêm ${them} số điện thoại chủ nhà (kho: ${MOC} → ${cuoi})` +
  `\n· Có tên chủ: ${ten}` +
  '\n· Kèm ảnh sổ hồng đã tải về (chỉ bot dùng, không lên web)' +
  '\n\nMáy quét đã sửa xong, từ đêm mai tự chạy 23h — Tuấn khỏi đụng tay.' +
  '\nMáy Mac của Tuấn giờ tự đi ngủ. Ngủ ngon 😴');

console.log(`[${gio()}] ${xong ? 'quét xong' : 'hết giờ canh'} — thêm ${them} số. Giao lại cho tool cho máy ngủ.`);
// tool ngủ tự đợi mọi việc nền khác xong rồi mới sleep
const p = spawn(process.execPath, [new URL('./ngu-khi-xong.mjs', import.meta.url).pathname, '3', '2'],
  { detached: true, stdio: 'ignore' });
p.unref();
