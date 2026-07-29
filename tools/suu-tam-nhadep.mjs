// SƯU TẦM ẢNH NHÀ ĐẸP / KIẾN TRÚC ĐẸP cho bài Threads 9h (Tuấn chốt 29/07).
// Nguồn: Openverse (openverse.org) — gom ảnh Creative Commons từ Flickr/Wikimedia/... CHO PHÉP DÙNG LẠI.
// Chỉ lấy license thương mại được phép; LƯU KÈM tác giả + giấy phép + link gốc để ghi nguồn khi đăng.
//
//   node tools/suu-tam-nhadep.mjs 100        — gom 100 ảnh (mặc định)
// Ra: đẩy ảnh lên R2 prefix dep/ + xuất danh sách JSON để nạp vào GAS.
import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

const MAGICK = '/opt/homebrew/bin/magick';
const CAN = parseInt(process.argv[2] || '100', 10);
const TMP = process.env.TMPDIR || '/tmp';
const KEY = readFileSync(homedir() + '/.config/claude-bds/gemini.env', 'utf8').match(/GEMINI_KEY\s*=\s*"?([^"\n]+)/)[1].trim();

// Truy vấn hướng vào NHÀ Ở + kiến trúc nhiệt đới/Á Đông cho hợp gu khách Sài Gòn
const TRUY_VAN = [
  'vietnamese house architecture', 'hoi an ancient house', 'saigon french colonial building',
  'tropical house facade', 'modern house exterior design', 'brick house facade',
  'courtyard house garden', 'minimalist house exterior', 'villa exterior architecture',
  'shophouse facade asia', 'concrete house architecture', 'terrace house facade',
  'balcony plants house facade', 'wooden house asia', 'breeze block wall facade',
  'townhouse street architecture', 'house with garden vietnam', 'roof tile house asia',
];

const j = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(40000) }); return r.ok ? r.json() : null; };

// ---- 1. GOM ỨNG VIÊN ----
const seen = new Set(), uv = [];
for (const q of TRUY_VAN) {
  for (const trang of [1, 2]) {
    const d = await j(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial&page_size=20&page=${trang}`);
    for (const r of (d?.results || [])) {
      if (!r.url || seen.has(r.id)) continue;
      if ((r.width || 0) < 900 || (r.height || 0) < 700) continue;      // ảnh nhỏ -> bỏ
      seen.add(r.id);
      uv.push({ id: r.id, url: r.url, title: r.title || '', creator: r.creator || '', license: r.license || '',
                license_url: r.license_url || '', foreign: r.foreign_landing_url || '', source: r.source || '', q });
    }
  }
  process.stdout.write('.');
}
console.log(`\ngom ${uv.length} ứng viên từ ${TRUY_VAN.length} truy vấn`);

// ---- 2. CHẤM BẰNG AI: có đúng là ảnh NHÀ/KIẾN TRÚC ĐẸP không ----
async function cham(lo) {
  const parts = [];
  for (const x of lo) {
    try {
      const r = await fetch(x.url, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) { x.bo = 'tải lỗi'; continue; }
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length > 6_000_000) { x.bo = 'quá nặng'; continue; }
      writeFileSync(`${TMP}/nd_${x.id}.jpg`, b);
      execFileSync(MAGICK, [`${TMP}/nd_${x.id}.jpg`, '-resize', '640x640>', '-quality', '85', `${TMP}/nds_${x.id}.jpg`]);
      x.file = `${TMP}/nd_${x.id}.jpg`;
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: readFileSync(`${TMP}/nds_${x.id}.jpg`).toString('base64') } });
    } catch (e) { x.bo = 'lỗi'; }
  }
  const dung = lo.filter(x => !x.bo);
  if (!dung.length) return;
  parts.push({ text:
`Đây là ${dung.length} ảnh, đánh số 1..${dung.length} theo thứ tự.
Bạn đang chọn ảnh cho trang Threads của một môi giới NHÀ PHỐ Sài Gòn — đăng để người ta NGẮM và thả tim.
Với MỖI ảnh, chấm điểm 0-10 theo tiêu chí:
- Phải là ảnh NGÔI NHÀ / CÔNG TRÌNH / KIẾN TRÚC, thấy rõ mặt tiền hoặc không gian sống. Ảnh phong cảnh, đồ vật, người, xe cộ, nội thất trống trơn, ảnh mờ/tối/xấu -> 0-3.
- Đẹp, có gu, đáng để người ta dừng lại ngắm -> 7-10.
- Hợp gu Á Đông/nhiệt đới (cây xanh, gạch, gỗ, ban công, sân trong) thì cộng điểm.
Trả về JSON thuần: {"diem":[số cho ảnh 1, số cho ảnh 2, ...]}  — đúng ${dung.length} số, không giải thích.` });

  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent', {
    method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }), signal: AbortSignal.timeout(180000),
  });
  const o = await r.json();
  const txt = (o?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  try {
    const m = txt.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    const diem = JSON.parse(m[0]).diem || [];
    dung.forEach((x, i) => { x.diem = Number(diem[i]) || 0; });
  } catch (e) { dung.forEach(x => { x.diem = 5; }); }
}

console.log('chấm chất lượng bằng AI...');
for (let i = 0; i < uv.length; i += 6) {
  await cham(uv.slice(i, i + 6));
  process.stdout.write(`${Math.min(i + 6, uv.length)}/${uv.length} `);
}
const dep = uv.filter(x => !x.bo && (x.diem || 0) >= 7).sort((a, b) => b.diem - a.diem).slice(0, CAN);
console.log(`\n→ giữ ${dep.length} ảnh đạt (điểm ≥7)`);

// ---- 3. ĐẨY LÊN R2 + XUẤT DANH SÁCH KÈM NGUỒN ----
const { put } = await import('./r2.mjs');
const ra = [];
for (const x of dep) {
  try {
    const buf = readFileSync(x.file);
    const ten = 'dep/' + x.id.replace(/[^a-z0-9]/gi, '').slice(0, 24) + '.jpg';
    await put(ten, buf, 'image/jpeg');
    ra.push({ url: 'https://anh.tuansaigon.com/' + ten, tac_gia: x.creator, giay_phep: x.license.toUpperCase(),
              nguon: x.source, link: x.foreign, tieu_de: x.title.slice(0, 80) });
    process.stdout.write('+');
  } catch (e) { process.stdout.write('x'); }
}
const out = `${TMP}/nhadep-kho.json`;
writeFileSync(out, JSON.stringify(ra));
console.log(`\n✅ ${ra.length} ảnh đã lên kho R2 · danh sách: ${out}`);
