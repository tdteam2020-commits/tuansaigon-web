// NỘI DUNG TĨNH cho website Tuấn Sài Gòn — bài khu vực + hỏi đáp.
// Nguồn: brain/ (01-khu-vuc, 04-phap-ly phần CÔNG KHAI, 06-thuat-ngu) + memory sáp nhập 2025.
// LUẬT: không bịa địa danh/số liệu; kiến thức phí dịch vụ NỘI BỘ không đưa lên đây.

export const BRAND = {
  name: 'Tuấn Sài Gòn',
  phone: '0777088622',
  phoneIntl: '+84777088622',
  tagline: 'Môi giới nhà phố – biệt thự khu trung tâm TP.HCM',
  areasText: 'Quận 1, Quận 3, Quận 5, Quận 10, Phú Nhuận, Bình Thạnh, Gò Vấp, Tân Bình và khu cao cấp Quận 2 (Thảo Điền), Quận 7 (Phú Mỹ Hưng)',
};

// Kênh mạng xã hội (điền dần — link nào có thì hiện + vào sameAs JSON-LD để AI nhận diện thương hiệu)
export const SOCIAL = [
  { ten: 'Facebook', url: 'https://www.facebook.com/tuansaigon.bds' },
  // YouTube tạm gỡ 12/07 (kênh @Tuansaigon-bds die) — có kênh mới thì thêm lại dòng này
  { ten: 'Threads', url: 'https://www.threads.com/@tuansaigon_nhapho' },
  { ten: 'TikTok', url: 'https://www.tiktok.com/@tuansaigon.bds' },
  { ten: 'Zalo', url: 'https://zalo.me/0777088622' },
];

