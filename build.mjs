// BỘ DỰNG WEBSITE TĨNH — Tuấn Sài Gòn (tối ưu GEO/AEO: AI đọc-hiểu-trích dẫn được)
// Chạy: node build.mjs  →  xuất ra dist/
// Dữ liệu: GAS ?action=weblist (kho T123_Kho đã làm sạch) + cache data/listings.json khi GAS lỗi.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND, AREAS, FAQ, ABOUT, SOCIAL } from './content.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const SITE = process.env.SITE_URL || 'https://tuansaigon.com';
const GAS = 'https://script.google.com/macros/s/AKfycbz33hU71TC2nj4p1MnISJ3LP83lGYXn_xSFu5RTY6zjiBF9piY2mZl0o6gQjQ5w31Gowg/exec';
const CACHE = join(ROOT, 'data', 'listings.json');
const BUILD_V = Math.floor(Date.now() / 1000);   // cache-bust CSS mỗi lần dựng

// ---------- dữ liệu ----------
async function loadData() {
  try {
    if (process.env.OFFLINE) throw new Error('OFFLINE=1 — dùng cache');
    // n=20000: 15/07 máy quét local nạp snapshot lên 13.7k căn -> trần 10.000 cũ CẮT MẤT ~2.8k căn (đa số có ảnh thật)
    const r = await fetch(`${GAS}?action=weblist&key=${process.env.WEB_KEY || ''}&n=20000`, { redirect: 'follow', signal: AbortSignal.timeout(240000) });
    const o = await r.json();
    if (!o.ok || !Array.isArray(o.rows)) throw new Error('weblist trả lỗi: ' + JSON.stringify(o).slice(0, 120));
    // LƯỚI 1 — CHỐNG WEB RỖNG (14/07): kho T123 bị reset-đêm mà T123 mất phiên -> weblist trả 0-vài căn -> ĐỪNG deploy web trắng, giữ web cũ từ cache
    if (o.rows.length < 1000) throw new Error('weblist chỉ ' + o.rows.length + ' căn (bình thường ~8000) — kho đang reset/lỗi, GIỮ web cũ từ cache, KHÔNG deploy rỗng');
    // LƯỚI 2 — CHỐNG SẬP 1 NGUỒN (15/07, dính thật): lưới 1 chỉ canh TỔNG nên khi T123 về 0 mà CĐMG còn 8.771 thì LỌT
    // -> deploy web thiếu 4.000 trang T123, URL đã index thành 404. Gốc: `t123KhoNight_` gán MÃ K *SAU* khi crawl xong,
    // nên đang crawl lại thì webList_ (`if (!code) continue`) trả 0 căn T123 — trạng thái TẠM, vài phút sau là có lại.
    // Xử: nguồn nào tụt quá nửa so với cache thì VÁ BẰNG CĂN CŨ TỪ CACHE (thà tin cũ vài giờ còn hơn 404 hàng ngàn trang).
    if (existsSync(CACHE)) {
      try {
        const cu = JSON.parse(readFileSync(CACHE, 'utf8'));
        const dem = rs => rs.reduce((a, r) => (a[r.ng == 1 ? 'cdmg' : 't123']++, a), { cdmg: 0, t123: 0 });
        const mNay = dem(o.rows), mCu = dem(cu.rows || []);
        const coMa = new Set(o.rows.map(r => String(r.ma)));
        for (const ng of ['cdmg', 't123']) {
          if (mCu[ng] < 500 || mNay[ng] >= mCu[ng] * 0.5) continue;
          const vaLai = (cu.rows || []).filter(r => (r.ng == 1 ? 'cdmg' : 't123') === ng && !coMa.has(String(r.ma)));
          o.rows.push(...vaLai);
          console.warn(`⚠ nguồn ${ng.toUpperCase()} tụt ${mCu[ng]} -> ${mNay[ng]} căn (kho đang crawl lại?) — vá ${vaLai.length} căn từ cache, KHÔNG để trang thành 404`);
        }
      } catch (eC) {}
    }
    mkdirSync(dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(o, null, 1));
    console.log(`✓ weblist: ${o.rows.length} căn (kho có ${o.so_can})`);
    return o;
  } catch (e) {
    if (existsSync(CACHE)) {
      console.warn('⚠ GAS lỗi, dùng cache:', String(e).slice(0, 100));
      return JSON.parse(readFileSync(CACHE, 'utf8'));
    }
    throw e;
  }
}

// Vệ sinh dữ liệu: nguồn thỉnh thoảng cụt tên đường -> sửa cái biết chắc, loại cái nghi vấn (thà thiếu còn hơn sai địa danh)
const DUONG_FIX = { 'Viết Nghệ Tĩnh': 'Xô Viết Nghệ Tĩnh', 'Mạng Tháng Tám': 'Cách Mạng Tháng Tám' };
function duongOk(duong) {
  const d = String(duong || '').trim();
  if (!d) return false;
  const tokens = d.split(/\s+/);
  if (tokens.length === 1 && d.length < 6) return false; // "Trãi", "Bạch", "Sa"... — tên đường cụt
  return true;
}
function cleanRows(rows) {
  const out = [];
  let drop = 0;
  const nowTs = Math.floor(Date.now() / 1000);
  for (const l of rows) {
    // (18/07 Tuấn bắt) Ngày TƯƠNG LAI = nguồn CĐMG ghi dd/mm bị parse mm/dd. Trước đây GHIM VỀ HÔM NAY -> căn
    // hỏng ngày LUÔN thành "mới nhất" -> kẹt đầu trang chủ mãi (căn 211 Hoàng Hoa Thám 2-3 ngày). Giờ KHÔI PHỤC:
    // hoán đổi ngày<->tháng (08/07 bị đọc 07/08 -> đổi lại 08/07). Đổi ra vẫn tương lai/không hợp lệ -> lùi 40 ngày
    // (coi như cũ, không cho chiếm "mới cập nhật"). KHÔNG dùng ngày build làm mốc nữa.
    if (l.up > nowTs) {
      const d = new Date(l.up * 1000);
      const sw = Math.floor(new Date(d.getFullYear(), d.getDate() - 1, d.getMonth() + 1).getTime() / 1000);
      l.up = (sw > 0 && sw <= nowTs) ? sw : (nowTs - 40 * 86400);
    }
    l.duong = DUONG_FIX[String(l.duong || '').trim()] || String(l.duong || '').trim();
    if (!duongOk(l.duong)) { drop++; continue; }
    out.push(l);
  }
  if (drop) console.log(`⚠ loại ${drop} căn tên đường cụt/trống (không đưa địa danh sai lên web)`);
  return out;
}

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const noDia = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const slug = s => noDia(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dViet = ts => new Date((ts || 0) * 1000).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
const num = (x, d = 1) => Number(x).toLocaleString('vi-VN', { maximumFractionDigits: d });
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// l.ck (CĐMG/sổ tay ≥50 tỷ, Tuấn chốt 14/07): CÔNG KHAI địa chỉ đầy đủ (số nhà). Còn lại: KHÔNG BAO GIỜ có số nhà.
const congKhai = l => l.ck && l.sonha;
function diaChi(l) {
  const dg = congKhai(l) ? `${l.sonha} ${l.duong}` : l.duong;
  return [dg, l.phuong, l.quan].filter(Boolean).join(', ');
}
function tieuDe(l) {
  // Công thức Tuấn chốt 11/07: hẻm ghi RÕ SỐ HẺM ("Bán nhà hẻm 511 Huỳnh Văn Bánh"), mặt tiền vẫn ẩn số nhà,
  // loại BĐS ghi rõ (biệt thự / tòa nhà văn phòng / tòa khách sạn / tòa nhà), nhà thường giữ như cũ.
  const loai = l.loai || 'nhà';
  if (congKhai(l)) { const vt = l.vitri === 'Mặt tiền' ? 'mặt tiền ' : ''; return `Bán ${loai} ${vt}${l.sonha} ${l.duong}, ${l.quan}`; }   // ≥50 tỷ CĐMG/sổ tay: số nhà đầy đủ trên tiêu đề
  if (l.hemso) return `Bán ${loai} hẻm ${l.hemso} ${l.duong}, ${l.quan}`;
  if (l.vitri === 'Mặt tiền') return `Bán ${loai} mặt tiền ${l.duong}, ${l.quan}`;
  if (l.vitri) return `Bán ${loai} hẻm đường ${l.duong}, ${l.quan}`;
  return `Bán ${loai} đường ${l.duong}, ${l.quan}`;
}
function motaNgan(l) {
  const p = [];
  if (l.dt) p.push(`diện tích ${num(l.dt)}m²${l.ngang && l.dai ? ` (${num(l.ngang)}×${num(l.dai)}m)` : ''}`);
  if (l.tang) p.push(`${num(l.tang, 0)} tầng`);
  if (l.vitri) p.push(l.vitri.toLowerCase());
  return `Giá ${l.gia_text.toLowerCase()}, ${p.join(', ')}. Vị trí ${diaChi(l)}, TP.HCM. Cập nhật ${dViet(l.up)}.`;
}
function statsOf(rows) {
  const gia = rows.map(l => l.gia_ty + 0.5); // gia_ty đã floor -> +0.5 ước trung tâm khoảng
  const ppm = rows.filter(l => l.dt > 0).map(l => (l.gia_ty + 0.5) / l.dt * 1000); // triệu/m²
  return { n: rows.length, min: Math.min(...rows.map(l => l.gia_ty)), max: Math.max(...rows.map(l => l.gia_ty)), medGia: median(gia), medPpm: median(ppm) };
}

// ---------- khung trang ----------
const NAV = [['/', 'Trang chủ'], ['/nha-dat/', '🔍 Tìm kiếm'], ['/khu-vuc/', 'Khu vực'], ['/cam-nang/', 'Cẩm nang'], ['/gioi-thieu.html', 'Giới thiệu']];   // Hỏi đáp gộp vào Cẩm nang trên menu (13/07) — trang /hoi-dap.html vẫn sống
const PHONE_FMT = '0777 088 622';
const ZALO = `https://zalo.me/${BRAND.phone}`;
const AVA = existsSync(join(ROOT, 'assets', 'tuan.jpg')) ? '/anh/tuan.jpg' : null; // ảnh đại diện Tuấn (website/assets/tuan.jpg)
const AVAW = existsSync(join(ROOT, 'assets', 'tuan.webp')) ? '/anh/tuan.webp' : null; // bản WebP nhẹ (PageSpeed 13/07)
const AGENT_LD = {
  '@type': 'RealEstateAgent', '@id': `${SITE}/#agent`, name: BRAND.name, telephone: BRAND.phoneIntl, url: SITE,
  description: `${BRAND.tagline}. Khu vực phục vụ: ${BRAND.areasText}.`,
  address: { '@type': 'PostalAddress', addressLocality: 'Thành phố Hồ Chí Minh', addressCountry: 'VN' },
  areaServed: AREAS.map(a => ({ '@type': 'Place', name: `${a.quan}, TP.HCM` })),
  knowsLanguage: 'vi', priceRange: '5 tỷ – 100+ tỷ VND',
  ...(AVA ? { image: SITE + AVA } : {}),
  // Google Business Profile (Tuấn lập 13/07): hasMap + sameAs — Google gom định danh web ↔ hồ sơ Maps về một mối
  hasMap: 'https://www.google.com/maps/search/?api=1&query=Tu%E1%BA%A5n%20S%C3%A0i%20G%C3%B2n%20511%20Hu%E1%BB%B3nh%20V%C4%83n%20B%C3%A1nh%20Ph%C3%BA%20Nhu%E1%BA%ADn',
  sameAs: [...SOCIAL.filter(s => s.url && s.ten !== 'Zalo').map(s => s.url), 'https://share.google/2h2827THiP3CLKPXG'],
};
function page({ path, title, desc, ld = [], body, upDate, preloadImg }) {
  const url = SITE + path;
  const graph = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', '@id': `${SITE}/#site`, name: BRAND.name, url: SITE, inLanguage: 'vi' }, AGENT_LD, ...ld] };
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:type" content="website"><meta property="og:locale" content="vi_VN">
<link rel="alternate" type="application/rss+xml" title="Tin mới ${BRAND.name}" href="${SITE}/feed.xml">
<link rel="icon" href="/anh/logo-64.png">
${GA_ID ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href')||'';
if(h.indexOf('tel:')===0)gtag('event','goi_dien',{event_category:'lien_he'});else if(h.indexOf('zalo.me')>-1)gtag('event','nhan_zalo',{event_category:'lien_he'});},true);</script>` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${preloadImg ? `<link rel="preload" as="image" href="${preloadImg}" type="image/webp" fetchpriority="high">` : ''}
<link rel="stylesheet" href="/style.css?v=${BUILD_V}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap"></noscript>
<script type="application/ld+json">${JSON.stringify(graph)}</script>
</head>
<body>
<header class="top"><div class="wrap bar">
<a class="logo" href="/"><img src="/anh/logo-64.png" alt="Logo Tuấn Sài Gòn" width="36" height="36">Tuấn <span>Sài Gòn</span></a>
<nav>${NAV.map(([h, t]) => `<a href="${h}"${h === path || (h !== '/' && path.startsWith(h)) ? ' class="on"' : ''}>${t}</a>`).join('')}</nav>
<a class="call" href="tel:${BRAND.phone}">📞 Gọi ngay<span class="tel"> · ${PHONE_FMT}</span></a>
</div></header>
<main class="wrap">
${body}
</main>
<div class="fab">
<a class="fz" href="${ZALO}" target="_blank" rel="noopener" aria-label="Nhắn Zalo cho Tuấn">Zalo</a>
<a class="fc" href="tel:${BRAND.phone}" aria-label="Gọi Tuấn ${PHONE_FMT}">📞</a>
</div>
<footer><div class="wrap">
<p><strong>${BRAND.name}</strong> — ${BRAND.tagline}. Điện thoại/Zalo: <a href="tel:${BRAND.phone}">${BRAND.phone}</a>.</p>
<p class="socials">${SOCIAL.filter(s => s.url).map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.ten}</a>`).join(' · ')}</p>
<p>Khu vực phục vụ: ${esc(BRAND.areasText)} (tên quận cũ, quen dùng sau sáp nhập 2025).</p>
<p class="dim">Thông tin trên trang cập nhật ${esc(upDate)}. Giá chào bán có thể thay đổi theo thời điểm — gọi để xác nhận căn còn hay đã cọc.</p>
</div></footer>
<script>
(function(){if(!('IntersectionObserver' in window))return;
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.08});
document.querySelectorAll('.card,.stat,.qa,article h2').forEach(function(el,i){el.classList.add('reveal');el.style.transitionDelay=Math.min(i%6*70,350)+'ms';io.observe(el)});})();
</script>
</body>
</html>`;
}
function card(l) {
  return `<a class="card" data-gia="${l.gia_ty}" data-quan="${slug(l.quan)}" data-vitri="${esc(l.vitri || '')}" data-coc="${l.coc ? 1 : 0}" href="/nha-dat/${l.url}.html">
