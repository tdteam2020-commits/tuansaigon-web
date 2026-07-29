// DỌN ẢNH BẰNG AI (Nano Banana / Gemini Image) — cho ảnh ĐĂNG FB/Threads (27/07).
// Đối thủ làm y cách này: xoá xe máy/rác/dây điện lòng thòng, làm sạch vệt ố mốc, trời đẹp,
// NHƯNG GIỮ NGUYÊN kết cấu căn nhà (số tầng, cửa, ban công, cầu thang, kích thước phòng).
// Chỉ dùng cho ẢNH ĐĂNG MXH — KHÔNG áp cả kho (Tuấn chốt 27/07).
//
//   node tools/anh-ai.mjs <ảnh vào> [ảnh ra] [--kieu ngoai|trong|san]
//   node tools/anh-ai.mjs --thu <thư mục>       — chạy cả thư mục, xuất kèm ảnh so sánh
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const MAGICK = '/opt/homebrew/bin/magick';
const KEY = readFileSync(homedir() + '/.config/claude-bds/gemini.env', 'utf8').match(/GEMINI_KEY\s*=\s*"?([^"\n]+)/)[1].trim();
const MODEL = process.env.ANH_AI_MODEL || 'gemini-3.1-flash-image';

// ---- LUẬT BẤT DI BẤT DỊCH: dọn dẹp + ánh sáng, CẤM sửa kết cấu / che hư hỏng kết cấu ----
const LUAT = `
TUYỆT ĐỐI GIỮ NGUYÊN, KHÔNG ĐƯỢC ĐỔI:
- Kết cấu căn nhà: số tầng, số ban công, vị trí và kích thước cửa/cửa sổ/cầu thang/lan can, hình dáng mái, chiều rộng mặt tiền.
- Bố cục và góc chụp: không xoay, không đổi phối cảnh, không cắt cúp, không phóng to thu nhỏ.
- Vật cố định thuộc căn nhà: bảng số nhà, đồng hồ điện, mái hiên, hoa văn cổng, gạch lát, thiết bị gắn tường.
- Nội thất đang có: không thêm bàn ghế/giường/tranh không có trong ảnh gốc.
- Nhà xuống cấp thì vẫn phải nhận ra là nhà xuống cấp — CHỈ làm sạch, KHÔNG tân trang thành nhà mới.

CHỈ ĐƯỢC XOÁ BỚT, TUYỆT ĐỐI KHÔNG ĐƯỢC THÊM VÀO:
- Không thêm cây cối, bụi cây, chậu cây, bồn hoa, cỏ, thảm cỏ.
- Không thêm xe cộ, người, biển hiệu, đèn, vật trang trí.
- Chỗ nào trống sau khi xoá vật cản thì để TRỐNG (nền tường, nền đường, nền gạch y như xung quanh) — không lấp bằng vật thể mới.
KHÔNG được viết thêm chữ, logo, watermark nào lên ảnh.
Giữ đúng tỉ lệ khung hình của ảnh gốc.`;

// PROMPT CHUNG — dùng cho GAS (1 prompt cho mọi loại ảnh, AI tự nhìn ảnh mà biết trong/ngoài).
export const PROMPT_CHUNG = `Dọn dẹp bức ảnh bất động sản này cho gọn gàng, sạch sẽ, sáng sủa như ảnh môi giới chuyên nghiệp.

NẾU LÀ ẢNH NGOÀI (mặt tiền, hẻm, sân):
- Xoá xe máy, ô tô, xe ba gác, thùng rác, bao rác, vật dụng vứt lộn xộn, người đi đường.
- Làm gọn dây điện chằng chịt trên không (giữ lại vài dây chính cho tự nhiên).
- Nền đường, vỉa hè, sân sạch sẽ, khô ráo.
- Bầu trời trong xanh nhẹ có mây mỏng, ánh nắng dịu.

NẾU LÀ ẢNH TRONG NHÀ:
- Xoá dây điện lòng thòng, thùng carton, chổi, xô chậu, quần áo phơi, đồ cá nhân vứt lộn xộn.
- Sàn sạch, ánh sáng ấm áp dễ chịu, mở sáng góc tối cho phòng thoáng rộng.

CẢ HAI TRƯỜNG HỢP:
- Lau sạch vệt ố, rêu mốc, bụi bẩn trên tường và nền.
- Màu sắc tươi trong trẻo, cây xanh mướt tự nhiên.
- GIỮ NGUYÊN mảng sơn bong tróc lớn và vết nứt (đó là hiện trạng thật của căn nhà).`;

