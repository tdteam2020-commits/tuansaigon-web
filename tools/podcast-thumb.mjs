#!/usr/bin/env node
// Lấy ẢNH BÌA PODCAST từ chính file mp4 gốc -> đưa lên R2 -> in map dán vào bảng PODCAST trong build.mjs.
//
// VÌ SAO KHÔNG LẤY THUMBNAIL CỦA YOUTUBE: podcast quay DỌC 1080×1920, còn YouTube chỉ trả ảnh 16:9
// -> video bị nhét vào giữa, hở hai bên đen thui. Cắt từ file gốc thì đúng khổ dọc, nét hơn.
// Mốc 2 giây là lúc THẺ TIÊU ĐỀ TẬP hiện ra (pipeline dựng tập nào cũng vậy) — làm bìa rất hợp.
//
// Chạy:  node tools/podcast-thumb.mjs           (tất cả tập tìm được)
//        node tools/podcast-thumb.mjs 9 10      (chỉ vài tập)
import { putAnh } from './r2put.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const KHO = join(homedir(), 'My Projects', 'Claude Code BĐS', 'podcast-pipeline', 'xuat');
const GIAY = 2;          // mốc cắt hình
const RONG = 540;        // 540×960 — đủ nét cho khung ~330px trên web, nhẹ ~50KB
const TMP = mkdtempSync(join(tmpdir(), 'podthumb-'));

const chon = process.argv.slice(2);
const tep = readdirSync(KHO).filter(f => /^PODCAST-Tap(\d+)-.*\.mp4$/.test(f))
  .map(f => ({ ep: +f.match(/^PODCAST-Tap(\d+)/)[1], f }))
  .filter(x => !chon.length || chon.includes(String(x.ep)))
  .sort((a, b) => a.ep - b.ep);
if (!tep.length) { console.error('Không thấy file podcast nào trong ' + KHO); process.exit(1); }

const ra = {};
for (const { ep, f } of tep) {
  const anh = join(TMP, `tap${ep}.jpg`);
  try {
    execFileSync('/opt/homebrew/bin/ffmpeg', ['-v', 'error', '-ss', String(GIAY), '-i', join(KHO, f),
      '-frames:v', '1', '-vf', `scale=${RONG}:-2`, '-q:v', '4', anh, '-y'], { stdio: 'ignore' });
  } catch (e) { console.error(`⚠ tập ${ep}: cắt hình lỗi — ${String(e).slice(0, 80)}`); continue; }
  const buf = readFileSync(anh);
  if (buf.length < 3000) { console.error(`⚠ tập ${ep}: ảnh rỗng, bỏ qua`); continue; }
  ra[ep] = await putAnh(buf);
  console.log(`tập ${ep}: ${Math.round(buf.length / 1024)} KB  ${ra[ep]}`);
}
console.log('\n--- dán vào bảng PODCAST trong build.mjs ---');
console.log(JSON.stringify(ra, null, 2));
