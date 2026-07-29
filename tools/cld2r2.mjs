// CHUYỂN ẢNH CLOUDINARY -> R2 trong sổ BDS_S06 (27/07: Cloudinary free doạ khoá 1/8).
// Mỗi căn: tải từng ảnh cloudinary -> up R2 (cột Anh -> a/, cột Anh_So -> so/) -> cldput ghi đè + ĐỐI CHIẾU.
// An toàn: ảnh nào tải fail thì GIỮ NGUYÊN URL cũ (không mất dữ liệu); căn nào ghi fail -> log, không chặn căn khác.
// Chạy: node tools/cld2r2.mjs [số căn mỗi lô=40] [tổng tối đa=9999]
import { putAnh, putSo } from './r2put.mjs';
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const KEY = (() => {   // 29/07: KHÔNG hardcode khoá (khoá cũ từng nằm CÔNG KHAI trong repo GitHub)
  const _f = homedir() + '/.config/claude-bds/gas.env';
  try { return (readFileSync(_f, 'utf8').match(/GAS_KEY[^"]*"([^"]+)"/) || [])[1].trim(); }
  catch (e) { console.error('Thieu khoa - tao ' + _f + ' voi dong: GAS_KEY="..."'); process.exit(1); }
})();
const LO = parseInt(process.argv[2] || '40', 10);
const MAX = parseInt(process.argv[3] || '9999', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('vi-VN');
const log = (...a) => console.log(`[${now()}]`, ...a);
async function rfetch(u, o, t = 3) { for (let i = 0; i < t; i++) { try { return await fetch(u, o); } catch (e) { if (i === t - 1) throw e; await sleep(1500 * (i + 1)); } } }

// tải 1 ảnh cloudinary -> up R2, trả URL mới (fail -> trả URL cũ để không mất dữ liệu)
const cache = new Map();
async function chuyen(u, loai) {
  if (!u.includes('res.cloudinary.com')) return u;      // đã R2 rồi
  if (cache.has(u)) return cache.get(u);
  try {
    const r = await rfetch(u, {}, 2);
    if (r.status !== 200) { log(`  ⚠️ tải fail ${r.status} — giữ URL cũ`); return u; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 500) return u;
    const moi = loai === 'so' ? await putSo(buf) : await putAnh(buf);
    cache.set(u, moi);
    return moi;
  } catch (e) { log(`  ⚠️ lỗi tải: ${String(e).slice(0, 60)} — giữ URL cũ`); return u; }
}

let canXong = 0, anhXong = 0, canFail = 0, vongRong = 0;
const t0 = Date.now();
for (let vong = 0; canXong < MAX; vong++) {
  const j = await (await rfetch(`${GAS}?action=cldscan&key=${KEY}&n=${LO}`)).json();
  if (!j.ok) { log('cldscan lỗi:', j.error); break; }
  if (!j.cans.length) { log('✅ HẾT — không còn căn nào dính cloudinary'); break; }
  if (vong === 0) log(`bắt đầu: ${j.tong} căn · ${j.tong_anh} ảnh cloudinary cần chuyển`);

  let doiTrongVong = 0;
  for (const c of j.cans) {
    if (canXong >= MAX) break;
    const anhCu = (c.anh || '').split(/\s+/).filter(Boolean);
    const soCu  = (c.so  || '').split(/\s+/).filter(Boolean);
    const anhMoi = [], soMoi = [];
    for (const u of anhCu) anhMoi.push(await chuyen(u, 'anh'));
    for (const u of soCu)  soMoi.push(await chuyen(u, 'so'));
    const doi = anhMoi.filter((v, i) => v !== anhCu[i]).length + soMoi.filter((v, i) => v !== soCu[i]).length;
    if (!doi) { log(`· ${c.ma}: 0 ảnh chuyển được (ảnh gốc đã mất trên cloudinary?) — bỏ qua`); canFail++; continue; }
    const q = new URLSearchParams({ action: 'cldput', key: KEY, ma: c.ma, row: String(c.row) });
    if (anhCu.length) q.set('anh', encodeURIComponent(anhMoi.join(' ')));
    if (soCu.length)  q.set('so',  encodeURIComponent(soMoi.join(' ')));
    try {
      const d = await (await rfetch(`${GAS}?${q}`)).json();
      if (d.ok) { canXong++; anhXong += doi; doiTrongVong++; if (canXong % 20 === 0) log(`✓ ${canXong} căn · ${anhXong} ảnh đã sang R2`); }
      else { canFail++; log(`⚠️ ghi fail ${c.ma}: ${JSON.stringify(d).slice(0, 90)}`); }
    } catch (e) { canFail++; log(`⚠️ ghi lỗi mạng ${c.ma}`); }
    await sleep(150);
  }
  if (!doiTrongVong) { vongRong++; if (vongRong >= 2) { log('⚠️ 2 vòng liền không chuyển được căn nào — DỪNG (xem log lỗi)'); break; } }
  else vongRong = 0;
}
log(`✅ XONG: ${canXong} căn · ${anhXong} ảnh sang R2 · ${canFail} căn lỗi/bỏ qua · ${((Date.now() - t0) / 60000).toFixed(1)} phút`);