<div class="thumb"><img src="${esc(l.anh[0])}" alt="${esc(tieuDe(l))}" loading="lazy" onerror="this.parentNode.style.display='none'">
<span class="badge"><b>${esc(l.gia_text)}</b></span>${l.coc ? '<span class="soldtag">ĐÃ CỌC</span>' : (l.vitri ? `<span class="vt">${esc(l.vitri)}</span>` : '')}${l.xm && !l.coc ? '<span class="xmtag">✔ Đã kiểm chứng</span>' : ''}</div>
<div class="ci"><h3>${esc(tieuDe(l))}</h3>
<p class="tsm">${l.dt ? '<b>' + num(l.dt) + 'm²</b>' : ''}${l.tang ? ' · ' + num(l.tang, 0) + ' tầng' : ''}${l.ngang ? ' · ngang ' + num(l.ngang) + 'm' : ''}</p>
<p class="dim">${esc(l.phuong ? l.phuong + ', ' : '')}${esc(l.quan)} · cập nhật ${dViet(l.up)}</p></div></a>`;
}
// ---------- THANH LỌC DÙNG CHUNG (16/07 Tuấn chốt: có ở CẢ trang từng quận, không riêng /nha-dat/) ----------
// Lọc dò CHỈ MỤC ĐẦY ĐỦ /tim-kiem.json (12k căn), KHÔNG dò mấy thẻ có sẵn trên trang — trước đây dò DOM
// nên "Phú Nhuận + Hẻm xe hơi" báo 0 căn khớp dù kho có 350 căn thật.
// Nội dung tĩnh của trang bọc trong #fstatic -> đang lọc thì ẩn CẢ KHỐI, hiện #fgrid. (Bản đầu 16/07 quét
// 'main>h2,...' NGAY LÚC script chạy — lúc đó mấy mục dưới CHƯA tồn tại -> ẩn hụt, kết quả lọc chồng lên
// danh sách cũ. Bọc khối + tra lazy trong hàm là hết.)
// preQ = slug quận chọn sẵn (trang quận). Lọc CHỈ chạy sau khi khách ĐỘNG VÀO (khỏi tự lọc lúc mở trang).
function fbarBlock(areas, preQ = '') {
  return `<div class="fbar">
<b>Lọc:</b>
<select id="fq" aria-label="Khu vực"><option value="">Tất cả khu vực</option>${areas.filter(a => a.rows.length).map(a => `<option value="${a.slug}"${a.slug === preQ ? ' selected' : ''}>${esc(a.quan)}</option>`).join('')}</select>
<select id="fv" aria-label="Vị trí"><option value="">Mọi vị trí</option><option value="Hẻm xe hơi">Hẻm xe hơi</option><option value="Nhà hẻm">Nhà hẻm</option><option value="Mặt tiền">Mặt tiền</option></select>
<input type="search" id="ft" class="ftxt" placeholder="Tên đường (vd: Lê Văn Sỹ)" aria-label="Tìm theo tên đường">
<span class="frange">Giá <input type="number" id="fg1" min="0" step="1" inputmode="numeric" placeholder="từ" aria-label="Giá từ (tỷ)"> – <input type="number" id="fg2" min="0" step="1" inputmode="numeric" placeholder="đến" aria-label="Giá đến (tỷ)"> tỷ</span>
<span class="frange">Diện tích từ <input type="number" id="fd1" min="0" step="1" inputmode="numeric" placeholder="từ" aria-label="Diện tích tối thiểu (m2)"> m²</span>
<span class="fkq" id="fkq"></span>
</div>
<div class="grid" id="fgrid" hidden></div>
<p class="xemtat" id="fmore" hidden><a href="#" id="fmorea">Xem thêm →</a></p>
<script>${jsLoc(preQ)}</script>`;
}
// Script bộ lọc tách riêng để KIỂM CÚ PHÁP lúc dựng (xem chú thích ở fbarBlock).
function jsLoc(preQ) {
  const js = `(function(){
var fq=document.getElementById('fq'),fv=document.getElementById('fv'),g1=document.getElementById('fg1'),g2=document.getElementById('fg2'),d1=document.getElementById('fd1'),ft=document.getElementById('ft'),
kq=document.getElementById('fkq'),gr=document.getElementById('fgrid'),mo=document.getElementById('fmore'),moa=document.getElementById('fmorea');
var IX=null,dangTai=false,hit=[],hienN=0,LO=36,daDung=false,PRE='${R2_URL}';
function khoiTinh(){return document.getElementById('fstatic')}
/* bỏ dấu tiếng Việt để gõ "le van sy" ra "Lê Văn Sỹ". (\\u0300-\\u036f = dấu tổ hợp NFD; lưới new Function kiểm cú pháp lúc dựng) */
function kd(s){return (s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/đ/g,'d')}
/* Chỉ mục cắt tiền tố kho R2 cho nhẹ -> ở đây ghép lại. Ảnh CHƯA mirror thì lưu nguyên URL gốc
   (cloudinary/daitheky) nên để nguyên; '/anh/...' là ảnh đại diện, cũng để nguyên.
   ⚠️ ĐỪNG dùng regex ở đây: script này nằm trong template literal của build.mjs, dấu \\ bị NUỐT
   -> /^https?:\\/\\// in ra thành /^https?:/// -> JS đọc // là COMMENT -> CHẾT CẢ BỘ LỌC (dính 16/07). */
function anh(s){return !s?'/anh/anh-dai-dien.svg':(s.slice(0,4)==='http'||s.charAt(0)==='/'?s:PRE+s)}
function the(r){var vt=IX.v[r[6]];
return '<a class="card" href="/nha-dat/'+r[0]+'.html"><div class="thumb"><img src="'+anh(r[2])+'" alt="'+r[1]+'" loading="lazy" onerror="this.parentNode.style.display=\\'none\\'">'+
'<span class="badge"><b>'+r[4]+'</b></span>'+(vt?'<span class="vt">'+vt+'</span>':'')+'</div>'+
'<div class="ci"><h3>'+r[1]+'</h3><p class="tsm">'+(r[7]?'<b>'+r[7]+'m²</b>':'')+(r[8]?' · '+r[8]+' tầng':'')+(r[9]?' · ngang '+r[9]+'m':'')+'</p>'+
'<p class="dim">'+(r[10]?r[10]+', ':'')+IX.qt[r[5]]+' · cập nhật '+r[11]+'</p></div></a>'}
function veThem(){var lat=hit.slice(hienN,hienN+LO);gr.insertAdjacentHTML('beforeend',lat.map(the).join(''));hienN+=lat.length;
mo.hidden=hienN>=hit.length;if(!mo.hidden)moa.textContent='Xem thêm '+Math.min(LO,hit.length-hienN)+' căn (còn '+(hit.length-hienN)+') →'}
function batLoc(){return !!(fq.value||fv.value||g1.value!==''||g2.value!==''||d1.value!==''||ft.value.trim())}
function loc(){if(!daDung)return;var st=khoiTinh();
if(!batLoc()){if(st)st.hidden=false;gr.hidden=true;mo.hidden=true;kq.textContent='';return}
if(!IX){if(!dangTai){dangTai=true;kq.textContent='→ đang tải…';
fetch('/tim-kiem.json').then(function(r){return r.json()}).then(function(j){IX=j;dangTai=false;loc()})
.catch(function(){dangTai=false;kq.textContent='→ lỗi tải, thử lại'})}return}
var q=fq.value,v=fv.value,lo=parseFloat(g1.value),hi=parseFloat(g2.value),dt=parseFloat(d1.value),kw=kd(ft.value.trim());
if(isNaN(lo))lo=0;if(isNaN(hi))hi=1e9;if(isNaN(dt))dt=0;
var qi=q?IX.q.indexOf(q):-1,vi=v?IX.v.indexOf(v):-1;
/* CHỌN rồi mà KHÔNG có trong chỉ mục -> 0 CĂN. TUYỆT ĐỐI không rơi về "không lọc":
   16/07 ô chọn dùng slug 'quan-7-phu-my-hung' còn chỉ mục dùng 'quan-7' -> indexOf=-1 -> qi<0
   -> lọc Quận 7 mà XỔ RA TOÀN BỘ 12.684 căn (Tuấn bắt). Lệch slug đã sửa, đây là lưới chặn dưới. */
if((q&&qi<0)||(v&&vi<0))hit=[];
else hit=IX.r.filter(function(r){return (qi<0||r[5]===qi)&&(vi<0||r[6]===vi)&&r[3]>=lo&&r[3]<=hi&&(!dt||r[7]>=dt)&&(!kw||kd(r[1]).indexOf(kw)>=0)});
if(st)st.hidden=true;gr.hidden=false;gr.innerHTML='';hienN=0;
kq.textContent='→ '+hit.length+' căn khớp';
if(!hit.length){gr.innerHTML='<p class="dim">Không có căn nào khớp. Anh chị nới tầm giá/diện tích, hoặc gọi ${PHONE_FMT} để Tuấn tìm giúp.</p>';mo.hidden=true;return}
veThem()}
function dung(){daDung=true;loc()}
moa.addEventListener('click',function(e){e.preventDefault();veThem()});
[fq,fv].forEach(function(x){x.addEventListener('change',dung)});
[g1,g2,d1,ft].forEach(function(x){x.addEventListener('input',dung)});})();`;
  // 🛡 LƯỚI (16/07, dính 2 lần): script này nằm TRONG template literal của build.mjs -> dấu \\ bị NUỐT.
  // Lần 1: regex /^https?:\\/\\// in ra thành /^https?:/// -> JS đọc // là COMMENT -> CHẾT CẢ BỘ LỌC,
  // mà build vẫn báo 'Dựng xong' nên deploy web hỏng lúc nào không hay. Giờ kiểm cú pháp NGAY LÚC DỰNG.
  try { new Function(js); } catch (e) { throw new Error('❌ SCRIPT BỘ LỌC HỎNG CÚ PHÁP -> DỪNG BUILD: ' + e.message); }
  return js;
}
const faqLd = qa => ({ '@type': 'FAQPage', mainEntity: qa.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
const faqHtml = qa => qa.map(f => `<details class="qa"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n');
const crumbLd = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })) });

