// T123 LOCAL-PULL ẢNH (Tuấn 14/07): CDN ảnh T123 chặn IP Google/GAS sau ~60 lượt tải.
// Máy LOCAL (IP thường) tải ảnh + lọc người/chọn bìa bằng Gemini → đẩy URL đã lọc về GAS ghi cột 13 kho.
// GAS chỉ trả URL ảnh GỐC (API detail chạy OK từ GAS). Chạy: node tools/t123-pull.mjs [số luồng]
// Cần: ~/.config/claude-bds/gemini.env (GEMINI_KEY) + kho T123 phải có token sống (login local + t123token).
import { readFileSync } from 'node:fs';
const KEY = process.env.GEMINI_KEY;
if (!KEY) { console.log('Thiếu GEMINI_KEY — source ~/.config/claude-bds/gemini.env && export GEMINI_KEY'); process.exit(1); }
const WEB_KEY = process.env.WEB_KEY || 'TSGWEB';
const EXEC = (readFileSync('build.mjs', 'utf8').match(/https:\/\/script\.google\.com\/[^"'` ]*exec/) || [])[0];
if (!EXEC) { console.log('không tìm thấy URL GAS'); process.exit(1); }
const GEM = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';
const N = parseInt(process.argv[2], 10) || 5;

const PROMPT = 'Đây là album ảnh rao bán nhà. Chấm từng ảnh, trả về DUY NHẤT JSON: {"bo":[2,5],"bia":3}, không giải thích. "bo" = số thứ tự các ảnh CHỈ khi CON NGƯỜI là CHỦ THỂ CHÍNH: selfie, chân dung, chụp cố ý một/vài người làm trung tâm (mặt/thân chiếm phần lớn khung, kể cả qua gương). TUYỆT ĐỐI KHÔNG loại ảnh chụp NHÀ/MẶT TIỀN/ĐƯỜNG PHỐ/NỘI THẤT chỉ vì tình cờ có người đi bộ/xe máy/xe cộ/người bán ở xa — đó là bối cảnh đường phố bình thường, GIỮ. Ảnh bản vẽ/quy hoạch/khuôn đất/3D minh họa là HỢP LỆ, KHÔNG loại. "bia" = số thứ tự ảnh ĐẸP NHẤT làm bìa trong các ảnh không bị loại — ưu tiên ảnh CHỤP THẬT mặt tiền/ngoại cảnh sáng rõ rồi tới phòng khách; tránh 3D/bản vẽ trừ khi không còn. "bo" rỗng nếu không ảnh nào là ảnh người.';

const gasGet = async (q) => { const r = await fetch(`${EXEC}?${q}`, { redirect: 'follow', signal: AbortSignal.timeout(280000) }); return r.json(); };

// ⭐ TỰ LOGIN T123 (16/07 — phát hiện login TỪ MÁY LOCAL CHẠY ĐƯỢC nếu gửi đúng header trình duyệt
//   x-api-version:v2 + Origin/Referer; ghi chú cũ "GAS không login được" chỉ đúng với IP Google).
//   Token chết -> máy quét TỰ login lấy token mới + nạp GAS, KHỎI phiền Tuấn. Đọc cred từ gas/T123.gs.
// ⚠️ CHỐNG LOGIN-STORM (đã từng làm KHOÁ CỨNG account): mỗi lần login CÁCH NHAU ≥8 PHÚT + tối đa 6 lần/lượt chạy.
//   Login = ĐÁ phiên người khác (T123 1-phiên) -> nếu token chết LIÊN TỤC ngay sau login = có người đang giành,
//   lúc đó backoff (đừng login lại ngay) để không đánh nhau vô tận với người thật.
// 🔒 CÔNG TẮC: auto-login MẶC ĐỊNH TẮT. Chỉ bật khi acc T123 là RIÊNG BOT (không đá phiên Tùng)
//   bằng cách chạy: T123_AUTOLOGIN=1 node tools/t123-pull.mjs 8
//   Tắt (mặc định) -> token chết thì DỪNG, chờ Tuấn nạp token browser (an toàn, không đá ai, không risk khoá acc).
const AUTO_LOGIN = process.env.T123_AUTOLOGIN === '1';
let _tkLast = 0, _tkLogins = 0;
async function loginT123() {
  if (!AUTO_LOGIN) { console.log('\n(auto-login TẮT — chạy với T123_AUTOLOGIN=1 nếu acc riêng bot). Cần token browser.'); return false; }
  const now = Date.now();
  if (_tkLogins >= 6) { console.log('\n⚠ đã tự login 6 lần/lượt — dừng để tránh khoá account. Chạy lại script sau.'); return false; }
  if (now - _tkLast < 8 * 60 * 1000) { const cho = Math.ceil((8 * 60 * 1000 - (now - _tkLast)) / 1000); console.log(`\n⏳ vừa login ${Math.round((now - _tkLast) / 1000)}s trước — chờ ${cho}s (chống login-storm)…`); await new Promise(r => setTimeout(r, cho * 1000)); }
  let U, P;
  try { const g = readFileSync('../gas/T123.gs', 'utf8'); U = (g.match(/T123_USER\s*=\s*.([^'"]+)/) || [])[1]; P = (g.match(/T123_PASS\s*=\s*.([^'"]+)/) || [])[1]; } catch (e) {}
  if (!U || !P) { console.log('\n⚠ không đọc được cred T123 từ ../gas/T123.gs'); return false; }
  _tkLast = Date.now(); _tkLogins++;
  try {
    const r = await fetch('https://api-dtk.thangbk.com/auth/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://tuan123.daitheky.net', 'Referer': 'https://tuan123.daitheky.net/', 'x-api-version': 'v2', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ username: U, password: P }), signal: AbortSignal.timeout(30000) });
    const j = await r.json();
    const tk = (j.data || {}).access_token;
    if (!tk) { console.log(`\n⚠ login trả rỗng/lỗi (code ${j.code}) — có thể T123 chặn tạm, chờ lượt sau`); return false; }
    const res = await gasGet(`action=t123token&t=${encodeURIComponent(tk)}`);
    if (res.ok) { console.log(`\n✅ TỰ LOGIN T123 thành công (lần ${_tkLogins}) — token mới đã nạp GAS, chạy tiếp.`); return true; }
    console.log('\n⚠ nạp token vào GAS lỗi:', res.error); return false;
  } catch (e) { console.log('\n⚠ login lỗi:', String(e).slice(0, 80)); return false; }
}
// (16/07) DÒ ĐỊNH DẠNG THẬT từ magic bytes. Trước đây gắn cứng image/jpeg cho MỌI ảnh -> ảnh PNG/WebP bị Gemini
// từ chối "Unable to process input image" (HTTP 400) -> CẢ CĂN fail (1 ảnh hỏng giết cả lô). Giờ set đúng mime;
// định dạng lạ/không phải ảnh -> trả null để BỎ RIÊNG ảnh đó.
function _mime(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'image/heic';   // ftyp box
  return null;
}
const b64 = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) return null;   // 404/4xx = ảnh ĐÃ BỊ GỠ khỏi CDN (định mệnh, không phải mạng) -> null
  const buf = Buffer.from(await r.arrayBuffer());
  const mime = _mime(buf);
  if (!mime) return null;   // không nhận ra là ảnh -> bỏ (khỏi làm Gemini 400 cả lô)
  return { data: buf.toString('base64'), mime };
};

async function locAnh(urls) {
  // (15/07) TẢI SONG SONG trong 1 căn: trước đây 12 ảnh tải NỐI ĐUÔI (mỗi ảnh chờ tới 25s, ảnh Drive rất chậm)
  // -> 1 căn mất 2-4 phút, thêm luồng vô ích vì luồng nào cũng ngồi chờ. Đo được: 6 luồng = 12 luồng = ~165 căn/giờ.
  // Ảnh nào tải hỏng thì BỎ RIÊNG ảnh đó (trước: 1 ảnh lỗi -> throw -> mất trắng cả căn).
  const raw = urls.slice(0, 12);
  // b64 trả {data,mime} = ảnh dùng được · null = ảnh ĐÃ GỠ/định dạng lạ (định mệnh) · throw = LỖI MẠNG (tạm).
  let netFail = 0;
  const tai = await Promise.all(raw.map(async (u) => { try { const b = await b64(u); return b ? { u, d: b.data, mime: b.mime } : null; } catch (e) { netFail++; return null; } }));
  const pick = tai.filter(Boolean);
  if (!pick.length) {
    // Không có ảnh nào dùng được. Phân biệt: toàn 404/lạ (netFail=0) = ẢNH GỠ HẲN -> báo caller đánh dấu 'none';
    // có lỗi mạng (netFail>0) = TẠM -> để lượt sau thử lại (đừng đánh dấu bỏ).
    const err = new Error(netFail ? 'lỗi mạng tải ảnh' : 'ảnh đã gỡ khỏi CDN');
    err.gone = netFail === 0;
    throw err;
  }
  const parts = [];
  pick.forEach((p, i) => { parts.push({ text: 'Ảnh ' + (i + 1) + ':' }); parts.push({ inline_data: { mime_type: p.mime, data: p.d } }); });
  parts.push({ text: PROMPT });
  let thu = 0;
  while (thu++ < 4) {
    const r = await fetch(GEM, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0, maxOutputTokens: 600 } }) });
    if (r.status === 429) { await new Promise(x => setTimeout(x, 8000)); continue; }
    if (r.status !== 200) throw new Error('gem ' + r.status);
    const j = await r.json();
    const t = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    const m = t.replace(/```json|```/g, '').match(/\{[\s\S]*\}/); if (!m) throw new Error('no json');
    const o = JSON.parse(m[0]);
    const bo = {}; (o.bo || []).forEach(x => bo[+x - 1] = 1);
    const out = []; let bia = '';
    for (let n = 0; n < pick.length; n++) if (!bo[n]) { out.push(pick[n].u); if (+o.bia - 1 === n) bia = pick[n].u; }
    if (bia && out[0] !== bia) { out.splice(out.indexOf(bia), 1); out.unshift(bia); }
    return out;   // đã lọc + xếp bìa
  }
  throw new Error('gem 429 lì');
}

