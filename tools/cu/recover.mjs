// THU HỒI 1 LẦN: kéo dữ liệu ảnh/caption từ bản web đang sống trên surge về data/archive.json
// (dùng khi kho GAS mất cache ảnh — web là nơi còn giữ đủ 538 căn)
import { writeFileSync, mkdirSync } from 'node:fs';
const SITE = process.env.FROM || 'https://tuansaigon.surge.sh';
const xml = await (await fetch(SITE + '/sitemap.xml')).text();
const urls = [...xml.matchAll(/<loc>([^<]+\/nha-dat\/[a-z0-9-]+\.html)<\/loc>/g)].map(m => m[1].replace(/^https:\/\/[^/]+/, SITE));
console.log('Trang căn trên web:', urls.length);
const archive = {};
let done = 0;
async function grab(u) {
  try {
    const h = await (await fetch(u)).text();
    const ldm = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!ldm) return;
    const g = JSON.parse(ldm[1])['@graph'];
    const listing = g.find(x => x['@type'] === 'RealEstateListing');
    if (!listing) return;
    const ma = u.split('/').pop().replace('.html', '').toUpperCase();
    // caption: các <p> trong phần "Đôi nét về căn này"
    let cap = '';
    const capm = h.match(/Đôi nét về căn này<\/h2>\n([\s\S]*?)(<p>Xem thêm|<\/article>|<div class)/);
    if (capm) cap = [...capm[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => m[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")).join('\n');
    archive[ma] = { anh: listing.image || [], cap, up: Math.floor(new Date(listing.dateModified).getTime() / 1000) };
    done++;
  } catch (e) { /* bỏ trang lỗi */ }
}
for (let i = 0; i < urls.length; i += 25) {
  await Promise.all(urls.slice(i, i + 25).map(grab));
  process.stdout.write(`\r${Math.min(i + 25, urls.length)}/${urls.length}`);
}
mkdirSync('data', { recursive: true });
writeFileSync('data/archive.json', JSON.stringify(archive));
console.log(`\n✓ Lưu ${done} căn vào data/archive.json`);