// slug -> bài khu vực. `intro` là đoạn mở (fact đã xác minh), `faq` là hỏi-đáp riêng khu (câu giá sẽ được build tự điền số liệu kho).
export const AREAS = [
  {
    slug: 'quan-1', quan: 'Quận 1', ten: 'Quận 1 (cũ)',
    intro: [
      'Quận 1 là trung tâm hành chính – thương mại của TP.HCM, nơi tập trung các tuyến đường giá trị nhất thành phố. Nhà phố khu này vừa để ở vừa là tài sản tích trữ được giới đầu tư ưa chuộng.',
      'Khu vực có hai cộng đồng quốc tế nổi bật: Phố Tây Bùi Viện – Phạm Ngũ Lão – Đề Thám (du khách và người nước ngoài, sôi động về đêm, hợp khai thác homestay, ẩm thực, căn hộ dịch vụ) và Phố Nhật quanh Lê Thánh Tôn – Thái Văn Lung với hơn 70 hàng quán Nhật (hợp cho thuê khách Nhật, nhà hàng, spa).',
      'Từ 1/7/2025, TP.HCM bỏ cấp quận theo mô hình chính quyền 2 cấp; các phường của Quận 1 cũ được sáp nhập thành phường mới. Người dân và giới môi giới vẫn quen gọi "Quận 1" nên trang này giữ tên gọi cũ cho dễ tra cứu.',
    ],
    faq: [],
  },
  {
    slug: 'quan-3', quan: 'Quận 3', ten: 'Quận 3 (cũ)',
    intro: [
      'Quận 3 nằm sát Quận 1, nổi tiếng với những tuyến đường rợp cây xanh và quỹ nhà biệt thự từ thời Pháp. Đây là một trong những khu được khách mua để ở lẫn giới đầu tư săn đón nhất TP.HCM.',
      'Sau sáp nhập hành chính 1/7/2025, địa bàn Quận 3 cũ gồm 3 phường mới: Bàn Cờ, Xuân Hòa và Nhiêu Lộc (phường Nhiêu Lộc gộp từ các phường 9, 11, 12, 14 cũ, chạy dọc kênh Nhiêu Lộc – Thị Nghè). Khi tra cứu nhà đất, anh chị có thể gặp cả tên phường cũ lẫn mới — cả hai đều chỉ cùng một khu vực.',
      'Vùng giáp ranh Quận 3 – Phú Nhuận – Tân Bình (các phường 12, 13, 14 Quận 3 cũ) có dân cư, hạ tầng và mặt bằng giá tương đồng nhau; khách tìm nhà một trong ba khu này thường xem thêm hai khu còn lại để rộng lựa chọn.',
    ],
    faq: [
      { q: 'Quận 3 sau sáp nhập 2025 gồm những phường nào?', a: 'Từ 1/7/2025, địa bàn Quận 3 cũ gồm 3 phường mới: Bàn Cờ, Xuân Hòa và Nhiêu Lộc. Tên gọi "Quận 3" vẫn được dùng phổ biến trong giao dịch nhà đất.' },
    ],
  },
  {
    slug: 'quan-5', quan: 'Quận 5', ten: 'Quận 5 (cũ)',
    intro: [
      'Quận 5 là trái tim của khu Chợ Lớn — cộng đồng người Hoa hình thành từ năm 1778, buôn bán sầm uất bậc nhất thành phố với nhiều dãy nhà phố thương mại và kiến trúc cổ.',
      'Nhà phố Quận 5 mạnh về khai thác kinh doanh: vị trí gần các chợ sỉ, bệnh viện lớn và trường học nên nhu cầu thuê mặt bằng, phòng khám, cửa hàng luôn ổn định.',
      'Sau sáp nhập hành chính 1/7/2025 các phường được gộp thành phường mới; tên gọi "Quận 5" vẫn thông dụng khi mua bán nhà đất.',
    ],
    faq: [],
  },
  {
    slug: 'quan-10', quan: 'Quận 10', ten: 'Quận 10 (cũ)',
    intro: [
      'Quận 10 nằm giữa trục kết nối Quận 1 – Quận 5 – Tân Bình, dân cư đông và tiện ích dày: trường học, bệnh viện, trung tâm thương mại. Nhà phố khu này được cả người mua ở thực lẫn giới khai thác cho thuê quan tâm.',
      'Sau sáp nhập hành chính 1/7/2025 các phường được gộp thành phường mới; tên gọi "Quận 10" vẫn thông dụng khi giao dịch.',
    ],
    faq: [],
  },
  {
    slug: 'phu-nhuan', quan: 'Phú Nhuận', ten: 'Phú Nhuận (cũ)',
    intro: [
      'Phú Nhuận là quận nội thành nhỏ gọn nằm giữa Quận 1, Quận 3, Bình Thạnh và Tân Bình — vị trí "đi đâu cũng gần". Khu Phan Xích Long nổi tiếng là phố ẩm thực nhộn nhịp, giá trị cho thuê tốt.',
      'Nhà bên Phú Nhuận sát các cây cầu bắc qua kênh Nhiêu Lộc – Thị Nghè thực tế chỉ cách Quận 1, Quận 3 đúng một cây cầu, trong khi mặt bằng giá mềm hơn — đây là lựa chọn quen thuộc của khách muốn "gần trung tâm nhưng vừa túi tiền hơn".',
      'Vùng giáp ranh Phú Nhuận – Quận 3 – Tân Bình có dân cư và mặt bằng giá tương đồng; khách tìm nhà khu này thường xem cả ba để rộng lựa chọn. Sau sáp nhập 1/7/2025, các phường được gộp thành phường mới; tên "Phú Nhuận" vẫn dùng phổ biến.',
    ],
    faq: [],
  },
  {
    slug: 'binh-thanh', quan: 'Bình Thạnh', ten: 'Bình Thạnh (cũ)',
    intro: [
      'Bình Thạnh giáp trực tiếp Quận 1, có khu Vinhomes Central Park – Landmark 81 và nhiều trục đường lớn. Nhà bên Bình Thạnh sát các cây cầu bắc qua kênh Nhiêu Lộc – Thị Nghè chỉ cách Quận 1 đúng một cây cầu, giá lại mềm hơn hẳn khu lõi trung tâm.',
      'Quỹ nhà đa dạng từ nhà hẻm vừa túi tiền đến nhà mặt tiền kinh doanh, phù hợp cả mua ở thực lẫn đầu tư cho thuê. Sau sáp nhập 1/7/2025, các phường được gộp thành phường mới; tên "Bình Thạnh" vẫn dùng phổ biến.',
    ],
    faq: [],
  },
  {
    slug: 'go-vap', quan: 'Gò Vấp', ten: 'Gò Vấp (cũ)',
    intro: [
      'Gò Vấp là quận dân cư đông đúc phía Bắc thành phố, gần sân bay Tân Sơn Nhất. Mặt bằng giá mềm hơn khu lõi trung tâm nên đây là điểm đến quen thuộc của khách mua căn nhà đầu tiên và giới đầu tư dòng tiền.',
      'Tuấn Sài Gòn tập trung tuyển tin ở các phường giáp Phú Nhuận – Tân Bình (khu phường 1, phường 3 cũ) — vùng kết nối trung tâm thuận tiện nhất của Gò Vấp. Sau sáp nhập 1/7/2025, các phường được gộp thành phường mới; tên "Gò Vấp" vẫn dùng phổ biến.',
    ],
    faq: [],
  },
  {
    slug: 'tan-binh', quan: 'Tân Bình', ten: 'Tân Bình (cũ)',
    intro: [
      'Tân Bình nằm cạnh sân bay Tân Sơn Nhất, dân cư sầm uất. Khu Super Bowl – K300 – Phạm Văn Hai có cộng đồng người Hàn Quốc đông, nhu cầu thuê nhà và mặt bằng dịch vụ tốt.',
      'Tuấn Sài Gòn tập trung tuyển tin ở các phường 1–5 (cũ) — vùng giáp Phú Nhuận và Quận 3, dân cư, hạ tầng và mặt bằng giá tương đồng hai khu này. Sau sáp nhập 1/7/2025, các phường được gộp thành phường mới; tên "Tân Bình" vẫn dùng phổ biến.',
    ],
    faq: [],
  },
  {
    slug: 'quan-2-thao-dien', quan: 'Quận 2', ten: 'Quận 2 – Thảo Điền (cũ)',
    intro: [
      'Khu Thảo Điền – An Phú (Quận 2 cũ, nay thuộc khu vực Thủ Đức) là nơi tập trung cộng đồng người nước ngoài lớn nhất TP.HCM với trường quốc tế, biệt thự và căn hộ cao cấp ven sông.',
      'Tuấn Sài Gòn tuyển chọn dòng sản phẩm cao cấp tại đây: biệt thự, nhà phố khu compound — phù hợp khách mua ở tầm cao hoặc khai thác cho thuê expat.',
    ],
    faq: [],
  },
  {
    slug: 'quan-7-phu-my-hung', quan: 'Quận 7', ten: 'Quận 7 – Phú Mỹ Hưng (cũ)',
    intro: [
      'Phú Mỹ Hưng (Quận 7 cũ) là khu đô thị kiểu mẫu quy hoạch bài bản, nơi có cộng đồng người Hàn Quốc đậm nhất TP.HCM. Hạ tầng, trường học, tiện ích đồng bộ; sản phẩm chủ đạo là nhà phố, biệt thự và shophouse cao cấp.',
      'Tuấn Sài Gòn tuyển chọn dòng sản phẩm cao cấp tại đây cho khách mua ở tầm cao và giới đầu tư cho thuê khách nước ngoài.',
    ],
    faq: [],
  },
];