// ---------- trang chi tiết căn ----------
function detailPage(l, today, tuongTu) {
  const path = `/nha-dat/${l.url}.html`;
  const t = `${tieuDe(l)} — ${l.coc ? 'ĐÃ CỌC' : l.gia_text}`;
  const rows = [
    ['Khu vực', `${diaChi(l)}, TP.HCM`],
    ['Giá chào bán', l.gia_text + ' (thương lượng khi xem nhà)'],
    l.dt ? ['Diện tích đất', `${num(l.dt)} m²${l.ngang && l.dai ? ` — ngang ${num(l.ngang)}m, dài ${num(l.dai)}m` : ''}`] : null,
    (l.ketcau || l.tang) ? ['Kết cấu', l.ketcau || `${num(l.tang, 0)} tầng`] : null,
    l.pn ? ['Phòng ngủ', `${l.pn}`] : null,
    l.wc ? ['Vệ sinh', `${l.wc}`] : null,
    l.huong ? ['Hướng', l.huong] : null,
    (l.hem || l.vitri) ? ['Vị trí', l.hem || [l.vitri, l.hemso ? `hẻm ${l.hemso} ${l.duong}` : ''].filter(Boolean).join(' — ')] : null,
    l.drong ? ['Đường/hẻm trước nhà', l.drong] : null,
    ['Mã tin', l.ma],
    ['Cập nhật', dViet(l.up)],
    l.xm ? ['Kiểm chứng', '✔ Tuấn đã trực tiếp xác minh thông tin căn này'] : null,
  ].filter(Boolean);
  const ld = [
    { '@type': 'RealEstateListing', '@id': `${SITE}${path}#listing`, url: SITE + path, name: t, dateModified: new Date(l.up * 1000).toISOString(), inLanguage: 'vi',
      about: { '@type': 'House', name: tieuDe(l), address: { '@type': 'PostalAddress', streetAddress: `Đường ${l.duong}`, addressLocality: `${l.phuong ? l.phuong + ', ' : ''}${l.quan}`, addressRegion: 'Thành phố Hồ Chí Minh', addressCountry: 'VN' },
        ...(l.dt ? { floorSize: { '@type': 'QuantitativeValue', value: l.dt, unitCode: 'MTK' } } : {}), ...(l.tang ? { numberOfFloors: l.tang } : {}),
        ...(l.pn ? { numberOfBedrooms: l.pn } : {}), ...(l.wc ? { numberOfBathroomsTotal: l.wc } : {}) },
      image: l.anh, offers: { '@type': 'Offer', price: l.gia_ty * 1e9, priceCurrency: 'VND', priceValidUntil: undefined, availability: l.coc ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock', description: l.coc ? 'Đã có khách đặt cọc' : `Giá chào ${l.gia_text}`, offeredBy: { '@id': `${SITE}/#agent` } } },
    crumbLd([['Trang chủ', '/'], ['Nhà đang bán', '/nha-dat/'], [tieuDe(l), path]]),
  ];
  const areaLink = AREAS.find(a => a.quan === l.quan);
  const body = `
<nav class="crumb"><a href="/">Trang chủ</a> › <a href="/nha-dat/">Nhà đang bán</a> › ${esc(l.quan)}</nav>
<div class="dbody">
<article>
<h1>${esc(t)}</h1>
${l.coc ? `<div class="cta soldcta"><p><strong>⛔ Căn này đã có khách đặt cọc.</strong> Anh chị đang tìm nhà khu ${esc(l.quan)}? Gọi/Zalo <a href="tel:${BRAND.phone}">${PHONE_FMT}</a> (Tuấn) — kho đang có những căn tương tự bên dưới, hoặc nói nhu cầu để Tuấn lọc đúng căn.</p></div>` : ''}
<p class="lead">${esc(motaNgan(l))}</p>
<div class="gal">
<div class="gview">
<button class="gbtn prev" aria-label="Ảnh trước">‹</button>
<img id="gmain" src="${esc(l.anh[0])}" alt="${esc(tieuDe(l))} - ảnh chính">
<button class="gbtn next" aria-label="Ảnh sau">›</button>
<span class="gcount"><span id="gidx">1</span>/${l.anh.length}</span>
</div>
<div class="gthumbs">${l.anh.map((u, i) => `<img src="${esc(u)}" alt="${esc(tieuDe(l))} - ảnh ${i + 1}"${i ? ' loading="lazy"' : ''} class="${i === 0 ? 'on' : ''}" onerror="this.remove()">`).join('')}</div>
</div>
<script>
(function(){var m=document.getElementById('gmain'),gi=document.getElementById('gidx'),ts=Array.prototype.slice.call(document.querySelectorAll('.gthumbs img')),i=0;
function go(k){var n=ts.length;if(!n)return;i=(k+n)%n;m.src=ts[i].src;ts.forEach(function(t,j){t.classList.toggle('on',j===i)});gi.textContent=i+1;ts[i].scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'})}
document.querySelector('.gbtn.prev').onclick=function(){go(i-1)};
document.querySelector('.gbtn.next').onclick=function(){go(i+1)};
ts.forEach(function(t,j){t.onclick=function(){go(j)}});
document.addEventListener('keydown',function(e){if(e.key==='ArrowLeft')go(i-1);if(e.key==='ArrowRight')go(i+1)});
var x0=null;m.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
m.addEventListener('touchend',function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40)go(i+(dx<0?1:-1));x0=null},{passive:true});
})();
</script>
<h2>Thông số căn nhà</h2>
<table class="specs">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
${l.cap ? `<h2>Đôi nét về căn này</h2>\n${l.cap.split(/\n+/).filter(x => x.trim()).map(x => `<p>${esc(x)}</p>`).join('\n')}` : ''}
${areaLink ? `<p>Xem thêm: <a href="/khu-vuc/${areaLink.slug}.html">nhà đang bán và mặt bằng giá khu ${esc(l.quan)}</a>.</p>` : ''}
</article>
<aside class="aside">
<div class="who">${AVA ? `<img class="ava sm" src="${AVA}" alt="Tuấn Sài Gòn" width="74" height="74">` : ''}<div><strong>Tuấn Sài Gòn</strong><br><span class="dim">Môi giới trực tiếp — không qua trung gian</span></div></div>
${l.xm ? '<p class="xmnote">✔ Tuấn đã trực tiếp xác minh thông tin căn này</p>' : ''}
<p class="dim">${l.coc ? 'Trạng thái' : 'Giá chào bán'}</p>
<p class="gia">${l.coc ? '⛔ ĐÃ CỌC' : esc(l.gia_text)}</p>
<p>${l.dt ? `<b>${num(l.dt)}m²</b>` : ''}${l.tang ? ` · ${num(l.tang, 0)} tầng` : ''}${l.vitri ? ` · ${esc(l.vitri)}` : ''}</p>
<a class="btn gold" href="tel:${BRAND.phone}">📞 Gọi ngay · ${PHONE_FMT}</a>
<a class="btn zalo" href="${ZALO}" target="_blank" rel="noopener">💬 Nhắn Zalo hỏi căn này</a>
<p>Khi liên hệ, đọc mã tin <strong>${esc(l.ma)}</strong> — Tuấn gửi vị trí chính xác và xếp lịch xem nhà ngay.</p>
</aside>
</div>
${tuongTu && tuongTu.length ? `<h2>Căn tương tự đang bán tại ${esc(l.quan)}</h2><div class="grid">${tuongTu.map(card).join('')}</div>` : ''}`;
  return { path, html: page({ path, title: `${t} | ${BRAND.name}`, desc: motaNgan(l), ld, body, upDate: today }) };
}

// ---------- build ----------
// KHO LƯU TRỮ ảnh/caption theo mã — kho GAS quét lại đêm có thể tạm mất cache ảnh; web đắp từ đây nên không "bốc hơi" căn
const GA_ID = process.env.GA_ID || '';   // GA4/Ads: đặt secret GA_ID là toàn site tự gắn máy đo (đếm bấm Gọi + Zalo)
const PLACEHOLDER = '/anh/anh-dai-dien.svg';   // ảnh đại diện tạm cho căn chưa có ảnh thật (Tuấn chốt 12/07)
const ARCHIVE = join(ROOT, 'data', 'archive.json');
function mergeArchive(rows) {
  let arc = {}; try { arc = JSON.parse(readFileSync(ARCHIVE, 'utf8')); } catch (e) {}
  const out = []; let vay = 0, bo = 0;
  let daiDien = 0;
  for (const l of rows) {
    const a = arc[l.ma] || {};
    if (l.ng) {
      // Nguồn sổ tay/CĐMG (Tuấn chốt 12/07 sau vụ LỘ SỔ HỒNG): GAS là nguồn ảnh DUY NHẤT — TUYỆT ĐỐI không vay
      // archive (ảnh cũ có thể là sổ vừa bị dọn). Hết ảnh thật -> ảnh ĐẠI DIỆN brand, căn vẫn lên web cho khách gọi.
      if (!(l.anh && l.anh.length)) { l.anh = [PLACEHOLDER]; daiDien++; }
    } else if (!(l.anh && l.anh.length >= 3)) {
      if (a.anh && a.anh.length >= 3) { l.anh = a.anh; vay++; }
      else if (!l.anh || !l.anh.length) { l.anh = [PLACEHOLDER]; daiDien++; }   // T123 chưa kịp quét ảnh: vẫn lên web (Tuấn chốt 12/07 "sao T123 ít quá"), máy quét thay ảnh thật dần
      else { bo++; continue; }
    } else if (a.anh && a.anh.length >= 3 && a.anh.every(u => l.anh.includes(u))) {
      l.anh = a.anh;   // archive là bản ĐÃ TUYỂN (AI cắt ảnh xấu + xếp bìa) của đúng album này -> bản tuyển thắng, kho thô không được đè
    }
    l.cap = (a.cap || '');   // Đôi nét CHỈ dùng bài viết riêng cho web (11/07 — bài FB có icon/giá lẻ không bê vào nữa)
    // URL ĐẸP cho AI/Google (Tuấn chốt 12/07): slug tiêu đề + mã. CHỐT 1 LẦN vào archive — title đổi sau này URL vẫn giữ (index ổn định).
    // NGOẠI LỆ (16/07, căn K695): nếu VỊ TRÍ được sửa mặt tiền <-> hẻm thì URL cũ "ban-nha-mat-tien-..." thành
    // SAI SỰ THẬT ngay trên thanh địa chỉ + kết quả Google. Thà đổi URL (bản cũ tự thành trang chuyển hướng)
    // còn hơn để địa chỉ nói dối khách. Chỉ đổi khi LỆCH mặt tiền/hẻm, title đổi lặt vặt khác vẫn giữ URL cũ.
    const urlMoi = slug(tieuDe(l)).slice(0, 90) + '-' + slug(l.ma);
    const lechVt = a.url && (/ban-nha-mat-tien/.test(a.url) !== /ban-nha-mat-tien/.test(urlMoi));
    l.url = (a.url && !lechVt) ? a.url : urlMoi;
    if (lechVt) l.urlCu = a.url;   // dựng stub chuyển hướng từ URL cũ (bên dưới)
    out.push(l);
  }
  if (daiDien) console.log(`· ${daiDien} căn dùng ảnh đại diện tạm (chưa có ảnh thật — chờ Tuấn/máy quét bổ sung)`);
  for (const l of out) arc[l.ma] = { anh: l.anh.filter(u => u !== PLACEHOLDER), cap: l.cap || '', up: l.up, url: l.url };
  if (process.env.SKIP_ARC_WRITE) console.log('· không ghi archive (sweep đang chạy)');
  else writeFileSync(ARCHIVE, JSON.stringify(arc));
  if (vay) console.log(`↺ đắp ảnh từ kho lưu trữ cho ${vay} căn (GAS chưa kịp cache lại ảnh)`);
  if (bo) console.log(`· ${bo} căn chưa có ảnh ở cả 2 nguồn — chờ prefetch, chưa lên web`);
  return out;
}

const data = await loadData();
const L = mergeArchive(cleanRows(data.rows));
// KHO ẢNH TỰ CHỦ (11/07): đổi URL ảnh sang kho mình (GitHub Pages CDN) — hết cảnh mobile bị server T123 chặn vặt.
// archive vẫn lưu URL GỐC (để mirror/hash ổn định); chỉ bản render dùng kho. Thiếu trong kho -> giữ URL gốc.
let ANHMAP = {}; try { ANHMAP = JSON.parse(readFileSync(join(ROOT, 'data', 'anh-map.json'), 'utf8')); } catch (e) {}
// ⭐ KHO ẢNH = CLOUDFLARE R2 (Tuấn chốt 16/07) — anh.tuansaigon.com, 1 kho DUY NHẤT, hết chia ngăn.
// Bỏ GitHub Pages vì: trần 1GB/repo (kho ~7GB phải cắt 8 repo = lách trần) + điều khoản Pages CẤM dùng làm CDN
// -> GitHub siết là ảnh TOÀN WEB chết cùng lúc. R2: 10GB free, băng thông ra MIỄN PHÍ vĩnh viễn, đúng mục đích.
// anh-map.json giữ nguyên định dạng cũ ("abc.jpg" / "2|abc.jpg") — CHỈ lấy phần TÊN FILE, số ngăn bỏ đi
// (tên file = sha1 URL gốc nên là duy nhất; giữ định dạng để mirror.mjs cũ vẫn chạy được nếu cần quay về).
const R2_URL = 'https://anh.tuansaigon.com/a/';
const tenFile = v => { const i = String(v).indexOf('|'); return i < 0 ? String(v) : String(v).slice(i + 1); };
let nMirror = 0;
for (const l of L) l.anh = l.anh.map(u => { const v = ANHMAP[u]; if (!v) return u; nMirror++; return R2_URL + tenFile(v); });
console.log(`· ảnh dùng kho tự chủ (R2): ${nMirror}`);
const ACT = L.filter(l => !l.coc);   // đang chào bán
// XẾP CĂN CÓ ẢNH LÊN TRƯỚC ở các trang LƯỚT (chủ, quận, RSS, ItemList) — Tuấn hỏi 15/07 "ảnh đại diện có hại web ko".
// 15/07: 36% kho chưa có ảnh thật (T123 kẹt phiên 401 + CĐMG có căn site CHƯA đăng ảnh -> Co_anh=0).
// ⚠️ Co_anh=0 là "CHƯA có ảnh", KHÔNG phải vĩnh viễn (Tuấn chỉnh 15/07) — nhân viên CĐMG up ảnh sau là có.
// cdmg-kho-local.mjs đọc list hinh_nha=1 LIVE mỗi lượt và chỉ bỏ căn ĐÃ có ảnh trong sheet mình
// -> căn nào được up ảnh sẽ TỰ vào list -> tự kéo thumb -> trang tự có ảnh, không cần đụng tay.
// KHÔNG gỡ trang căn không ảnh: 89% có Đôi nét riêng + đủ thông số (287 căn ≥50 tỷ nằm trong nhóm này) — người tìm địa chỉ
// cụ thể cần SỐ LIỆU, ảnh là thứ hai; mà gỡ rồi dựng lại = URL 404 rồi hồi sinh hàng loạt, Google mất tin cả web,
// lại mất luôn thứ hạng đã tích (giữ trang thì ngày CĐMG up ảnh, ảnh chỉ việc hiện lên).
// Chỉ đẩy XUỐNG DƯỚI: khách LƯỚT thấy ảnh trước (đỡ thoát ngay — Google đọc bounce là tín hiệu xấu),
// còn căn không ảnh vẫn tới được qua tìm kiếm cụ thể. Trang căn giữ nguyên, không đụng gì.
const coAnhThat_ = l => !!(l.anh && l.anh.length && l.anh[0] !== PLACEHOLDER);
ACT.sort((a, b) => (coAnhThat_(b) - coAnhThat_(a)) || (b.up - a.up));   // có ảnh trước, trong mỗi nhóm vẫn mới nhất trước
const COC = L.filter(l => l.coc);    // đã cọc — GIỮ TRANG + nhãn (giữ index, làm social proof)
console.log(`· ${ACT.length} căn đang bán · ${COC.length} căn đã cọc (giữ trang)`);
const today = dViet(data.ts || Date.now() / 1000);
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'nha-dat'), { recursive: true });
mkdirSync(join(DIST, 'khu-vuc'), { recursive: true });
const W = (p, s) => writeFileSync(join(DIST, p), s);

