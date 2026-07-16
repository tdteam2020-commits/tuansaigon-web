// MÁY VIẾT CẨM NANG (blog) — Tuấn chốt 12/07: phủ 100-200 bài pain-point BĐS, GEO/AEO.
// Chạy: source ~/.config/claude-bds/gemini.env && export GEMINI_KEY && node blog.mjs
// Mỗi bài 1 file data/blog/<slug>.json {slug,title,mota,bai,nhom,pub} — file tồn tại = đã viết (resume tự nhiên).
// Lịch ĐĂNG RẢI: 20 bài đầu đăng ngay, còn lại 4 bài/ngày (trường pub — build.mjs chỉ dựng bài tới hạn).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const KEY = process.env.GEMINI_KEY;
if (!KEY) { console.log('Thiếu GEMINI_KEY'); process.exit(1); }
const GEM = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';
mkdirSync('data/blog', { recursive: true });

// ---- kiến thức nghề (brain/) nạp theo nhóm ----
const doc = f => { try { return readFileSync('../brain/' + f, 'utf8').slice(0, 6000); } catch (e) { return ''; } };
const BRAIN = { phaply: doc('04-phap-ly.md'), thamdinh: doc('03-tham-dinh-can.md') + '\n' + doc('02-dinh-gia.md'), khuvuc: doc('01-khu-vuc.md') };

// ---- số liệu THẬT từ kho (cho bài khu vực — chống bịa) ----
let KHO = {};
try {
  const rows = JSON.parse(readFileSync('data/listings.json', 'utf8')).rows.filter(l => l.gia_ty && l.dt);
  for (const l of rows) (KHO[l.quan] = KHO[l.quan] || []).push(l);
} catch (e) {}
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 0; };
const soLieu = quan => {
  const r = KHO[quan] || []; if (r.length < 5) return '';
  const gia = r.map(l => l.gia_ty), ppm = r.map(l => l.gia_ty * 1000 / l.dt);
  return `SỐ LIỆU KHO THẬT (tin đang bán tháng 7/2026, nguồn kho Tuấn Sài Gòn — ĐƯỢC dùng nguyên văn): ${quan}: giá từ ${Math.min(...gia)} tỷ tới ${Math.max(...gia)} tỷ, giá phổ biến quanh ${med(gia)} tỷ, đơn giá đất phổ biến ~${Math.round(med(ppm))} triệu/m².`;
};

