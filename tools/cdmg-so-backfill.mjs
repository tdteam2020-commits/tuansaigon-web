// VÉT ẢNH SỔ cho căn ĐÃ CÓ SĐT mà chưa có sổ (Tuấn kêu 25/07).
// ⚠️ MỖI CĂN = 1 lượt quickview (chung cap 200/ngày với quét SĐT — chạy cái này là bớt quota lấy số mới).
// Luồng: sdtqueue&mode=so -> quickview -> bóc hinh_so -> tải local -> cloudinary -> GAS cdmgputso (CÓ ĐỐI CHIẾU sau ghi).
// Chạy: node tools/cdmg-so-backfill.mjs [cap]
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const KEY = (() => {   // 29/07: KHÔNG hardcode khoá (khoá cũ từng nằm CÔNG KHAI trong repo GitHub)
  const _f = homedir() + '/.config/claude-bds/gas.env';
  try { return (readFileSync(_f, 'utf8').match(/GAS_KEY[^"]*"([^"]+)"/) || [])[1].trim(); }
  catch (e) { console.error('Thieu khoa - tao ' + _f + ' voi dong: GAS_KEY="..."'); process.exit(1); }
})();
const BASE = 'https://congdongmoigioi.pro';
const CAP = parseInt(process.argv[2] || '100', 10);
import { putSo } from './r2put.mjs';   // kho ảnh R2 (thay Cloudinary 27/07)
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('vi-VN');
const log = (...a) => console.log(`[${now()}]`, ...a);
async function rfetch(u, o, t = 3) { for (let i = 0; i < t; i++) { try { return await fetch(u, o); } catch (e) { if (i === t - 1) throw e; await sleep(1500 * (i + 1)); } } }

const cfg = await (await rfetch(`${GAS}?action=sdtqueue&key=${KEY}&since=2025&mode=so`)).json();
if (!cfg.ok) { log('sdtqueue lỗi:', cfg.error); process.exit(1); }
log(`hàng đợi VÉT SỔ: ${cfg.tong_cho} căn có SĐT nhưng chưa có ảnh sổ · phiên này tối đa ${CAP}`);

const H = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36',
  'Accept-Language': 'vi-VN,vi;q=0.9', 'X-Requested-With': 'XMLHttpRequest',
  'Origin': BASE, 'Referer': `${BASE}/NhaPho`, 'Cookie': cfg.cookie,
  'Content-Type': 'application/x-www-form-urlencoded' };
const jsonMsg = t => { try { const o = JSON.parse(t); return o && o.message ? o.message : t; } catch (e) { return t; } };
const hetLuot = t => /200 th[ôo]ng tin|error_code"?\s*:?\s*504|xem 200|gi[ớo]i h[ạa]n.*200/i.test(t || '');
function soPaths(qv) {
  const out = [];
  const re = /href="https?:\/\/[^"]*?(\/NhaPho\/image\/[^"'?]+\.(?:jpg|jpeg|png))[^"]*"\s+data-fancybox="(hinh_so|hinh_so_mobile)"/gi;
  let m; while ((m = re.exec(qv)) !== null) if (!out.includes(m[1])) out.push(m[1]);
  return out.slice(0, 4);
}

let done = 0, soOk = 0, khongSo = 0, soFailLT = 0;
const t0 = Date.now();
for (const c of cfg.cans) {
  if (done >= CAP) { log(`đủ cap ${CAP} — dừng`); break; }
  let qv;
  try { qv = jsonMsg(await (await rfetch(`${BASE}/NhaPho/quickview/${c.uuid}`, { method: 'POST', headers: H, body: 'token=' + cfg.jwt })).text()); }
  catch (e) { done++; continue; }
  if (hetLuot(qv)) { log('🛑 SITE BÁO HẾT LƯỢT (200/ngày) — dừng, để mai chạy tiếp'); break; }
  done++;
  const paths = soPaths(qv);
  if (!paths.length) { khongSo++; await sleep(1800); continue; }   // căn không đăng ảnh sổ
  const urls = [];
  for (const p of paths) {
    try {
      const rr = await rfetch(BASE + p, { headers: { Referer: `${BASE}/NhaPho`, 'User-Agent': H['User-Agent'], Cookie: cfg.cookie } });
      if (rr.status !== 200) continue;
      const buf = Buffer.from(await rr.arrayBuffer());
      urls.push(await putSo(buf));   // 27/07: R2 thay Cloudinary
      await sleep(120);
    } catch (e) {}
  }
  if (urls.length) {
    try {   // GET + GAS tự đọc lại cell -> ok = ĐÃ trong sổ thật (bài học 20-23/07)
      const d = await (await rfetch(`${GAS}?action=cdmgputso&key=${KEY}&ma=${c.ma}&addr=${encodeURIComponent(encodeURIComponent(c.addr || ''))}&urls=${encodeURIComponent(urls.join('|'))}`)).json();
      if (d.ok) { soOk++; soFailLT = 0; if (soOk % 10 === 0 || soOk <= 3) log(`📒 ${soOk} căn có sổ (mới nhất ${c.ma}: ${d.so_n} tấm)`); }
      else { soFailLT++; log(`⚠️ ghi sổ FAIL (${c.ma}): ${JSON.stringify(d).slice(0, 80)}`); }
    } catch (e) { soFailLT++; log(`⚠️ ghi sổ lỗi mạng (${c.ma})`); }
    if (soFailLT >= 3) { log('🛑 ghi sổ FAIL 3 lần liên tiếp — DỪNG để khỏi phí lượt'); process.exit(3); }
  }
  await sleep(2000 + Math.floor((c.ma.charCodeAt(0) % 10) * 150));
}
log(`✅ XONG: ${soOk} căn ghi ẢNH SỔ vào sổ (đã đối chiếu) · ${khongSo} căn không đăng sổ · ${done} lượt quickview đã dùng · ${((Date.now() - t0) / 60000).toFixed(1)} phút`);