// CSS
W('style.css', `
/* THEME ĐỎ RƯỢU VANG / ĐỎ ĐÔ (Tuấn chốt 16/07) — trước là xanh rêu #5c1a2b.
   Biến đã đổi tên --xanh -> --chinh cho khỏi đánh đố (tên "xanh" mà màu đỏ).
   Giữ VÀNG ĐỒNG làm màu nhấn: vàng + đỏ đô là cặp kinh điển, hợp phân khúc cao cấp. */
:root{--chinh:#5c1a2b;--chinh2:#8a2a3c;--vang:#c9a35c;--vang2:#e3c98f;--nen:#faf7f5;--chu:#2f2428;--vien:#e9e0dc;--do:#b3392f}
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:16px/1.7 'Be Vietnam Pro',-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--chu);background:var(--nen)}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}a{color:var(--chinh2)}
h1,h2,h3,.logo{font-family:'Playfair Display','Be Vietnam Pro',serif}
.top{background:linear-gradient(90deg,#5c1a2b,#7a2334);position:sticky;top:0;z-index:9;box-shadow:0 2px 16px rgba(60,15,25,.3)}
.bar{display:flex;align-items:center;gap:18px;padding:12px 20px;flex-wrap:wrap}
.logo{font-size:1.45rem;font-weight:800;color:#fff;text-decoration:none;letter-spacing:.2px}.logo span{color:var(--vang)}
.top nav{display:flex;gap:2px;flex-wrap:wrap;flex:1}
.top nav a{color:#f2dfe3;text-decoration:none;padding:7px 12px;border-radius:8px;font-size:.95rem;font-weight:500}
.top nav a.on{color:#5c1a2b;background:var(--vang);font-weight:700}.top nav a:hover{background:rgba(255,255,255,.14);color:#fff}
.call{background:linear-gradient(135deg,var(--vang),#b8904a);color:#211804;font-weight:700;text-decoration:none;padding:9px 18px;border-radius:999px;white-space:nowrap;box-shadow:0 3px 10px rgba(184,144,74,.35)}
.call:hover{filter:brightness(1.06)}
main{padding:30px 20px 48px}
h1{font-size:2rem;line-height:1.25;margin:8px 0 14px;color:var(--chinh)}
h2{font-size:1.4rem;margin:34px 0 14px;color:var(--chinh);position:relative;padding-left:14px}
h2:before{content:'';position:absolute;left:0;top:.25em;bottom:.25em;width:4px;border-radius:4px;background:var(--vang)}
.lead{font-size:1.06rem;color:#5a4a4e;margin-bottom:14px}.dim{color:#8b7d80;font-size:.9rem}
.crumb{font-size:.88rem;color:#8b7d80;margin-bottom:6px}.crumb a{text-decoration:none}
.hero{position:relative;background:linear-gradient(120deg,#5c1a2b 0%,#8a2a3c 55%,#6a1f3a 100%);color:#fff;border-radius:22px;padding:52px 44px;margin-bottom:30px;overflow:hidden}
.hero:after{content:'';position:absolute;inset:0;background:radial-gradient(600px 300px at 85% 20%,rgba(201,163,92,.28),transparent 65%),radial-gradient(400px 260px at 8% 95%,rgba(201,163,92,.14),transparent 60%);pointer-events:none}
.hero h1{color:#fff;font-size:clamp(1.7rem,4.2vw,2.7rem);max-width:720px;position:relative;z-index:1}
.hero h1 em{font-style:normal;color:var(--vang2)}
.hero p{color:#d9e6de;max-width:660px;margin-top:12px;position:relative;z-index:1;font-size:1.05rem}
.hero .hoTro{color:var(--vang2);font-weight:600;font-size:.98rem;margin-top:8px}
.hero .call{display:inline-block;margin-top:20px;position:relative;z-index:1;font-size:1.05rem;padding:12px 24px}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 4px;position:relative;z-index:1}
.chips a{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);color:#f0f5f1;text-decoration:none;padding:6px 14px;border-radius:999px;font-size:.9rem;backdrop-filter:blur(4px)}
.chips a:hover{background:rgba(201,163,92,.3);border-color:var(--vang)}
.chips.dark a{background:#fff;border:1px solid var(--vien);color:#3a4c44}
.chips.dark a:hover{border-color:var(--vang);color:var(--chinh)}
.statrow{display:flex;gap:14px;flex-wrap:wrap;margin:20px 0}
.stat{background:#fff;border:1px solid var(--vien);border-radius:16px;padding:14px 22px;min-width:150px;box-shadow:0 2px 8px rgba(11,61,46,.04)}
.stat b{display:block;font-size:1.45rem;color:var(--chinh);font-family:'Playfair Display',serif}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:20px;margin:16px 0}
.card{background:#fff;border:1px solid var(--vien);border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:.18s;box-shadow:0 2px 8px rgba(11,61,46,.05)}
.card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(11,61,46,.14);border-color:#d8cfae}
.thumb{position:relative;overflow:hidden;aspect-ratio:16/10;background:#ece3df}
.thumb img{width:100%;height:100%;object-fit:cover;transition:transform .35s}
.card:hover .thumb img{transform:scale(1.05)}
.badge{position:absolute;left:10px;bottom:10px;background:#5c1a2b;color:#fff;font-weight:800;padding:5px 14px;border-radius:999px;font-size:.98rem;border:1.5px solid rgba(201,163,92,.9);box-shadow:0 2px 6px rgba(0,0,0,.45),0 4px 14px rgba(60,15,25,.5)}
.badge b{color:var(--vang2)}
.vt{position:absolute;right:10px;top:10px;background:rgba(92,26,43,.94);color:#fff;font-size:.78rem;font-weight:700;padding:3px 11px;border-radius:999px;box-shadow:0 2px 8px rgba(60,15,25,.3);backdrop-filter:blur(3px)}
.ci{padding:14px 16px 15px}.ci h3{font-size:1.02rem;line-height:1.4;font-family:'Be Vietnam Pro',sans-serif;font-weight:600}
.gia{color:var(--chinh);font-weight:800;font-size:1.12rem;margin:4px 0 2px}
.tsm{font-size:.92rem;color:#5a4a4e;margin-top:4px}.tsm b{color:var(--chinh)}
.gal{margin:16px 0}
.gview{position:relative;border-radius:14px;overflow:hidden;background:#14211b}
.gview img{width:100%;height:min(60vw,480px);object-fit:cover;display:block}
.gbtn{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:var(--chinh);font-size:1.7rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.3);z-index:2}
.gbtn:hover{background:var(--vang)}
.gbtn.prev{left:12px}.gbtn.next{right:12px}
.gcount{position:absolute;right:14px;bottom:12px;background:rgba(0,0,0,.55);color:#fff;padding:3px 12px;border-radius:999px;font-size:.85rem}
.gthumbs{display:flex;gap:8px;overflow-x:auto;padding:10px 2px 4px;scrollbar-width:thin}
.gthumbs img{width:94px;height:66px;object-fit:cover;border-radius:8px;cursor:pointer;flex:none;opacity:.6;border:2px solid transparent;transition:.15s;background:#ece3df}
.gthumbs img.on,.gthumbs img:hover{opacity:1;border-color:var(--vang)}
.soldtag{position:absolute;left:10px;top:10px;background:var(--do);color:#fff;font-size:.78rem;font-weight:800;padding:3px 11px;border-radius:999px;letter-spacing:.5px}
.soldcta{background:#fdeeec;border-color:#eec7c2}
.fbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:#fff;border:1px solid var(--vien);border-radius:14px;padding:12px 16px;margin:14px 0 20px;box-shadow:0 2px 10px rgba(11,61,46,.06);position:sticky;top:64px;z-index:5}
.fbar select{padding:9px 12px;border:1px solid var(--vien);border-radius:9px;font:inherit;color:var(--chu);background:var(--nen);cursor:pointer}
.fbar select:focus{outline:2px solid var(--vang)}
.gtx{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:18px 0 6px}
.gtx figure{margin:0;background:var(--card,#fff);border:1px solid var(--vien);border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(11,61,46,.07)}
.gtx img{width:100%;height:260px;object-fit:cover;display:block}
.gtx figcaption{padding:10px 14px 13px;font-size:.9rem;color:#5a4a4e}
.frange{display:flex;align-items:center;gap:6px;font-size:.95rem;color:#5a4a4e}
.frange input{width:64px;padding:8px 9px;border:1px solid var(--vien);border-radius:9px;font:inherit;background:var(--nen);color:var(--chu);text-align:center}
.frange input:focus{outline:2px solid var(--vang)}
.ftxt{padding:9px 12px;border:1px solid var(--vien);border-radius:9px;font:inherit;color:var(--chu);background:var(--nen);min-width:180px;flex:1 1 180px;max-width:260px}
.ftxt:focus{outline:2px solid var(--vang)}
.xemtat{margin:6px 0 4px}.xemtat a{font-size:.9rem;color:var(--chinh2);font-weight:600;text-decoration:none}.xemtat a:hover{text-decoration:underline}
/* Phân trang khu vực (15/07) — nút to đủ bấm bằng ngón cái trên mobile (44px), tự xuống dòng khi nhiều trang */
.pager{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin:22px 0 8px}
.pager a,.pager .pcur{min-width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;border-radius:10px;font-weight:600;font-size:.95rem;text-decoration:none}
.pager a{color:var(--chinh2);border:1px solid #d8dee6;background:#fff}
.pager a:hover{border-color:var(--chinh2);background:#f4f8fc}
.pager .pcur{background:var(--chinh2);color:#fff}
.pager .pnav{font-weight:700}
.pager .pgap{padding:0 2px;color:#98a2b3}
.frl{font-size:.95rem}.frl b{color:var(--chinh)}
.fsl{position:relative;width:200px;height:26px}
.fsl::before{content:'';position:absolute;left:0;right:0;top:11px;height:4px;background:var(--vien);border-radius:2px}
.fsl i{position:absolute;top:11px;height:4px;background:var(--vang);border-radius:2px;left:0;width:100%}
.fsl input{position:absolute;left:0;top:0;width:100%;height:26px;margin:0;-webkit-appearance:none;appearance:none;background:none;pointer-events:none}
.fsl input::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;pointer-events:auto;width:20px;height:20px;border-radius:50%;background:var(--chinh2);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;margin-top:3px}
.fsl input::-moz-range-thumb{pointer-events:auto;width:16px;height:16px;border-radius:50%;background:var(--chinh2);border:2px solid #fff;cursor:pointer}
.fkq{color:var(--chinh);font-weight:700}
.xmtag{position:absolute;right:10px;bottom:10px;background:#8a2a3c;color:#fff;font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:999px}
.xmnote{background:#eaf5ef;color:#5c1a2b;border:1px solid #bcd9c9;border-radius:9px;padding:8px 12px;font-size:.9rem;font-weight:600}
.dbody{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:30px;align-items:start}
.dbody>article,.dbody>aside{min-width:0;max-width:100%}
.gal,.gview,.gthumbs{max-width:100%}
article{min-width:0}
.aside{position:sticky;top:76px;background:#fff;border:1px solid var(--vien);border-radius:16px;padding:20px;box-shadow:0 4px 16px rgba(11,61,46,.07)}
.aside .gia{font-size:1.75rem;font-weight:900;letter-spacing:-.5px}
.aside .call{display:block;text-align:center;margin:14px 0 10px;font-size:1.05rem}
.aside p{font-size:.92rem;color:#6b5a5e;margin:6px 0}
.specs{border-collapse:collapse;width:100%;background:#fff;border:1px solid var(--vien);border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(11,61,46,.04)}
.specs th,.specs td{text-align:left;padding:11px 16px;border-bottom:1px solid var(--vien);vertical-align:top}
.specs tr:last-child th,.specs tr:last-child td{border-bottom:0}
.specs th{width:36%;color:#6b5a5e;font-weight:600;background:#f5f3ec}
.qa{background:#fff;border:1px solid var(--vien);border-radius:12px;margin:10px 0;box-shadow:0 2px 6px rgba(11,61,46,.04)}
.qa summary{cursor:pointer;font-weight:650;padding:14px 18px;list-style:none;position:relative;padding-right:38px}
.qa summary:after{content:'+';position:absolute;right:16px;top:50%;transform:translateY(-52%);font-size:1.3rem;color:var(--vang);font-weight:400}
.qa[open] summary:after{content:'−'}
.qa p{padding:0 18px 16px;color:#5a4a4e}
.cta{background:linear-gradient(135deg,#fdf7e9,#faf0d8);border:1px solid #ead9ae;border-radius:16px;padding:18px 22px;margin:26px 0}
footer{background:#3a1019;color:#e4cdd3;margin-top:36px}footer .wrap{padding:30px 20px}
footer a{color:var(--vang2)}footer p{margin:5px 0}footer strong{color:#fff}
article p{margin:10px 0}table{font-size:.97rem}
.btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;position:relative;z-index:1}
.btn{display:inline-flex;align-items:center;gap:8px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;transition:.15s}
.btn.gold{background:linear-gradient(135deg,var(--vang),#b8904a);color:#211804;box-shadow:0 3px 12px rgba(184,144,74,.4)}
.btn.zalo{background:#0068ff;color:#fff;box-shadow:0 3px 12px rgba(0,104,255,.32)}
.btn:hover{filter:brightness(1.07);transform:translateY(-1px)}
.aside .btn{width:100%;justify-content:center;margin:5px 0;padding:12px 10px}
.hero-flex{display:flex;gap:36px;align-items:center;justify-content:space-between;position:relative;z-index:1}
.ava{border-radius:50%;object-fit:cover;object-position:50% 18%;border:4px solid var(--vang);box-shadow:0 10px 34px rgba(0,0,0,.35);background:#ece3df}
.ava.big{width:215px;height:215px;flex:none;animation:float 5.5s ease-in-out infinite}
.ava.sm{width:70px;height:70px;border-width:3px;flex:none}
.hero-flex>picture{flex:none;display:block;line-height:0}
.heroPic{width:235px;aspect-ratio:4/5;flex:none;object-fit:cover;border-radius:22px;border:4px solid var(--vang);box-shadow:0 16px 44px rgba(0,0,0,.4);animation:float 5.5s ease-in-out infinite;position:relative;z-index:1}
.logo{display:inline-flex;align-items:center;gap:9px}.logo img{border-radius:50%;box-shadow:0 0 0 2px rgba(201,163,92,.5)}
.socials a{margin-right:2px}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.who{display:flex;gap:13px;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed var(--vien)}
.reveal{opacity:0;transform:translateY(22px);transition:opacity .55s ease,transform .55s ease}
.reveal.in{opacity:1;transform:none}
.fab{position:fixed;right:16px;bottom:16px;display:flex;flex-direction:column;gap:12px;z-index:50}
.fab a{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;text-decoration:none;font-weight:800;box-shadow:0 6px 20px rgba(0,0,0,.28)}
.fab .fz{background:#0068ff;color:#fff;font-size:.8rem;letter-spacing:.3px}
.fab .fc{background:linear-gradient(135deg,var(--vang),#b8904a);color:#211804;font-size:1.35rem;position:relative}
.fab .fc:before{content:'';position:absolute;inset:-6px;border-radius:50%;border:2px solid var(--vang);animation:pulse 1.9s ease-out infinite}
@keyframes pulse{0%{transform:scale(.85);opacity:.9}70%{transform:scale(1.3);opacity:0}100%{opacity:0}}
@media(max-width:860px){.dbody{grid-template-columns:1fr}.aside{position:static}}
@media(max-width:760px){.hero-flex{flex-direction:column-reverse;align-items:stretch}.hero-flex>div{width:100%;min-width:0;max-width:100%}.hero h1,.hero p{max-width:100%}.ava.big{width:150px;height:150px}.hero-flex>picture{width:100%;text-align:center}.heroPic{width:180px;margin:0 auto}}
@media(max-width:640px){
html,body{overflow-x:clip}
main{padding:18px 13px 40px}
.bar{padding:9px 12px;gap:8px}
.logo{font-size:1.15rem;flex:none}.logo img{width:30px;height:30px}
.call{padding:7px 12px;font-size:.85rem;margin-left:auto}
.call .tel{display:none}
.top nav{order:3;flex:0 0 100%;width:100%;min-width:0;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;gap:0;margin:0 -12px;padding:0 8px}
.top nav::-webkit-scrollbar{display:none}
.top nav a{white-space:nowrap;font-size:.88rem;padding:6px 9px}
h1{font-size:1.42rem}h2{font-size:1.18rem;margin:26px 0 10px}
.lead{font-size:.98rem}
.hero{padding:24px 16px 26px;border-radius:15px;margin-bottom:20px}
.hero h1{font-size:1.5rem}.hero p{font-size:.95rem}
.chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:4px;margin:14px -16px 2px;padding-left:16px;padding-right:16px}
.chips::-webkit-scrollbar{display:none}
.chips a{white-space:nowrap;font-size:.85rem}
.btns{flex-direction:column;width:100%}.btns .btn{justify-content:center;width:100%}
.statrow{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.stat{min-width:0;padding:11px 14px}.stat b{font-size:1.15rem}
.grid{grid-template-columns:1fr;gap:14px}
.thumb{aspect-ratio:16/9}
.fbar{position:static;padding:10px 12px;gap:8px}
.fbar b{width:100%}
.fbar select{flex:1 1 44%;min-width:0;padding:9px 8px;font-size:.9rem}
.frange{width:100%}
.gview img{height:56vw}.gbtn{width:38px;height:38px;font-size:1.35rem}
.gthumbs img{width:78px;height:56px}
.specs{table-layout:fixed}.specs th{width:40%}.specs td,.specs th{overflow-wrap:break-word;word-break:break-word}
.gallery img{height:150px}
.fab{right:12px;bottom:12px}.fab a{width:50px;height:50px}
footer{font-size:.92rem}
}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}.ava.big,.fab .fc:before{animation:none}}
`);
// ảnh tĩnh (avatar...) -> dist/anh/
if (existsSync(join(ROOT, 'assets'))) cpSync(join(ROOT, 'assets'), join(DIST, 'anh'), { recursive: true });