// ---- 112 ĐỀ TÀI (slug · đề bài pain-point · nhóm) ----
const T = [];
const D = (s, d, n) => T.push({ s, d, n });
// A. GIAO DỊCH & PHÁP LÝ (30)
D('dat-coc-mua-nha-sao-cho-khong-mat-tien', 'Đặt cọc mua nhà thế nào để không mất tiền oan: cọc bao nhiêu là vừa, ghi gì trong giấy cọc, khi nào được đòi lại', 'phaply');
D('kiem-tra-quy-hoach-truoc-khi-mua-nha', 'Sợ mua trúng nhà dính quy hoạch: cách tự kiểm tra quy hoạch trước khi xuống tiền, các nguồn tra miễn phí', 'phaply');
D('so-chung-so-rieng-khac-gi-nhau', 'Nhà giá rẻ bất ngờ vì "sổ chung": rủi ro thật sự của sổ chung so với sổ riêng, khi nào chấp nhận được', 'phaply');
D('mua-nha-vi-bang-rui-ro', 'Mua nhà giấy tay, vi bằng: vì sao rẻ hơn hẳn thị trường và cái giá phải trả có thể là mất trắng', 'phaply');
D('nha-chua-hoan-cong-co-nen-mua', 'Nhà chưa hoàn công: mua được không, rủi ro gì khi sang tên và cách xử lý hoàn công sau khi mua', 'phaply');
D('thue-phi-khi-mua-ban-nha', 'Mua bán nhà tốn những khoản thuế phí nào: ai trả thuế TNCN, ai trả lệ phí trước bạ, cách tính nhanh', 'phaply');
D('quy-trinh-cong-chung-sang-ten-nha', 'Lần đầu ra công chứng mua nhà: quy trình từng bước, giấy tờ cần mang, các bẫy thường gặp ở khâu thanh toán', 'phaply');
D('thanh-toan-mua-nha-an-toan', 'Giao tiền tỷ khi mua nhà sao cho an toàn: thanh toán qua ngân hàng, phong tỏa tài khoản, tuyệt đối tránh tiền mặt', 'phaply');
D('mua-nha-dang-the-chap-ngan-hang', 'Nhà đang thế chấp ngân hàng: mua được không và quy trình giải chấp 3 bên an toàn', 'phaply');
D('uy-quyen-ban-nha-rui-ro', 'Mua nhà qua hợp đồng ủy quyền: vì sao rủi ro cao và những trường hợp ủy quyền bị vô hiệu', 'phaply');
D('nha-dong-so-huu-mua-ban-sao', 'Nhà đồng sở hữu, nhà của vợ chồng: thiếu 1 chữ ký là giao dịch đổ — kiểm tra thế nào trước khi cọc', 'phaply');
D('mua-nha-thua-ke-can-luu-y', 'Mua nhà từ người thừa kế: các bước kiểm tra để không dính tranh chấp anh em sau này', 'phaply');
D('tranh-chap-loi-di-chung', 'Nhà trong hẻm có lối đi chung: các dạng tranh chấp thường gặp và cách kiểm tra trước khi mua', 'phaply');
D('kiem-tra-nha-co-tranh-chap-khong', 'Cách kiểm tra căn nhà có đang tranh chấp, kê biên, ngăn chặn giao dịch hay không trước khi đặt cọc', 'phaply');
D('so-hong-that-gia-phan-biet', 'Sổ hồng thật hay giả: các cách kiểm tra một cuốn sổ trước khi giao dịch tiền tỷ', 'phaply');
D('dien-tich-so-va-thuc-te-lech-nhau', 'Diện tích trên sổ và đo thực tế lệch nhau: vì sao xảy ra, phần lệch được tính tiền thế nào', 'phaply');
D('nha-nam-trong-lo-gioi', 'Lộ giới là gì và vì sao nhà dính lộ giới mất giá: cách đọc chỉ giới trên sổ và bản đồ', 'phaply');
D('dat-o-dat-xay-dung-hon-hop', 'Đất ở, đất hỗn hợp, đất quy hoạch treo: đọc mục đích sử dụng đất trên sổ để không mua nhầm', 'phaply');
D('mua-nha-cho-nguoi-khac-dung-ten', 'Nhờ người thân đứng tên mua nhà: những vụ mất nhà đau đớn và cách làm đúng nếu bắt buộc', 'phaply');
D('hop-dong-mua-ban-nha-dieu-khoan-quan-trong', 'Những điều khoản buộc phải có trong hợp đồng mua bán nhà: tiến độ thanh toán, phạt cọc, thời điểm bàn giao', 'phaply');
D('mua-nha-co-nguoi-dang-thue', 'Mua nhà đang có người thuê: quyền của người thuê tới đâu, xử lý hợp đồng thuê cũ thế nào', 'phaply');
D('ban-nha-dang-cho-thue-can-gi', 'Bán nhà đang cho thuê: báo trước người thuê ra sao, hợp đồng thuê ảnh hưởng giá bán thế nào', 'phaply');
D('nha-xay-lan-ranh-dat-hang-xom', 'Nhà xây lấn ranh, tường chung với hàng xóm: kiểm tra thế nào và ai chịu chi phí xử lý', 'phaply');
D('phong-cong-chung-hay-van-phong-cong-chung', 'Công chứng nhà nước hay văn phòng công chứng tư: khác nhau gì, phí thế nào, chọn đâu an toàn', 'phaply');
D('giay-to-can-chuan-bi-khi-ban-nha', 'Bán nhà cần chuẩn bị giấy tờ gì: danh sách đầy đủ để không phải chạy đi chạy lại', 'phaply');
D('mua-nha-nguoi-ban-o-nuoc-ngoai', 'Chủ nhà đang ở nước ngoài: giao dịch qua ủy quyền lãnh sự thế nào cho chắc', 'phaply');
D('nha-di-san-thua-ke-chua-khai', 'Nhà cha mẹ để lại chưa khai di sản: vì sao chưa bán được ngay và thủ tục khai nhận mất bao lâu', 'phaply');
D('rut-coc-vi-doi-y-co-doi-duoc-khong', 'Đặt cọc xong đổi ý: khi nào mất cọc, khi nào đòi được, và cách thương lượng ít thiệt nhất', 'phaply');
D('mua-ban-nha-qua-moi-gioi-phi-the-nao', 'Phí môi giới khi mua bán nhà: ai trả, bao nhiêu là chuẩn thị trường, và môi giới phải làm gì cho xứng', 'phaply');
D('bay-lua-dao-mua-ban-nha-pho-bien', 'Các chiêu lừa phổ biến khi mua bán nhà lẻ: giả chủ, bán 1 căn cho nhiều người, sổ giả — và cách phòng', 'phaply');
// B. VAY & TÀI CHÍNH (15)
D('vay-ngan-hang-mua-nha-can-biet', 'Lần đầu vay ngân hàng mua nhà: vay được bao nhiêu phần trăm, thu nhập bao nhiêu thì nên vay, hồ sơ gồm gì', 'taichinh');
D('lai-suat-tha-noi-sau-uu-dai', 'Bẫy lãi suất ưu đãi năm đầu: lãi thả nổi sau ưu đãi tính thế nào, cách tự tính khoản trả hằng tháng', 'taichinh');
D('ngan-hang-dinh-gia-nha-thap-hon-gia-mua', 'Ngân hàng định giá căn nhà thấp hơn giá mình mua: vì sao và xoay xở thế nào cho đủ tiền', 'taichinh');
D('tra-no-truoc-han-phi-phat', 'Trả nợ vay mua nhà trước hạn: phí phạt bao nhiêu, khi nào nên tất toán sớm', 'taichinh');
D('dao-han-ngan-hang-la-gi-khi-nao-can', 'Đáo hạn ngân hàng: khi nào cần, chi phí thật sự và những rủi ro phải biết trước khi làm', 'taichinh');
D('no-xau-co-vay-mua-nha-duoc-khong', 'Dính nợ xấu có vay mua nhà được không: các nhóm nợ, thời gian xóa và cách cải thiện hồ sơ', 'taichinh');
D('vay-mua-nha-can-nguoi-bao-lanh', 'Thu nhập chưa đủ vay: dùng người đồng trả nợ, tài sản bảo đảm thêm thế nào', 'taichinh');
D('mua-nha-bang-tien-vay-toan-bo', 'Muốn mua nhà mà gần như không có vốn: vì sao vay 100% là công thức nguy hiểm, phương án thay thế', 'taichinh');
D('chon-ky-han-vay-15-hay-25-nam', 'Vay 15 năm hay 25 năm: khoản trả hằng tháng, tổng lãi và cách chọn theo dòng tiền gia đình', 'taichinh');
D('the-chap-nha-dang-o-de-mua-can-nua', 'Thế chấp căn đang ở để mua căn thứ hai: điều kiện, tỷ lệ vay và rủi ro dây chuyền', 'taichinh');
D('giai-ngan-mua-nha-dung-thoi-diem', 'Giải ngân khoản vay đúng thời điểm công chứng: quy trình phối hợp 3 bên để không bên nào cầm dao đằng lưỡi', 'taichinh');
D('mua-nha-dau-tu-dong-tien-cho-thue', 'Mua nhà phố cho thuê: cách tính tỷ suất dòng tiền thật (trừ đủ chi phí) trước khi xuống tiền', 'taichinh');
D('nen-mua-nha-hay-tiep-tuc-thue', 'Thuê nhà hay mua nhà: bảng tính thực tế theo lãi vay và giá thuê ở TP.HCM, khi nào mua là đúng', 'taichinh');
D('lam-phat-va-gia-nha-nen-cho-hay-mua', 'Chờ giá nhà giảm hay mua ngay: nhìn từ dữ liệu chu kỳ và chi phí cơ hội của việc chờ', 'taichinh');
D('ban-nha-con-no-ngan-hang', 'Bán căn nhà đang còn nợ ngân hàng: trình tự giải chấp — sang tên và cách nhận tiền an toàn', 'taichinh');
// C. DỊCH VỤ HỒ SƠ (8) — đúng các dịch vụ Tuấn hỗ trợ
D('do-ve-cap-doi-so-khi-nao-can', 'Khi nào phải đo vẽ lại, cấp đổi sổ hồng: sổ cũ mờ, diện tích lệch, nhà sửa khác hiện trạng — thủ tục và thời gian', 'phaply');
D('hoan-cong-nha-o-thu-tuc', 'Hoàn công nhà ở: hồ sơ gồm gì, mất bao lâu, không hoàn công thì bán nhà bị trừ giá ra sao', 'phaply');
D('sang-ten-so-hong-mat-bao-lau', 'Sang tên sổ hồng mất bao lâu và tắc ở đâu: kinh nghiệm rút ngắn thời gian chờ', 'phaply');
D('lam-so-hong-lan-dau-nha-giay-tay', 'Nhà mua giấy tay lâu năm muốn làm sổ: điều kiện được cấp sổ lần đầu và các bước chuẩn bị', 'phaply');
D('chuyen-dat-thanh-tho-cu', 'Chuyển đất lên thổ cư: điều kiện, tiền sử dụng đất tính thế nào, vì sao có lô lên được có lô không', 'phaply');
D('tach-thua-gop-thua-dieu-kien', 'Tách thửa, gộp thửa ở TP.HCM: diện tích tối thiểu, điều kiện đường tiếp giáp và các bước làm', 'phaply');
D('khai-thue-khi-ban-nha-tranh-bi-phat', 'Khai thuế khi bán nhà: khai giá thấp để né thuế nguy hiểm thế nào sau các đợt siết', 'phaply');
D('di-chuc-va-chia-thua-ke-nha-dat', 'Lập di chúc cho nhà đất: làm sao để con cháu không tranh chấp, di chúc thế nào là hợp lệ', 'phaply');
// D. THẨM ĐỊNH CĂN NHÀ (22)
D('hem-xe-hoi-dang-tien-hon-bao-nhieu', 'Hẻm xe hơi đắt hơn hẻm ba gác bao nhiêu là hợp lý: cách định giá chênh lệch theo độ rộng hẻm', 'thamdinh');
D('nha-no-hau-top-hau-gia-tri', 'Nhà nở hậu, tóp hậu: ảnh hưởng giá thật sự bao nhiêu hay chỉ là tâm lý', 'thamdinh');
D('kiem-tra-nha-tham-nut-truoc-khi-mua', 'Đi xem nhà 30 phút phát hiện thấm, nứt, lún: những chỗ phải soi kỹ mà người bán hay che', 'thamdinh');
D('nha-cu-nat-hay-nha-moi-xay-san', 'Mua nhà cũ về xây lại hay mua nhà mới xây sẵn: bài toán chi phí thật từng phương án', 'thamdinh');
D('nha-xay-san-cua-thau-nhan-biet', 'Nhà thầu xây bán: nhận biết nhà xây ẩu, đẹp mã — kiểm tra kết cấu, vật tư thế nào khi đi xem', 'thamdinh');
D('huong-nha-quan-trong-toi-dau', 'Hướng nhà quan trọng tới đâu khi mua nhà phố: giữa phong thủy và thực tế nắng gió TP.HCM', 'thamdinh');
D('nha-goc-2-mat-tien-dinh-gia', 'Nhà góc 2 mặt tiền: cộng thêm bao nhiêu phần trăm giá là hợp lý, khi nào góc lại là điểm trừ', 'thamdinh');
D('chieu-ngang-nha-quan-trong-hon-dien-tich', 'Vì sao nhà ngang 5m ăn đứt nhà ngang 3,2m cùng diện tích: chiều ngang quyết định giá thế nào', 'thamdinh');
D('nha-cap-4-gia-tri-nam-o-dat', 'Mua nhà cấp 4 khu trung tâm: trả tiền cho đất chứ không phải nhà — cách định giá đúng', 'thamdinh');
D('nha-hem-cut-co-nen-mua', 'Nhà cuối hẻm cụt: rẻ hơn bao nhiêu là đáng mua, và những điểm cộng ít ai để ý', 'thamdinh');
D('kiem-tra-phap-ly-hem-truoc-nha', 'Hẻm trước nhà là đất công hay đất tư: vì sao phải kiểm tra và cách tra nhanh', 'thamdinh');
D('nha-gan-cho-truong-hoc-duoc-mat', 'Nhà gần chợ, gần trường: tiện cho ở nhưng được mất gì khi bán lại và cho thuê', 'thamdinh');
D('tang-lung-san-gia-co-tinh-dien-tich', 'Gác lửng, sàn giả, chuồng cọp: phần nào được tính vào diện tích hợp pháp, phần nào là rủi ro', 'thamdinh');
D('nha-2-mat-hem-truoc-sau', 'Nhà thông 2 hẻm trước sau: giá trị khai thác thật và những phiền toái đi kèm', 'thamdinh');
D('mua-nha-mua-luon-noi-that-dinh-gia', 'Mua nhà kèm nội thất: định giá phần nội thất thế nào để không trả tiền đồ cũ giá đồ mới', 'thamdinh');
D('nha-huong-tay-nong-xu-ly', 'Nhà hướng Tây nắng chiều: mất giá bao nhiêu và các cách xử lý nhiệt hiệu quả', 'thamdinh');
D('den-bu-giai-toa-nhin-tu-ban-do', 'Nhà trong diện giải tỏa mở đường: người mất trắng, người trúng lớn — đọc bản đồ để biết mình ở đâu', 'thamdinh');
D('nha-yeu-to-tam-linh-mua-ban', 'Nhà có yếu tố tâm linh: pháp luật không ghi nhưng thị trường trừ giá — ứng xử thế nào khi mua và khi bán', 'thamdinh');
D('xem-nha-buoi-toi-va-ngay-mua', 'Vì sao nên xem căn nhà ít nhất 2 lần: buổi tối và ngày mưa lộ ra những gì', 'thamdinh');
D('dinh-gia-nha-minh-truoc-khi-ban', 'Tự định giá căn nhà trước khi bán: 4 bước tra giá thị trường thật thay vì nghe đồn', 'thamdinh');
D('nha-dat-tang-gia-theo-hem-mo-rong', 'Hẻm sắp mở rộng: cách xác minh thông tin thật giả và định giá phần kỳ vọng', 'thamdinh');
D('mua-nha-cho-thue-tro-phong-cach-toi-uu', 'Mua nhà làm phòng trọ, căn hộ dịch vụ khu trung tâm: bài toán pháp lý PCCC và dòng tiền sau siết', 'thamdinh');
// E. KHU VỰC — số liệu kho thật (17)
D('mat-bang-gia-nha-phu-nhuan', 'Mặt bằng giá nhà Phú Nhuận hiện nay theo tin đang bán thật: phân khúc nào nhiều hàng nhất, ngân sách bao nhiêu thì có cửa', 'khuvuc:Phú Nhuận');
D('mat-bang-gia-nha-quan-1', 'Giá nhà Quận 1 theo tin đang bán thật: từ nhà hẻm nhỏ tới mặt tiền — ngân sách nào chen chân được', 'khuvuc:Quận 1');
D('mat-bang-gia-nha-quan-3', 'Mặt bằng giá nhà Quận 3: khu biệt thự cũ, nhà hẻm xe hơi — số liệu từ tin đang bán thật', 'khuvuc:Quận 3');
D('mat-bang-gia-nha-quan-5', 'Giá nhà Quận 5 người Hoa: đặc thù khu chợ, nhà mặt tiền kinh doanh — số liệu tin thật', 'khuvuc:Quận 5');
D('mat-bang-gia-nha-quan-10', 'Mặt bằng giá nhà Quận 10: trung tâm y tế - giáo dục, nhà hẻm thông — số liệu từ tin đang bán', 'khuvuc:Quận 10');
D('mat-bang-gia-nha-binh-thanh', 'Giá nhà Bình Thạnh sát Quận 1: chênh lệch từng khu vực trong quận — số liệu tin thật', 'khuvuc:Bình Thạnh');
D('mat-bang-gia-nha-tan-binh', 'Mặt bằng giá nhà Tân Bình khu sân bay: phường nào đáng tiền — số liệu từ tin đang bán', 'khuvuc:Tân Bình');
D('mat-bang-gia-nha-go-vap', 'Giá nhà Gò Vấp giáp Phú Nhuận: vùng giá mềm cuối cùng của khu trung tâm — số liệu tin thật', 'khuvuc:Gò Vấp');
D('5-ty-mua-duoc-nha-gi-khu-trung-tam', 'Có 5 tỷ mua được nhà gì ở khu trung tâm TP.HCM: những lựa chọn thật và đánh đổi từng phương án', 'khuvuc:Phú Nhuận');
D('10-ty-mua-nha-quan-nao', '10 tỷ nên mua nhà quận nào: so sánh cùng ngân sách giữa Phú Nhuận, Quận 3, Bình Thạnh, Quận 10', 'khuvuc:Quận 3');
D('20-ty-nha-mat-tien-hay-hem-vip', '20 tỷ chọn mặt tiền quận ven hay hẻm VIP quận trung tâm: bài toán ở và giữ tiền', 'khuvuc:Phú Nhuận');
D('phu-nhuan-vs-binh-thanh-mua-dau', 'Phú Nhuận hay Bình Thạnh: cùng tầm tiền chọn bên nào — so từng tiêu chí ở thật', 'khuvuc:Bình Thạnh');
D('quan-3-vs-quan-10-nha-hem', 'Nhà hẻm Quận 3 hay Quận 10: chênh giá bao nhiêu và có đáng không', 'khuvuc:Quận 10');
D('khu-phan-xich-long-dang-song', 'Khu Phan Xích Long Phú Nhuận: vì sao giá cao hơn mặt bằng quận và có xứng đáng', 'khuvuc:Phú Nhuận');
D('nha-gan-san-bay-tan-binh-on-ao', 'Mua nhà gần sân bay Tân Sơn Nhất: tiếng ồn, tĩnh không và giá — những điều phải cân', 'khuvuc:Tân Bình');
D('sap-nhap-phuong-2025-anh-huong-gia-nha', 'TP.HCM bỏ cấp quận từ 7/2025: tên phường mới ảnh hưởng gì tới sổ, địa chỉ và giá nhà', 'khuvuc:Quận 3');
D('khu-nguyen-trong-tuyen-hem-xe-hoi', 'Trục Nguyễn Trọng Tuyển - Huỳnh Văn Bánh: thủ phủ nhà hẻm xe hơi Phú Nhuận — giá và đặc điểm', 'khuvuc:Phú Nhuận');
// F. CHIẾN LƯỢC MUA/BÁN (20)
D('lan-dau-mua-nha-lo-trinh-6-buoc', 'Lần đầu mua nhà: lộ trình 6 bước từ lúc gom đủ tiền cọc tới ngày nhận sổ', 'chienluoc');
D('tra-gia-mua-nha-nghe-thuat', 'Trả giá khi mua nhà: đọc vị chủ nhà đang cần gì và mức giảm thực tế của thị trường nhà lẻ', 'chienluoc');
D('dau-hieu-tin-dang-ao-gia-ao', 'Nhận diện tin đăng ảo, giá ảo: những dấu hiệu lộ liễu và cách kiểm tra chéo', 'chienluoc');
D('chon-moi-gioi-dang-tin', 'Chọn môi giới đáng tin khi mua bán nhà lẻ: các câu hỏi thử và cờ đỏ phải tránh', 'chienluoc');
D('ban-nha-nhanh-khong-bi-ep-gia', 'Bán nhà cần tiền gấp mà không bị ép giá: chuẩn bị gì trước 2 tuần rao bán', 'chienluoc');
D('dang-tin-ban-nha-hieu-qua', 'Tự đăng tin bán nhà: chụp ảnh, viết tin, để số thế nào cho ra khách thật thay vì cò gọi', 'chienluoc');
D('nha-rao-mai-khong-ban-duoc-vi-sao', 'Căn nhà rao nửa năm không ai mua: 5 lý do thật và cách sửa từng lý do', 'chienluoc');
D('thoi-diem-tot-trong-nam-mua-ban-nha', 'Mua bán nhà mùa nào trong năm dễ nhất: nhịp thị trường trước Tết, sau Tết và mùa Ngâu', 'chienluoc');
D('dan-xep-lich-xem-nha-hieu-qua', 'Đi xem 10 căn cuối tuần: cách xếp lịch, ghi chú so sánh để không loạn thông tin', 'chienluoc');
D('mua-nha-o-ket-hop-kinh-doanh', 'Mua nhà vừa ở vừa kinh doanh: tiêu chí chọn vị trí, công năng và những ngành phù hợp nhà phố', 'chienluoc');
D('nang-cap-nha-truoc-khi-ban-dang-khong', 'Sơn sửa trước khi bán nhà: khoản nào đáng bỏ tiền, khoản nào vô ích', 'chienluoc');
D('mua-nha-cu-giu-lai-hay-dap-xay', 'Mua nhà cũ: giữ sửa hay đập xây mới — ngưỡng chi phí để quyết định', 'chienluoc');
D('ban-nha-de-doi-can-lon-hon', 'Bán căn đang ở để đổi căn lớn hơn: trình tự bán trước mua sau hay mua trước bán sau', 'chienluoc');
D('mua-nha-cho-con-hoc-truong-diem', 'Mua nhà theo tuyến trường cho con: kiểm tra phân tuyến thế nào và trả thêm bao nhiêu là hợp lý', 'chienluoc');
D('nguoi-lon-tuoi-ban-nha-duong-gia', 'Cha mẹ lớn tuổi bán nhà dưỡng già: phương án ở đâu, giữ tiền thế nào an toàn', 'chienluoc');
D('mua-chung-nha-voi-ban-be', 'Chung tiền mua nhà với bạn bè, anh em: cấu trúc đứng tên và thỏa thuận phải làm từ đầu', 'chienluoc');
D('dau-tu-nha-pho-vs-can-ho', 'Đầu tư nhà phố lẻ hay căn hộ: thanh khoản, dòng tiền, tăng giá — so thẳng từng tiêu chí', 'chienluoc');
D('giu-tien-hay-mua-nha-luc-thi-truong-cham', 'Thị trường chậm: người có sẵn tiền nên gom hàng hay chờ — nhìn từ hành vi người bán thật', 'chienluoc');
D('mua-nha-tu-tin-chinh-chu', 'Săn tin chính chủ để né phí môi giới: được gì mất gì, và những rủi ro ít ai kể', 'chienluoc');
D('ho-so-mua-nha-cho-nguoi-tu-kinh-doanh', 'Người kinh doanh tự do khó chứng minh thu nhập: cách chuẩn bị hồ sơ mua nhà - vay vốn từ sớm', 'chienluoc');

