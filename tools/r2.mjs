// Cloudflare R2 — bộ ký AWS SigV4 tối giản (không cần aws-cli / SDK, chỉ dùng crypto có sẵn của Node).
// Nạp khoá: source ~/.config/claude-bds/r2.env  (KHÔNG hardcode khoá vào file này — file này nằm trong git).
import { createHash, createHmac } from 'node:crypto';

export const CFG = {
  account: process.env.R2_ACCOUNT_ID,
  endpoint: process.env.R2_ENDPOINT,
  key: process.env.R2_ACCESS_KEY_ID,
  secret: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET || 'tuansaigon-anh',
};
if (!CFG.key || !CFG.secret || !CFG.endpoint) {
  console.error('❌ Thiếu khoá R2 — chạy: source ~/.config/claude-bds/r2.env && export R2_ACCOUNT_ID R2_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET');
  process.exit(1);
}

const sha256 = b => createHash('sha256').update(b).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
// R2 dùng region cố định 'auto'
const REGION = 'auto', SERVICE = 's3';

// Mã hoá theo RFC3986 — AWS đòi ĐÚNG kiểu này. KHÔNG dùng URLSearchParams.toString():
// nó mã hoá kiểu form (dấu + = khoảng trắng), mà continuation-token là base64 CÓ dấu '+' và '='
// -> chữ ký lệch -> 403 SignatureDoesNotMatch ở trang thứ 2 trở đi (dính thật 16/07, list 26k ảnh mới lòi ra).
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const canonQuery = q => Object.keys(q).sort().map(k => `${enc(k)}=${enc(q[k])}`).join('&');

/* Ký 1 request theo SigV4. path = đường dẫn KHÔNG query; query = object. body = Buffer|string|'' */
export function sign(method, path, query = {}, body = '', extraHeaders = {}) {
  const qs = canonQuery(query);
  const url = new URL(CFG.endpoint + path + (qs ? '?' + qs : ''));
  const host = url.host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');   // 20260716T060000Z
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);

  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...extraHeaders };
  const signedKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const canonHeaders = signedKeys.map(k => {
    const real = Object.keys(headers).find(h => h.toLowerCase() === k);
    return `${k}:${String(headers[real]).trim()}\n`;
  }).join('');
  const signedHeaders = signedKeys.join(';');

  const canonReq = [method, url.pathname, qs, canonHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonReq)].join('\n');

  let k = hmac('AWS4' + CFG.secret, dateStamp);
  k = hmac(k, REGION); k = hmac(k, SERVICE); k = hmac(k, 'aws4_request');
  const sig = createHmac('sha256', k).update(toSign).digest('hex');

  headers.Authorization = `AWS4-HMAC-SHA256 Credential=${CFG.key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;
  return { url: url.toString(), headers };
}

export async function r2(method, path, query = {}, body = '', extraHeaders = {}) {
  const { url, headers } = sign(method, path, query, body, extraHeaders);
  return fetch(url, { method, headers, body: body || undefined });
}

/* Đẩy 1 object. key = đường dẫn trong bucket (vd 'a/abc.jpg') */
export async function put(key, buf, type = 'image/jpeg') {
  const r = await r2('PUT', `/${CFG.bucket}/${key}`, {}, buf, { 'content-type': type });
  if (!r.ok) throw new Error(`PUT ${key} -> ${r.status} ${(await r.text()).slice(0, 120)}`);
  return true;
}

/* Xoá 1 object */
export async function del(key) {
  const r = await r2('DELETE', `/${CFG.bucket}/${key}`);
  return r.ok || r.status === 204;
}

/* Liệt kê object (trả mảng tên). Tự phân trang qua continuation-token (base64 -> phải ký RFC3986, xem `enc`). */
export async function list(prefix = '') {
  const out = []; let token = '';
  for (;;) {
    const q = { 'list-type': '2', 'max-keys': '1000' };
    if (prefix) q.prefix = prefix;
    if (token) q['continuation-token'] = token;
    const r = await r2('GET', `/${CFG.bucket}`, q);
    if (!r.ok) throw new Error(`LIST -> ${r.status} ${(await r.text()).slice(0, 120)}`);
    const xml = await r.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) out.push(m[1]);
    const t = xml.match(/<NextContinuationToken>([^<]+)</);
    if (!t) break;
    token = t[1];
  }
  return out;
}
