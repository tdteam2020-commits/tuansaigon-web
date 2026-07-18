// KHO ẢNH TỰ CHỦ v2 — CHIA NGĂN (Tuấn chốt 13/07: 1 repo GitHub Pages trần 1GB, web bung 8k căn cần ~4GB).
// Ngăn 0 = ../tuansaigon-anh (kho gốc, file cũ Ở YÊN — URL sống). Ngăn 1..3 = ../tuansaigon-anh-<i>.
// anh-map.json: giá trị "abc.jpg" (đời cũ = ngăn 0) hoặc "2|abc.jpg" (ngăn 2). File MỚI rót vào ngăn còn chỗ (<900MB).
// CHỈ phục vụ website — auto post/video vẫn dùng ảnh gốc. Chạy: node mirror.mjs [--no-prune]
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = dirname(fileURLToPath(import.meta.url));
// Ngăn 4 thêm 15/07 (Tuấn duyệt) — ngăn 0/1/2 đã đầy 901MB, ngăn 3 sắp đầy. Repo + Pages đã bật sẵn.
const NGAN = [0, 1, 2, 3, 4].map(i => join(ROOT, '..', i ? `tuansaigon-anh-${i}` : 'tuansaigon-anh', 'a'));
const TRAN = 900 * 1048576;   // rót ngăn tới ~900MB (trần Pages 1GB)
const MAPF = join(ROOT, 'data', 'anh-map.json');
const arc = JSON.parse(readFileSync(join(ROOT, 'data', 'archive.json'), 'utf8'));
let map = {}; try { map = JSON.parse(readFileSync(MAPF, 'utf8')); } catch (e) {}
const ten = u => createHash('sha1').update(u).digest('hex').slice(0, 16) + '.jpg';
const tach = v => { const i = String(v).indexOf('|'); return i < 0 ? [0, v] : [+v.slice(0, i), v.slice(i + 1)]; };
const sizeOf = d => { try { return readdirSync(d).reduce((s, f) => s + (f.endsWith('.jpg') ? statSync(join(d, f)).size : 0), 0); } catch (e) { return 0; } };
const nganSize = NGAN.map(sizeOf);
let nganMo = nganSize.findIndex(s => s < TRAN);
// Hết ngăn: tạo repo mới (gh repo create tdteam2020-commits/tuansaigon-anh-N --public), thêm .nojekyll + thư mục a/,
// bật Pages (gh api -X POST repos/.../pages -f "source[branch]=main" -f "source[path]=/"), rồi thêm N vào mảng NGAN trên.
// build.mjs KHÔNG cần sửa (NGAN_URL tự sinh theo số ngăn).
if (nganMo < 0) { console.log('⚠ MỌI NGĂN ĐẦY — tạo repo tuansaigon-anh-' + NGAN.length + ' rồi thêm vào mảng NGAN (xem chú thích ngay trên)'); process.exit(1); }

// danh sách URL cần có (mọi căn còn trong archive = đang/sắp trên web)
const can = new Map();
for (const m of Object.keys(arc)) for (const u of (arc[m].anh || [])) if (/^https?:\/\//.test(u)) can.set(u, ten(u));
console.log(`Cần ${can.size} ảnh · ngăn hiện có: ${NGAN.map((d, i) => `${i}:${existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.jpg')).length : 0}`).join(' ')} · rót vào ngăn ${nganMo}`);

// file đã có ở ngăn nào thì nhận map ở đó
for (const [u, f] of can.entries()) {
  if (map[u]) continue;
  for (let i = 0; i < NGAN.length; i++) if (existsSync(join(NGAN[i], f))) { map[u] = i ? `${i}|${f}` : f; break; }
}
const hang = [...can.entries()].filter(([u]) => !map[u]);
console.log(`Phải tải mới: ${hang.length}`);
let tai = 0, loi = 0, bo = 0, themVao = 0;
const worker = async (loat) => {
  for (const [u, f] of loat) {
    if (nganMo < 0) break;
    const KHO = NGAN[nganMo], tmp = join(KHO, f + '.tmp');
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) { loi++; continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 5000 || buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) {   // JPEG cụt (thiếu FFD9) = ảnh xám — bỏ, lần sau tải lại
        if (buf.length < 5000) { bo++; continue; } // quá bé chắc chắn hỏng
      }
      writeFileSync(tmp, buf);
      execFileSync('sips', ['-Z', '1000', '-s', 'format', 'jpeg', '-s', 'formatOptions', '65', tmp, '--out', join(KHO, f)], { stdio: 'ignore' });
      unlinkSync(tmp);
      map[u] = nganMo ? `${nganMo}|${f}` : f; tai++; themVao += statSync(join(KHO, f)).size;
      if (nganSize[nganMo] + themVao > TRAN) {   // ngăn đầy giữa chừng -> chuyển ngăn kế
        nganMo = nganSize.findIndex((s, i) => i > nganMo && s < TRAN); themVao = 0;
        if (nganMo < 0) console.log('\n⚠ hết chỗ — dừng tải, cần thêm repo ngăn 4');
      }
      if (tai % 100 === 0) { writeFileSync(MAPF, JSON.stringify(map)); process.stdout.write(`\r${tai}/${hang.length}`); }
    } catch (e) { loi++; try { unlinkSync(tmp); } catch (e2) {} }
  }
};
const N = 6, loat = Array.from({ length: N }, () => []);
hang.forEach((x, i) => loat[i % N].push(x));
await Promise.all(loat.map(worker));
// PRUNE: dọn file không còn căn nào dùng (mọi ngăn)
let don = 0;
if (!process.argv.includes('--no-prune')) {
  const dungDen = new Set([...can.entries()].map(([u]) => map[u]).filter(Boolean).map(v => tach(v).join('|')));
  NGAN.forEach((d, i) => { if (!existsSync(d)) return;
    for (const f of readdirSync(d)) if (f.endsWith('.jpg') && !dungDen.has(`${i}|${f}`)) { unlinkSync(join(d, f)); don++; }
  });
  for (const u of Object.keys(map)) if (!can.has(u)) delete map[u];
}
writeFileSync(MAPF, JSON.stringify(map));
console.log(`\n✓ tải mới ${tai} · lỗi ${loi} · bỏ ${bo} · dọn ${don} · dung lượng ngăn: ${NGAN.map((d, i) => i + ':' + Math.round(sizeOf(d) / 1048576) + 'MB').join(' ')}`);
