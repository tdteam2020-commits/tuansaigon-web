// ĐĂNG PODCAST THEO LỆNH — Tuấn chat "đăng podcast số N" -> Claude chạy file này.
// Luồng: đẩy mp4 lên R2 -> kích webhook Make (đăng YouTube + FB video) -> chờ GAS trả link -> in link.
// Chạy: source ~/.config/claude-bds/r2.env && node tools/dang-podcast.mjs <N>
import { readFileSync } from 'node:fs';
import { put } from './r2.mjs';
import { homedir } from 'node:os';

const KEY = (() => {   // khoá GAS đọc từ file config (khoá cũ từng nằm CÔNG KHAI trong repo GitHub)
  const _f = homedir() + '/.config/claude-bds/gas.env';
  try { return (readFileSync(_f, 'utf8').match(/GAS_KEY[^"]*"([^"]+)"/) || [])[1].trim(); }
  catch (e) { console.error('Thieu khoa - tao ' + _f + ' voi dong: GAS_KEY="..."'); process.exit(1); }
})();

const HOOK = 'https://hook.eu1.make.com/svx4c0kp22jnbjafg8796niw3vj2aabv';
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const DESK = '/Users/nguyentuan94/My Projects/Claude Code BĐS/podcast-pipeline/xuat/';   // 22/07: video gom vào dự án, bỏ Desktop

// Kho tập: số -> file + tiêu đề (SEO) + mô tả. Thuần Việt, không bán hàng, không SĐT/địa chỉ.
// YouTube CHẶN CỨNG tiêu đề >100 ký tự -> module Make trả rỗng LẶNG LẼ (dính thật 28/07 tập 6: FB lên, YouTube mất tăm).
// Tool tự soát trước khi gửi, quá thì dừng luôn cho biết đường sửa.
const YT_MAX_TITLE = 100;
const EP = {
  1: { file: 'PODCAST-Tap1-datcoc-antoan.mp4',
       title: 'Đặt cọc mua nhà sao cho không mất tiền oan | Chuyện Nghề Môi Giới #1 | Tuấn Sài Gòn',
       desc: 'Đặt cọc là bước dễ mất tiền nhất khi mua nhà nếu không nắm rõ. Tập này Tuấn chia sẻ cách đặt cọc an toàn: hợp đồng cọc cần ghi gì, giữ tiền thế nào, và những tình huống khiến người mua mất cọc oan.\n\nKênh Tuấn Sài Gòn — chuyện nghề môi giới nhà phố Sài Gòn.\n#batdongsan #muanha #datcoc #tuansaigon #nhaphosaigon' },
  2: { file: 'PODCAST-Tap2-vaymuanha.mp4',
       title: 'Vay ngân hàng mua nhà cần biết gì để không đuối | Chuyện Nghề Môi Giới #2 | Tuấn Sài Gòn',
       desc: 'Vay bao nhiêu là vừa sức? Lãi suất thả nổi, thời gian vay và những khoản dễ bị bỏ sót khi tính tiền vay mua nhà. Tuấn chia sẻ kinh nghiệm thật để không rơi vào cảnh gồng nợ.\n\nKênh Tuấn Sài Gòn — chuyện nghề môi giới nhà phố Sài Gòn.\n#vaymuanha #nganhang #batdongsan #tuansaigon #muanha' },
  3: { file: 'PODCAST-Tap3-nhathechap.mp4',
       title: 'Mua nhà đang thế chấp ngân hàng có sợ mất trắng không | Chuyện Nghề Môi Giới #3 | Tuấn Sài Gòn',
       desc: 'Nhà đang thế chấp ngân hàng vẫn mua bán được nếu làm đúng cách. Tuấn chỉ quy trình giải chấp — sang tên an toàn để người mua không mất tiền, người bán không kẹt sổ.\n\nKênh Tuấn Sài Gòn — chuyện nghề môi giới nhà phố Sài Gòn.\n#nhathechap #muanha #batdongsan #tuansaigon #giaichap' },
  4: { file: 'PODCAST-Tap4-thuephi2026.mp4',
       title: 'Thuế phí khi mua bán nhà 2026 ai chịu, bao nhiêu | Chuyện Nghề Môi Giới #4 | Tuấn Sài Gòn',
       desc: 'Thuế thu nhập, lệ phí trước bạ, phí công chứng... khi mua bán nhà 2026 ai trả và tính thế nào. Tuấn liệt kê rõ để hai bên thỏa thuận sòng phẳng, tránh lúng túng lúc ra công chứng.\n\nKênh Tuấn Sài Gòn — chuyện nghề môi giới nhà phố Sài Gòn.\n#thuenha #muabannha #batdongsan #tuansaigon #phitruocba' },
  5: { file: 'PODCAST-Tap5-dixemnha.mp4',
       title: "Đi xem nhà cần để ý gì để không bị 'úp' | Chuyện Nghề Môi Giới #5 | Tuấn Sài Gòn",
       desc: 'Xem nhà ban ngày hay tối, nhìn vết nứt - thấm - lún ra sao, kiểm điện nước thế nào. Tuấn chia sẻ checklist đi xem nhà từ kinh nghiệm thực tế để không bị che khuyết điểm.\n\nKênh Tuấn Sài Gòn — chuyện nghề môi giới nhà phố Sài Gòn.\n#xemnha #kinhnghiemmuanha #batdongsan #tuansaigon #nhapho' },
  6: { file: 'PODCAST-Tap6-quyhoach-logioi.mp4',
       title: 'Kiểm tra quy hoạch, lộ giới trước khi mua nhà | Chuyện Nghề Môi Giới #6 | Tuấn Sài Gòn',
       desc: 'Mua trúng nhà dính quy hoạch, lộ giới — nỗi sợ lớn nhất của người mua nhà, mà hoàn toàn kiểm tra trước được, miễn phí. Tuấn chỉ cách tra cổng thông tin quy hoạch chính thức của thành phố, cách đọc sổ hồng nhận ra phần đất lộ giới, khi nào nhà dính lộ giới vẫn đáng mua và cách trừ giá cho đúng.\n\nCô chú anh chị từng ưng một căn rồi mở sổ ra mới thấy dính lộ giới chưa? Kể Tuấn nghe dưới bình luận.\n\nKênh Tuấn Sài Gòn — chuyện nghề môi giới nhà phố Sài Gòn.\n#quyhoach #logioi #muanha #batdongsan #tuansaigon' },
  7: { file: 'PODCAST-Tap7-noxau-cic.mp4',
       title: 'Nợ xấu CIC — lỡ dính rồi có vay mua nhà được không? | Chuyện Nghề Môi Giới #7 | Tuấn Sài Gòn',
       desc: 'Cái thẻ tín dụng quên trả từ chục năm trước có thể chặn đứng hồ sơ vay mua nhà hôm nay. Tuấn nói rõ: 5 nhóm nợ trên CIC là gì, cách tự tra miễn phí bằng app CIC Credit Connect, nhóm nào còn cửa vay, lộ trình gỡ nợ xấu đúng luật — và vì sao đừng bao giờ tin dịch vụ "xóa nợ xấu cấp tốc".\n\nCô chú anh chị từng bị từ chối hồ sơ vì một vết trễ hạn cũ chưa? Kể Tuấn nghe dưới bình luận.\n\nKênh Tuấn Sài Gòn — chuyện nghề môi giới nhà phố Sài Gòn.\n#noxau #cic #vaymuanha #batdongsan #tuansaigon' },
  8: { file: 'PODCAST-Tap8-mienthue-2026.mp4',
       title: 'Bán nhà duy nhất được MIỄN thuế từ 1/7/2026 | Chuyện Nghề Môi Giới #8 | Tuấn Sài Gòn',
       desc: 'Tin vui cho người bán nhà: từ 1/7/2026, bán căn nhà duy nhất được miễn thuế thu nhập cá nhân 2% (Nghị định 253/2026). Nhưng phải đủ 3 điều kiện: sở hữu duy nhất, đủ 183 ngày, không áp dụng nhà hình thành trong tương lai — hụt một cái là đóng đủ. Tuấn giải thích từng điều kiện, diện miễn khi sang tên trong gia đình, và vì sao đừng khai giá thấp né thuế.\n\nCô chú anh chị có ai bán nhà rồi mới biết mình thuộc diện miễn thuế không? Kể dưới bình luận.\n\nKênh Tuấn Sài Gòn — chuyện nghề môi giới nhà phố Sài Gòn.\n#mienthue #thuenha #bannha #batdongsan #tuansaigon' },
  9: { file: 'PODCAST-Tap9-dinhgia-tranh-ho.mp4',
       title: 'Định giá nhà — vì sao 2 căn cạnh nhau chênh cả tỷ? | Chuyện Nghề Môi Giới #9 | Tuấn Sài Gòn',
       desc: 'Không ai mua hớ vì thiếu tiền — người ta mua hớ vì thiếu điểm so sánh. Tuấn chỉ khung định giá dân trong nghề dùng: quy về đơn giá đất/m², so "táo với táo" đúng nhóm mặt tiền - hẻm xe hơi - hẻm nhỏ, danh sách các yếu tố phải trừ giá, vì sao đừng tin giá tin rao, và quy tắc "giá rẻ bất ngờ luôn có lý do".\n\nCô chú anh chị định giá nhà kiểu nào — tự dò quanh khu hay tin cảm giác? Kể Tuấn nghe dưới bình luận.\n\nKênh Tuấn Sài Gòn — chuyện nghề môi giới nhà phố Sài Gòn.\n#dinhgia #muanha #tranhmuaho #batdongsan #tuansaigon' },
  10: { file: 'PODCAST-Tap10-vibang-giaytay.mp4',
       title: 'Nhà vi bằng, giấy tay — rẻ phân nửa, có nên mua? | Chuyện Nghề Môi Giới #10 | Tuấn Sài Gòn',
       desc: 'Nhà giá bằng 60-70% thị trường, hỏi ra chỉ có vi bằng hoặc giấy tay. Tuấn nói thẳng: vi bằng chỉ chứng minh mình đã ĐƯA TIỀN, không chứng minh mình là CHỦ NHÀ (Nghị định 08/2020 — vi bằng không thay công chứng). Giấy tay dễ bị tuyên vô hiệu, sổ chung thì mọi thứ phụ thuộc người khác. Và nếu lỡ mua rồi — 3 việc cần làm ngay.\n\nQuanh cô chú anh chị có ai mua nhà vi bằng chưa, giờ họ sao rồi? Kể Tuấn nghe dưới bình luận.\n\nKênh Tuấn Sài Gòn — chuyện nghề môi giới nhà phố Sài Gòn.\n#vibang #giaytay #sochung #muanha #tuansaigon' },
};

const n = String(process.argv[2] || '').replace(/\D/g, '');
const ep = EP[n];
if (!ep) { console.error('Không có tập ' + n + '. Có: ' + Object.keys(EP).join(', ')); process.exit(1); }
if (ep.title.length > YT_MAX_TITLE) {
  console.error(`❌ DỪNG: tiêu đề tập ${n} dài ${ep.title.length} ký tự, YouTube chỉ cho ${YT_MAX_TITLE}.`);
  console.error('   Cắt ngắn trong bảng EP rồi chạy lại — nếu cứ gửi, YouTube từ chối LẶNG LẼ (FB vẫn lên, YouTube mất tăm).');
  process.exit(1);
}
const CHI_YT = process.argv.includes('--chi-youtube');   // chỉ đăng YouTube, BỎ FB (28/07: scenario có route fbmode=khong — trước đó cờ này KHÔNG ăn vì route FB lọc kiểu 'khác reel')
const j = async (u, o) => { const r = await fetch(u, o); try { return JSON.parse(await r.text()); } catch (e) { return null; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 1) đẩy lên R2
const key = 'podcast/tap' + n + '.mp4';
const buf = readFileSync(DESK + ep.file);
process.stdout.write(`[1/3] Đẩy tập ${n} lên R2 (${(buf.length / 1048576).toFixed(0)}MB)... `);
await put(key, buf, 'video/mp4');
const url = 'https://anh.tuansaigon.com/' + key;
console.log('OK');

// 2) đọc rec cũ (chống nhầm kết quả lần trước) rồi kích webhook
const old = await j(`${GAS}?action=podlog&key=${KEY}&ep=${n}`);
const oldT = (old && old.rec && old.rec.t) || 0;
process.stdout.write('[2/3] Kích Make đăng YouTube + FB... ');
await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ep: n, video_url: url, title: ep.title, desc: ep.desc, pl: '1', fbmode: CHI_YT ? 'khong' : 'video' }) });   // pl=1: vào playlist podcast · fbmode=video: FB video thường (24/07 scenario router) · 'khong' = bỏ nhánh FB
console.log('đã kích');

