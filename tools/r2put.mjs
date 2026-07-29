// UPLOAD ẢNH LÊN R2 — thay Cloudinary (27/07: Cloudinary free vượt quota, doạ khoá 1/8).
// Tự nạp khoá từ ~/.config/claude-bds/r2.env nên tool gọi KHÔNG cần source trước.
// Tên file = sha1(nội dung) -> ảnh trùng không tốn chỗ 2 lần, chạy lại an toàn.
//   putAnh(buf)  -> https://anh.tuansaigon.com/a/<sha1>.jpg    (ảnh nhà — chung kho web)
//   putSo(buf)   -> https://anh.tuansaigon.com/so/<sha1>.jpg   (ảnh SỔ — chỉ bot dùng, KHÔNG bao giờ đưa vào build web)
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

// nạp env R2 nếu thiếu
const ENV_FILE = homedir() + '/.config/claude-bds/r2.env';
if (!process.env.R2_ACCESS_KEY_ID && existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*export\s+([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const { put } = await import('./r2.mjs');
const PUBLIC = process.env.R2_PUBLIC || 'https://anh.tuansaigon.com';

async function up(buf, prefix) {
  const name = createHash('sha1').update(buf).digest('hex') + '.jpg';
  await put(`${prefix}/${name}`, buf, 'image/jpeg');   // throw nếu lỗi
  return `${PUBLIC}/${prefix}/${name}`;
}
export const putAnh = buf => up(buf, 'a');
export const putSo  = buf => up(buf, 'so');

// File JSON tạm (payload lớn đẩy sang GAS: GAS GET trần ~5KB, POST bị Google cache -> up file rồi báo URL)
export async function putRaw(obj, name) {
  const body = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));
  const key = 'tmp/' + (name || createHash('sha1').update(body).digest('hex').slice(0, 16) + '.json');
  await put(key, body, 'application/json');
  return `${PUBLIC}/${key}`;
}
