// Đẩy 1 file podcast lên R2 (path podcast/<ten>) -> in link công khai. Dùng cho luồng đăng YouTube/FB theo lệnh.
// Chạy: source ~/.config/claude-bds/r2.env && node tools/podcast-r2-up.mjs <đường-dẫn-mp4> [tên-key]
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { put, CFG } from './r2.mjs';

const src = process.argv[2];
if (!src) { console.error('Thiếu đường dẫn mp4'); process.exit(1); }
const key = 'podcast/' + (process.argv[3] || basename(src));
const buf = readFileSync(src);
await put(key, buf, 'video/mp4');   // trả true hoặc throw
console.log('OK ' + (buf.length / 1048576).toFixed(1) + 'MB');
console.log('URL https://anh.tuansaigon.com/' + key);