// 3) chờ kết quả (upload YouTube ~1-3 phút)
process.stdout.write('[3/3] Chờ đăng xong');
let rec = null;
for (let i = 0; i < 30; i++) {   // tối đa ~5 phút
  await sleep(10000); process.stdout.write('.');
  const r = await j(`${GAS}?action=podlog&key=${KEY}&ep=${n}`);
  if (r && r.rec && r.rec.t && r.rec.t !== oldT) { rec = r.rec; break; }
}
console.log('');
if (!rec) { console.log('⚠️ Chưa thấy kết quả sau 5 phút. Kiểm Make execution scenario 6630431 hoặc Telegram báo cáo.'); process.exit(2); }
console.log('=== KẾT QUẢ TẬP ' + n + ' ===');
if (rec.yt) console.log('📺 YouTube: https://youtu.be/' + rec.yt); else console.log('📺 YouTube: ❌ HỎNG — video VẪN lên kênh với tiêu đề "unknown".\n   ⛔ ĐỪNG chạy lại lệnh này (chỉ tạo thêm video rác). Vào YouTube Studio xoá + đăng tay.');
if (rec.fb) console.log('📘 Facebook: https://www.facebook.com/watch/?v=' + rec.fb); else console.log('📘 Facebook: ❌ không có id (xem log Make)');
if (rec.err) console.log('⚠️ ' + rec.err);
