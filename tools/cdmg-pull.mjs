// Kéo TRỌN kho ảnh CĐMG (vượt chặn IP Google) — POOL LIÊN TỤC: slot rảnh bốc căn kế, không chờ căn chậm.
// Mỗi căn: tải ảnh gốc CĐMG (cookie, tuần tự nhẹ nhàng né rate-limit) -> cloudinary -> cdmgputanh (lọc + ghi cột Anh).
// Xong -> node mirror.mjs rồi build web.
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const KEY = 'TSGTH';
const POOL = parseInt(process.argv[2] || '5', 10);
const CAP = parseInt(process.argv[3] || '0', 10);   // giới hạn số căn (chừa quota CĐMG 200/ngày); 0 = không giới hạn
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rfetch(u, o, t = 5) { for (let i = 0; i < t; i++) { try { return await fetch(u, o); } catch (e) { if (i === t - 1) throw e; await sleep(1500 * (i + 1)); } } }
const now = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(`[${now()}]`, ...a);

let cfg = null;              // {cookie, cloud, preset}
const queue = [];            // căn chờ xử lý
let done = 0, withAnh = 0, totSach = 0, emptyRounds = 0, fetching = false, finished = false;
const t0 = Date.now();

async function refill() {
  if (fetching || finished) return;
  if (CAP && (done + queue.length) >= CAP) { finished = true; return; }   // đủ CAP -> ngừng xin thêm
  fetching = true;
  try {
    const pj = await (await rfetch(`${GAS}?action=cdmgpaths&key=${KEY}&n=14`)).json();
    if (pj.ok) {
      cfg = { cookie: pj.cookie, cloud: pj.cloud, preset: pj.preset };
      if (pj.cans.length) { queue.push(...pj.cans); emptyRounds = 0; log(`+${pj.cans.length} căn vào hàng · còn ~${pj.con_lai_uoc} · đã xong ${done}`); }
      else { emptyRounds++; log(`hàng rỗng ${emptyRounds}/2 (còn ~${pj.con_lai_uoc})`); if (emptyRounds >= 2) finished = true; }
    } else { log('cdmgpaths lỗi:', pj.error); }
  } catch (e) { log('cdmgpaths mạng lỗi'); }
  fetching = false;
}

async function doCan(c) {
  const tc = Date.now(), urls = [];
  for (const path of c.paths) {
    try {
      const r = await rfetch(path, { headers: { Referer: 'https://congdongmoigioi.pro/NhaPho', 'User-Agent': 'Mozilla/5.0', Cookie: cfg.cookie } });
      if (r.status !== 200) { process.stdout.write(`x${r.status} `); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      const fd = new FormData();
      fd.append('file', new Blob([buf], { type: 'image/jpeg' }), 'i.jpg');
      fd.append('upload_preset', cfg.preset);
      const up = await (await rfetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, { method: 'POST', body: fd })).json();
      if (up.secure_url) urls.push(up.secure_url);
    } catch (e) { process.stdout.write('E'); }
    await sleep(120);
  }
  let sach = 0;
  if (urls.length) {
    try {
      const q = new URLSearchParams({ action: 'cdmgputanh', key: KEY, ma: c.ma, uuid: c.uuid || '', addr: c.addr || '', urls: urls.join('|') });
      const put = await (await rfetch(`${GAS}?${q}`)).json();
      if (put.ok) { sach = put.sach || 0; if (urls.length) withAnh++; totSach += sach; }
    } catch (e) {}
  }
  done++;
  log(`✓ ${c.ma} · ${(c.addr || '').slice(0, 28)} · ${urls.length}/${c.paths.length}→sạch ${sach} · ${((Date.now() - tc) / 1000).toFixed(0)}s`);
}

async function worker(id) {
  while (true) {
    if (CAP && done >= CAP) return;   // đạt CAP -> dừng worker (chừa quota)
    if (queue.length < POOL && !finished) await refill();
    const c = queue.shift();
    if (!c) { if (finished) return; await sleep(1500); continue; }
    if (CAP && done >= CAP) return;
    try { await doCan(c); } catch (e) { done++; }
  }
}

await Promise.all(Array.from({ length: POOL }, (_, i) => worker(i)));
const dt = (Date.now() - t0) / 1000;
log(`✅ XONG: ${done} căn xử lý · ${withAnh} căn có ảnh · ${totSach} ảnh sạch · ${(dt / 60).toFixed(1)} phút (${(dt / Math.max(done, 1)).toFixed(1)}s/căn)`);
log('>> Bước tiếp: cd website && node build.mjs → node mirror.mjs → build lại + deploy.');