// ---- SYS prompt (luật content Tuấn + style pain-point từ memory faq-pain-point) ----
const SYS = `Bạn là Tuấn Sài Gòn — môi giới bất động sản trực tiếp hơn 5 năm ở khu trung tâm TP.HCM (Quận 1, 3, 5, 10, Phú Nhuận, Bình Thạnh, Gò Vấp, Tân Bình), viết CẨM NANG cho người mua/bán nhà lẻ trên website tuansaigon.com.
PHONG CÁCH: viết như người trong nghề kể cho khách nghe — chững chạc, đời thường, thuần Việt 100%, có ví dụ tiền tỷ cụ thể kiểu Sài Gòn. Xưng "Tuấn" khi kể kinh nghiệm thực tế. KHÔNG icon, KHÔNG hashtag, KHÔNG xen tiếng Anh, KHÔNG "cơ hội vàng/hiếm có/đừng bỏ lỡ/liên hệ ngay/inbox".
TIÊU ĐỀ: phải là NỖI LO hay TÌNH HUỐNG THẬT của khách (kiểu "Sợ mất cọc khi...", "Nhà rao mãi không bán được..."), TUYỆT ĐỐI không đặt kiểu định nghĩa vô tri "X là gì?". Định nghĩa thuật ngữ thì đan tự nhiên vào trong bài.
CẤU TRÚC: mở bài 2-4 câu vào thẳng tình huống; 3-5 mục <h2> tiêu đề cụ thể; đoạn văn ngắn 2-4 câu; chỗ liệt kê dùng <ul><li>; kết bài 2-4 câu thực dụng (KHÔNG kêu gọi liên hệ — website tự thêm nút gọi).
ĐỘ DÀI: 750-1100 từ.
CHÍNH XÁC (lĩnh vực pháp lý - tiền bạc, bịa sai là hại khách): ⛔ TUYỆT ĐỐI KHÔNG BỊA con số SỐ TIỀN CỤ THỂ bằng "triệu/đồng" (vd "trọn gói 11 triệu", "cọc 300 triệu", "phí 8 triệu") và KHÔNG bịa THỜI GIAN xử lý cụ thể (vd "mất 7 ngày") — mấy cái này tùy hồ sơ/thời điểm/nơi làm, ghi số cứng là dễ sai; hãy nói ĐỊNH TÍNH ("tùy hồ sơ và thời điểm", "có gói phổ thông rẻ hơn nhưng lâu hơn và gói nhanh phí cao hơn", "nên hỏi trực tiếp để được báo đúng"). ✅ ĐƯỢC nêu các NGƯỠNG % CHUẨN thông dụng của ngành (vd đặt cọc thường 5-10% giá trị, ngân hàng cho vay tối đa ~70% giá trị nhà, thuế thu nhập cá nhân 2% giá chuyển nhượng, phí môi giới thường 1-2%) NHƯNG phải kèm chữ "thường/khoảng" + câu "mức này theo quy định/thông lệ hiện hành, có thể thay đổi — khi làm nên xác nhận lại". KHÔNG bịa số điều luật, mức phạt cụ thể. Con số THỊ TRƯỜNG/GIÁ chỉ dùng khi dữ liệu có dòng "SỐ LIỆU KHO THẬT" (ghi rõ nguồn kho, tháng 7/2026).
TRẢ VỀ DUY NHẤT JSON (không markdown, không giải thích): {"title":"tiêu đề pain-point ≤75 ký tự","mota":"mô tả 140-160 ký tự cho Google","bai":"nội dung HTML chỉ dùng thẻ <p> <h2> <ul> <li> <b>"}`;

