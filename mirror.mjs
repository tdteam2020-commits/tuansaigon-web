// KHO ẢNH TỰ CHỦ v3 — CLOUDFLARE R2 (Tuấn chốt 16/07). Thay hẳn cách chia ngăn GitHub Pages.
//
// VÌ SAO BỎ GITHUB PAGES: trần 1GB/repo → kho ~7GB phải cắt 8 repo = lách trần; điều khoản Pages ghi rõ
// KHÔNG dùng làm CDN → GitHub siết là ảnh TOÀN WEB chết cùng lúc; mỗi lượt còn phải push ~900MB (>10 phút).
// R2: 10GB free · BĂNG THÔNG RA MIỄN PHÍ vĩnh viễn · 1 kho duy nhất · upload thẳng, không git.
//
// anh-map.json GIỮ NGUYÊN định dạng cũ ("abc.jpg" hoặc "2|abc.jpg") để bản cũ (tools/mirror-github-cu.mjs)
// vẫn chạy được nếu phải quay về. Từ nay ghi entry mới KHÔNG kèm số ngăn.
// Tên file = sha1(URL gốc) → duy nhất, đổi kho không đổi tên.
//
// Khoá: source ~/.config/claude-bds/r2.env
// Chạy: node mirror.mjs [--no-prune]     (--no-prune = không dọn ảnh thừa trên R2)
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { put, list, del } from './tools/r2.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const TMP = join(ROOT, '.anh-tmp');            // chỗ tạm cho sips, tự dọn
const MAPF = join(ROOT, 'data', 'anh-map.json');
const arc = JSON.parse(readFileSync(join(ROOT, 'data', 'archive.json'), 'utf8'));
let map = {}; try { map = JSON.parse(readFileSync(MAPF, 'utf8')); } catch (e) {}
mkdirSync(TMP, { recursive: true });

const ten = u => createHash('sha1').update(u).digest('hex').slice(0, 16) + '.jpg';
const tenFile = v => { const i = String(v).indexOf('|'); return i < 0 ? String(v) : String(v).slice(i + 1); };   // bỏ số ngăn đời cũ

// 1. URL cần có (mọi căn còn trong archive = đang/sắp trên web)
const can = new Map();
for (const m of Object.keys(arc)) for (const u of (arc[m].anh || [])) if (/^https?:\/\//.test(u)) can.set(u, ten(u));

// 2. R2 đang có gì
const coR2 = new Set((await list('a/')).map(k => k.slice(2)));
console.log(`Cần ${can.size} ảnh · R2 đang có ${coR2.size}`);

// 3. ảnh đã nằm trên R2 rồi thì nhận map luôn (khỏi tải lại)
for (const [u, f] of can.entries()) if (!map[u] && coR2.has(f)) map[u] = f;

const hang = [...can.entries()].filter(([u, f]) => !coR2.has(tenFile(map[u] || f)));
console.log(`Phải tải mới: ${hang.length}`);

let tai = 0, loi = 0, bo = 0;
const worker = async (loat) => {
  for (const [u, f] of loat) {
    const tmp = join(TMP, f + '.tmp'), out = join(TMP, f);
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) { loi++; continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 5000) { bo++; continue; }   // quá bé = ảnh hỏng, lần sau tải lại
      writeFileSync(tmp, buf);
      // ép về tối đa 1000px + JPEG q65 — vừa nhẹ vừa đủ nét cho web
      execFileSync('sips', ['-Z', '1000', '-s', 'format', 'jpeg', '-s', 'formatOptions', '65', tmp, '--out', out], { stdio: 'ignore' });
      await put(`a/${f}`, readFileSync(out));
      map[u] = f; tai++;
      if (tai % 100 === 0) { writeFileSync(MAPF, JSON.stringify(map)); process.stdout.write(`\r${tai}/${hang.length}`); }
    } catch (e) { loi++; }
    finally { for (const p of [tmp, out]) { try { unlinkSync(p); } catch (e2) {} } }
  }
};
const N = 8, loat = Array.from({ length: N }, () => []);
hang.forEach((x, i) => loat[i % N].push(x));
await Promise.all(loat.map(worker));

// 4. DỌN: xoá ảnh trên R2 không còn căn nào dùng
let don = 0;
if (!process.argv.includes('--no-prune')) {
  const dungDen = new Set([...can.entries()].map(([u, f]) => tenFile(map[u] || f)));
  for (const f of coR2) {
    if (dungDen.has(f)) continue;
    try { await del(`a/${f}`); don++; } catch (e) {}
  }
  for (const u of Object.keys(map)) if (!can.has(u)) delete map[u];
}
writeFileSync(MAPF, JSON.stringify(map));
console.log(`\n✓ tải mới ${tai} · lỗi ${loi} · bỏ ${bo} · dọn ${don} · R2 giờ có ${coR2.size + tai - don} ảnh`);
console.log('>> Ảnh serve từ https://anh.tuansaigon.com/a/ — KHÔNG cần push git, không cần chia ngăn.');
