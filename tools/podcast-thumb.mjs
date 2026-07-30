#!/usr/bin/env node
// Tải ảnh bìa podcast từ YouTube -> đưa lên R2 (kho ảnh của Tuấn) -> in ra map cho build.mjs.
// Tự host ảnh bìa để trang KHÔNG phải gọi sang máy chủ Google khi mở (nhanh hơn + không lộ người xem).
// Chạy: node tools/podcast-thumb.mjs
import { putAnh } from './r2put.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// YouTube trả bản 1280×720 ~65KB — trang chỉ hiện rộng ~760px nên nén về 800px cho nhẹ máy khách.
// Dùng `sips` (có sẵn trong macOS, khỏi cài thêm gì). Nén lỗi thì dùng ảnh gốc.
const TMP = mkdtempSync(join(tmpdir(), 'podthumb-'));
function nen(buf, ep) {
  try {
    const vao = join(TMP, `${ep}.jpg`), ra = join(TMP, `${ep}-nho.jpg`);
    writeFileSync(vao, buf);
    execFileSync('/usr/bin/sips', ['-Z', '800', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', vao, '--out', ra], { stdio: 'ignore' });
    const b2 = readFileSync(ra);
    return b2.length > 2000 && b2.length < buf.length ? b2 : buf;
  } catch (e) { return buf; }
}

const TAP = JSON.parse(process.argv[2] || '{}');
if (!Object.keys(TAP).length) { console.error('Cần truyền JSON {ep: ytId}'); process.exit(1); }

const ra = {};
for (const [ep, yt] of Object.entries(TAP)) {
  let buf = null;
  for (const ten of ['maxresdefault', 'sddefault', 'hqdefault']) {
    const r = await fetch(`https://i.ytimg.com/vi/${yt}/${ten}.jpg`);
    if (!r.ok) continue;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length < 3000) continue;          // YouTube trả ảnh xám 120x90 khi không có bản đó
    buf = b; console.log(`tập ${ep}: ${ten} — ${Math.round(b.length / 1024)} KB`); break;
  }
  if (!buf) { console.error(`⚠ tập ${ep} (${yt}): KHÔNG tải được ảnh bìa`); continue; }
  const nho = nen(buf, ep);
  console.log(`   nén: ${Math.round(buf.length / 1024)} KB -> ${Math.round(nho.length / 1024)} KB`);
  ra[ep] = await putAnh(nho);
}
console.log('\n--- map cho build.mjs ---');
console.log(JSON.stringify(ra, null, 2));
