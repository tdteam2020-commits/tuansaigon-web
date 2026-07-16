// ĐẨY KHO ẢNH LÊN R2 (16/07) — chuyển ảnh từ 5 ngăn GitHub (tuansaigon-anh*) lên Cloudflare R2.
// Vì sao bỏ GitHub Pages: Pages có trần 1GB/repo + ĐIỀU KHOẢN CẤM dùng làm CDN; kho ~7GB phải cắt 8 repo
// = lách trần, mỗi lượt push 900MB, và nếu GitHub siết thì ẢNH TOÀN WEB chết cùng lúc.
// R2: 10GB free, BĂNG THÔNG RA MIỄN PHÍ vĩnh viễn, 1 bucket, đúng mục đích.
//
// Chạy: source ~/.config/claude-bds/r2.env && node tools/r2-push.mjs [luồng]
// An toàn: chỉ ĐỌC các ngăn GitHub, không xoá gì. Chạy lại được — file đã có trên R2 thì bỏ qua.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { put, list, CFG } from './r2.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));   // website/
const NGAN = [0, 1, 2, 3, 4].map(i => join(ROOT, '..', i ? `tuansaigon-anh-${i}` : 'tuansaigon-anh', 'a'));
const POOL = parseInt(process.argv[2] || '10', 10);
const now = () => new Date().toLocaleTimeString('vi-VN');
const log = (...a) => console.log(`[${now()}]`, ...a);

// 1. gom file từ mọi ngăn (tên file = sha1 của URL gốc -> DUY NHẤT, ngăn nào cũng như nhau)
const files = new Map();   // ten -> đường dẫn đầy đủ
for (const d of NGAN) {
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d)) if (f.endsWith('.jpg') && !files.has(f)) files.set(f, join(d, f));
}
log(`Kho local: ${files.size.toLocaleString()} ảnh (gom từ ${NGAN.length} ngăn)`);

// 2. hỏi R2 xem đã có gì (chạy lại thì bỏ qua file cũ)
log('Đang hỏi R2 xem đã có ảnh nào...');
const daCo = new Set((await list('a/')).map(k => k.slice(2)));
log(`R2 đã có: ${daCo.size.toLocaleString()} ảnh`);

const canDay = [...files.keys()].filter(f => !daCo.has(f));
if (!canDay.length) { log('✅ R2 đã đủ ảnh, không cần đẩy gì.'); process.exit(0); }
const tongMB = canDay.reduce((s, f) => { try { return s + readFileSync(files.get(f)).length; } catch (e) { return s; } }, 0) / 1048576;
log(`Cần đẩy: ${canDay.length.toLocaleString()} ảnh (~${tongMB.toFixed(0)}MB) · ${POOL} luồng`);

// 3. đẩy
let ok = 0, loi = 0;
const t0 = Date.now();
async function worker(danh) {
  for (const f of danh) {
    try { await put(`a/${f}`, readFileSync(files.get(f))); ok++; }
    catch (e) { loi++; if (loi <= 3) log('lỗi:', f, String(e.message).slice(0, 80)); }
    if ((ok + loi) % 500 === 0) {
      const gio = (Date.now() - t0) / 1000;
      const conLai = ((canDay.length - ok - loi) * (gio / (ok + loi)) / 60).toFixed(1);
      log(`${(ok + loi).toLocaleString()}/${canDay.length.toLocaleString()} · lỗi ${loi} · còn ~${conLai} phút`);
    }
  }
}
const phan = Array.from({ length: POOL }, (_, i) => canDay.filter((_, j) => j % POOL === i));
await Promise.all(phan.map(worker));
const dt = (Date.now() - t0) / 1000;
log(`✅ XONG: ${ok.toLocaleString()} ảnh lên R2 · ${loi} lỗi · ${(dt / 60).toFixed(1)} phút`);
log(`>> Bước tiếp: gắn anh.tuansaigon.com vào bucket ${CFG.bucket}, đổi NGAN_URL trong build.mjs, build + deploy.`);