const KIEU = {
  ngoai: `Dọn dẹp bức ảnh mặt tiền nhà này cho gọn gàng, giữ nguyên 100% căn nhà:
- Xoá xe máy, ô tô, xe đẩy, thùng rác, bao rác, vật dụng vứt lộn xộn trên vỉa hè và lòng đường.
- Xoá người đi đường.
- Làm gọn dây điện chằng chịt trên không (giữ lại vài dây chính cho tự nhiên, không xoá sạch trơn).
- Lau sạch vệt ố, rêu mốc, bụi bẩn bám trên tường và nền — nhưng GIỮ NGUYÊN các mảng sơn bong tróc lớn và vết nứt (đó là hiện trạng thật).
- Nền đường/vỉa hè sạch sẽ, không rác.
- Bầu trời trong xanh nhẹ có mây mỏng, ánh nắng dịu buổi sáng.
- Màu sắc tươi, trong trẻo, cây xanh mướt tự nhiên.`,
  trong: `Dọn dẹp bức ảnh nội thất này cho gọn gàng, giữ nguyên 100% căn phòng:
- Xoá dây điện lòng thòng, ổ cắm dây nối, đồ đạc cá nhân vứt lộn xộn, thùng carton, chổi, xô chậu, quần áo phơi.
- Lau sạch vệt ố trên tường và trần, sàn nhà sạch bóng tự nhiên.
- Ánh sáng ấm áp dễ chịu, cân bằng sáng cho phòng thoáng và rộng rãi hơn, không bị tối góc.
- GIỮ NGUYÊN toàn bộ nội thất, tủ bếp, cầu thang, cửa, gạch lát, đèn đang có.`,
  san: `Dọn dẹp bức ảnh sân/hẻm/lối vào này cho gọn gàng:
- Xoá xe máy, ô tô, rác, vật dụng vứt lộn xộn, người.
- Sân và lối đi sạch sẽ.
- Cây cối xanh mướt tự nhiên, ánh nắng dịu.
- Lau sạch vệt ố rêu mốc trên tường, GIỮ NGUYÊN mảng bong tróc lớn và vết nứt.`,
};

export async function donAnh(vao, ra, kieu = 'ngoai') {
  // Ảnh gốc 1600-2000px làm AI chạy rất chậm mà đăng MXH không cần cỡ đó -> hạ về tối đa 1280px trước khi gửi.
  const nho = ra.replace(/(\.\w+)$/, '_in.jpg');
  execFileSync(MAGICK, [vao, '-resize', '1280x1280>', '-quality', '92', nho]);
  const b64 = readFileSync(nho).toString('base64');
  const mime = 'image/jpeg';
  const prompt = (kieu === 'chung' ? PROMPT_CHUNG : (KIEU[kieu] || KIEU.ngoai)) + '\n' + LUAT;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: prompt }] }] }),
    signal: AbortSignal.timeout(180000),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message.slice(0, 200));
  const parts = ((j.candidates || [])[0] || {}).content?.parts || [];
  const img = parts.find(p => p.inline_data || p.inlineData);
  if (!img) throw new Error('AI không trả ảnh: ' + JSON.stringify(parts).slice(0, 200));
  const d = img.inline_data || img.inlineData;
  writeFileSync(ra, Buffer.from(d.data, 'base64'));
  // AI trả ảnh nhỏ hơn -> kéo về ĐÚNG cỡ ảnh đã gửi (Threads/FB carousel cần ảnh đều cỡ)
  const co = execFileSync(MAGICK, ['identify', '-format', '%wx%h', nho], { encoding: 'utf8' }).trim();
  execFileSync(MAGICK, [ra, '-resize', co + '!', '-quality', '92', ra]);
  return { ra, co, model: MODEL, token: (j.usageMetadata || {}).totalTokenCount };
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '')) {
  const a = process.argv.slice(2);
  const kIdx = a.indexOf('--kieu');
  const kieu = kIdx > -1 ? a[kIdx + 1] : 'ngoai';
  const args = a.filter((x, i) => i !== kIdx && i !== kIdx + 1);
  if (args[0] === '--thu') {
    const dir = args[1], out = join(dir, 'ai'); mkdirSync(out, { recursive: true });
    for (const f of readdirSync(dir).filter(x => /\.(jpg|jpeg|png)$/i.test(x))) {
      const vao = join(dir, f), sau = join(out, basename(f, extname(f)) + '_ai.jpg');
      try {
        const kq = await donAnh(vao, sau, kieu);
        execFileSync(MAGICK, [vao, sau, '-resize', '520x520', '+append', join(out, basename(f, extname(f)) + '_SO.jpg')]);
        console.log('✅', f, kq.token, 'token');
      } catch (e) { console.log('❌', f, String(e.message).slice(0, 120)); }
    }
    console.log('xong:', out);
  } else if (args[0]) {
    const ra = args[1] || args[0].replace(/(\.\w+)$/, '_ai.jpg');
    console.log(await donAnh(args[0], ra, kieu), '→', ra);
  } else console.log('dùng: node tools/anh-ai.mjs <ảnh> [ra] [--kieu ngoai|trong|san] | --thu <thư mục>');
}
