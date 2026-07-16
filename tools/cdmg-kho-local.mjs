// QUÉT KHO CĐMG — BẢN "ALL LOCAL" (15/07). Thay cho cdmg-thumb-local.mjs (chỉ lấy mã + ảnh).
//
// VÌ SAO: scrapeSnapshot_ chạy TỪ GAS chỉ kham ~360 căn/lượt (trần 6 phút/execution) -> BDS_Snapshot chỉ biết
// ~4.3k căn, trong khi list CĐMG có ~9.6k căn CÓ ẢNH. Thumb kéo về nằm không vì web (nguồn 3) chỉ dựng trang
// cho căn CÓ TRONG snapshot. Máy local không dính trần đó -> vét sâu rồi POST cả 2 thứ về GAS.
//
// Trang list chứa SẴN đủ trường snapshot: địa chỉ, số nhà, giá, DT, vị trí, ngang×dài, số tầng, trạng thái,
// cập nhật — và thumbnail 360x480 KHÔNG watermark. List KHÔNG dính cap 200 căn/ngày (khác quickview/view).
//
// Chạy: node tools/cdmg-kho-local.mjs [pages] [pool]     vd: node tools/cdmg-kho-local.mjs 500 6
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const KEY = 'TSGTH';
const BASE = 'https://congdongmoigioi.pro';
const PAGES = parseInt(process.argv[2] || '500', 10);   // độ sâu list mỗi quận (20 căn/trang)
const POOL = parseInt(process.argv[3] || '6', 10);
const SNAP_BATCH = 1200;   // căn/lô POST snapshot
const THUMB_BATCH = 30;    // thumb/lô ghi Sheet
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('vi-VN');
const log = (...a) => console.log(`[${now()}]`, ...a);
async function rfetch(u, o, t = 4) { for (let i = 0; i < t; i++) { try { return await fetch(u, o); } catch (e) { if (i === t - 1) throw e; await sleep(1200 * (i + 1)); } } }
const clean = s => String(s || '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// "10 ngày trước" -> phút (port updMin_ của GAS — snapshot dùng để tính căn mới/cũ)
function updMin(s) {
  s = (s || '').toLowerCase();
  const n = +((s.match(/(\d+)/) || [])[1] || 0);
  if (/vừa|hôm nay|today|giây/.test(s)) return 0;
  if (/phút/.test(s)) return n;
  if (/giờ/.test(s)) return n * 60;
  if (/ngày/.test(s)) return n * 1440;
  if (/tuần/.test(s)) return n * 10080;
  if (/tháng/.test(s)) return n * 43200;
  if (/năm/.test(s)) return n * 525600;
  return 999999;
}

// ---- 1. xin cấu hình từ GAS (1 call) ----
const cfg = await (await rfetch(`${GAS}?action=cdmgcfg&key=${KEY}`)).json();
if (!cfg.ok) { log('cdmgcfg lỗi:', cfg.error); process.exit(1); }
const daCoAnh = new Set(cfg.da_co.map(String));   // căn đã có ảnh -> khỏi tải thumb lại (vẫn gửi snapshot)
log(`cfg: ${cfg.areas.length} khu · ${daCoAnh.size} căn đã có ảnh (khỏi tải lại thumb)`);
const H = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest', 'Referer': `${BASE}/NhaPho`, 'Cookie': cfg.cookie,
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'vi-VN,vi;q=0.9',
};

