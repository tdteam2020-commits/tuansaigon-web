// KÉO THUMB CĐMG — BẢN v2 "ALL LOCAL" (15/07): crawl list + tải + upload ĐỀU Ở MÁY LOCAL.
// GAS chỉ làm 2 việc rẻ: cdmgcfg (1 lần: cookie + khu + danh sách căn đã có ảnh) + cdmgputthumbs (ghi LÔ 30 căn/lần).
// -> Quota GAS từ ~56 phút xuống còn ~2 phút. Thumb 360x480, KHÔNG watermark, KHÔNG tốn lượt 200 căn/ngày.
// Chạy: node tools/cdmg-thumb-local.mjs [pages] [pool]     vd: node tools/cdmg-thumb-local.mjs 40 6
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const KEY = 'TSGTH';
const BASE = 'https://congdongmoigioi.pro';
const PAGES = parseInt(process.argv[2] || '40', 10);   // độ sâu list mỗi quận (20 căn/trang)
const POOL = parseInt(process.argv[3] || '6', 10);
const BATCH = 30;                                       // số thumb ghi Sheet 1 lần
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('vi-VN');
const log = (...a) => console.log(`[${now()}]`, ...a);
async function rfetch(u, o, t = 4) { for (let i = 0; i < t; i++) { try { return await fetch(u, o); } catch (e) { if (i === t - 1) throw e; await sleep(1200 * (i + 1)); } } }

// ---- 1. xin cấu hình từ GAS (1 call duy nhất) ----
const cfg = await (await rfetch(`${GAS}?action=cdmgcfg&key=${KEY}`)).json();
if (!cfg.ok) { log('cdmgcfg lỗi:', cfg.error); process.exit(1); }
const daCo = new Set(cfg.da_co.map(String));
log(`cfg: ${cfg.areas.length} khu · ${daCo.size} căn đã có ảnh (bỏ qua)`);
const H = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest', 'Referer': `${BASE}/NhaPho`, 'Cookie': cfg.cookie,
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'vi-VN,vi;q=0.9' };

// ---- 2. crawl list NGAY TẠI MÁY + parse (port từ parseItems_) ----
function parseList(html) {
  const out = [], blocks = html.split('class="open-detail');
  for (let b = 1; b < blocks.length; b++) {
    const blk = blocks[b];
    const uuid = (blk.match(/data-uuid="([0-9a-f-]{36})"/) || [])[1];
    if (!uuid) continue;
    const ma = (blk.match(/STT_(\d+)/) || [])[1] || '';
    const addr = ((blk.match(/Địa Chỉ:\s*([^<]+?)\s*<br/i) || [])[1] || '').trim();
    const mTh = blk.match(/<img[^>]+src=["']([^"']*(?:NhaPho\/image|upload\/)[^"']*)["']/i);
    let thumb = '';
    if (mTh && mTh[1].indexOf('blank-image') < 0) thumb = mTh[1].startsWith('http') ? mTh[1] : BASE + (mTh[1][0] === '/' ? '' : '/') + mTh[1];
    if (ma && thumb) out.push({ ma, uuid, addr, thumb });
  }
  return out;
}
async function crawlKhu(area) {
  const found = []; let pageSize = 0;
  for (let pg = 0; pg < PAGES; pg++) {
    const qs = `nhucau=1&deleted=0&tinhthanh=1&quanhuyen[]=${area.quan}&hinh_nha=1&rowstart=${pg * (pageSize || 20)}`;
    let items = [];
    try { items = parseList(await (await rfetch(`${BASE}/NhaPho?${qs}`, { headers: H })).text()); }
    catch (e) { break; }
    if (!items.length) break;
    if (pg === 0) pageSize = items.length;
    const fresh = items.filter(x => !daCo.has(x.ma));
    fresh.forEach(x => { daCo.add(x.ma); found.push(x); });   // đánh dấu ngay, khỏi trùng
    if (items.length < pageSize) break;
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

// ---- 4. ghi LÔ về GAS ----
let saved = 0, failed = 0, gasCalls = 1;
async function flush(rows) {
  if (!rows.length) return;
  const data = rows.map(r => `${r.ma}~${r.url}`).join('|');
  try {
    const q = new URLSearchParams({ action: 'cdmgputthumbs', key: KEY, data });
    const d = await (await rfetch(`${GAS}?${q}`)).json();
    gasCalls++;
    if (d.ok) { saved += d.nhan; log(`💾 ghi lô ${d.nhan} thumb (tổng ${saved}) · GAS calls: ${gasCalls}`); }
    else { failed += rows.length; log('ghi lô lỗi:', d.error); }
  } catch (e) { failed += rows.length; log('ghi lô mạng lỗi'); }
}

const t0 = Date.now();
for (const area of cfg.areas) {
  const cans = await crawlKhu(area);
  log(`🔎 ${area.ten}: ${cans.length} căn có thumb chưa lưu`);
  if (!cans.length) continue;
  let pend = [];
  for (let i = 0; i < cans.length; i += POOL) {
    const res = (await Promise.all(cans.slice(i, i + POOL).map(grab))).filter(Boolean);
    failed += POOL - res.length > 0 ? 0 : 0;
    pend.push(...res);
    if (pend.length >= BATCH) { await flush(pend.splice(0, BATCH)); }
  }
  await flush(pend);
}
const dt = (Date.now() - t0) / 1000;
log(`✅ XONG: ${saved} thumb lưu · ${(dt / 60).toFixed(1)} phút · CHỈ ${gasCalls} lần gọi GAS (bản cũ tốn ~1500 lần!)`);
log('>> Bước tiếp: node build.mjs → node mirror.mjs --no-prune → push + ghbuild');