// dữ liệu theo khu (danh sách chính chỉ tính căn ĐANG BÁN; căn cọc vào mục "giao dịch gần đây")
const byQuan = {}, cocByQuan = {};
for (const l of ACT) (byQuan[l.quan] ||= []).push(l);
for (const l of COC) (cocByQuan[l.quan] ||= []).push(l);
const areasLive = AREAS.map(a => ({ ...a, rows: byQuan[a.quan] || [], coc: cocByQuan[a.quan] || [] }));
const st = statsOf(ACT);

// TRANG CHỦ
{
  const newest = ACT.slice(0, 6);
  const ld = [faqLd(FAQ.slice(0, 4)), { '@type': 'ItemList', name: 'Nhà mới cập nhật', itemListElement: newest.map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/nha-dat/${l.url}.html`, name: tieuDe(l) })) }];
  const body = `
<div class="hero"><div class="hero-flex"><div>
<h1>Nhà phố – biệt thự <em>khu trung tâm</em> TP.HCM</h1>
<p>Hơn 5 năm đồng hành cùng người mua nhà phố Sài Gòn. Không ồn ào — không phô trương, chỉ giá trị thật.</p>
<p class="hoTro">❤️ Hỗ trợ dịch vụ vay thế chấp, đo vẽ cấp đổi sổ, thừa kế, hoàn công...</p>
<div class="chips">${areasLive.filter(a => a.rows.length).map(a => `<a href="/khu-vuc/${a.slug}.html">${esc(a.quan)}</a>`).join('')}</div>
<div class="btns"><a class="btn gold" href="tel:${BRAND.phone}">📞 Gọi Tuấn ngay · ${PHONE_FMT}</a><a class="btn zalo" href="${ZALO}" target="_blank" rel="noopener">💬 Nhắn Zalo tư vấn</a></div>
</div>${AVA ? `<picture>${AVAW ? `<source srcset="${AVAW}" type="image/webp">` : ''}<img class="heroPic" src="${AVA}" alt="Tuấn — Tuấn Sài Gòn, môi giới nhà phố, biệt thự trung tâm TP.HCM" width="235" height="294" fetchpriority="high"></picture>` : ''}</div></div>
<div class="statrow">
<div class="stat"><b>${st.n} căn</b>đang chào bán</div>
<div class="stat"><b>${num(st.min, 0)}–${num(st.max, 0)} tỷ</b>khoảng giá trong kho</div>
<div class="stat"><b>~${num(st.medGia, 0)} tỷ</b>giá phổ biến</div>
<div class="stat"><b>${today}</b>cập nhật</div></div>
<h2>Nhà mới cập nhật</h2>
<div class="grid">${newest.map(card).join('')}</div>
<p><a href="/nha-dat/">Xem tất cả ${st.n} căn đang bán →</a></p>
<h2>Tìm theo khu vực</h2>
<div class="grid">${areasLive.filter(a => a.rows.length).map(a => `<a class="card" href="/khu-vuc/${a.slug}.html"><div class="ci"><h3>${esc(a.ten)}</h3><p class="tsm">nhà phố – biệt thự · từ ${num(Math.min(...a.rows.map(x => x.gia_ty)), 0)} tỷ</p></div></a>`).join('')}</div>
<h2>Khách hay hỏi</h2>
${faqHtml(FAQ.slice(0, 4))}
<p><a href="/hoi-dap.html">Xem đủ ${FAQ.length} câu hỏi – đáp về mua bán nhà TP.HCM →</a></p>`;
  W('index.html', page({ path: '/', title: `${BRAND.name} — Bán nhà phố, biệt thự Quận 1, Quận 3, Phú Nhuận, Bình Thạnh TP.HCM`, desc: `Kho ${st.n} căn nhà phố – biệt thự đang bán tại khu trung tâm TP.HCM (Quận 1, Quận 3, Quận 5, Quận 10, Phú Nhuận, Bình Thạnh...), giá từ ${num(st.min, 0)} tỷ. Môi giới trực tiếp ${BRAND.name} ${BRAND.phone}, tin cập nhật ${today}.`, ld, body, upDate: today, preloadImg: AVAW }));
}

// DANH SÁCH TẤT CẢ
{
  const body = `<h1>Nhà đang bán tại TP.HCM (${st.n} căn, cập nhật ${today})</h1>
<p class="lead">Toàn bộ căn đang chào bán trong kho ${esc(BRAND.name)}, sắp theo tin mới nhất. Giá lẻ được làm tròn thành "hơn X tỷ" — gọi ${BRAND.phone} đọc mã tin để biết giá chính xác và vị trí.</p>
${fbarBlock(areasLive)}
<div id="fstatic">
${areasLive.filter(a => a.rows.length).map(a => `<h2 id="${a.slug}">${esc(a.ten)}</h2><div class="grid">${a.rows.slice(0, 24).map(card).join('')}</div>${a.rows.length > 24 ? `<p class="xemtat"><a href="/khu-vuc/${a.slug}.html">Xem tất cả ${esc(a.quan)} →</a></p>` : ''}`).join('\n')}
${COC.length ? `<h2 id="da-coc">Giao dịch gần đây — đã có khách cọc (${COC.length} căn)</h2>
<p class="dim">Các căn dưới đây đã có khách đặt cọc qua kho tin. Anh chị thích căn nào tương tự, gọi ${PHONE_FMT} để Tuấn lọc căn cùng khu, cùng tầm giá.</p>
<div class="grid">${COC.slice(0, 12).map(card).join('')}</div>` : ''}
</div>`;
  const ld = [{ '@type': 'ItemList', name: `Nhà đang bán TP.HCM — ${BRAND.name}`, numberOfItems: st.n, itemListElement: ACT.slice(0, 100).map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/nha-dat/${l.url}.html`, name: tieuDe(l) })) }, crumbLd([['Trang chủ', '/'], ['Nhà đang bán', '/nha-dat/']])];
  // ---- CHỈ MỤC TÌM KIẾM (16/07) ----
  // Trang /nha-dat/ khoe "12.420 căn" nhưng chỉ nạp 24 thẻ/quận (~200 thẻ). Bộ lọc cũ dò trong DOM
  // -> "Phú Nhuận + Hẻm xe hơi" ra "0 căn khớp" dù kho có thật (Tuấn bắt lỗi 16/07). Giờ lọc chạy trên
  // chỉ mục ĐẦY ĐỦ này, khách bấm lọc mới tải (không làm chậm trang lúc mở).
  // Mảng thay vì object cho nhẹ; ảnh cắt tiền tố chung; chuỗi ĐÃ esc sẵn để client nhét thẳng innerHTML.
  // Cắt tiền tố kho ảnh R2 cho chỉ mục nhẹ (mirrored -> "abc.jpg"); ảnh CHƯA mirror giữ nguyên URL gốc.
  // ⚠️ 16/07: kho ảnh đã chuyển GitHub Pages -> R2, nên tiền tố này PHẢI bám R2_URL. Ghim tay chuỗi cũ
  // là client ghép sai -> ảnh trong kết quả lọc VỠ HẾT (suýt dính khi session kia dời nhà sang Cloudflare).
  const IMG_PRE = R2_URL;
  // ⚠️ 16/07 (Tuấn bắt lỗi Q7/Q2 lọc ra TOÀN BỘ 12.684 căn): slug quận trong chỉ mục PHẢI lấy từ CÙNG
  // nguồn với ô chọn (areasLive[].slug), ĐỪNG tự tính slug(l.quan) — khu Thảo Điền/Phú Mỹ Hưng có slug
  // 'quan-2-thao-dien'/'quan-7-phu-my-hung' còn slug(l.quan) ra 'quan-2'/'quan-7' -> lệch -> indexOf=-1.
  const qSlugOf = {}; areasLive.forEach(a => { qSlugOf[a.quan] = a.slug; });
  const sgCua = l => qSlugOf[l.quan] || slug(l.quan);
  const qSlug = [...new Set(ACT.map(sgCua))];
  const qTen = qSlug.map(sg => esc(ACT.find(l => sgCua(l) === sg).quan));
  const vList = [...new Set(ACT.map(l => l.vitri || ''))];
  W('tim-kiem.json', JSON.stringify({
    q: qSlug, qt: qTen, v: vList.map(esc),
    r: ACT.map(l => [l.url, esc(tieuDe(l)), String(l.anh[0] || '').replace(IMG_PRE, ''), l.gia_ty, esc(l.gia_text),
      qSlug.indexOf(sgCua(l)), vList.indexOf(l.vitri || ''), l.dt || 0, l.tang || 0, l.ngang || 0, esc(l.phuong || ''), dViet(l.up)]),
  }));
  W('nha-dat/index.html', page({ path: '/nha-dat/', title: `${st.n} căn nhà đang bán khu trung tâm TP.HCM (${today}) | ${BRAND.name}`, desc: `Danh sách ${st.n} nhà phố, biệt thự đang bán tại Quận 1, Quận 3, Quận 5, Quận 10, Phú Nhuận, Bình Thạnh, Gò Vấp, Tân Bình. Giá ${num(st.min, 0)}–${num(st.max, 0)} tỷ, cập nhật ${today}.`, ld, body, upDate: today }));
}

