// CHỈNH ẢNH TỰ ĐỘNG "VƯỜN THƠ" — dựng lại cách đối thủ làm cho ảnh Threads/FB đẹp lên (27/07).
// KHÔNG phải AI vẽ lại ảnh: chỉ chỉnh MÀU + ÁNH SÁNG, giữ nguyên 100% hiện trạng căn nhà
// (luật kho ảnh của Tuấn: cấm che khuyết điểm, cấm đổi kết cấu).
//
// Khác preset cố định ở chỗ: ĐO TỪNG ẢNH TRƯỚC rồi mới tính liều lượng.
// Ảnh lạnh/đục -> ấm + trong nhiều · Ảnh vốn đã vàng khè -> kéo NGƯỢC lại cho trung tính.
//
//   node tools/anh-dep.mjs <ảnh vào> [ảnh ra]        — chỉnh 1 ảnh
//   node tools/anh-dep.mjs --thu <thư mục>           — chỉnh cả thư mục, xuất kèm ảnh so sánh trước/sau
//   node tools/anh-dep.mjs --do <ảnh>                — chỉ ĐO, in thông số, không chỉnh
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAGICK = '/opt/homebrew/bin/magick';
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const kep = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const r3 = x => Math.round(x * 1000) / 1000;

// ---------- ĐO ẢNH (thu nhỏ 240px cho nhanh) ----------
export function doAnh(f) {
  const q = ['%[fx:mean.r]', '%[fx:mean.g]', '%[fx:mean.b]',
    '%[fx:standard_deviation]',                                  // độ tương phản
    '%[fx:mean.r>0?0:0]'].join(' ');
  const s = execFileSync(MAGICK, [f, '-resize', '240x240!', '-colorspace', 'sRGB', '-format', q, 'info:'], { encoding: 'utf8' });
  const [mr, mg, mb, sd] = s.trim().split(/\s+/).map(Number);
  // độ bão hoà trung bình + tỉ lệ pixel xanh lá (dùng -fx trên ảnh nhỏ nên rất nhanh)
  const s2 = execFileSync(MAGICK, [f, '-resize', '160x160!', '-colorspace', 'sRGB',
    '-format', '%[fx:mean]', 'info:'], { encoding: 'utf8' });
  const satTxt = execFileSync(MAGICK, [f, '-resize', '160x160!', '-colorspace', 'HSL',
    '-channel', 'G', '-separate', '-format', '%[fx:mean]', 'info:'], { encoding: 'utf8' });
  const grnTxt = execFileSync(MAGICK, [f, '-resize', '140x140!', '-colorspace', 'sRGB',
    '-fx', '(g>r*1.06 && g>b*1.06) ? 1 : 0', '-format', '%[fx:mean]', 'info:'], { encoding: 'utf8' });
  const luma = 0.299 * mr + 0.587 * mg + 0.114 * mb;
  return {
    mr, mg, mb, luma, sd,
    amLanh: mr / Math.max(mb, 0.001),        // >1 = ảnh ngả ấm, <1 = ngả lạnh
    baoHoa: Number(satTxt.trim()) || 0,
    xanhLa: Number(grnTxt.trim()) || 0,      // tỉ lệ pixel là cây lá
    trungBinh: Number(s2.trim()) || 0,
  };
}

// ---------- TÍNH LIỀU LƯỢNG THEO ẢNH ----------
export function congThuc(d) {
  // 1. CÂN TRẮNG — kéo về hơi ấm (1.07). Ảnh đã quá vàng thì kéo NGƯỢC lại.
  const dichAm = kep((1.07 - d.amLanh) * 0.45, -0.035, 0.055);
  // 2. SÁNG — nhắm mức sáng trung bình 0.52 (ảnh nhà nên sáng sủa, thoáng)
  const sang = kep((0.52 - d.luma) * 0.38, -0.04, 0.10);
  const moBong = r3(0.012 + kep((0.52 - d.luma) * 0.12, 0, 0.05));   // mở vùng tối (góc khuất, gầm cầu thang)
  // 3. TƯƠNG PHẢN — ảnh đục (sd thấp) thì tăng mạnh
  const tuongPhan = kep(1.22 - d.sd * 0.55, 1.05, 1.18);
  // 4. RỰC MÀU — ảnh nhợt thì tăng nhiều, ảnh đã rực thì thôi
  const ruc = kep((0.40 - d.baoHoa) * 1.25, 0.12, 0.40);
  // 5. CÂY LÁ — nhiều cây thì đẩy xanh ngả vàng cho mướt
  const nhieuCay = d.xanhLa > 0.05;
  const xanhSat = nhieuCay ? kep(0.24 + d.xanhLa * 0.8, 0.24, 0.42) : 0.14;
  const xanhHue = nhieuCay ? 8 : 3;
  // 6. ảnh vàng khè: hạ bớt vàng cho đỡ gắt
  const vangGat = d.amLanh > 1.14;
  return {
    dichAm: r3(dichAm), sang: r3(sang), moBong: r3(moBong), tuongPhan: r3(tuongPhan),
    ruc: r3(ruc), xanhSat: r3(xanhSat), xanhHue, vangGat, nhieuCay,
  };
}

