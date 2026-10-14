import { SPEC2 } from "./plates-spec-2.mjs";
// Text blocks per live artwork (coordinates in the original image pixels, see design-src/live).
// r / rs: rect(s) holding only that text on a smooth background (erased from the plate)
// t: HTML text (use <br> for the live line breaks) · f: font class suffix · w: weight · s: style
// a: left|center|right · c: colour (auto-sampled when omitted) · g: CSS gradient for gradient text
// lhr: line-height / font-size guess for multi-line blocks · fill: 'row' (default) | '#hex' | 'none'
export const SPEC = {
  ...SPEC2,
  'bahan-alami': {
    frames: {
      'm-69b7e2': {
        blocks: [
          { r: [170, 125, 1335, 215], t: 'Dari Berbagai Bahan Alami Pilihan', f: 'libre', a: 'center', tag: 'h2' },
          { r: [270, 290, 590, 358], t: 'Chia Seeds', f: 'poppins', w: 700 },
          { r: [985, 288, 1305, 350], t: 'Pea Protein', f: 'poppins', w: 700 },
          { r: [275, 470, 720, 535], t: 'Kacang Almond', f: 'poppins', w: 700 },
          { r: [985, 440, 1375, 552], t: 'Black Sesame<br>Seeds', f: 'poppins', w: 700, lhr: 0.9 },
          { r: [275, 630, 695, 740], t: 'Stevia<br>Pemanis Alami', f: 'poppins', w: 700, lhr: 0.9 },
          { r: [980, 620, 1355, 780], t: 'Dan Berbagai<br>Bahan Alami<br>lainnya...', f: 'poppins', w: 700, lhr: 0.9 },
        ],
      },
    },
  },
  'telah-teruji': {
    frames: {
      'm-8e52ef': {
        blocks: [
          { r: [80, 140, 830, 245], t: 'TELAH TERUJI', f: 'inter', w: 900, tag: 'h2', ls: -0.04,
            g: 'linear-gradient(90deg,#131a3a 0%,#1f2b63 45%,#5f76c9 80%,#8ea3e6 100%)' },
          { r: [80, 352, 1320, 560], m: [70, 350, 1330, 600], f: 'inter', lhr: 1.3, css: 'font-weight:400',
            t: 'Telah teruji pada Wanita &amp; Pria dengan variable rentang <b>usia</b><br><b>18-73th, seluruh body type, berat 48kg - 135kg, 8 macam pola</b><br><b>makan, dan anabolism sekaligus catabolism metabolic rate</b><br>pada peserta kami di Pekanbaru, Papua, Medan &amp; Pulau Jawa.' },
          { r: [400, 672, 1152, 752], t: 'Studi Ilmiah Buktikan:', f: 'inter', w: 700, a: 'center', c: '#000000' },
          { r: [225, 805, 1285, 1000], t: 'Chia Seed Turunkan BB<br>8x Lebih Besar', f: 'inter', w: 700, a: 'center', lhr: 1.05, tag: 'h3',
            g: 'linear-gradient(90deg,#3a72c8 0%,#2d559f 50%,#1f3a76 100%)' },
          { r: [115, 1058, 740, 1118], t: 'Prof. Vladimir Vuksan', f: 'inter', w: 700, c: '#ffffff' },
          { r: [115, 1125, 1035, 1222], t: 'Professor of Nutritional Sciences &amp; Medicine<br>University of Toronto', f: 'inter', c: '#ffffff', lhr: 1.2 },
          { rs: [[80, 1272, 1132, 1388], [80, 1388, 1400, 1552]], f: 'inter', lhr: 1.3, fill: '#ffffff',
            t: 'Dalam uji klinis yang saya pimpin, peserta yang<br>mengonsumsi 30 gram chia seed setiap hari selama<br>6 bulan mengalami penurunan berat badan 8x lebih besar dan<br>penyusutan lingkar pinggang hingga 3,5 cm, disertai peningkatan<br>hormon kenyang dan penurunan peradangan tubuh hingga 40%.' },
          { r: [80, 1572, 1048, 1632], f: 'inter', s: 'italic', lhr: 1.25,
            t: 'Source: Vuksan V, et al. Salba-chia (Salvia hispanica L.) in the treatment of overweight and obese<br>patients with Type 2 diabetes. Nutrition, Metabolism and Cardiovascular Diseases. 2017;27(2):138–146.' },
        ],
      },
    },
  },
  '79-juta': {
    frames: {
      'm-cf3812': {
        blocks: [
          { r: [115, 95, 645, 252], t: '79 juta', f: 'caveat', w: 700, tag: 'h2' },
          { r: [92, 282, 775, 372], t: 'Wanita Di Indonesia', f: 'caveat', w: 700 },
          { r: [82, 442, 1000, 568], t: 'Mencari Solusi Untuk Mengecilkan<br>Lingkar Tubuh Mereka,', f: 'libre', w: 700, lhr: 1.25 },
          { r: [82, 632, 885, 700], t: 'Demi Bisa Pake Outfit Idaman!', f: 'libre', w: 700 },
        ],
      },
    },
  },
  'testi-cindy-bekasi': {
    frames: {
      'm-34b61a': {
        label: 'Testimoni Cindy, Bekasi',
        blocks: [
          { r: [298, 140, 1205, 372], t: '“dr semua yg udh ak coba,<br>pinggang susut 8 cm<br>NEVER BE THIS EASIER!”', f: 'libre', a: 'center', lhr: 1.15, tag: 'blockquote' },
          { r: [478, 410, 1065, 486], t: '- Cindy 39th, Bekasi', f: 'libre', w: 700, a: 'center' },
        ],
      },
    },
  },
  'cara-kerja': {
    frames: {
      'm-c8b1b7': {
        blocks: [
          { r: [98, 58, 722, 132], t: 'Bagaimana Cara Kerjanya ?', f: 'caveat', w: 700, a: 'center', tag: 'h2' },
          { r: [160, 190, 192, 218], t: '1.', f: 'inter', w: 700 },
          { r: [200, 182, 708, 326], t: 'Membantu tubuh mempertahankan<br>metabolisme yang optimal, sehingga<br>mempermudah &amp; mempercepat<br>memiliki tubuh ideal &amp; sehat.', f: 'inter', lhr: 1.25 },
          { r: [160, 391, 194, 419], t: '2.', f: 'inter', w: 700 },
          { r: [200, 382, 672, 454], t: 'Menjaga perut kenyang lebih lama<br>berjam-jam secara natural &amp; sehat.', f: 'inter', lhr: 1.25 },
          { r: [160, 512, 194, 540], t: '3.', f: 'inter', w: 700 },
          { r: [200, 505, 632, 577], t: 'Menunjang defisit kalori secara<br>Nyaman, natural &amp; efektif.', f: 'inter', lhr: 1.25 },
        ],
      },
    },
  },
  'efek-samping': {
    frames: {
      'm-012f74': {
        blocks: [
          { r: [44, 48, 592, 114], t: 'EFEK SAMPING', f: 'libre', w: 700, tag: 'h2' },
          { r: [114, 213, 738, 268], t: 'TIDAK ADA EFEK SAMPING', f: 'libre', w: 700, tag: 'h3' },
          { r: [114, 281, 612, 394], t: 'Betul! Karna bahan baku kami<br>menggunakan biji-bijian natural<br>dari alam.', f: 'poppins', lhr: 1.3 },
          { r: [114, 438, 668, 492], t: 'NO Chemical Fat Burner !', f: 'libre', w: 700, tag: 'h3' },
          { r: [114, 507, 668, 620], t: 'Kami tidak menggunakan CHEMICAL<br>FAT BURNER yang membuat jantung<br>kamu berdegup lebih kencang.', f: 'poppins', lhr: 1.3 },
          { r: [114, 653, 442, 707], t: 'Anti Pencahar !', f: 'libre', w: 700, tag: 'h3' },
          { r: [114, 723, 652, 797], t: 'Kamu tidak akan mules karna kami<br>TIDAK MENGGUNAKAN PENCAHAR.', f: 'poppins', lhr: 1.3 },
        ],
      },
      'm-9d94e1': {
        blocks: [
          { r: [114, 23, 472, 78], t: 'No Preservatives', f: 'libre', w: 700, tag: 'h3' },
          { r: [114, 123, 307, 178], t: 'No Filler', f: 'libre', w: 700, tag: 'h3' },
          { r: [114, 218, 412, 274], t: 'No Emulsifier', f: 'libre', w: 700, tag: 'h3' },
        ],
      },
      'm-27c947': {
        blocks: [
          { r: [508, 470, 748, 516], t: 'Minuman Serbuk Biji-Bijian<br>dan Kacang-Kacangan', f: 'inter', w: 500, s: 'italic', a: 'right', lhr: 1.15 },
          { r: [114, 553, 638, 608], t: 'Pro Natural Ingredients !', f: 'libre', w: 700, tag: 'h3' },
          { r: [114, 630, 582, 738], t: 'RAW Dari Alam,<br>Untuk Tubuh Ideal Kamu!', f: 'libre', w: 700, lhr: 1.2 },
          { r: [114, 738, 658, 928], t: 'Spencer\'s MealBlend menggunakan<br><b style="color:#ec5866;font-weight:700">bahan alami pilihan</b> dengan<br>komposisi &amp; kandungan nutrisi<br>komplit untuk membantu<br>mendapatkan tubuh ideal Kamu.', f: 'poppins', lhr: 1.25 },
          { r: [72, 970, 742, 1003], m: [60, 973, 760, 1004], t: 'PRO NATURAL &nbsp; PRO NATURAL &nbsp; PRO NATURAL', f: 'libre', c: '#ffffff', a: 'center', fixed: { size: 24.7, left: 410.5, top: 974 }, css: 'word-spacing:.02em' },
        ],
      },
    },
  },
  "dampak-positif": {
    frames: {
      "m-eeb8df": {
        blocks: [
          { r: [285, 58, 1205, 138], t: "Selain Tanpa Efek Samping,", f: "libre", w: 700, a: "center", tag: "h2" },
          { r: [195, 198, 1292, 345], t: "mengkonsumsi Spencer's MealBlend<br>secara rutin juga memberikan", f: "libre", a: "center", lhr: 1.2 },
          { r: [138, 350, 1352, 416], pad: 0, m: [130, 345, 1360, 416], t: "dampak positif untuk kesehatan kamu :", f: "libre", w: 700, a: "center" },
          { r: [298, 538, 342, 588], t: "1.", f: "inter", w: 700 },
          { r: [382, 522, 1140, 658], t: "Menurunkan Kadar Kolesterol<br>Dalam Darah.", f: "inter", lhr: 1.2 },
          { r: [298, 785, 352, 834], t: "2.", f: "inter", w: 700 },
          { r: [376, 770, 1212, 1040], t: "Mengontrol Gula Darah Dengan<br>Memperlambat Penyerapan Gula<br>Ke Dalam Darah, Sehingga<br>Kadar Gula Darah Lebih Stabil.", f: "inter", lhr: 1.2 },
          { r: [303, 1176, 357, 1224], t: "3.", f: "inter", w: 700 },
          { r: [380, 1162, 1005, 1298], t: "Membantu Meringankan<br>Gejala GERD.", f: "inter", lhr: 1.2 },
          { r: [303, 1416, 359, 1467], t: "4.", f: "inter", w: 700 },
          { r: [382, 1408, 1398, 1542], t: "Tinggi Antioksidan Untuk Meningkatkan<br>Sistem Kekebalan Tubuh.", f: "inter", lhr: 1.2 },
          { r: [303, 1670, 355, 1720], t: "5.", f: "inter", w: 700 },
          { r: [382, 1660, 1318, 1798], t: "Membantu Melembabkan &amp; Menjaga<br>Kesehatan Kulit.", f: "inter", lhr: 1.2 },
        ],
      },
    },
  },
  "langsung-kenyang": {
    frames: {
      "m-1e17f4": {
        label: "Langsung Kenyang, Tahan Lama! Spencer's MealBlend Instant Effect",
        blocks: [
          { r: [110, 46, 676, 110], t: "Langsung Kenyang,", f: "libre", w: 700, a: "center", tag: "h2" },
          { r: [118, 104, 702, 202], t: "Tahan Lama!", f: "caveat", w: 700, a: "center" },
          { r: [134, 452, 192, 496], t: "0<span style=\"font-size:.5em\">%</span>", f: "carlito", w: 700 },
          { r: [284, 446, 346, 494], t: "9<span style=\"font-size:.5em\">gr</span>", f: "carlito", w: 700 },
          { r: [424, 448, 508, 492], t: "15 <span style=\"font-size:.48em\">gr</span>", f: "carlito", w: 700 },
          { r: [568, 444, 714, 494], t: "170 <span style=\"font-size:.48em\">kkal</span>", f: "carlito", w: 700 },
          { r: [128, 500, 194, 520], t: "Added", f: "inter", w: 500, s: "italic", a: "center" },
          { r: [112, 520, 212, 549], t: "SUGAR", f: "inter", w: 700, a: "center" },
          { r: [246, 500, 404, 520], t: "HIGH QUALITY", f: "inter", w: 500, s: "italic", a: "center" },
          { r: [272, 522, 350, 550], t: "FIBER", f: "inter", w: 700, a: "center" },
          { r: [412, 498, 514, 518], t: "BALANCED", f: "inter", w: 500, s: "italic", a: "center" },
          { r: [404, 520, 524, 549], t: "PROTEIN", f: "inter", w: 700, a: "center" },
          { r: [598, 498, 646, 518], t: "LOW", f: "inter", w: 500, s: "italic", a: "center" },
          { r: [560, 522, 682, 552], t: "CALORIE", f: "inter", w: 700, a: "center" },
          { r: [150, 556, 652, 582], t: "*Kandungan gizi dapat bervariasi bergantung pada varian rasa", f: "inter", s: "italic", a: "center" },
        ],
      },
    },
  },
  "testi-nelly-josephine": {
    frames: {
      "m-280b61": {
        label: "Testimoni Nelly, Surabaya",
        blocks: [
          { r: [243, 196, 1252, 348], t: "“one step closer to be kpop idol<br>wkkwkwkw 🤣”", f: "libre", a: "center", lhr: 1.15, tag: "blockquote" },
          { r: [414, 408, 1052, 478], t: "- Nelly 36 th, Surabaya", f: "libre", w: 700, a: "center" },
        ],
      },
      "m-93a2fa": {
        label: "Testimoni Josephine, Jakarta",
        blocks: [
          { r: [252, 240, 1260, 390], t: "“ Utk aku yg super sibuk bgt ini<br>bener2 game changer sih..”", f: "libre", w: 700, a: "center", lhr: 1.15, tag: "blockquote" },
          { r: [387, 442, 1071, 510], t: "- Josephine 28th, Jakarta", f: "libre", w: 700, a: "center" },
        ],
      },
    },
  },
};
