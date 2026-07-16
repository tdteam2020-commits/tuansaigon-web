// QUÉT DỌN SELFIE trong data/archive.json bằng máy lọc vision của GAS (?action=locurls).
// Chạy: node sweep.mjs — có con trỏ resume (data/sweep-done.json), ngắt giữa chừng chạy lại không tốn tiền lọc lại.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const ARC = 'data/archive.json', DONE = 'data/sweep-done.json';
const arc = JSON.parse(readFileSync(ARC, 'utf8'));
const done = existsSync(DONE) ? JSON.parse(readFileSync(DONE, 'utf8')) : {};
const mas = Object.keys(arc).filter(m => !done[m] && arc[m].anh && arc[m].anh.length);
console.log(`Cần lọc ${mas.length}/${Object.keys(arc).length} căn`);
let go = 0, cut = 0;
for (const ma of mas) {
  try {
    const u = encodeURIComponent(arc[ma].anh.join(','));
    const r = await fetch(`${GAS}?action=locurls&key=${process.env.WEB_KEY || ''}&u=${u}`, { redirect: 'follow', signal: AbortSignal.timeout(90000) });
    const o = await r.json();
    if (!o.ok) throw new Error(o.error || 'loi');
    if (JSON.stringify(o.giu) !== JSON.stringify(arc[ma].anh)) {   // khác cả khi chỉ ĐỔI THỨ TỰ (ảnh bìa mới lên đầu)
      const bo = arc[ma].anh.length - o.giu.length;
      console.log(`✂ ${ma}: ${bo > 0 ? `bỏ ${bo} ảnh xấu/người/giấy tờ` : 'đổi ảnh bìa đẹp hơn'}`);
      arc[ma].anh = o.giu; cut++;
    }
    done[ma] = 1; go++;
    if (go % 10 === 0) { writeFileSync(ARC, JSON.stringify(arc)); writeFileSync(DONE, JSON.stringify(done)); process.stdout.write(`\r${go}/${mas.length}`); }
    await new Promise(x => setTimeout(x, 800));
  } catch (e) { console.log(`\n⚠ ${ma}: ${String(e).slice(0, 80)} — thử lại lượt sau`); await new Promise(x => setTimeout(x, 3000)); }
}
writeFileSync(ARC, JSON.stringify(arc)); writeFileSync(DONE, JSON.stringify(done));
console.log(`\n✓ Xong: lọc ${go} căn, cắt ảnh ở ${cut} căn`);