export function chuoiLoc(c) {
  const b = c.moBong;
  return [
    // đường cong chữ S: nâng vùng tối + trung gian cho thoáng, ghì nhẹ chân đen cho ảnh có "cốt"
    `curves=master='0/${r3(b)} 0.08/${r3(0.08 + b * 0.5 - 0.014)} 0.25/${r3(0.25 + b * 0.9 + 0.052)} 0.5/${r3(0.5 + b * 0.5 + 0.032)} 0.78/${r3(0.78 + 0.018)} 1/1'`,
    `colorbalance=rs=${r3(c.dichAm * 0.3)}:bs=${r3(-c.dichAm * 0.45)}:rm=${c.dichAm}:bm=${r3(-c.dichAm)}:rh=${r3(c.dichAm * 0.5)}:bh=${r3(-c.dichAm * 0.55)}`,
    `huesaturation=colors=g:hue=${c.xanhHue}:saturation=${c.xanhSat}:intensity=0.05`,
    `huesaturation=colors=y:saturation=${c.vangGat ? -0.10 : 0.18}:intensity=${c.vangGat ? -0.04 : 0.03}`,
    `huesaturation=colors=r:saturation=0.14:intensity=0.02`,
    `huesaturation=colors=b:saturation=-0.10:intensity=-0.03`,
    `vibrance=intensity=${c.ruc}:rbal=1.0:gbal=${c.nhieuCay ? 1.14 : 1.05}:bbal=0.92`,
    `eq=contrast=${c.tuongPhan}:brightness=${c.sang}:saturation=1.03:gamma=1.02`,
    `unsharp=13:13:0.55:13:13:0`,   // "clarity" — tăng tương phản cục bộ, ảnh trong hẳn ra (đây là thứ tạo cảm giác ảnh xịn)
    `unsharp=5:5:0.45:5:5:0`,       // nét vừa phải, không bị rỗ
  ].join(',');
}

export function chinh(vao, ra) {
  const d = doAnh(vao);
  const c = congThuc(d);
  execFileSync(FFMPEG, ['-y', '-v', 'error', '-i', vao, '-vf', chuoiLoc(c), '-q:v', '2', ra]);
  return { do: d, cong_thuc: c };
}

// ---------- chạy dòng lệnh ----------
// (đường dẫn dự án có dấu tiếng Việt + khoảng trắng -> phải so bằng fileURLToPath, so chuỗi thô là hụt)
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '')) {
  const a = process.argv.slice(2);
  if (a[0] === '--do') {
    const d = doAnh(a[1]);
    console.log('ĐO:', JSON.stringify(d, (k, v) => typeof v === 'number' ? r3(v) : v, 1));
    console.log('CÔNG THỨC:', JSON.stringify(congThuc(d)));
  } else if (a[0] === '--thu') {
    const dir = a[1], out = join(dir, 'ra');
    mkdirSync(out, { recursive: true });
    for (const f of readdirSync(dir).filter(x => /\.(jpg|jpeg|png)$/i.test(x))) {
      const vao = join(dir, f), sau = join(out, basename(f, extname(f)) + '_dep.jpg');
      const kq = chinh(vao, sau);
      execFileSync(MAGICK, [vao, sau, '-resize', '520x520', '+append',
        join(out, basename(f, extname(f)) + '_SO.jpg')]);
      console.log(f, '→', JSON.stringify(kq.cong_thuc));
    }
    console.log('xong, xem thư mục:', out);
  } else if (a[0]) {
    const ra = a[1] || a[0].replace(/(\.\w+)$/, '_dep.jpg');
    console.log(JSON.stringify(chinh(a[0], ra), null, 1));
    console.log('→', ra);
  } else console.log('dùng: node tools/anh-dep.mjs <ảnh> | --thu <thư mục> | --do <ảnh>');
}
