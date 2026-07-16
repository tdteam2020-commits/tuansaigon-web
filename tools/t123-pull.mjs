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
const b64 = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(25000) }); if (!r.ok) throw new Error('img ' + r.status); return Buffer.from(await r.arrayBuffer()).toString('base64'); };

async function locAnh(urls) {
  // (15/07) TẢI SONG SONG trong 1 căn: trước đây 12 ảnh tải NỐI ĐUÔI (mỗi ảnh chờ tới 25s, ảnh Drive rất chậm)
  // -> 1 căn mất 2-4 phút, thêm luồng vô ích vì luồng nào cũng ngồi chờ. Đo được: 6 luồng = 12 luồng = ~165 căn/giờ.
  // Ảnh nào tải hỏng thì BỎ RIÊNG ảnh đó (trước: 1 ảnh lỗi -> throw -> mất trắng cả căn).
  const raw = urls.slice(0, 12);
  const tai = await Promise.all(raw.map(async (u) => { try { return { u, d: await b64(u) }; } catch (e) { return null; } }));
  const pick = tai.filter(Boolean);
  if (!pick.length) throw new Error('không tải được ảnh nào');
  const parts = [];
  pick.forEach((p, i) => { parts.push({ text: 'Ảnh ' + (i + 1) + ':' }); parts.push({ inline_data: { mime_type: 'image/jpeg', data: p.d } }); });
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
    } catch (e) { loi++; /* căn lỗi -> bỏ, GAS đã mark scan 6h */ }
  }
}
(async () => {
  let rong = 0;   // đếm số lượt GAS trả 0 căn liên tiếp
  while (!het) {
    const d = await gasGet(`action=t123paths&key=${WEB_KEY}&n=40`);
    // (15/07) GAS báo lỗi VẪN có thể kèm căn đã lấy được -> XÀI NỐT rồi mới dừng (trước đây vứt sạch ~29 căn/mẻ,
    // mà GAS đã khoá chúng 6h -> đốt căn mà 0 ảnh). GAS @574 cũng đã thôi trả "401 giả" khi chỉ 1 căn hỏng.
    if (!d.ok && !(d.cans || []).length) { console.log('\nGAS:', d.error); if (/token/.test(d.error || '')) { console.log('→ lấy token từ browser Tuấn + nạp t123token trước'); } break; }
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
    if (!d.ok) { console.log('GAS báo:', d.error, '— đã xài nốt căn trong lô, dừng.'); break; }
  }
  console.log(`\n✓ TỔNG: ${ok} căn có ảnh, ${loi} lỗi/bỏ`);
})();