// ---- lịch đăng rải: 20 bài đầu hôm nay, sau đó 4 bài/ngày ----
const d0 = new Date();
const pubOf = i => { const d = new Date(d0); if (i >= 20) d.setDate(d.getDate() + 1 + Math.floor((i - 20) / 4)); return d.toISOString().slice(0, 10); };

const wait = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, loi = 0, idx = -1;
for (const t of T) {
  idx++;
  const f = `data/blog/${t.s}.json`;
  if (existsSync(f)) continue;
  const [nhom, quan] = t.n.split(':');
  const ctx = [BRAIN[nhom] ? 'KIẾN THỨC NGHỀ THAM KHẢO (chắt lọc ý đúng, không bê nguyên văn):\n' + BRAIN[nhom] : '', quan ? soLieu(quan) : ''].filter(Boolean).join('\n\n');
  let thu = 0, done = false;
  while (thu < 5 && !done) {
    thu++;
    try {
      const r = await fetch(GEM, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify({ system_instruction: { parts: [{ text: SYS }] },
          contents: [{ parts: [{ text: `ĐỀ BÀI: ${t.d}\n\n${ctx}` }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 8000, responseMimeType: 'application/json' } }) });
      if (r.status === 429) { const b = await r.text(); if (/PerDay/.test(b)) { console.log('\nHẾT QUOTA NGÀY — chạy lại sau.'); process.exit(0); } await wait(65000); continue; }
      const j = await r.json();
      const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      const o = JSON.parse(txt.replace(/```json|```/g, ''));
      if (!o.title || !o.bai || o.bai.length < 1500) throw new Error('bài ngắn/thiếu');
      if (/\b0\d{9,10}\b/.test(o.bai.replace(/0777088622/g, ''))) o.bai = o.bai.replace(/\b0\d{9,10}\b/g, '');
      writeFileSync(f, JSON.stringify({ slug: t.s, title: o.title.trim(), mota: String(o.mota || '').trim().slice(0, 170), bai: o.bai, nhom, pub: pubOf(idx) }));
      ok++; done = true;
      if (ok % 10 === 0) process.stdout.write(`${ok} bài... `);
    } catch (e) { if (thu >= 5) { loi++; console.log(`\n✗ ${t.s}: ${String(e).slice(0, 80)}`); } else await wait(3000); }
  }
  await wait(1200);
}
console.log(`\n✓ Viết xong ${ok} bài mới (lỗi ${loi}) · tổng đề tài ${T.length}`);
