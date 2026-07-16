// CHIẾN DỊCH "ĐÔI NÉT VỀ CĂN NÀY" — Gemini FREE viết đoạn giới thiệu cho căn chưa có bài (Tuấn duyệt 11/07).
// Chạy: source ~/.config/claude-bds/gemini.env && export GEMINI_KEY && node doinet.mjs
// Ghi vào data/archive.json (trường cap — build tự hiện, merge giữ vĩnh viễn). Con trỏ resume: data/doinet-done.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const KEY = process.env.GEMINI_KEY;
if (!KEY) { console.log('Thiếu GEMINI_KEY'); process.exit(1); }
const GEM = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';
const ARC = 'data/archive.json', DONE = 'data/doinet-done.json';
const arc = JSON.parse(readFileSync(ARC, 'utf8'));
const rows = JSON.parse(readFileSync('data/listings.json', 'utf8')).rows;
const done = existsSync(DONE) ? JSON.parse(readFileSync(DONE, 'utf8')) : {};
const SYS = `Viết đoạn "Đôi nét về căn này" cho trang chi tiết website môi giới "Tuấn Sài Gòn": 3-4 câu, giọng chững chạc tự nhiên kiểu người Sài Gòn, giàu dữ kiện (khách và Google/AI cùng đọc). Chỉ nói đúng theo dữ liệu cho sẵn: vị trí (số hẻm ĐƯỢC ghi, vd "hẻm 220 Hồ Văn Huê"), kết cấu, diện tích, kích thước, công năng. TUYỆT ĐỐI KHÔNG: số nhà đầy đủ; SĐT/tên chủ; bịa tiện ích/landmark/khoảng cách; "cơ hội vàng/hiếm có/đừng bỏ lỡ/liên hệ ngay/inbox"; câu hỏi; tiếng Anh; hashtag; emoji; mở bài bằng "Tọa lạc". ⛔ CẤM MÔ TẢ + BÌNH PHẨM HÌNH THẾ/HÌNH DÁNG/CHẤT LƯỢNG thửa đất. TUYỆT ĐỐI KHÔNG dùng: "vuông vức", "vuông vắn", "nở hậu", "tóp hậu", "méo", "thế đất đẹp", "thế đất vuông", "đất đẹp", "thế đất lý tưởng", hay bất kỳ tính từ khen/tả hình dáng đất nào. CHỈ được nêu SỐ ĐO trần trụi "ngang X, dài Y" (không kèm chữ "thế đất"), tuyệt đối KHÔNG suy ra hình thế từ số đo (nhiều căn nở/tóp hậu — ghi vuông vức là SAI). Không có dữ liệu hình thế thì BỎ QUA, đừng nhắc tới đất/thế đất. Hẻm chỉ nói trung tính/tích cực. Kết bằng 1 câu về nhóm khách phù hợp. Trả về DUY NHẤT đoạn văn.`;
const info = l => [
  `Khu vực: ${l.duong}${l.phuong ? ', ' + l.phuong : ''}, ${l.quan}, TP.HCM`,
  `Loại: ${l.loai || 'nhà phố'}`,
  `Giá ghi trong bài: ${l.gia_text}`,
  l.dt ? `Diện tích đất: ${l.dt} m²${l.ngang && l.dai ? ` (ngang ${l.ngang}m, dài ${l.dai}m)` : ''}` : '',
  l.ketcau ? `Kết cấu: ${l.ketcau}` : (l.tang ? `Kết cấu: ${l.tang} tầng` : ''),
  l.pn ? `Phòng ngủ: ${l.pn}` : '', l.wc ? `Vệ sinh: ${l.wc}` : '', l.huong ? `Hướng: ${l.huong}` : '',
  l.hem ? `Vị trí: ${l.hem}` : (l.vitri ? `Vị trí: ${l.vitri}` : ''),
  l.hemso ? `Hẻm số: ${l.hemso} (được ghi "hẻm ${l.hemso} ${l.duong}")` : '',
].filter(Boolean).join('\n');
const cần = rows.filter(l => !l.coc && !(arc[l.ma]?.cap) && !l.cap && !done[l.ma] && arc[l.ma]);
console.log(`Cần viết: ${cần.length} căn`);
let ok = 0, loi = 0, hetNgay = false;
const hang = [...cần];
async function tho() {
 while (hang.length && !hetNgay) {
  const l = hang.shift();
  let thu = 0, banThu = 0;
  while (true) { try {
    const r = await fetch(GEM, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({ system_instruction: { parts: [{ text: SYS }] }, contents: [{ parts: [{ text: 'Dữ liệu căn:\n' + info(l) }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 1200 } }),
      signal: AbortSignal.timeout(60000) });
    const o = await r.json();
    if (o.error) {
      if (o.error.code === 429) {
        const perDay = JSON.stringify(o.error.details || '').includes('PerDay');
        if (perDay) { console.log('\n429 HẾT QUOTA NGÀY — nghỉ, mai tự chạy tiếp'); hetNgay = true; break; }
        if (++thu > 5) { console.log('\n429 lì quá 5 lần — coi như hết ngày'); hetNgay = true; break; }
        console.log('\n429 chặn tạm theo phút — nghỉ 65s rồi thử lại');   // đụng RPM khi trùng giờ bot quét ảnh
        await new Promise(x => setTimeout(x, 65000)); continue;
      }
      throw new Error(o.error.message);
    }
    let t = (o.candidates?.[0]?.content?.parts || []).filter(p => p.text).map(p => p.text).join('').trim()
      .replace(/^["'`]+|["'`]+$/g, '').replace(/\s*#[^\s#]+/g, '').replace(/\?/g, '.');
    // BỘ LỌC HÌNH THẾ (Tuấn 14/07): AI hay bịa "vuông vức/thế đất đẹp/nở hậu" từ ngang×dài — cấm tuyệt đối.
    const BAN = /vuông\s*v[ứắ]c|vuông\s*vắn|nở\s*hậu|tóp\s*hậu|thế\s*đất|thế\s*nhà\s*đẹp|đất\s*(?:đẹp|vuông)/i;
    if (BAN.test(t)) {
      if (banThu++ < 3) continue;   // model lỡ ghi hình thế -> viết lại
      t = t.split(/(?<=[.!?])\s+/).filter(s => !BAN.test(s)).join(' ').trim();   // cạn lượt -> cắt câu dính
    }
    if (t.length > 50 && !/\d{9,}/.test(t)) { arc[l.ma].cap = t; ok++; } else loi++;
    done[l.ma] = 1;
    if (ok % 25 === 0) { writeFileSync(ARC, JSON.stringify(arc)); writeFileSync(DONE, JSON.stringify(done)); process.stdout.write(`\r${ok}/${cần.length}`); }
    await new Promise(x => setTimeout(x, 800));   // Tier 1 (4000 RPM): 8 luồng × ~1 bài/2s ≈ 240 bài/phút vẫn dư trần
    break;
  } catch (e) { loi++; await new Promise(x => setTimeout(x, 5000)); break; } }
 }
}
await Promise.all(Array.from({ length: 8 }, tho));
writeFileSync(ARC, JSON.stringify(arc)); writeFileSync(DONE, JSON.stringify(done));
console.log(`\n✓ Xong: viết ${ok} căn, lỗi/bỏ ${loi}`);
