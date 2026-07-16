// KHO DỮ LIỆU WEB TRÊN R2 (16/07) — đưa data/*.json RA KHỎI repo public.
//
// VÌ SAO: repo tuansaigon-web là PUBLIC (GitHub bắt public mới cho Pages free) -> ai cũng `git clone` là có
// trọn listings.json (12.8k căn) + archive.json (12.4k bài Đôi nét) dạng JSON sạch trong 30 giây.
// Dữ liệu vốn hiện trên web, nhưng khác nhau ở CÔNG SỨC: clone 30s vs cào 13k trang.
// -> Cất data ở bucket R2 RIÊNG `tuansaigon-data` (KHÔNG gắn custom domain -> không có URL công khai,
//    phải có khoá mới đọc). Bucket ảnh `tuansaigon-anh` thì CÓ domain -> TUYỆT ĐỐI không để data chung đó.
//
// Dùng: node tools/data-r2.mjs pull    (tải data về trước khi build)
//       node tools/data-r2.mjs push    (đẩy data lên sau khi build)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { r2 } from './r2.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));   // website/
const DATA = join(ROOT, 'data');
const BUCKET = 'tuansaigon-data';
// archive = slug + Đôi nét (MẤT LÀ ĐAU NHẤT: slug chốt 1 lần, Đôi nét tốn ~1h Gemini viết lại)
// listings = cache weblist (lưới chống web rỗng dựa vào nó) · anh-map = URL gốc -> tên file R2
const FILES = ['archive.json', 'listings.json', 'anh-map.json', 'doinet-done.json', 'sweep-done.json'];
const lenh = process.argv[2];

async function pull() {
  mkdirSync(DATA, { recursive: true });
  for (const f of FILES) {
    const r = await r2('GET', `/${BUCKET}/${f}`);
    if (r.status === 404) { console.log(`  ${f}: chưa có trên R2 (bỏ qua)`); continue; }
    if (!r.ok) { console.log(`  ${f}: LỖI ${r.status}`); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(join(DATA, f), buf);
    console.log(`  ↓ ${f} — ${(buf.length / 1048576).toFixed(1)}MB`);
  }
}

async function push() {
  for (const f of FILES) {
    const p = join(DATA, f);
    if (!existsSync(p)) continue;
    const buf = readFileSync(p);
    // LƯỚI: đừng bao giờ đẩy file rỗng/hỏng đè bản tốt trên R2 (bài học 14/07 "đừng xoá kho khi crawl lỗi")
    try { const o = JSON.parse(buf); if (!o || (Array.isArray(o) ? !o.length : !Object.keys(o).length)) { console.log(`  ⚠ ${f} RỖNG — KHÔNG đẩy, giữ bản cũ trên R2`); continue; } }
    catch (e) { console.log(`  ⚠ ${f} hỏng JSON — KHÔNG đẩy`); continue; }
    const r = await r2('PUT', `/${BUCKET}/${f}`, {}, buf, { 'content-type': 'application/json' });
    console.log(r.ok ? `  ↑ ${f} — ${(buf.length / 1048576).toFixed(1)}MB` : `  ✗ ${f} LỖI ${r.status}`);
  }
}

if (lenh === 'pull') await pull();
else if (lenh === 'push') await push();
else { console.error('Dùng: node tools/data-r2.mjs pull|push'); process.exit(1); }
