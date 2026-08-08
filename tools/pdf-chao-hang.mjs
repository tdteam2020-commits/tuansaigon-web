// LÀM PDF CHÀO HÀNG cho Tuấn: thông tin căn + ảnh đại diện + ảnh sổ + SĐT chủ.
//
// ⚠️ FILE PDF NÀY CHỨA SĐT CHỦ NHÀ VÀ ẢNH SỔ — tài liệu NỘI BỘ của Tuấn.
//    Tuyệt đối không đưa lên web/mạng xã hội (xem luật dữ liệu trong memory web-van-hanh).
//
// Chạy: node tools/pdf-chao-hang.mjs "Phú Nhuận" 20 80 20
//   (quận · giá từ · giá đến · số căn)  → xuất ra Desktop
import { homedir } from 'node:os';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9viY2mZl0o6gQjQ5w31Gowg/exec'.replace('9viY', '9piY');
const KEY = (() => {
  const f = homedir() + '/.config/claude-bds/gas.env';
  try { return (readFileSync(f, 'utf8').match(/GAS_KEY[^"]*"([^"]+)"/) || [])[1].trim(); }
  catch { console.error('Thiếu khoá ' + f); process.exit(1); }
})();
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const [quan = 'Phú Nhuận', gmin = '20', gmax = '80', slg = '20'] = process.argv.slice(2);
const SO_ANH_SO = 3;                       // tối đa 3 tấm sổ/căn cho PDF khỏi phình

const log = (...a) => console.log(...a);

// ---- 1. lấy dữ liệu ----
const u = `${GAS}?action=pdflist&key=${KEY}&quan=${encodeURIComponent(quan)}&min=${gmin}&max=${gmax}&n=${slg}`;
const d = await (await fetch(u)).json();
if (!d.ok) { console.error('GAS lỗi:', d.error); process.exit(1); }
log(`${quan} ${gmin}-${gmax} tỷ: tìm thấy ${d.tong_tim_thay} căn, lấy ${d.tra_ve}`);

// ---- 2. tải ảnh về nhúng thẳng vào file (R2 chống hotlink nên KHÔNG để Chrome tự tải) ----
async function nhung(url) {
  if (!url || !url.startsWith('http')) return '';
  try {
    const r = await fetch(url, { headers: { 'Referer': 'https://tuansaigon.com/' } });
    if (!r.ok) return '';
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length > 6e6) return '';                       // ảnh quá nặng thì bỏ
    const kieu = r.headers.get('content-type') || 'image/jpeg';
    return `data:${kieu};base64,${b.toString('base64')}`;
  } catch { return ''; }
}

// Nhiều căn CĐMG trong sổ chỉ còn ảnh Cloudinary (đã cắt 27/07 -> 401 chết). Nhưng WEB có bộ ảnh
// riêng trên R2: /tim-kiem.json cho tên file ảnh theo từng căn, slug kết thúc bằng mã căn.
// -> thiếu ảnh thì tra sang đây, PDF mới đủ hình.
let anhWeb = {};
try {
  const tk = await (await fetch('https://tuansaigon.com/tim-kiem.json')).json();
  for (const r of (tk.r || [])) {
    const ma = String(r[0] || '').split('-').pop();          // slug: ...-40354
    if (ma && r[2]) anhWeb[ma] = 'https://anh.tuansaigon.com/a/' + r[2];
  }
  log(`tra cứu ảnh từ web: ${Object.keys(anhWeb).length} căn`);
} catch { log('không tải được ảnh từ web (bỏ qua)'); }

let n = 0;
for (const c of d.can) {
  c._anh = await nhung(c.anh || anhWeb[c.ma] || '');
  if (!c._anh && anhWeb[c.ma] && c.anh) c._anh = await nhung(anhWeb[c.ma]);   // ảnh trong sổ hỏng -> thử ảnh web
  c._so = [];
  for (const s of (c.anh_so || []).slice(0, SO_ANH_SO)) { const x = await nhung(s); if (x) c._so.push(x); }
  log(`  ${++n}/${d.can.length} ${c.ma} — ảnh ${c._anh ? '✓' : '—'} · sổ ${c._so.length}`);
}

// ---- 3. dựng HTML ----
const esc = s => String(s ?? '').replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
const sdtDep = s => { const x = String(s || '').replace(/\D/g, ''); return x.length >= 9 ? x.replace(/(\d{4})(\d{3})(\d+)/, '$1 $2 $3') : (s || '—'); };
const homNay = new Date().toLocaleDateString('vi-VN');

const the = (c, i) => `
<section class="can">
  <div class="dau">
    <div class="stt">${i + 1}</div>
    <div>
      <h2>${esc(c.dia_chi)}</h2>
      <div class="ma">Mã ${esc(c.ma)}${c.vi_tri ? ' · ' + esc(c.vi_tri) : ''}</div>
    </div>
    <div class="gia">${esc(c.gia_ty)} tỷ</div>
  </div>
  <div class="than">
    <div class="anh">${c._anh ? `<img src="${c._anh}">` : '<div class="trong">chưa có ảnh</div>'}</div>
    <table class="ts">
      <tr><th>Diện tích</th><td>${esc(c.dien_tich) || '—'}</td></tr>
      <tr><th>Kích thước</th><td>${esc(c.kich_thuoc) || '—'}</td></tr>
      <tr><th>Số tầng</th><td>${esc(c.so_tang) || '—'}</td></tr>
      <tr><th>Vị trí</th><td>${esc(c.vi_tri) || '—'}</td></tr>
      <tr><th>Cập nhật</th><td>${esc(c.cap_nhat) || '—'}</td></tr>
      <tr class="lienhe"><th>Chủ nhà</th><td>${esc(c.ten_chu) || '—'}</td></tr>
      <tr class="lienhe"><th>Điện thoại</th><td class="sdt">${sdtDep(c.sdt)}</td></tr>
    </table>
  </div>
  ${c._so.length ? `<div class="so"><div class="nhan">Ảnh sổ (${c._so.length})</div><div class="soanh">${c._so.map(s => `<img src="${s}">`).join('')}</div></div>` : ''}
</section>`;

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(quan)} ${gmin}-${gmax} tỷ</title>
<style>
  @page { size: A4; margin: 12mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #241a17; margin: 0; font-size: 11px; }
  .bia { border-bottom: 3px solid #7b1e28; padding-bottom: 10px; margin-bottom: 14px; }
  .bia h1 { margin: 0 0 4px; font-size: 20px; color: #7b1e28; }
  .bia .phu { color: #6b5b56; font-size: 11px; }
  .canhbao { margin-top: 8px; background: #fdf3f4; border-left: 3px solid #7b1e28; padding: 6px 9px; color: #7b1e28; font-size: 10px; }
  .can { border: 1px solid #e0d6d2; border-radius: 6px; padding: 9px 11px; margin-bottom: 9px; page-break-inside: avoid; }
  .dau { display: flex; align-items: flex-start; gap: 9px; border-bottom: 1px solid #efe8e5; padding-bottom: 6px; margin-bottom: 7px; }
  .stt { background: #7b1e28; color: #fff; width: 21px; height: 21px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; flex: none; }
  .dau h2 { margin: 0; font-size: 13px; line-height: 1.25; }
  .ma { color: #8a7a75; font-size: 10px; margin-top: 2px; }
  .gia { margin-left: auto; font-weight: 700; font-size: 15px; color: #7b1e28; white-space: nowrap; }
  .than { display: flex; gap: 10px; }
  .anh { width: 200px; flex: none; }
  .anh img { width: 100%; height: 132px; object-fit: cover; border-radius: 4px; }
  .trong { width: 100%; height: 132px; background: #f4efed; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #a89b96; font-size: 10px; }
  .ts { flex: 1; border-collapse: collapse; }
  .ts th, .ts td { text-align: left; padding: 2.5px 5px; border-bottom: 1px solid #f2ecea; vertical-align: top; }
  .ts th { color: #8a7a75; font-weight: 500; width: 78px; }
  .lienhe td, .lienhe th { background: #fdf6ee; }
  .sdt { font-weight: 700; font-size: 12px; color: #7b1e28; letter-spacing: .3px; }
  .so { margin-top: 7px; border-top: 1px dashed #ded3cf; padding-top: 6px; }
  .nhan { font-size: 10px; color: #8a7a75; margin-bottom: 4px; }
  .soanh { display: flex; gap: 6px; }
  .soanh img { height: 112px; border: 1px solid #e0d6d2; border-radius: 3px; }
</style></head><body>
<div class="bia">
  <h1>Nhà ${esc(quan)} · ${gmin}–${gmax} tỷ</h1>
  <div class="phu">${d.can.length} căn chọn lọc · trong kho có ${d.tong_tim_thay} căn cùng phân khúc · lập ngày ${homNay} · Tuấn Sài Gòn 0777 088 622</div>
  <div class="canhbao"><b>Tài liệu nội bộ</b> — có số điện thoại chủ nhà và ảnh sổ. Không đăng lên mạng, không chuyển cho người ngoài.</div>
</div>
${d.can.map(the).join('')}
</body></html>`;

// ---- 4. xuất PDF ----
const tmp = mkdtempSync(path.join(tmpdir(), 'pdfch-'));
const fHtml = path.join(tmp, 'in.html');
writeFileSync(fHtml, html);
const ten = `Nha-${quan.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')}-${gmin}-${gmax}ty-${new Date().toISOString().slice(0, 10)}.pdf`;
const ra = path.join(homedir(), 'Desktop', ten);
execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-pdf-header-footer',
  `--print-to-pdf=${ra}`, 'file://' + fHtml], { stdio: 'ignore' });
rmSync(tmp, { recursive: true, force: true });
log(`\n✅ XONG → ${ra}`);