// TRANG TỪNG CĂN (kèm 6 căn tương tự cùng khu đang bán — căn cọc càng cần để "hứng" khách)
for (const l of L) {
  const tuongTu = (byQuan[l.quan] || []).filter(x => x.ma !== l.ma).slice(0, 6);
  const { path, html } = detailPage(l, today, tuongTu);
  W(path.slice(1), html);
}

// URL CŨ /nha-dat/<mã>.html (Google index 2 ngày đầu) -> trang chuyển hướng 0s + canonical sang URL mới
const stub = (tuFile, moi) => W(tuFile, `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${moi}"><link rel="canonical" href="${SITE}${moi}"><meta name="robots" content="noindex"><title>Đang chuyển tới tin mới…</title></head><body><p><a href="${moi}">Xem tin tại địa chỉ mới</a></p></body></html>`);
let doiUrl = 0;
for (const l of L) {
  const moi = `/nha-dat/${l.url}.html`;
  if (`nha-dat/${slug(l.ma)}.html` !== moi.slice(1)) stub(`nha-dat/${slug(l.ma)}.html`, moi);
  // URL cũ ghi sai mặt tiền/hẻm (vị trí đã sửa) -> giữ link cũ sống bằng stub, khách/Google tự sang bản đúng
  if (l.urlCu && l.urlCu !== l.url) { stub(`nha-dat/${l.urlCu}.html`, moi); doiUrl++; }
}
if (doiUrl) console.log(`· ${doiUrl} căn ĐỔI URL do sửa vị trí mặt tiền/hẻm (URL cũ -> trang chuyển hướng)`);

// (17/07 Tuấn chốt) CĂN TRÙNG bị gộp (T123 nhiều chuyên gia cùng quản 1 nhà) -> REDIRECT về căn GIỮ (tương đương),
// KHÔNG để 404 và KHÔNG redirect về Home (Home = soft-404, hại SEO). Redirect cả URL mã (k4789.html) lẫn URL
// tiêu-đề cũ (lấy từ archive) sang căn giữ. data.gop = {mã trùng: mã giữ}.
if (data.gop && Object.keys(data.gop).length) {
  const urlByMa = {}; for (const l of L) urlByMa[l.ma] = l.url;
  let arcAll = {}; try { arcAll = JSON.parse(readFileSync(ARCHIVE, 'utf8')); } catch (e) {}
  let nGop = 0;
  for (const dupMa of Object.keys(data.gop)) {
    const ku = urlByMa[data.gop[dupMa]];   // URL căn GIỮ
    if (!ku) continue;                      // căn giữ không có trên web -> bỏ (khỏi redirect vào hư không)
    const moi = `/nha-dat/${ku}.html`;
    stub(`nha-dat/${slug(dupMa)}.html`, moi);                       // URL mã của căn trùng
    const oldUrl = arcAll[dupMa] && arcAll[dupMa].url;             // URL tiêu-đề cũ (đã từng index)
    if (oldUrl && oldUrl !== ku) stub(`nha-dat/${oldUrl}.html`, moi);
    nGop++;
  }
  if (nGop) console.log(`· ${nGop} căn TRÙNG (nhiều chuyên gia) -> redirect 301 về căn giữ (không 404)`);
}

// TRANG ĐƯỜNG (13/07 — đón từ khoá "bán nhà + tên đường": bán nhà phan xích long, nhà nguyễn trọng tuyển...)
const byDuongKhu = {};
for (const l of ACT) { if (!l.duong || l.duong.length < 4) continue; const k = `${l.duong}|${l.quan}`; (byDuongKhu[k] = byDuongKhu[k] || []).push(l); }
const DUONG_LIST = Object.entries(byDuongKhu).filter(([, v]) => v.length >= 5)
  .map(([k, v]) => { const [duong, quan] = k.split('|'); const st2 = statsOf(v);
    return { duong, quan, rows: v, slug: slug(`${duong} ${quan}`), min: st2.min, max: st2.max, med: st2.medGia, n: v.length }; })
  .sort((x, y) => y.n - x.n).slice(0, 250);
