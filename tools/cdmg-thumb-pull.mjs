// KÉO THUMB CĐMG MIỄN PHÍ (15/07) — thumb nằm trong trang LIST nên KHÔNG tốn lượt 200 căn/ngày.
// Luồng: GAS cdmgthumbs (list + filter hinh_nha, trả thumb URL + cookie) -> local tải (IP thường, nhanh)
//        -> cloudinary -> GAS cdmgputthumb -> cột Anh_thumb(25) -> weblist dùng khi chưa có ảnh FULL.
// Thumb 360x480, KHÔNG watermark. Ảnh FULL vẫn phải local-pull (cdmg-pull.mjs) + tốn lượt 200.
// Chạy: node tools/cdmg-thumb-pull.mjs [pool] [cap]     vd: node tools/cdmg-thumb-pull.mjs 6 0   (0 = không giới hạn)
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const KEY = 'TSGTH';
const POOL = parseInt(process.argv[2] || '6', 10);
const CAP = parseInt(process.argv[3] || '0', 10);
// PAGES = độ sâu quét list mỗi quận (15/07: mặc định 4 trang = ~80 căn đầu -> BỎ SÓT hàng ngàn căn nằm sâu;
// kho CĐMG ~7.6k trang. Tăng lên để vét sâu. cdmgthumbs có chốt giờ 230s/lần nên cứ gọi lặp là hết dần.)
const PAGES = parseInt(process.argv[4] || '25', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rfetch(u, o, t = 4) { for (let i = 0; i < t; i++) { try { return await fetch(u, o); } catch (e) { if (i === t - 1) throw e; await sleep(1200 * (i + 1)); } } }
const now = () => new Date().toLocaleTimeString('vi-VN');
const log = (...a) => console.log(`[${now()}]`, ...a);

let cfg = null, done = 0, ok = 0, fail = 0, emptyRounds = 0, fetching = false, finished = false;
const queue = [];
const t0 = Date.now();

async function refill() {
  if (fetching || finished) return;
  if (CAP && (done + queue.length) >= CAP) { finished = true; return; }
  fetching = true;
  try {
    const d = await (await rfetch(`${GAS}?action=cdmgthumbs&key=${KEY}&n=40&pages=${PAGES}`)).json();
    if (d.ok) {
      cfg = { cookie: d.cookie, cloud: d.cloud, preset: d.preset };
      if (d.cans?.length) { queue.push(...d.cans); emptyRounds = 0; log(`+${d.cans.length} căn · ${d.theo_khu} · đã xong ${done}`); }
      else { emptyRounds++; log(`hết căn (vòng rỗng ${emptyRounds}/2)`); if (emptyRounds >= 2) finished = true; }
    } else log('cdmgthumbs lỗi:', d.error);
  } catch (e) { log('cdmgthumbs mạng lỗi'); }
  fetching = false;
}

async function doCan(c) {
  try {
    const r = await rfetch(c.thumb, { headers: { Referer: 'https://congdongmoigioi.pro/NhaPho', 'User-Agent': 'Mozilla/5.0', Cookie: cfg.cookie } });
    if (r.status !== 200) { fail++; done++; return; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 3000) { fail++; done++; return; }   // ảnh hỏng/rỗng
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: 'image/jpeg' }), 't.jpg');
    fd.append('upload_preset', cfg.preset);
    const up = await (await rfetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, { method: 'POST', body: fd })).json();
    if (!up.secure_url) { fail++; done++; return; }
    const q = new URLSearchParams({ action: 'cdmgputthumb', key: KEY, ma: c.ma, uuid: c.uuid || '', addr: c.addr || '', url: up.secure_url });
    const put = await (await rfetch(`${GAS}?${q}`)).json();
    done++; if (put.ok) { ok++; if (ok % 10 === 0) log(`✓ ${ok} thumb đã lưu (mới nhất: ${c.ma} · ${(c.addr || '').slice(0, 28)})`); }
    else fail++;
  } catch (e) { fail++; done++; }
}

async function worker() {
  while (true) {
    if (CAP && done >= CAP) return;
    if (queue.length < POOL && !finished) await refill();
    const c = queue.shift();
    if (!c) { if (finished) return; await sleep(1200); continue; }
    await doCan(c);
    await sleep(80);
  }
}

await Promise.all(Array.from({ length: POOL }, () => worker()));
const dt = (Date.now() - t0) / 1000;
log(`✅ XONG: ${ok} thumb lưu · ${fail} lỗi · ${(dt / 60).toFixed(1)} phút (${(dt / Math.max(done, 1)).toFixed(1)}s/căn)`);
log('>> Bước tiếp: cd website && node build.mjs → node mirror.mjs → build lại + deploy (hoặc chờ build 7h/19h).');