// Hỏi đáp CHUNG (trang /hoi-dap) — viết theo PAIN POINT thật của khách (Tuấn chốt 10/07: bỏ câu định nghĩa vô tri).
// 4 câu ĐẦU hiện ở trang chủ. Đáp án bám brain/ + thông lệ nghề, chỗ nhạy cảm có chữ "thông thường/khoảng".
export const FAQ = [
  {
    q: 'Làm sao biết căn nhà mình định mua có bị chào giá cao hơn thị trường (mua hớ)?',
    a: 'Cách thực dụng nhất: quy giá về đơn giá đất trên mỗi m² rồi so với các căn cùng loại trong khu — phải so đúng "táo với táo": cùng loại hẻm hay mặt tiền, cùng tầm diện tích, cùng tình trạng pháp lý. Trang khu vực của web này công bố sẵn khoảng giá và mức giá phổ biến tính từ tin thật đang bán để anh chị đối chiếu nhanh. Cần chắc tay hơn, gọi 0777088622 đọc căn đang xem — Tuấn đối chiếu kho tin và nói thẳng mức đó cao hay hợp lý.',
  },
  {
    q: 'Trước khi đặt cọc, kiểm tra quy hoạch và lộ giới thế nào để không mua nhầm nhà dính quy hoạch?',
    a: 'Đừng tin miệng lời rao "không quy hoạch". Cầm đúng số tờ, số thửa trên sổ đi xin thông tin quy hoạch tại phường hoặc tra ứng dụng quy hoạch của thành phố, nhìn rõ hai thứ: nhà có nằm trong ranh dự án/quy hoạch treo không, và lộ giới cắt vào nhà bao nhiêu mét. Nhà dính lộ giới có thể bị lùi hoặc mất một phần diện tích khi mở đường — phần đó phải trừ thẳng vào giá. Đây là bước Tuấn luôn kiểm giùm khách trước khi xuống cọc.',
  },
  {
    q: 'Đặt cọc thế nào để không bị mất cọc, không bị bẻ kèo?',
    a: 'Quan trọng không phải cọc ít hay nhiều (mức cọc do hai bên thỏa thuận) mà là hợp đồng cọc phải chặt: ghi rõ thời hạn ra công chứng, ai chịu thuế phí, phạt cọc nếu bên bán đổi ý, và tình trạng pháp lý căn nhà (sổ, thế chấp, quy hoạch) ngay trong hợp đồng. Căn giá trị lớn nên công chứng hợp đồng cọc. Nhà đang thế chấp ngân hàng vẫn cọc được — xem câu riêng bên dưới.',
  },
  {
    q: 'Nhà rẻ bất ngờ vì "sổ chung", "mua bán vi bằng" — có nên liều không?',
    a: 'Không nên, trừ khi anh chị hiểu rất rõ mình đang mua gì. Nhà sổ chung không tự định đoạt được tài sản, gần như không vay được ngân hàng, tranh chấp rất khó xử lý; còn vi bằng chỉ ghi nhận việc giao tiền, không phải hợp đồng chuyển nhượng hợp pháp. Giá rẻ hơn hẳn thị trường luôn có lý do — với tài sản tiền tỷ, ưu tiên nhà sổ hồng riêng, pháp lý sạch.',
  },
  {
    q: 'Nhà xây thêm tầng nhưng chưa hoàn công — mua có rủi ro gì?',
    a: 'Rủi ro chính: phần xây thêm không có trên giấy tờ nên ngân hàng chỉ định giá theo phần được công nhận (vay được ít hơn), và khi sang tên chỉ mua bán được phần trên sổ. Nhà chưa hoàn công vẫn giao dịch bình thường nếu mình biết rõ và trừ đúng vào giá; cần kiểm thêm phần xây thêm có nguy cơ bị buộc tháo dỡ theo quy hoạch không. Nên nhờ người rành pháp lý soát hồ sơ trước khi cọc.',
  },
  {
    q: 'Mua nhà vay ngân hàng cần lưu ý gì? Nhà nào ngân hàng chê?',
    a: 'Ngân hàng chuộng nhà sổ hồng riêng, hoàn công đủ, không dính quy hoạch; sổ chung, vi bằng, nhà sai hiện trạng thường bị từ chối hoặc định giá thấp. Mẹo quan trọng: nhờ ngân hàng thẩm định hạn mức vay trên chính căn định mua TRƯỚC khi chốt cọc (định giá ngân hàng thường thấp hơn giá thị trường), tránh cảnh cọc rồi vay không đủ. Hiện một số ngân hàng còn có cơ chế bên thứ ba kiểm tra pháp lý để giải ngân sớm cho bên bán trước khi sang tên xong — giao dịch nhanh gọn hơn hẳn, Tuấn tư vấn cụ thể theo từng trường hợp.',
  },
  {
    q: 'Nhà đang thế chấp ngân hàng có đặt cọc, mua bán được không?',
    a: 'Được, và khá phổ biến. Theo hướng dẫn nghiệp vụ mới của Bộ Tư pháp (công văn 4908/BTP-BTTP ngày 1/7/2026), hợp đồng đặt cọc nhà đang thế chấp KHÔNG bắt buộc phải có văn bản đồng ý của ngân hàng — chỉ hợp đồng mua bán chính thức mới cần xử lý xong nghĩa vụ thế chấp. Thực tế, hợp đồng cọc thường ghi rõ "chỉ chuyển nhượng sau khi bên bán hoàn thành nghĩa vụ với ngân hàng và giải chấp". Mỗi hồ sơ công chứng vẫn được xem xét cụ thể, nên cần người có kinh nghiệm soạn điều khoản chặt chẽ.',
  },
  {
    q: 'Có cách nào thanh toán an toàn khi mua nhà giá trị lớn không?',
    a: 'Có — hình thức ký quỹ qua ngân hàng (tương tự escrow ở nước ngoài): bên mua nộp tiền vào ngân hàng, ngân hàng phong tỏa khoản tiền này; khi sổ đã sang tên bên mua, các bên cùng lên ngân hàng gỡ phong tỏa để bên bán nhận tiền. Cách này bảo vệ cả hai phía — bên mua không sợ mất tiền khi chưa ra sổ, bên bán yên tâm tiền đã nằm sẵn ở ngân hàng. Một số ngân hàng như ACB có dịch vụ này, phí tính theo phần trăm giá trị hợp đồng.',
  },
  {
    q: 'Mua nhà qua môi giới, người mua có mất phí không? Làm sao tránh bị "ăn chênh"?',
    a: 'Thông lệ tại TP.HCM: hoa hồng do bên bán trả theo thỏa thuận, người mua không mất phí môi giới. Muốn chắc không bị ăn chênh lệch giá: yêu cầu đàm phán trực tiếp với chủ nhà và giá chốt ghi thẳng vào hợp đồng cọc ký với chủ. Tuấn làm đúng nguyên tắc này — khách mua không mất đồng phí nào, giá làm việc thẳng với chủ.',
  },
  {
    q: 'Bán căn nhà duy nhất có được miễn thuế thu nhập cá nhân?',
    a: 'Có — trường hợp bán nhà ở, đất ở DUY NHẤT đang đứng tên, người bán được miễn thuế thu nhập cá nhân chuyển nhượng. Lưu ý quan trọng: cam kết nhà ở duy nhất bắt buộc người bán ký trực tiếp tại Việt Nam, không được ủy quyền ký thay — chủ nhà đang ở nước ngoài vẫn phải về ký. Chính sách thuế có thể thay đổi theo thời điểm, nên xác nhận lại khi giao dịch.',
  },
  {
    q: 'Nhà hẻm xe hơi đắt hơn hẻm nhỏ khá nhiều — có đáng tiền không?',
    a: 'Đáng, nếu nhìn theo thanh khoản: nhà ô tô vào tận nơi luôn dễ bán lại và dễ cho thuê hơn, trong khi quỹ nhà loại này ở khu trung tâm ngày càng hiếm nên giữ giá tốt. Nếu ngân sách chưa tới, nhà hẻm ba gác thông thoáng gần trục chính vẫn là phương án ở thực ổn — quan trọng là trả đúng giá của từng loại hẻm, đừng trả giá hẻm xe hơi cho một căn hẻm nhỏ. Hẻm rộng cỡ xe tải vào được thì kinh doanh gần như nhà mặt tiền, giới trong nghề gọi là "mặt tiền hẻm".',
  },
  {
    q: 'Nhà thóp hậu có nên mua không, ép giá được bao nhiêu?',
    a: 'Theo quan niệm phổ biến, nhà nở hậu (sau rộng hơn trước) được chuộng, thóp hậu bị kiêng — nên nhà thóp hậu kén khách khi bán lại, bù lại giá thường mềm và dễ thương lượng hơn. Mua để ở mà công năng vẫn tốt thì không vấn đề; mua đầu tư thì cân nhắc vì thanh khoản chậm hơn. Nhớ xem sơ đồ thửa đất trong sổ để biết hình dáng chính xác, đừng chỉ nhìn bằng mắt.',
  },
  {
    q: 'TP.HCM bỏ cấp quận từ 2025 — giờ tìm nhà "Quận 3", "Phú Nhuận" thì gọi thế nào?',
    a: 'Từ 1/7/2025, TP.HCM chuyển sang chính quyền 2 cấp (Thành phố → Phường/Xã), bỏ cấp quận; nhiều phường cũ gộp thành phường mới. Ví dụ địa bàn Quận 3 cũ nay gồm 3 phường: Bàn Cờ, Xuân Hòa, Nhiêu Lộc. Tuy vậy người dân và giới môi giới vẫn quen dùng tên quận cũ khi giao dịch, nên tin đăng thường ghi song song cả hai — cứ tra theo tên quận quen thuộc là được.',
  },
  {
    q: 'Vì sao tin đăng không ghi số nhà chính xác và số điện thoại chủ nhà?',
    a: 'Để bảo vệ sự riêng tư của chủ nhà và tránh làm phiền họ — đây là nguyên tắc làm nghề của Tuấn Sài Gòn. Tin đăng ghi tên đường, phường, quận và thông số đầy đủ; khi anh chị quan tâm thật, gọi 0777088622 để được cung cấp vị trí chính xác và sắp lịch xem nhà trực tiếp.',
  },
  {
    q: 'Khu nào ở TP.HCM có cộng đồng người nước ngoài, cho thuê tốt?',
    a: 'Nổi bật nhất: Phố Nhật quanh Lê Thánh Tôn – Thái Văn Lung (Quận 1 cũ) với hơn 70 hàng quán Nhật; Phố Tây Bùi Viện – Phạm Ngũ Lão (Quận 1 cũ) đông du khách; Phố Hàn đậm nhất ở Phú Mỹ Hưng (Quận 7 cũ) và cụm Super Bowl – K300 – Phạm Văn Hai (Tân Bình cũ); khu Chợ Lớn (Quận 5 cũ) với cộng đồng người Hoa lâu đời; và Thảo Điền – An Phú (Quận 2 cũ) là khu expat cao cấp có trường quốc tế. Nhà trong các khu này thường khai thác cho thuê người nước ngoài rất tốt.',
  },
];

// Giới thiệu (E-E-A-T)
export const ABOUT = [
  'Tuấn Sài Gòn là môi giới bất động sản tại TP.HCM, chuyên dòng nhà phố và biệt thự khu trung tâm: Quận 1, Quận 3, Quận 5, Quận 10, Phú Nhuận, Bình Thạnh, Gò Vấp, Tân Bình (tên quận cũ, trước sáp nhập 2025) và dòng cao cấp tại Thảo Điền, Phú Mỹ Hưng.',
  'Cách làm việc: tin đăng trung thực đúng hiện trạng — không ghi số nhà công khai để bảo vệ chủ nhà, không tô vẽ điểm yếu thành điểm mạnh. Kho tin được cập nhật hằng ngày từ nguồn hàng trực tiếp, căn nào đã cọc sẽ được gỡ khỏi trang.',
  'Anh chị cần tìm nhà theo ngân sách, cần định giá sơ bộ hay cần người đi xem nhà cùng — gọi 0777088622 (Tuấn), nói rõ nhu cầu, Tuấn lọc đúng căn phù hợp rồi mới hẹn đi xem, không dắt đi lòng vòng.',
];