const DUONG_KHU = {};
for (const d of DUONG_LIST) { (DUONG_KHU[d.quan] = DUONG_KHU[d.quan] || []); if (DUONG_KHU[d.quan].length < 14) DUONG_KHU[d.quan].push(d); }
mkdirSync(join(DIST, 'duong'), { recursive: true });
for (const d of DUONG_LIST) {
  const areaLink = AREAS.find(x => x.quan === d.quan);
  const body = `<nav class="crumb"><a href="/">Trang chủ</a> › <a href="/khu-vuc/${areaLink ? areaLink.slug : ''}.html">${esc(d.quan)}</a> › ${esc(d.duong)}</nav>
<h1>Bán nhà đường ${esc(d.duong)}, ${esc(d.quan)}</h1>
<p class="lead">Nhà phố đang chào bán trên trục ${esc(d.duong)} (${esc(d.quan)}, TP.HCM) từ kho tin thật ${esc(BRAND.name)}: giá từ ${num(d.min, 0)} đến ${num(d.max, 0)} tỷ, mức phổ biến quanh ${num(d.med, 0)} tỷ — gồm cả nhà hẻm lẫn mặt tiền, cập nhật ${today}. Giá chào, còn thương lượng khi xem nhà.</p>
<div class="grid">${d.rows.slice(0, 30).map(card).join('')}</div>
${d.rows.length > 30 ? `<p class="dim">Còn ${d.rows.length - 30} căn nữa trên đường này — gọi ${PHONE_FMT} nói ngân sách, Tuấn lọc gửi đúng căn.</p>` : ''}
${areaLink ? `<p>Xem thêm: <a href="/khu-vuc/${areaLink.slug}.html">mặt bằng giá & toàn bộ nhà đang bán ${esc(d.quan)}</a>.</p>` : ''}
<div class="cta"><p>Anh chị đang nhắm khu ${esc(d.duong)}? Gọi/Zalo <a href="tel:${BRAND.phone}">${PHONE_FMT}</a> (Tuấn) — có căn chưa kịp lên web Tuấn báo trước.</p></div>`;
  const ld = [{ '@type': 'ItemList', name: `Nhà bán đường ${d.duong}, ${d.quan}`, numberOfItems: d.n, itemListElement: d.rows.slice(0, 30).map((l, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/nha-dat/${l.url}.html`, name: tieuDe(l) })) },
    crumbLd([['Trang chủ', '/'], [d.quan, `/khu-vuc/${areaLink ? areaLink.slug : ''}.html`], [d.duong, `/duong/${d.slug}.html`]])];
  W(`duong/${d.slug}.html`, page({ path: `/duong/${d.slug}.html`, title: `Bán nhà đường ${d.duong}, ${d.quan} — giá từ ${num(d.min, 0)} tỷ | ${BRAND.name}`, desc: `Nhà đang bán trên đường ${d.duong} ${d.quan}: giá ${num(d.min, 0)}–${num(d.max, 0)} tỷ, phổ biến ~${num(d.med, 0)} tỷ. Tin thật kèm ảnh, có số hẻm, cập nhật ${today}. ${BRAND.name} ${BRAND.phone}.`, ld, body, upDate: today }));
}
console.log(`· Trang đường: ${DUONG_LIST.length}`);

// KHU VỰC index + từng khu
{
  const body = `<h1>Khu vực Tuấn Sài Gòn phục vụ</h1>
<p class="lead">Mỗi trang khu vực gồm: đặc điểm khu, mặt bằng giá tính từ chính kho tin đang bán (không phải giá đồn), và danh sách căn hiện có.</p>
<div class="grid">${areasLive.map(a => `<a class="card" href="/khu-vuc/${a.slug}.html"><div class="ci"><h3>${esc(a.ten)}</h3><p class="tsm">${a.rows.length ? 'xem danh sách & mặt bằng giá' : 'đang tuyển tin'}</p><p class="dim">${esc(a.intro[0].slice(0, 90))}…</p></div></a>`).join('')}</div>`;
  W('khu-vuc/index.html', page({ path: '/khu-vuc/', title: `Nhà bán theo khu vực: Quận 1, Quận 3, Phú Nhuận, Bình Thạnh… | ${BRAND.name}`, desc: `Đặc điểm từng khu và mặt bằng giá nhà phố thực tế tại 10 khu vực trung tâm TP.HCM, tính từ kho tin đang bán của ${BRAND.name}, cập nhật ${today}.`, ld: [crumbLd([['Trang chủ', '/'], ['Khu vực', '/khu-vuc/']])], body, upDate: today }));

  // PHÂN TRANG khu vực (Tuấn chốt 15/07): trước đây khu page cắt cứng 96 căn rồi ghi "gọi Tuấn"
  // -> Bình Thạnh 2.603 căn mà chỉ 96 căn bấm tới được, 2.507 căn còn lại KHÔNG có đường link nào
  // (chỉ vào được qua sitemap/Google) => Google coi là trang mồ côi, người dùng không lướt hết kho.
  // Nay: 24 căn/trang, có số trang. Trang 1 GIỮ NGUYÊN URL cũ (/khu-vuc/<slug>.html — đừng đổi, đã index)
  // + giữ intro/thống kê/FAQ/khối; trang 2+ = /khu-vuc/<slug>-trang-N.html chỉ có lưới + pager (khỏi lặp FAQ = trùng nội dung).
  const PER = 24;
  const trangUrl = (slug, n) => `/khu-vuc/${slug}${n > 1 ? '-trang-' + n : ''}.html`;
  // Pager có CỬA SỔ: 109 trang mà in hết 109 số thì vô dụng -> 1 2 3 … 54 55 56 … 109
  const pagerHtml = (slug, cur, tong) => {
    if (tong < 2) return '';
    const nums = new Set([1, 2, tong - 1, tong, cur - 1, cur, cur + 1]);
    const list = [...nums].filter(n => n >= 1 && n <= tong).sort((x, y) => x - y);
    let out = '', prev = 0;
    for (const n of list) {
      if (prev && n - prev > 1) out += '<span class="pgap">…</span>';
      out += n === cur ? `<span class="pcur" aria-current="page">${n}</span>` : `<a href="${trangUrl(slug, n)}">${n}</a>`;
      prev = n;
    }
    return `<nav class="pager" aria-label="Phân trang">
${cur > 1 ? `<a class="pnav" href="${trangUrl(slug, cur - 1)}" rel="prev">‹ Trước</a>` : ''}
${out}
${cur < tong ? `<a class="pnav" href="${trangUrl(slug, cur + 1)}" rel="next">Sau ›</a>` : ''}
</nav>`;
  };

  for (const a of areasLive) {
    const has = a.rows.length > 0;
    const s = has ? statsOf(a.rows) : null;
    const soTrang = Math.max(1, Math.ceil(a.rows.length / PER));
    const giaQA = has ? {
      q: `Giá nhà ${a.quan} (TP.HCM) hiện khoảng bao nhiêu?`,
      a: `Theo ${s.n} căn đang chào bán trong kho ${BRAND.name} (cập nhật ${today}), nhà khu ${a.quan} có giá từ ${num(s.min, 0)} đến ${num(s.max, 0)} tỷ đồng; mức phổ biến khoảng ${num(s.medGia, 0)} tỷ (giá trung vị — một nửa số căn rẻ hơn mức này, nửa còn lại cao hơn), quy ra đơn giá đất phổ biến khoảng ${num(s.medPpm, 0)} triệu/m². Đây là giá chào của tin thật đang bán, không phải giá đồn — mức cụ thể tùy vị trí hẻm hay mặt tiền, hiện trạng nhà và pháp lý.`,
    } : null;
    const qa = [...(giaQA ? [giaQA] : []), ...a.faq];
    const body = `
<nav class="crumb"><a href="/">Trang chủ</a> › <a href="/khu-vuc/">Khu vực</a> › ${esc(a.ten)}</nav>
<h1>Mua bán nhà ${esc(a.ten)} — TP.HCM</h1>
${has ? fbarBlock(areasLive, a.slug) : ''}
<div id="fstatic">
${a.intro.map(p => `<p class="lead">${esc(p)}</p>`).join('\n')}
${has ? `<h2>Mặt bằng giá thực tế (từ kho tin đang bán)</h2>
<div class="statrow">
<div class="stat"><b>${s.n} căn</b>đang chào bán</div>
<div class="stat"><b>${num(s.min, 0)}–${num(s.max, 0)} tỷ</b>khoảng giá</div>
<div class="stat"><b>~${num(s.medGia, 0)} tỷ</b>giá phổ biến</div>
<div class="stat"><b>~${num(s.medPpm, 0)} tr/m²</b>đơn giá đất phổ biến</div></div>
<p class="dim">Tính từ ${s.n} tin thật đang bán trong kho, cập nhật ${today}. Giá chào — còn thương lượng.</p>` : `<p>Khu này Tuấn đang tuyển tin — gọi <a href="tel:${BRAND.phone}">${BRAND.phone}</a> nói nhu cầu, có căn phù hợp Tuấn báo liền.</p>`}
${qa.length ? `<h2>Hỏi đáp về nhà đất ${esc(a.quan)}</h2>\n${faqHtml(qa)}` : ''}
${has ? (() => {
  const hxh = a.rows.filter(x => x.vitri === 'Hẻm xe hơi');
  const mt = a.rows.filter(x => x.vitri === 'Mặt tiền');
  const nguong = Math.max(5, Math.round(s.medGia));
  const duoi = a.rows.filter(x => x.gia_ty < nguong);
  // (16/07 Tuấn chốt) TRANG 1 = DANH SÁCH THẲNG GIỐNG TRANG 2,3,4. Trước đây trang 1 bố cục khác hẳn:
  // nhét 3 mục "hẻm xe hơi / mặt tiền / dưới N tỷ" LÊN ĐẦU, đẩy danh sách chính xuống tận dưới
  // -> khách vào trang quận không thấy nhà ngay. Giờ mấy mục chia theo nhu cầu gom xuống CUỐI = "Tìm kiếm liên quan".
  const khoi = (id, tit, arr) => arr.length >= 4 ? `<h3 id="${id}">${tit}</h3><div class="grid">${arr.slice(0, 8).map(card).join('')}</div>` : '';
  const lienQuan = `${khoi('hem-xe-hoi', `Nhà hẻm xe hơi ${esc(a.quan)} đang bán`, hxh)}
${khoi('mat-tien', `Nhà mặt tiền ${esc(a.quan)} đang bán`, mt)}
${khoi('theo-gia', `Nhà ${esc(a.quan)} dưới ${nguong} tỷ`, duoi)}
${DUONG_KHU[a.quan] ? `<h3>Bán nhà theo tên đường tại ${esc(a.quan)}</h3><p class="chips">${DUONG_KHU[a.quan].map(d => `<a href="/duong/${d.slug}.html">${esc(d.duong)} · từ ${num(d.min, 0)} tỷ</a>`).join('')}</p>` : ''}`.trim();
  return `<h2 id="tat-ca">Tất cả nhà đang bán tại ${esc(a.quan)}</h2>
<p class="dim">${s.n} căn — trang 1/${soTrang}, ${PER} căn mỗi trang.</p>
<div class="grid">${a.rows.slice(0, PER).map(card).join('')}</div>
${pagerHtml(a.slug, 1, soTrang)}
${lienQuan ? `<h2 id="lien-quan">Tìm kiếm liên quan</h2>\n${lienQuan}` : ''}`;
})() : ''}
${a.coc.length ? `<h2>Giao dịch gần đây tại ${esc(a.quan)} — đã có khách cọc</h2><div class="grid">${a.coc.slice(0, 8).map(card).join('')}</div>` : ''}
</div>
<div class="cta"><p>Cần tìm nhà ${esc(a.quan)} theo đúng ngân sách? Gọi/Zalo <a href="tel:${BRAND.phone}">${BRAND.phone}</a> (Tuấn) — nói rõ tầm tiền và nhu cầu, Tuấn lọc đúng căn rồi mới hẹn xem, không dắt đi lòng vòng.</p></div>`;
    const ld = [crumbLd([['Trang chủ', '/'], ['Khu vực', '/khu-vuc/'], [a.ten, `/khu-vuc/${a.slug}.html`]]), ...(qa.length ? [faqLd(qa)] : [])];
    W(`khu-vuc/${a.slug}.html`, page({ path: `/khu-vuc/${a.slug}.html`, title: `Bán nhà ${a.ten} TP.HCM${has ? ` — hẻm xe hơi, mặt tiền, giá từ ${num(s.min, 0)} tỷ` : ''} | ${BRAND.name}`, desc: has ? `Giá nhà ${a.quan} theo tin thật đang bán: ${num(s.min, 0)}–${num(s.max, 0)} tỷ, trung vị ~${num(s.medGia, 0)} tỷ (~${num(s.medPpm, 0)} triệu/m² đất). Danh sách kèm ảnh, cập nhật ${today}. ${BRAND.name} ${BRAND.phone}.` : `${a.intro[0].slice(0, 150)}`, ld, body, upDate: today }));

    // Trang 2..N — chỉ lưới + pager. KHÔNG lặp intro/FAQ (Google đọc là nội dung trùng), title/desc riêng từng trang.
    for (let t = 2; t <= soTrang; t++) {
      const lat = a.rows.slice((t - 1) * PER, t * PER);
      const bodyT = `
<nav class="crumb"><a href="/">Trang chủ</a> › <a href="/khu-vuc/">Khu vực</a> › <a href="/khu-vuc/${a.slug}.html">${esc(a.ten)}</a> › Trang ${t}</nav>
<h1>Bán nhà ${esc(a.ten)} — trang ${t}/${soTrang}</h1>
${fbarBlock(areasLive, a.slug)}
<div id="fstatic">
<p class="lead">Kho ${esc(a.quan)} đang có ${s.n} căn chào bán. Đây là căn thứ ${(t - 1) * PER + 1}–${Math.min(t * PER, s.n)}, xếp căn có ảnh và mới cập nhật lên trước. Cập nhật ${today}.</p>
<div class="grid">${lat.map(card).join('')}</div>
${pagerHtml(a.slug, t, soTrang)}
</div>
<div class="cta"><p>Chưa thấy căn ưng ở trang này? Gọi/Zalo <a href="tel:${BRAND.phone}">${BRAND.phone}</a> (Tuấn) — nói tầm tiền và nhu cầu, Tuấn lọc đúng căn trong kho ${esc(a.quan)} rồi mới hẹn xem.</p></div>`;
      W(`khu-vuc/${a.slug}-trang-${t}.html`, page({
        path: trangUrl(a.slug, t),
        title: `Bán nhà ${a.ten} TP.HCM — trang ${t}/${soTrang} | ${BRAND.name}`,
        desc: `Nhà đang bán ${a.quan} TP.HCM, căn ${(t - 1) * PER + 1}–${Math.min(t * PER, s.n)} trong ${s.n} căn (giá ${num(s.min, 0)}–${num(s.max, 0)} tỷ). Tin thật kèm ảnh, cập nhật ${today}. ${BRAND.name} ${BRAND.phone}.`,
        ld: [crumbLd([['Trang chủ', '/'], ['Khu vực', '/khu-vuc/'], [a.ten, `/khu-vuc/${a.slug}.html`], [`Trang ${t}`, trangUrl(a.slug, t)]])],
        body: bodyT, upDate: today,
      }));
    }
    a.soTrang = soTrang;   // để sitemap gom trang 2+
  }
}

// HỎI ĐÁP
{
  const body = `<h1>Hỏi đáp mua bán nhà TP.HCM — ${BRAND.name} trả lời</h1>
<p class="lead">Những câu khách hỏi Tuấn nhiều nhất khi mua bán nhà phố khu trung tâm TP.HCM: thuật ngữ, pháp lý, thanh toán an toàn và mặt bằng giá. Câu trả lời dựa trên kinh nghiệm giao dịch thực tế — quy định có thể thay đổi theo thời điểm, khi giao dịch nên xác nhận lại.</p>
${faqHtml(FAQ)}
<div class="cta"><p>Câu hỏi của anh chị chưa có ở đây? Gọi/Zalo <a href="tel:${BRAND.phone}">${BRAND.phone}</a> (Tuấn) — hỏi gì đáp nấy, không mất phí tư vấn.</p></div>`;
  W('hoi-dap.html', page({ path: '/hoi-dap.html', title: `Hỏi đáp mua nhà TP.HCM: tránh mua hớ, cọc an toàn, quy hoạch, nhà thế chấp | ${BRAND.name}`, desc: 'Giải đáp ' + FAQ.length + ' nỗi lo thật khi mua bán nhà phố TP.HCM: làm sao khỏi mua hớ, kiểm tra quy hoạch trước khi cọc, đặt cọc không bị bẻ kèo, sổ chung – vi bằng, nhà thế chấp, vay ngân hàng, ký quỹ, miễn thuế nhà duy nhất.', ld: [faqLd(FAQ), crumbLd([['Trang chủ', '/'], ['Hỏi đáp', '/hoi-dap.html']])], body, upDate: today }));
}

// GIỚI THIỆU
{
  const body = `<h1>Về ${BRAND.name}</h1>
${AVA ? `<p><picture>${AVAW ? `<source srcset="${AVAW}" type="image/webp">` : ''}<img class="ava big" src="${AVA}" alt="Tuấn — ${esc(BRAND.tagline)}" width="215" height="215" fetchpriority="high"></picture></p>` : ''}
${ABOUT.map(p => `<p class="lead">${esc(p)}</p>`).join('\n')}
<h2>Tuấn làm việc mỗi ngày</h2>
<div class="gtx">
<figure><picture><source srcset="/anh/tuan-khach-1.webp" type="image/webp"><img src="/anh/tuan-khach-1.jpg" alt="Tuấn Sài Gòn cùng khách hàng chốt giao dịch nhà phố TP.HCM" loading="lazy" width="1100" height="990"></picture><figcaption>Cùng khách chốt giao dịch — tính toán rõ ràng từng khoản ngay trên bàn.</figcaption></figure>
<figure><picture><source srcset="/anh/tuan-khach-2.webp" type="image/webp"><img src="/anh/tuan-khach-2.jpg" alt="Tuấn Sài Gòn tư vấn khách mua nhà tại quán cà phê" loading="lazy" width="1100" height="827"></picture><figcaption>Buổi tư vấn với gia đình khách — nghe nhu cầu trước, lọc căn sau.</figcaption></figure>
<figure><picture><source srcset="/anh/tuan-cong-chung.webp" type="image/webp"><img src="/anh/tuan-cong-chung.jpg" alt="Hồ sơ công chứng mua bán nhà tại văn phòng công chứng Bến Nghé" loading="lazy" width="825" height="1100"></picture><figcaption>Theo khách tới tận phòng công chứng — hồ sơ pháp lý có Tuấn lo cùng (thông tin cá nhân trong ảnh đã được che).</figcaption></figure>
</div>
<div class="btns"><a class="btn gold" href="tel:${BRAND.phone}">📞 Gọi Tuấn ngay · ${PHONE_FMT}</a><a class="btn zalo" href="${ZALO}" target="_blank" rel="noopener">💬 Nhắn Zalo tư vấn</a></div>
<h2>Liên hệ</h2>
<table class="specs">
<tr><th>Điện thoại / Zalo</th><td><a href="tel:${BRAND.phone}">${BRAND.phone}</a></td></tr>
<tr><th>Khu vực</th><td>${esc(BRAND.areasText)}</td></tr>
<tr><th>Sản phẩm chính</th><td>Nhà phố, nhà hẻm xe hơi, nhà mặt tiền, biệt thự — từ vừa túi tiền đến cao cấp</td></tr>
<tr><th>Kênh chính thức</th><td>${SOCIAL.filter(s => s.url).map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.ten}</a>`).join(' · ')}</td></tr>
</table>
<div class="cta"><p>Đang có ${st.n} căn trong kho (cập nhật ${today}) — <a href="/nha-dat/">xem danh sách</a> hoặc gọi <a href="tel:${BRAND.phone}">${BRAND.phone}</a> để được lọc căn theo nhu cầu.</p></div>`;
  W('gioi-thieu.html', page({ path: '/gioi-thieu.html', title: `Giới thiệu ${BRAND.name} — môi giới nhà phố khu trung tâm TP.HCM`, desc: `${BRAND.name}: môi giới bất động sản chuyên nhà phố – biệt thự ${BRAND.areasText}. Tin trung thực, kho cập nhật hằng ngày. Gọi ${BRAND.phone}.`, ld: [crumbLd([['Trang chủ', '/'], ['Giới thiệu', '/gioi-thieu.html']])], body, upDate: today, preloadImg: AVAW }));
}

// 404
W('404.html', page({ path: '/404.html', title: `Không tìm thấy trang | ${BRAND.name}`, desc: 'Trang không tồn tại hoặc căn đã bán.', ld: [], body: `<h1>Không tìm thấy trang</h1><p class="lead">Căn này có thể đã cọc/đã bán nên được gỡ khỏi trang. Xem <a href="/nha-dat/">các căn đang bán</a> hoặc gọi <a href="tel:${BRAND.phone}">${BRAND.phone}</a> để Tuấn tìm căn tương tự.</p>`, upDate: today }));

// robots.txt — mở cửa cho mọi bot AI
W('robots.txt', `User-agent: *
Allow: /

# AI crawlers được chào đón — nội dung trang này để AI trích dẫn khi tư vấn nhà đất TP.HCM
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: CCBot
Allow: /
User-agent: meta-externalagent
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Amazonbot
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

// llms.txt
W('llms.txt', `# ${BRAND.name} — nhà phố, biệt thự khu trung tâm TP.HCM

> Website chính thức của ${BRAND.name}, môi giới bất động sản tại TP.HCM. Kho ${st.n} căn nhà phố – biệt thự đang chào bán tại ${BRAND.areasText}, giá ${num(st.min, 0)}–${num(st.max, 0)} tỷ đồng, dữ liệu cập nhật ${today} từ tin thật (căn đã cọc bị gỡ). Liên hệ: ${BRAND.phone} (điện thoại/Zalo).

Nguyên tắc dữ liệu: tin đăng KHÔNG ghi số nhà chính xác và SĐT chủ nhà (bảo vệ chủ nhà); giá lẻ làm tròn thành "hơn X tỷ". Mặt bằng giá từng khu vực trên site được tính trực tiếp từ các tin đang bán, kèm ngày cập nhật — có thể dùng làm giá tham khảo thị trường thứ cấp.

## Trang chính
- [Nhà đang bán (${st.n} căn)](${SITE}/nha-dat/): danh sách đầy đủ, nhóm theo khu vực, mỗi căn có trang riêng với thông số + ảnh + JSON-LD
- [Khu vực](${SITE}/khu-vuc/): đặc điểm 10 khu trung tâm + mặt bằng giá thực tế (min/max/trung vị, đơn giá đất) tính từ kho tin
- [Hỏi đáp](${SITE}/hoi-dap.html): ${FAQ.length} câu hỏi-đáp về mua bán nhà TP.HCM (hẻm xe hơi, sổ hồng, đặt cọc nhà thế chấp, ký quỹ, thuế, sáp nhập phường 2025)
- [Giới thiệu](${SITE}/gioi-thieu.html): về ${BRAND.name}, cách làm việc, liên hệ

## Khu vực (giá tính từ tin đang bán, cập nhật ${today})
${areasLive.filter(a => a.rows.length).map(a => { const s = statsOf(a.rows); return `- [${a.ten}](${SITE}/khu-vuc/${a.slug}.html): ${s.n} căn, ${num(s.min, 0)}–${num(s.max, 0)} tỷ, trung vị ~${num(s.medGia, 0)} tỷ (~${num(s.medPpm, 0)} triệu/m² đất)`; }).join('\n')}

## Liên hệ
- Điện thoại/Zalo: ${BRAND.phone}
- Khu vực phục vụ: ${BRAND.areasText}
`);


// ================= CẨM NANG (blog — Tuấn chốt 12/07, mục tiêu 100-200 bài pain-point) =================
// Bài do blog.mjs viết sẵn vào data/blog/*.json; chỉ ĐĂNG bài tới hạn pub (đăng rải 4 bài/ngày — build 2 cữ/ngày tự nhả).
const NHOM_TEN = { phaply: 'Pháp lý & giao dịch', taichinh: 'Vay & tài chính', thamdinh: 'Thẩm định căn nhà', khuvuc: 'Khu vực & mặt bằng giá', chienluoc: 'Kinh nghiệm mua bán' };
let BAI = [];
try {
  const homNay = new Date().toISOString().slice(0, 10);
  BAI = readdirSync(join(ROOT, 'data', 'blog')).filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(ROOT, 'data', 'blog', f), 'utf8')))
    .filter(b => b.pub <= homNay).sort((a, b) => b.pub < a.pub ? -1 : 1);
} catch (e) {}
if (BAI.length) {
  mkdirSync(join(DIST, 'cam-nang'), { recursive: true });
  const dV = iso => { const [y, m, d] = iso.split('-'); return `${+d}/${+m}/${y}`; };
  const baiCard = b => `<a class="card" href="/cam-nang/${b.slug}.html"><div class="ci"><p class="dim" style="margin:0 0 4px">${NHOM_TEN[b.nhom] || 'Cẩm nang'} · ${dV(b.pub)}</p><h3>${esc(b.title)}</h3><p class="tsm">${esc(b.mota)}</p></div></a>`;
  for (const b of BAI) {
    const cung = BAI.filter(x => x.nhom === b.nhom && x.slug !== b.slug).slice(0, 3);
    const body = `<nav class="crumb"><a href="/">Trang chủ</a> › <a href="/cam-nang/">Cẩm nang</a> › ${esc(NHOM_TEN[b.nhom] || '')}</nav>
<h1>${esc(b.title)}</h1>
<p class="dim">${NHOM_TEN[b.nhom] || 'Cẩm nang'} · Tuấn Sài Gòn · cập nhật ${dV(b.pub)}</p>
${b.bai}
<div class="cta"><p>Anh chị đang vướng đúng tình huống trong bài? Gọi/Zalo <a href="tel:${BRAND.phone}">${PHONE_FMT}</a> (Tuấn) — nghe kể tình huống cụ thể rồi mới tư vấn, không mất phí.</p></div>
${cung.length ? `<h2>Đọc tiếp cùng chủ đề</h2><div class="grid">${cung.map(baiCard).join('')}</div>` : ''}
<p>Xem thêm: <a href="/nha-dat/">nhà đang bán tại TP.HCM</a> · <a href="/khu-vuc/">mặt bằng giá từng khu vực</a></p>`;
    const ld = [{ '@type': 'Article', headline: b.title, description: b.mota, datePublished: b.pub, dateModified: b.pub,
      author: { '@id': `${SITE}/#agent` }, publisher: { '@id': `${SITE}/#agent` }, mainEntityOfPage: `${SITE}/cam-nang/${b.slug}.html`, inLanguage: 'vi' },
      crumbLd([['Trang chủ', '/'], ['Cẩm nang', '/cam-nang/'], [b.title, `/cam-nang/${b.slug}.html`]])];
    W(`cam-nang/${b.slug}.html`, page({ path: `/cam-nang/${b.slug}.html`, title: `${b.title} | ${BRAND.name}`, desc: b.mota, ld, body, upDate: dV(b.pub) }));
  }
  const nhoms = [...new Set(BAI.map(b => b.nhom))];
  const idxBody = `<h1>Cẩm nang mua bán nhà TP.HCM — ${BAI.length} bài từ kinh nghiệm giao dịch thật</h1>
<p class="lead">Tuấn viết từ chính các tình huống gặp hằng ngày khi dẫn khách mua bán nhà lẻ khu trung tâm: pháp lý, đặt cọc, vay ngân hàng, thẩm định căn nhà, mặt bằng giá từng khu. Quy định có thể thay đổi theo thời điểm — khi giao dịch nên xác nhận lại.</p>
<div class="cta"><p><b>Cần đáp án nhanh?</b> Xem <a href="/hoi-dap.html">Hỏi đáp — ${FAQ.length} câu khách hỏi Tuấn nhiều nhất</a>: cọc an toàn, tránh mua hớ, kiểm tra quy hoạch, sổ chung – vi bằng…</p></div>
${nhoms.map(n => `<h2>${NHOM_TEN[n] || n}</h2><div class="grid">${BAI.filter(b => b.nhom === n).map(baiCard).join('')}</div>`).join('\n')}`;
  W('cam-nang/index.html', page({ path: '/cam-nang/', title: `Cẩm nang mua bán nhà TP.HCM: pháp lý, đặt cọc, vay vốn, định giá | ${BRAND.name}`, desc: `${BAI.length} bài kinh nghiệm thực tế khi mua bán nhà phố TP.HCM: tránh mất cọc, kiểm tra quy hoạch, vay ngân hàng, thẩm định nhà, mặt bằng giá từng quận — viết bởi môi giới trực tiếp ${BRAND.name}.`, ld: [crumbLd([['Trang chủ', '/'], ['Cẩm nang', '/cam-nang/']])], body: idxBody, upDate: today }));
  console.log(`· Cẩm nang: đăng ${BAI.length} bài`);
}

// sitemap.xml
{
  const urls = [['/', data.ts], ['/nha-dat/', data.ts], ['/khu-vuc/', data.ts], ['/hoi-dap.html', data.ts], ['/gioi-thieu.html', data.ts],
    ...AREAS.map(a => [`/khu-vuc/${a.slug}.html`, data.ts]),
    // trang 2+ của khu vực (15/07): PHẢI có trong sitemap — đây là đường Google bò tới mấy ngàn căn nằm sâu
    ...areasLive.flatMap(a => Array.from({ length: Math.max(0, (a.soTrang || 1) - 1) }, (_, i) => [`/khu-vuc/${a.slug}-trang-${i + 2}.html`, data.ts])),
    ...L.map(l => [`/nha-dat/${l.url}.html`, l.up]),
    ...(BAI.length ? [['/cam-nang/', data.ts], ...BAI.map(b => [`/cam-nang/${b.slug}.html`, new Date(b.pub).getTime() / 1000])] : []),
    ...DUONG_LIST.map(d => [`/duong/${d.slug}.html`, data.ts])];
  W('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, ts]) => `<url><loc>${SITE}${p}</loc><lastmod>${new Date((ts || 0) * 1000).toISOString().slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>`);
}

// feed.xml (RSS tin mới)
{
  const items = ACT.slice(0, 20).map(l => `<item><title>${esc(tieuDe(l))} — ${esc(l.gia_text)}</title><link>${SITE}/nha-dat/${l.url}.html</link><guid>${SITE}/nha-dat/${l.url}.html</guid><pubDate>${new Date(l.up * 1000).toUTCString()}</pubDate><description>${esc(motaNgan(l))}</description></item>`).join('\n');
  W('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${BRAND.name} — nhà mới cập nhật</title><link>${SITE}</link><description>Nhà phố, biệt thự mới chào bán khu trung tâm TP.HCM</description><language>vi</language>\n${items}\n</channel></rss>`);
}

// CNAME giữ chỗ cho tên miền sau này (surge dùng file CNAME để custom domain)
console.log(`✓ Dựng xong ${L.length} trang căn + ${AREAS.length} trang khu vực + 5 trang chính -> dist/`);
