// THỬ NGHIỆM prompt restyle ảnh (Nano Banana) — chỉ để DÒ prompt, chưa gắn hệ.
// Chạy: source ~/.config/claude-bds/gemini.env && export GEMINI_KEY && node tools/restyle-thu.mjs <url> <ten-out> <so-prompt>
import { writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [URL, OUT, PN] = [process.argv[2], process.argv[3] || 'out', process.argv[4] || '1'];
const KEY = process.env.GEMINI_KEY;

// các prompt để so
const PROMPTS = {
  // 1 = bảo thủ: chỉ color-grade + sáng, cấm vẽ lại, giữ chữ
  '1': 'You are a professional photo RETOUCHER, not an illustrator. Apply only subtle, realistic color grading, white-balance and exposure correction to this real-estate photo. PRESERVE EXACTLY: the composition, framing, every architectural element, all objects, all textures, and ANY text/writing/signs/calligraphy (do NOT redraw or alter text). Do NOT regenerate, repaint, sharpen artificially, or add/remove anything. The result must look like the SAME photo with light professional editing — indistinguishable from a Lightroom edit. Photorealistic.',
  // 2 = vintage nhẹ cho nhà cổ
  '2': 'Apply a subtle warm vintage film color grade to this real-estate photo (soft warm tones, gentle contrast, slight film grain). Keep the composition, all architecture, objects, textures and any text EXACTLY unchanged — this is a color-grade only, NOT a redraw. Must stay photorealistic and truthful to the real property. Do not beautify or hide any flaw.',
  // 3 = modern sáng sạch cho nhà mới/tòa nhà
  '3': 'Apply a clean modern real-estate color grade: bright, neutral white-balance, crisp but natural. Keep composition, architecture, every object, texture and all text EXACTLY the same. Color and light only — no redraw, no added elements, no removed flaws. Photorealistic and faithful to the original.',
};

const img = Buffer.from(await (await fetch(URL, { headers: { Referer: 'https://tuansaigon.com/' } })).arrayBuffer());
// khung gốc để kéo về sau
const gocPath = `/tmp/${OUT}-goc.jpg`; writeFileSync(gocPath, img);
const dim = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', gocPath]).toString();
console.log('gốc:', (img.length / 1024).toFixed(0) + 'KB', dim.match(/pixel\w+: \d+/g).join(' '));

const body = { contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: img.toString('base64') } }, { text: PROMPTS[PN] }] }],
  generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
const t0 = Date.now();
const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
  { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body) });
const j = await r.json();
if (j.error) { console.log('LỖI:', JSON.stringify(j.error).slice(0, 300)); process.exit(1); }
const part = (j.candidates?.[0]?.content?.parts || []).find(p => p.inline_data || p.inlineData);
const data = part?.inline_data?.data || part?.inlineData?.data;
if (!data) { console.log('KHÔNG ra ảnh'); process.exit(1); }
const raw = `/tmp/${OUT}-raw.jpg`, fin = `/tmp/${OUT}.jpg`;
writeFileSync(raw, Buffer.from(data, 'base64'));
// KÉO VỀ ĐÚNG KHUNG GỐC (chống model đổi tỷ lệ làm xê dịch) + nén web
const w = (dim.match(/pixelWidth: (\d+)/) || [])[1], h = (dim.match(/pixelHeight: (\d+)/) || [])[1];
execFileSync('sips', ['-z', h, w, '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', raw, '--out', fin], { stdio: 'ignore' });
console.log(`✅ prompt ${PN} · ${((Date.now() - t0) / 1000).toFixed(1)}s · ${(statSync(fin).size / 1024).toFixed(0)}KB -> ${fin} (đã kéo về ${w}x${h})`);
