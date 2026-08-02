#!/usr/bin/env node
// SO GEMINI vs OPENAI trên CÙNG bộ ảnh + CÙNG prompt — để Tuấn tự chấm rồi quyết đổi hay không.
// Chạy: node tools/so-anh-ai.mjs <mã căn> [số ảnh]
//   vd: node tools/so-anh-ai.mjs K4124 5
// Kết quả: ~/Documents/so-anh-ai/<mã>/ + trang so-sanh.html mở bằng Chrome.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CFG = homedir() + '/.config/claude-bds/';
// ⚠️ File .env trong máy KHÔNG đồng nhất: gas.env có nháy kép, gemini.env thì KHÔNG. Đọc kiểu nào cũng được.
const doc = (f, ten) => {
  try {
    const m = readFileSync(CFG + f, 'utf8').match(new RegExp('(?:^|\\n)\\s*(?:export\\s+)?' + ten + '\\s*=\\s*(.+)'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch (e) { return ''; }
};
const GAS_KEY = doc('gas.env', 'GAS_KEY');
const GEM_KEY = doc('gemini.env', 'GEMINI_KEY');
const OAI_KEY = doc('openai.env', 'OPENAI_API_KEY');
if (!GAS_KEY || !GEM_KEY || !OAI_KEY) { console.error('Thiếu khoá trong ~/.config/claude-bds/ (gas.env, gemini.env, openai.env)'); process.exit(1); }

const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const MA = process.argv[2] || 'K4124';
const SO = parseInt(process.argv[3] || '5', 10);
const GEM_MODEL = 'gemini-3.1-flash-image';
const OAI_MODEL = process.argv[4] || 'gpt-image-1.5';
const OAI_QUALITY = process.argv[5] || 'low';   // Tuấn muốn thử đúng mức rẻ nhất
// Chạy lại với model OpenAI khác thì GIỮ LẠI ảnh đã có (khỏi tốn tiền dọn lại Gemini + model cũ),
// trang so sánh tự gom thành nhiều cột.
const RA = join(homedir(), 'Documents', 'so-anh-ai', MA);
mkdirSync(RA, { recursive: true });

// Prompt PHẢI y hệt bản GAS đang dùng — so sánh mà đổi prompt thì vô nghĩa.
const PROMPT = readFileSync(join(homedir(), 'My Projects', 'Claude Code BĐS', 'website', 'tools', 'prompt-don-anh.txt'), 'utf8');

const nghi = ms => new Promise(r => setTimeout(r, ms));

async function anhCuaCan() {
  const r = await fetch(`${GAS}?action=anhxepthu&key=${GAS_KEY}&ma=${MA}`, { redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error('anhxepthu lỗi: ' + JSON.stringify(j).slice(0, 120));
  return (j.sau || j.truoc || []).slice(0, SO);
}

async function gemini(buf) {
  const body = { contents: [{ parts: [
    { inline_data: { mime_type: 'image/jpeg', data: buf.toString('base64') } },
    { text: PROMPT }] }] };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEM_MODEL}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': GEM_KEY }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('gemini ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const j = await r.json();
  const parts = j.candidates?.[0]?.content?.parts || [];
  for (const p of parts) { const d = p.inline_data || p.inlineData; if (d?.data) return Buffer.from(d.data, 'base64'); }
  throw new Error('gemini không trả ảnh');
}

async function openai(buf) {
  const fd = new FormData();
  fd.append('model', OAI_MODEL);
  fd.append('image', new Blob([buf], { type: 'image/jpeg' }), 'anh.jpg');
  fd.append('prompt', PROMPT);
  fd.append('quality', OAI_QUALITY);
  // giữ bám ảnh gốc — việc của ta là DỌN, không phải vẽ lại. Bản 'mini' KHÔNG hỗ trợ (trả 400),
  // nghĩa là nó buộc phải vẽ lại nhiều hơn -> khó giữ đúng căn nhà.
  if (!/mini/.test(OAI_MODEL)) fd.append('input_fidelity', 'high');
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: 'Bearer ' + OAI_KEY }, body: fd });
  const t = await r.text();
  if (!r.ok) throw new Error('openai ' + r.status + ' ' + t.slice(0, 200));
  const j = JSON.parse(t);
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error('openai không trả ảnh: ' + t.slice(0, 150));
  return { buf: Buffer.from(b64, 'base64'), usage: j.usage || null };
}

const urls = await anhCuaCan();
console.log(`Căn ${MA} — ${urls.length} ảnh (đã qua bước AI sắp thứ tự, giống hệt lúc đăng thật)`);
console.log(`OpenAI: ${OAI_MODEL} · mức ${OAI_QUALITY}\n`);

const tenOai = `openai-${OAI_MODEL}-${OAI_QUALITY}`;
const hang = [];
let tokOut = 0, soMoi = 0;
for (let i = 0; i < urls.length; i++) {
  const n = i + 1;
  const fGoc = join(RA, `${n}-goc.jpg`), fGem = join(RA, `${n}-gemini.jpg`), fOai = join(RA, `${n}-${tenOai}.png`);
  let goc;
  if (existsSync(fGoc)) goc = readFileSync(fGoc);
  else { goc = Buffer.from(await (await fetch(urls[i])).arrayBuffer()); writeFileSync(fGoc, goc); }
  const d = { i: n, loiG: '', loiO: '' };

  if (existsSync(fGem)) d.gem = 1;
  else try { writeFileSync(fGem, await gemini(goc)); d.gem = 1; soMoi++; }
  catch (e) { d.loiG = String(e.message).slice(0, 90); }

  if (existsSync(fOai)) d.oai = 1;
  else try { const o = await openai(goc); writeFileSync(fOai, o.buf); d.oai = 1; soMoi++;
             if (o.usage?.output_tokens) tokOut += o.usage.output_tokens; }
  catch (e) { d.loiO = String(e.message).slice(0, 160); }

  console.log(`ảnh ${n}: gemini ${d.gem ? '✅' : '❌ ' + d.loiG} · ${OAI_MODEL} ${d.oai ? '✅' : '❌ ' + d.loiO}`);
  hang.push(d);
  if (soMoi) await nghi(800);
}
// gom mọi biến thể openai đã dựng (chạy nhiều model thì thành nhiều cột)
const cotOai = [...new Set(readdirSync(RA).filter(f => /^\d+-openai-.*\.png$/.test(f))
  .map(f => f.replace(/^\d+-/, '').replace(/\.png$/, '')))].sort();

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const soCot = 2 + cotOai.length;
const html = `<!doctype html><meta charset="utf-8"><title>So ảnh AI — căn ${esc(MA)}</title>
<style>body{font:15px/1.6 -apple-system,sans-serif;max-width:1700px;margin:20px auto;padding:0 16px;background:#faf8f6;color:#241a1c}
h1{font-size:20px;color:#7b1e2b}
.hd,.r{display:grid;grid-template-columns:repeat(${soCot},1fr);gap:12px}
.hd{position:sticky;top:0;background:#faf8f6;padding:10px 0;z-index:5;border-bottom:2px solid #e4d9c8}
.hd b{display:block;text-align:center;font-size:14px}.hd span{display:block;text-align:center;font-size:11.5px;color:#6b6257}
.r{margin:12px 0 22px}
.r img{width:100%;border-radius:10px;border:1px solid #e4d9c8;background:#fff}
.r .er{background:#fff2f0;border:1px solid #f3b9b1;border-radius:10px;padding:12px;font-size:12.5px;color:#a4231a}
.n{font-weight:700;color:#7b1e2b;margin:16px 0 4px}</style>
<h1>So ảnh AI — căn ${esc(MA)}</h1>
<p>Cùng một ảnh gốc, cùng một bản chỉ thị. Cột đầu là ảnh chưa dọn, kế đến bản đang dùng, còn lại là các bản thử.</p>
<div class="hd">
<b>ẢNH GỐC</b>
<div><b>GEMINI (đang dùng)</b><span>${GEM_MODEL} · ~1.000đ/ảnh</span></div>
${cotOai.map(c => `<div><b>${esc(c.replace('openai-', '').toUpperCase())}</b><span>OpenAI · thử</span></div>`).join('')}
</div>
${hang.map(d => `<div class="n">Ảnh ${d.i}</div><div class="r">
<img src="${d.i}-goc.jpg" alt="gốc">
${d.gem ? `<img src="${d.i}-gemini.jpg" alt="gemini">` : `<div class="er">Gemini lỗi: ${esc(d.loiG)}</div>`}
${cotOai.map(c => existsSync(join(RA, `${d.i}-${c}.png`))
    ? `<img src="${d.i}-${c}.png" alt="${esc(c)}">`
    : `<div class="er">${esc(c)} không có ảnh${d.loiO ? ': ' + esc(d.loiO) : ''}</div>`).join('')}
</div>`).join('')}`;
writeFileSync(join(RA, 'so-sanh.html'), html);
console.log(`\n✅ Mở bằng Chrome:\n   file://${join(RA, 'so-sanh.html')}`);
console.log(`   cột đang có: gốc · gemini · ${cotOai.join(' · ')}`);
if (tokOut) console.log(`   ${OAI_MODEL} dùng ${tokOut} token ảnh cho lượt này`);