let ok = 0, loi = 0, het = false;
async function worker(cans) {
  for (const c of cans) {
    if (het) return;
    try {
      const kept = await locAnh(c.urls);
      const res = await gasGet(`action=t123putanh&key=${WEB_KEY}&ma=${encodeURIComponent(c.ma)}&urls=${encodeURIComponent(kept.join('|'))}`);
      if (res.ok) { ok++; process.stdout.write(`\r✓ ${ok} căn (${c.ma}: ${kept.length} ảnh)   `); }
      else loi++;
    } catch (e) {
      loi++;
      // Ảnh GỠ HẲN (toàn 404) -> đánh dấu 'none' để GAS BỎ QUA VĨNH VIỄN (khỏi churn: trước đây căn fail
      // không ghi cột 13 -> GAS trả lại vòng vòng -> "còn ước" không giảm, đo được 16/07). Lỗi mạng tạm thì KHÔNG đánh dấu.
      if (e && e.gone) { try { await gasGet(`action=t123putanh&key=${WEB_KEY}&ma=${encodeURIComponent(c.ma)}&urls=`); } catch (e2) {} }
    }
  }
}
(async () => {
  let rong = 0, netErr = 0;   // rong = số lượt 0 căn liên tiếp; netErr = lỗi mạng liên tiếp
  while (!het) {
    // (16/07) 1 blip mạng tới script.google.com từng làm CRASH cả tiến trình (fetch throw không ai bắt).
    // Giờ bắt lỗi mạng -> nghỉ 20s thử lại, 10 lần liên tiếp mới chịu dừng (mạng chập chờn không giết máy quét).
    let d;
    try { d = await gasGet(`action=t123paths&key=${WEB_KEY}&n=40`); netErr = 0; }
    catch (eNet) {
      if (++netErr >= 10) { console.log('\n⚠ mạng lỗi 10 lần liên tiếp — dừng.'); break; }
      console.log(`\n⚠ lỗi mạng gọi GAS (lần ${netErr}/10): ${String(eNet).slice(0, 60)} — nghỉ 20s thử lại…`);
      await new Promise(x => setTimeout(x, 20000)); continue;
    }
    // (15/07) GAS báo lỗi VẪN có thể kèm căn đã lấy được -> XÀI NỐT rồi mới dừng (trước đây vứt sạch ~29 căn/mẻ,
    // mà GAS đã khoá chúng 6h -> đốt căn mà 0 ảnh). GAS @574 cũng đã thôi trả "401 giả" khi chỉ 1 căn hỏng.
    if (!d.ok && !(d.cans || []).length) {
      // Token chết -> TỰ LOGIN lấy token mới rồi chạy tiếp (khỏi phiền Tuấn). Login lỗi/bị chặn mới chịu dừng.
      if (/token|401/.test(d.error || '')) { console.log('\nGAS:', d.error, '— thử tự login…'); if (await loginT123()) continue; }
      else console.log('\nGAS:', d.error);
      break;
    }
    // (16/07) 0 căn CHƯA CHẮC là hết việc: trùng lúc t123KhoNight_ (1-3h sáng) nạp lại kho thì bảng tạm trống
    // -> GAS trả cans:[] con_lai_uoc:0 -> máy quét tưởng XONG rồi TỰ TẮT giữa chừng (dính thật 16/07: bỏ dở 5.979 căn).
    // Giờ: thấy rỗng thì nghỉ 60s thử lại, 3 lượt liên tiếp đều rỗng mới tin là hết thật.
    if (!d.cans || !d.cans.length) {
      if (++rong < 3) { console.log(`\n0 căn (lượt ${rong}/3) — có thể kho đang được nạp lại, nghỉ 60s thử lại...`); await new Promise(x => setTimeout(x, 60000)); continue; }
      console.log('\n✓ HẾT căn cần lấy ảnh (3 lượt liên tiếp đều rỗng)'); break;
    }
    rong = 0;
    const lo = Array.from({ length: N }, () => []);
    d.cans.forEach((c, i) => lo[i % N].push(c));
    await Promise.all(lo.map(worker));
    console.log(`\n— mẻ xong: ${ok} ảnh OK, ${loi} lỗi, còn ước ${d.con_lai_uoc}`);
    if (!d.ok) { console.log('GAS báo:', d.error, '— xài nốt lô xong, thử tự login…'); if (/token|401/.test(d.error || '') && await loginT123()) continue; break; }
  }
  console.log(`\n✓ TỔNG: ${ok} căn có ảnh, ${loi} lỗi/bỏ`);
})();
