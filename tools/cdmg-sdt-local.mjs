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
const KEY = 'TSGTH';
const BASE = 'https://congdongmoigioi.pro';
const CAP = parseInt(process.argv[2] || '180', 10);
const TEST = process.argv[3] === 'test';
const STATUS = '4';                 // tham số report (khớp sdtByMa_ dùng stS='4')
const BATCH = 20;                   // ghi Sheet mỗi 20 số
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('vi-VN');
const log = (...a) => console.log(`[${now()}]`, ...a);
async function rfetch(u, o, t = 3) { for (let i = 0; i < t; i++) { try { return await fetch(u, o); } catch (e) { if (i === t - 1) throw e; await sleep(1500 * (i + 1)); } } }

// ---- cfg + hàng đợi ----
const cfg = await (await rfetch(`${GAS}?action=sdtqueue&key=${KEY}`)).json();
if (!cfg.ok) { log('sdtqueue lỗi:', cfg.error); process.exit(1); }

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

async function reveal(can) {
  // 1) quickview -> lấy contact-uuid (data-mode="Phone")
  const qv = jsonMsg(await (await rfetch(`${BASE}/NhaPho/quickview/${can.uuid}`, { method: 'POST', headers: H, body: 'token=' + cfg.jwt })).text());
  if (hetLuot(qv)) return { limit: true };
  const cuuids = [...qv.matchAll(/data-uuid="([0-9a-f-]{36})"\s+data-mode="Phone"/g)].map(m => m[1]);
  if (!cuuids.length) return { none: true };
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
  if (!tel) return { none: true };
  // 3) XÁC MINH số vừa xem (site ép — khớp reportFull_ trong GAS)
  await report(cu);
  return { phone: tel, owner: nm };
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
let pend = [];
const t0 = Date.now();
async function flush() {
  if (!pend.length) return;
  const data = pend.map(x => `${x.ma}~${x.phone}~${x.owner || ''}~${encodeURIComponent(x.addr || '')}`).join('|');
  try { const d = await (await rfetch(`${GAS}?action=sdtput&key=${KEY}`, { method: 'POST', body: new URLSearchParams({ action: 'sdtput', key: KEY, data }) })).json();
    if (d.ok) log(`💾 lưu ${d.nhan} số (tổng ${ok})`); } catch (e) { log('lưu lỗi mạng'); }
  pend = [];
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
  } else if (r.none) { none++; loiLienTiep = 0; }
  else { loi++; loiLienTiep++; if (loiLienTiep >= 8) { log('🛑 8 lỗi liên tiếp (mất phiên?/site chặn) — dừng an toàn'); break; } }
  await sleep(2200 + Math.floor((c.ma.charCodeAt(0) % 12) * 130));   // rải 2.2-3.7s/căn, đỡ lộ pattern máy
}
await flush();
const dt = (Date.now() - t0) / 1000;
log(`✅ XONG: ${ok} số lấy được · ${none} căn ẩn số/không số · ${loi} lỗi · ${done} lượt đã dùng · ${(dt / 60).toFixed(1)} phút`);
log(`>> Kho SĐT tăng thêm ${ok}. Số nằm ở BDS_S06 (bot gõ mã hiện số; web KHÔNG lộ). Mai chạy lại lấy tiếp.`);
