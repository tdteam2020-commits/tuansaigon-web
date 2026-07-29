// NGƯỜI GÁC PHIÊN T123 (Tuấn chốt 27/07) — acc riêng bot 0777088622.
// Cách Tuấn làm việc: Tuấn cần xem T123 thì tự login (bot bị đá) → xem xong Tuấn OUT → gác này login lại cho bot.
// Mỗi 15 phút: thử feed bằng token đang giữ → chết thì login lại → nạp GAS → báo Telegram.
// GAS KHÔNG tự login được (device-check chặn IP Google) nên phải chạy từ máy Tuấn.
//
// Chạy nền:  node tools/t123-login-watch.mjs &
// Chạy 1 lượt rồi thoát (kiểm tay): node tools/t123-login-watch.mjs once
// Dừng:      pkill -f t123-login-watch
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const KEY = (() => {   // 29/07: KHÔNG hardcode khoá (khoá cũ từng nằm CÔNG KHAI trong repo GitHub)
  const _f = homedir() + '/.config/claude-bds/gas.env';
  try { return (readFileSync(_f, 'utf8').match(/GAS_KEY[^"]*"([^"]+)"/) || [])[1].trim(); }
  catch (e) { console.error('Thieu khoa - tao ' + _f + ' voi dong: GAS_KEY="..."'); process.exit(1); }
})();
const API = 'https://api-dtk.thangbk.com';
const USER = '0777088622', PASS = 'minhhanh';
const TKFILE = '/tmp/t123_bot.jwt';
const PHUT = 15;
const ONCE = process.argv[2] === 'once';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36';
const H = { 'Content-Type': 'application/json', 'x-api-version': 'v2', 'User-Agent': UA,
            'Origin': 'https://tuan123.daitheky.net', 'Referer': 'https://tuan123.daitheky.net/' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('vi-VN');
const log = (...a) => console.log(`[${now()}]`, ...a);
const bao = async t => { try { await fetch(`${GAS}?action=notify&key=${KEY}&t=${encodeURIComponent(t)}`); } catch (e) {} };

async function tokenSong(tk) {
  if (!tk) return false;
  try {
    const r = await fetch(`${API}/bi-kip-tong/search`, { method: 'POST', headers: { ...H, Authorization: 'Bearer ' + tk },
      body: JSON.stringify({ offset: 0, size: 1 }), signal: AbortSignal.timeout(25000) });
    const j = await r.json();
    return j.success === true && (((j.detail || {}).data || []).length > 0);
  } catch (e) { return null; }   // null = không kết luận (mạng lỗi) -> KHÔNG login oan
}

async function login() {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: H,
    body: JSON.stringify({ username: USER, password: PASS }), signal: AbortSignal.timeout(30000) });
  const j = await r.json();
  const tk = (j.data || {}).access_token || '';
  if (!tk) throw new Error(String(j.message || 'login fail').slice(0, 120));
  return tk;
}

async function mot_luot() {
  let tk = existsSync(TKFILE) ? readFileSync(TKFILE, 'utf8').trim() : '';
  const song = await tokenSong(tk);
  if (song === true) { log('phiên bot còn sống ✅'); return; }
  if (song === null) { log('mạng chập chờn — bỏ lượt này, không login oan'); return; }
  log('phiên bot đã mất (Tuấn đang xem hoặc vừa xem xong) — thử đăng nhập lại...');
  try {
    tk = await login();
    writeFileSync(TKFILE, tk);
    const d = await (await fetch(`${GAS}?action=t123token&t=${encodeURIComponent(tk)}`)).json();
    if (d.ok) { log('✅ ĐÃ LOGIN LẠI + nạp token vào hệ'); await bao('✅ T123: bot đã tự đăng nhập lại (Tuấn out xong) — kho + ảnh hoạt động bình thường.'); }
    else log('⚠️ login được nhưng nạp GAS lỗi:', JSON.stringify(d).slice(0, 100));
  } catch (e) {
    const m = String(e.message || e);
    if (/thiết bị/i.test(m)) log('⏳ Tuấn ĐANG đăng nhập — chờ 15 phút thử lại (không đá Tuấn ra)');
    else log('⚠️ login lỗi:', m.slice(0, 100));
  }
}

if (ONCE) { await mot_luot(); process.exit(0); }
log(`gác phiên T123 mỗi ${PHUT} phút · acc bot ${USER} · dừng: pkill -f t123-login-watch`);
for (;;) { await mot_luot(); await sleep(PHUT * 60000); }