// ---- 2. parse list ĐẦY ĐỦ trường (port parseItems_) ----
function parseList(html, khu) {
  const out = [], blocks = html.split('class="open-detail');
  for (let b = 1; b < blocks.length; b++) {
    const blk = blocks[b];
    const uuid = (blk.match(/data-uuid="([0-9a-f-]{36})"/) || [])[1];
    if (!uuid) continue;
    const ma = (blk.match(/STT_(\d+)/) || [])[1] || '';
    if (!ma) continue;
    let addr = clean((blk.match(/Địa Chỉ:\s*([^<]+?)\s*<br/i) || [])[1]);
    // số nhà nằm ở CỘT RIÊNG (span.text-gray-900.fw-bold), không nằm trong "Địa Chỉ:" -> ghép vào
    const sonhaCol = clean((blk.match(/<span class="text-gray-900 fw-bold[^"]*">\s*([^<]+?)\s*<\/span>/i) || [])[1]);
    if (sonhaCol && /^\d/.test(sonhaCol) && addr && !/^\s*\d/.test(addr)) addr = sonhaCol + ' ' + addr;
    if (!addr) continue;
    const status = clean((blk.match(/(Đang Giao Dịch|Đã Giao Dịch|Đã Cọc|Hết hạn|Tạm ngưng|Ng[ưừ]ng giao dịch|Đã bán|Đã cho thuê|Hết hàng|Chưa Xác Định|Chưa Xác Minh)/i) || [])[1]);
    const upd = clean((blk.match(/Cập nhật<\/span>\s*<span>([^<]+)</i) || [])[1]);
    const gia = clean((blk.match(/text-primary mb-0 fs-4">([^<]+)</) || [])[1]);
    let dt = clean((blk.match(/text-primary">([\d.,]+)m<sup>/) || [])[1]);
    if (dt) dt += 'm²';
    const vitri = clean((blk.match(/•\s*<span>([^<]+)<\/span>/) || [])[1]);
    const kt = blk.match(/([\d.,]+)\s*m\s*x\s*([\d.,]+)\s*m/i);
    const tang = ((blk.match(/(\d+)\s*t[aầ]ng/i) || [])[1] || '');
    const hasImg = blk.indexOf('blank-image') < 0;
    let thumb = '';
    const mTh = blk.match(/<img[^>]+src=["']([^"']*(?:NhaPho\/image|upload\/)[^"']*)["']/i);
    if (mTh && mTh[1].indexOf('blank-image') < 0) thumb = mTh[1].startsWith('http') ? mTh[1] : BASE + (mTh[1][0] === '/' ? '' : '/') + mTh[1];
    out.push({ ma, uuid, khu, addr, gia, dt, vitri, status, upd, upd_min: updMin(upd),
      kt: kt ? `${kt[1]}m x ${kt[2]}m` : '', tang, co_anh: hasImg ? 1 : 0, thumb });
  }
  return out;
}

// Bỏ dấu để khớp tên phường (SCRAPE_AREAS.loc) — Thủ Đức/Q7 quận rất lớn, chỉ lấy Thảo Điền / Phú Mỹ Hưng
const noDia = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const hopKhu = (area, addr) => !area.loc || area.loc.some(k => noDia(addr).includes(noDia(k)));

async function crawlKhu(area) {
  const found = [], seen = new Set(); let pageSize = 0;
  for (let pg = 0; pg < PAGES; pg++) {
    // hinh_nha=1: CHỈ căn CÓ ẢNH NHÀ. Đo 15/07: toàn kho CĐMG chỉ ~16% căn là có ảnh (697/4.329 căn active)
    // -> nạp căn không ảnh vào snapshot = đẻ ra hàng ngàn trang web "ảnh đang cập nhật", lợi bất cập hại.
    const qs = `nhucau=1&deleted=0&tinhthanh=1&quanhuyen[]=${area.quan}&hinh_nha=1&rowstart=${pg * (pageSize || 20)}`;
    let items = [];
    try { items = parseList(await (await rfetch(`${BASE}/NhaPho?${qs}`, { headers: H })).text(), area.ten); }
    catch (e) { break; }
    if (!items.length) break;
    if (pg === 0) pageSize = items.length;
    items.forEach(x => { if (!seen.has(x.ma) && hopKhu(area, x.addr)) { seen.add(x.ma); found.push(x); } });
    if (items.length < pageSize) break;   // lưu ý: vẫn duyệt HẾT trang của quận, chỉ GIỮ căn đúng phường
    await sleep(150);
  }
  return found;
}

// ---- 3. tải thumb + upload cloudinary ----
async function grab(c) {
  try {
    const r = await rfetch(c.thumb, { headers: { Referer: `${BASE}/NhaPho`, 'User-Agent': H['User-Agent'], Cookie: cfg.cookie } });
    if (r.status !== 200) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 3000) return null;
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: 'image/jpeg' }), 't.jpg');
    fd.append('upload_preset', cfg.preset);
    const up = await (await rfetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, { method: 'POST', body: fd })).json();
    return up.secure_url ? { ma: c.ma, url: up.secure_url } : null;
  } catch (e) { return null; }
}

// ---- 4. đẩy về GAS ----
// Snapshot đi đường CLOUDINARY RAW: URL GET chỉ tải nổi ~15 căn/lần (trần ~5KB) mà POST thì Google
// trả CACHE lần chạy cũ (code không chạy — đo thật 15/07). Nên: up file JSON -> báo URL -> GAS tự tải.
let snapAdded = 0, thumbSaved = 0, gasCalls = 1;
async function get(action, params) {
  const q = new URLSearchParams({ action, key: KEY, ...params });
  const r = await rfetch(`${GAS}?${q}`);
  gasCalls++;
  return await r.json();
}
async function upRaw(obj) {
  const fd = new FormData();
  fd.append('file', new Blob([JSON.stringify(obj)], { type: 'application/json' }), 'snap.json');
  fd.append('upload_preset', cfg.preset);
  const up = await (await rfetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/raw/upload`, { method: 'POST', body: fd })).json();
  return up.secure_url || '';
}
async function flushSnap(rows) {
  const lot = rows.map(x => ({ ma: x.ma, uuid: x.uuid, khu: x.khu, addr: x.addr, gia: x.gia, dt: x.dt,
    vitri: x.vitri, status: x.status, upd: x.upd, upd_min: x.upd_min, kt: x.kt, tang: x.tang, co_anh: x.co_anh }));
  try {
    const url = await upRaw(lot);
    if (!url) { log('up cloudinary lỗi'); return; }
    const d = await get('cdmgputsnapurl', { url });
    if (d.ok) { snapAdded += (d.them || 0); log(`🏠 snapshot +${d.them} căn mới (bỏ ${d.da_co} đã có) · kho: ${d.tong_snapshot}`); }
    else log('putsnapurl lỗi:', d.error);
  } catch (e) { log('putsnapurl lỗi:', e.message); }
}
async function flushThumb(rows) {
  if (!rows.length) return;
  try {
    const d = await get('cdmgputthumbs', { data: rows.map(r => `${r.ma}~${r.url}`).join('|') });
    if (d.ok) { thumbSaved += d.nhan; log(`💾 thumb +${d.nhan} (tổng ${thumbSaved})`); }
    else log('putthumbs lỗi:', d.error);
  } catch (e) { log('putthumbs mạng lỗi'); }
}

// ---- chạy ----
const t0 = Date.now();
let tongCan = 0, tongCoAnh = 0;
for (const area of cfg.areas) {
  const cans = await crawlKhu(area);
  const coAnh = cans.filter(c => c.co_anh && c.thumb);
  tongCan += cans.length; tongCoAnh += coAnh.length;
  log(`🔎 ${area.ten}: ${cans.length} căn (${coAnh.length} có ảnh)`);
  if (!cans.length) continue;
  await flushSnap(cans);                                    // gửi TẤT CẢ — GAS tự bỏ căn đã có
  const canTai = coAnh.filter(c => !daCoAnh.has(c.ma));     // chỉ tải thumb căn chưa có ảnh
  log(`   ↓ tải ${canTai.length} thumb mới`);
  let pend = [];
  for (let i = 0; i < canTai.length; i += POOL) {
    const res = (await Promise.all(canTai.slice(i, i + POOL).map(grab))).filter(Boolean);
    res.forEach(r => daCoAnh.add(r.ma));
    pend.push(...res);
    if (pend.length >= THUMB_BATCH) await flushThumb(pend.splice(0, THUMB_BATCH));
  }
  await flushThumb(pend);
}
const dt = (Date.now() - t0) / 1000;
log(`✅ XONG: quét ${tongCan} căn (${tongCoAnh} có ảnh) · snapshot thêm ${snapAdded} · thumb thêm ${thumbSaved} · ${(dt / 60).toFixed(1)} phút · ${gasCalls} lần gọi GAS`);
log('>> Bước tiếp: node build.mjs → node mirror.mjs --no-prune → push + ghbuild');
