// Test kéo lại 1 căn cụ thể (đối chiếu lọc mới)
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const KEY = 'TSGTH';
const MA = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rfetch(u, o, t = 4) { for (let i = 0; i < t; i++) { try { return await fetch(u, o); } catch (e) { if (i === t - 1) throw e; await sleep(1500 * (i + 1)); } } }

const pj = await (await rfetch(`${GAS}?action=cdmgpaths&key=${KEY}&ma=${MA}`)).json();
if (!pj.ok || !pj.cans.length) { console.log('không lấy được căn', MA, pj); process.exit(); }
const { cookie, cloud, preset } = pj; const c = pj.cans[0];
console.log(`Căn ${c.ma} · ${c.addr} · ${c.paths.length} ảnh gốc`);
const urls = [];
for (const path of c.paths) {
  const r = await rfetch(path, { headers: { 'Referer': 'https://congdongmoigioi.pro/NhaPho', 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie } });
  if (r.status !== 200) { console.log('  x tải', r.status); continue; }
  const buf = Buffer.from(await r.arrayBuffer());
  const fd = new FormData(); fd.append('file', new Blob([buf], { type: 'image/jpeg' }), 'i.jpg'); fd.append('upload_preset', preset);
  const up = await (await rfetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd })).json();
  if (up.secure_url) { urls.push(up.secure_url); console.log('  ✓', up.secure_url); }
  await sleep(300);
}
const q = new URLSearchParams({ action: 'cdmgputanh', key: KEY, ma: c.ma, uuid: c.uuid || '', addr: c.addr || '', urls: urls.join('|') });
const put = await (await rfetch(`${GAS}?${q}`)).json();
console.log(`\n=> Lọc mới GIỮ ${put.sach}/${urls.length} ảnh`);
