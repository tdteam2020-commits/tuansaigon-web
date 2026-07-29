// LẤY SĐT CHỦ NHÀ CĐMG — chạy MÁY LOCAL (Tuấn chốt 16/07: 180 căn/ngày, chừa 20 xem tay).
//
// ⚠️ ĐỌC TRƯỚC KHI CHẠY:
// - Mỗi số reveal = 1 lượt "xem" + BẮT BUỘC 1 "báo cáo" (site ép xác minh mới xem số kế). 200 lượt/ngày/TÀI KHOẢN.
// - Chạy đều 180/ngày = ~5.400/tháng, gấp mấy lần lượng cũ -> CÓ RỦI RO CĐMG gắn cờ/khoá acc. Tuấn tự cân.
// - Runner tự DỪNG khi: đủ CAP · site báo hết lượt (200) · quá nhiều lỗi liên tiếp. Ctrl+C dừng ngay, đã lưu tới đâu giữ tới đó.
// - Chỉ lấy căn CĐMG ĐANG TRÊN WEB chưa có SĐT, ưu tiên GIÁ CAO trước.
//
// Chạy: node tools/cdmg-sdt-local.mjs [cap] [test]
//   node tools/cdmg-sdt-local.mjs 1 test   -> thử ĐÚNG 1 căn, in ra, KHÔNG lưu (kiểm cơ chế)
//   node tools/cdmg-sdt-local.mjs 180       -> chạy thật, cap 180
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const KEY = (() => {   // 29/07: KHÔNG hardcode khoá (khoá cũ từng nằm CÔNG KHAI trong repo GitHub)
  const _f = homedir() + '/.config/claude-bds/gas.env';
  try { return (readFileSync(_f, 'utf8').match(/GAS_KEY[^"]*"([^"]+)"/) || [])[1].trim(); }
  catch (e) { console.error('Thieu khoa - tao ' + _f + ' voi dong: GAS_KEY="..."'); process.exit(1); }
})();
const BASE = 'https://congdongmoigioi.pro';
const CAP = parseInt(process.argv[2] || '180', 10);
const TEST = process.argv[3] === 'test';
const STATUS = '4';                 // tham số report (khớp sdtByMa_ dùng stS='4')
const BATCH = 12;                   // ghi Sheet mỗi 12 số (lưu qua GET — trần URL ~5KB; ⚠️ CẤM POST vào GAS: Google trả cache, code không chạy — dính thật 20-23/07 mất 4 ngày số)
import { putSo } from './r2put.mjs';   // kho ảnh R2 (thay Cloudinary 27/07)
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('vi-VN');
const log = (...a) => console.log(`[${now()}]`, ...a);
async function rfetch(u, o, t = 3) { for (let i = 0; i < t; i++) { try { return await fetch(u, o); } catch (e) { if (i === t - 1) throw e; await sleep(1500 * (i + 1)); } } }

// ---- cfg + hàng đợi (chỉ căn cập nhật từ 2025 trở lại — Tuấn chốt 20/07; đổi: đối số 4 = năm) ----
const SINCE = parseInt(process.argv[4] || '2025', 10);
const cfg = await (await rfetch(`${GAS}?action=sdtqueue&key=${KEY}&since=${SINCE}`)).json();
if (!cfg.ok) { log('sdtqueue lỗi:', cfg.error); process.exit(1); }
if (cfg.bo_cu) log(`lọc năm: bỏ ${cfg.bo_cu} căn cập nhật trước ${SINCE} (chỉ giữ căn còn "chăm")`);

// ---- ƯU TIÊN QUẬN (Tuấn chốt 17/07): Phú Nhuận → Q3 → Tân Bình P.1-5 → Q1 → Q10 → Bình Thạnh → còn lại ----
// Trong mỗi bậc GIỮ thứ tự cũ (giá cao trước). Địa chỉ dạng "<đường>, P. <n>, <quận>".
function xRank(addr) {
  const s = String(addr || '').toLowerCase();
  const pm = s.match(/p\.?\s*(\d+)/);                 // số phường
  const ph = pm ? parseInt(pm[1], 10) : 0;
  if (/ph[uú]\s*nhu[aậ]n/.test(s)) return 1;
  if (/q\.?\s*3\b|qu[aậ]n\s*3\b/.test(s)) return 2;
  if (/t[aâ]n\s*b[iì]nh/.test(s)) return (ph >= 1 && ph <= 5) ? 3 : 7;
  if (/q\.?\s*1\b|qu[aậ]n\s*1\b/.test(s)) return 4;
  if (/q\.?\s*10\b|qu[aậ]n\s*10\b/.test(s)) return 5;
  if (/b[iì]nh\s*th[aạ]nh/.test(s)) return 6;
  return 7;
}
cfg.cans = cfg.cans
  .map((c, i) => ({ c, i, r: xRank(c.addr) }))
  .sort((a, b) => a.r - b.r || a.i - b.i)              // bậc trước, cùng bậc giữ giá-cao-trước
  .map(x => x.c);
const bac = {}; cfg.cans.forEach(c => { const r = xRank(c.addr); bac[r] = (bac[r] || 0) + 1; });
const tenBac = { 1: 'Phú Nhuận', 2: 'Q3', 3: 'Tân Bình P1-5', 4: 'Q1', 5: 'Q10', 6: 'Bình Thạnh', 7: 'còn lại' };
log('ưu tiên quận: ' + [1, 2, 3, 4, 5, 6, 7].filter(r => bac[r]).map(r => `${tenBac[r]} ${bac[r]}`).join(' · '));

log(`hàng đợi: ${cfg.tong_cho} căn CĐMG trên web chưa có SĐT · phiên này lấy tối đa ${TEST ? 1 : CAP}`);
const H = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36',
  'Accept-Language': 'vi-VN,vi;q=0.9', 'X-Requested-With': 'XMLHttpRequest',
  'Origin': BASE, 'Referer': `${BASE}/NhaPho`, 'Cookie': cfg.cookie,
  'Content-Type': 'application/x-www-form-urlencoded' };
const jsonMsg = t => { try { const o = JSON.parse(t); return o && o.message ? o.message : t; } catch (e) { return t; } };
const clean = s => (s || '').replace(/\s+/g, ' ').trim();
// đúng dấu hiệu "hết lượt 200" (site trả error_code 504 / câu "200 thông tin")
const hetLuot = t => /200 th[ôo]ng tin|error_code"?\s*:?\s*504|xem 200|gi[ớo]i h[ạa]n.*200/i.test(t || '');

// Bóc đường dẫn ẢNH SỔ từ quickview HTML (CĐMG chia sẵn data-fancybox="hinh_so...") — khớp classifyImages_ bên GAS
function soPaths(qv) {
  const out = [];
  const re = /href="https?:\/\/[^"]*?(\/NhaPho\/image\/[^"'?]+\.(?:jpg|jpeg|png))[^"]*"\s+data-fancybox="(hinh_so|hinh_so_mobile)"/gi;
  let m; while ((m = re.exec(qv)) !== null) if (!out.includes(m[1])) out.push(m[1]);
  return out.slice(0, 4);   // tối đa 4 tấm sổ/căn
}
async function reveal(can) {
  // 1) quickview -> lấy contact-uuid (data-mode="Phone")
  const qv = jsonMsg(await (await rfetch(`${BASE}/NhaPho/quickview/${can.uuid}`, { method: 'POST', headers: H, body: 'token=' + cfg.jwt })).text());
  if (hetLuot(qv)) return { limit: true };
  // TIỆN LƯỢT QUICKVIEW (25/07): bóc luôn ảnh SỔ (0 lượt thêm) — cả căn ẩn số cũng lấy
  const so = can.co_so ? [] : soPaths(qv);
  const cuuids = [...qv.matchAll(/data-uuid="([0-9a-f-]{36})"\s+data-mode="Phone"/g)].map(m => m[1]);
  if (!cuuids.length) return { none: true, so };
  // 2) phone(cuuid) -> nếu bị khoá "xác minh" thì report rồi xem lại
  const cu = cuuids[0];
  let ph = jsonMsg(await (await rfetch(`${BASE}/NhaPho/phone/${cu}`, { method: 'POST', headers: H, body: 'token=' + cfg.jwt })).text());
  if (hetLuot(ph)) return { limit: true };
  if (/x[aá]c\s*minh/i.test(ph)) {
    await report(cu);
    ph = jsonMsg(await (await rfetch(`${BASE}/NhaPho/phone/${cu}`, { method: 'POST', headers: H, body: 'token=' + cfg.jwt })).text());
    if (hetLuot(ph)) return { limit: true };
  }
  const tel = (ph.match(/tel:(\d{9,11})/) || [])[1] || '';
  const nm = clean((ph.match(/fw-bold fs-5 text-gray-700[^>]*>\s*([^<]+)/) || [])[1]);
  if (!tel) return { none: true, so };
  // 3) XÁC MINH số vừa xem (site ép — khớp reportFull_ trong GAS)
  await report(cu);
  return { phone: tel, owner: nm, so };
}
async function report(cu) {
  try { await rfetch(`${BASE}/NhaPho/process_report/${cu}`, { method: 'POST', headers: H, body: `token=${cfg.jwt}&uuid=${cu}&status=${STATUS}&note=` }); }
  catch (e) {}
}

// ---- TEST: 1 căn, không lưu ----
if (TEST) {
  const c = cfg.cans[0];
  log(`THỬ căn ${c.ma} · ${c.gia} tỷ · ${c.addr.slice(0, 45)}`);
  const r = await reveal(c);
  log('kết quả:', JSON.stringify(r));
  log(r.phone ? '✅ cơ chế reveal CHẠY (đã tốn 1 lượt của hôm nay) — chưa lưu vì đang test' : '⚠️ không ra số (căn ẩn số / hết lượt / lỗi)');
  process.exit(0);
}

// ---- CHẠY THẬT ----
let ok = 0, none = 0, loi = 0, loiLienTiep = 0, done = 0;
let pend = [], ansoPend = [];   // ansoPend: căn chủ ẨN SỐ -> báo GAS ghi dấu, mai khỏi thử lại (23/07, đỡ phí ~40 lượt/ngày)
// ---- ẢNH SỔ đi kèm (25/07 — cùng lượt quickview, 0 lượt thêm): tải local -> cloudinary -> GAS cdmgputso (có đối chiếu) ----
let soOk = 0, soFailLT = 0, soTat = false;
async function luuSo(c, paths) {
  if (soTat || !paths.length) return;
  const urls = [];
  for (const p of paths) {
    try {
      const rr = await rfetch(BASE + p, { headers: { Referer: `${BASE}/NhaPho`, 'User-Agent': H['User-Agent'], Cookie: cfg.cookie } });
      if (rr.status !== 200) continue;
      const buf = Buffer.from(await rr.arrayBuffer());
      urls.push(await putSo(buf));   // 27/07: R2 thay Cloudinary (free hết quota, doạ khoá 1/8)
      await sleep(120);
    } catch (e) {}
  }
  if (!urls.length) return;
  try {   // GET (cấm POST vào GAS!) + GAS tự đọc lại cell sau ghi -> d.ok=true nghĩa là ĐÃ NẰM TRONG SỔ thật
    const d = await (await rfetch(`${GAS}?action=cdmgputso&key=${KEY}&ma=${c.ma}&addr=${encodeURIComponent(encodeURIComponent(c.addr || ''))}&urls=${encodeURIComponent(urls.join('|'))}`)).json();
    if (d.ok) { soOk++; soFailLT = 0; log(`📒 ${c.ma}: ${d.so_n} ảnh sổ ĐÃ VÀO SỔ (đối chiếu OK) · ${urls[0].slice(0, 60)}...`); }
    else { soFailLT++; log(`⚠️ ghi ảnh sổ FAIL (${c.ma}): ${JSON.stringify(d).slice(0, 80)}`); }
  } catch (e) { soFailLT++; log(`⚠️ ghi ảnh sổ lỗi mạng (${c.ma})`); }
  if (soFailLT >= 3 && !soTat) { soTat = true; log('🛑 ghi ảnh sổ FAIL 3 lần liên tiếp — TẮT phần sổ mẻ này (SĐT vẫn chạy bình thường)'); }
}
const t0 = Date.now();
async function flush() {
  if (!pend.length && !ansoPend.length) return;
  // ⚠️ LƯU QUA GET (24/07): POST vào GAS bị Google trả CACHE — code không chạy, 20-23/07 "lưu" 300 số mà sổ nhận 0.
  // addr encode RIÊNG từng field (GAS decodeURIComponent lớp 2) rồi cả cục encode lần nữa khi vào URL
  const data = pend.map(x => `${x.ma}~${x.phone}~${x.owner || ''}~${encodeURIComponent(x.addr || '')}`).join('|');
  const anso = ansoPend.map(x => `${x.ma}~${encodeURIComponent(x.addr || '')}`).join('|');
  const u = `${GAS}?action=sdtput&key=${KEY}&data=${encodeURIComponent(data)}&anso=${encodeURIComponent(anso)}`;
  try {
    const d = await (await rfetch(u)).json();
    if (d.ok) log(`💾 lưu THẬT ${d.nhan || 0} số + đánh dấu ${ansoPend.length} ẩn số (tổng ${ok})`);
    else log(`🛑 LƯU THẤT BẠI: ${JSON.stringify(d).slice(0, 120)} — DỪNG để khỏi phí lượt`), process.exit(3);
  } catch (e) { log(`🛑 LƯU LỖI MẠNG (${String(e).slice(0, 80)}) — DỪNG để khỏi phí lượt`); process.exit(3); }
  pend = []; ansoPend = [];
}
for (const c of cfg.cans) {
  if (done >= CAP) { log(`đã đủ cap ${CAP} — dừng, chừa lượt cho Tuấn xem tay`); break; }
  let r;
  try { r = await reveal(c); } catch (e) { r = { err: true }; }
  if (r.limit) { log('🛑 SITE BÁO HẾT LƯỢT (200/ngày) — dừng ngay, để mai chạy tiếp'); break; }
  done++;
  if (r.phone) { ok++; loiLienTiep = 0; pend.push({ ma: c.ma, phone: r.phone, owner: r.owner, addr: c.addr });
    if (ok % 20 === 0) log(`✓ ${ok} số (mới nhất ${c.ma}: ${r.phone}${r.owner ? ' — ' + r.owner : ''})`);
    if (pend.length >= BATCH) await flush();
  } else if (r.none) { none++; loiLienTiep = 0; ansoPend.push({ ma: c.ma, addr: c.addr }); if (pend.length + ansoPend.length >= BATCH) await flush(); }
  else { loi++; loiLienTiep++; if (loiLienTiep >= 8) { log('🛑 8 lỗi liên tiếp (mất phiên?/site chặn) — dừng an toàn'); break; } }
  if (r.so && r.so.length) await luuSo(c, r.so);   // ảnh sổ đi kèm — sau khi xử lý số, không ảnh hưởng đếm lượt
  await sleep(2200 + Math.floor((c.ma.charCodeAt(0) % 12) * 130));   // rải 2.2-3.7s/căn, đỡ lộ pattern máy
}
await flush();
const dt = (Date.now() - t0) / 1000;
log(`✅ XONG: ${ok} số lấy được · ${soOk} căn ghi ẢNH SỔ vào sổ (đã đối chiếu) · ${none} căn ẩn số/không số · ${loi} lỗi · ${done} lượt đã dùng · ${(dt / 60).toFixed(1)} phút`);
log(`>> Kho SĐT tăng thêm ${ok}. Số nằm ở BDS_S06 (bot gõ mã hiện số; web KHÔNG lộ). Mai chạy lại lấy tiếp.`);
