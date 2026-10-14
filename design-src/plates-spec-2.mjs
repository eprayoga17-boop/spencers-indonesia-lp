// Specs for the remaining sections (merged into SPEC by plates-spec.mjs)
const W = '#ffffff';
const quote = (r, t, w = 700, lhr = 1.15) => ({ r, t, f: 'libre', w, a: 'center', lhr, tag: 'blockquote' });
const name = (r, t) => ({ r, t, f: 'libre', w: 700, a: 'center' });

const ctaSiap = {
  blocks: [
    { r: [205, 165, 1330, 425], t: 'Kamu Siap Memiliki<br>Lingkar Tubuh Kecil Mu ?', f: 'caveat', w: 700, a: 'center', lhr: 1.05, tag: 'h2' },
    { r: [205, 470, 1290, 632], t: 'Kalau Nggak Percaya, Buktiin Aja<br>Khasiatnya <span style="color:#e3727a">Dalam 2 Minggu !</span>', f: 'libre', w: 700, a: 'center', lhr: 1.15 },
    { r: [380, 748, 1120, 824], t: 'Cobain Sendiri Disini :', f: 'libre', w: 700, a: 'center' },
  ],
};
const chatAdmin = { blocks: [{ r: [540, 72, 992, 148], t: 'Chat Admin', f: 'opensans', w: 700, c: W }] };
const pembayaran = {
  blocks: [
    { r: [185, 226, 1332, 282], t: 'Pembayaran Official &amp; Trusted hanya melalui Paper.id', f: 'inter', w: 700, a: 'center' },
    { r: [195, 292, 1322, 347], t: 'sebagai Payment Gateway resmi Spencer\'s Indonesia.', f: 'inter', a: 'center' },
    { r: [275, 383, 1297, 439], t: 'Pastikan rekening tertera atas nama PAPER.ID.', f: 'inter', w: 700 },
    { r: [296, 506, 1220, 600], m: [290, 500, 1226, 604], t: 'Spencer\'s Indonesia tidak pernah menggunakan<br>Rekening atas nama perseorangan', f: 'inter', w: 500, s: 'italic', a: 'center', lhr: 1.2 },
    { r: [248, 670, 657, 747], t: 'Bekerjasama dengan mitra<br>berizin dan diawasi oleh', f: 'inter', lhr: 1.15 },
    { r: [1031, 816, 1260, 892], t: 'Tersertifikasi<br>ISO 27001 · KAN', f: 'inter', lhr: 1.15 },
  ],
};
const btnDistributor = { blocks: [{ r: [193, 80, 620, 127], t: 'Info Peluang Distributor', f: 'opensans', w: 700, c: W }] };
const distributorCard = (extra = []) => ({
  blocks: [
    { r: [155, 36, 647, 130], t: 'Mau jadi Distributor /<br>Stockist MealBlend?', f: 'poppins', w: 700, a: 'center', lhr: 1.1, c: W, tag: 'h2' },
    { r: [86, 186, 717, 294], t: 'Bantu kami menerima <b>besarnya antusiasme</b><br><b>permintaan Spencer’s MealBlend</b> secara<br>merata ke seluruh Indonesia.', f: 'inter', a: 'center', lhr: 1.25 },
    { r: [208, 348, 592, 387], t: 'Dapatkan kesempatan', f: 'inter', w: 700, a: 'center' },
    { r: [213, 394, 587, 427], t: 'menghasilkan keuntungan', f: 'inter', a: 'center' },
    { r: [113, 429, 686, 460], pad: 0, fill: '#5862cb', size: 25.5, m: [112, 428, 692, 462], t: 'Puluhan hingga Ratusan juta rupiah /bln', f: 'inter', a: 'center', c: W },
    { r: [146, 464, 670, 499], t: 'dari penjualan Spencer’s MealBlend,', f: 'inter', a: 'center' },
    ...extra,
  ],
});

export const SPEC2 = {
  'diliput-judul': { frames: { 'm-10d649': { blocks: [{ r: [205, 18, 755, 72], fill: '#ffffff', t: 'Spencer’s sudah diliput oleh:', f: 'libre', w: 700, a: 'center', tag: 'h2' }] } } },
  'pola-makan': {
    frames: {
      'm-fc037a': {
        blocks: [
          { r: [103, 78, 724, 152], t: 'Bagaimana Menggunakan', f: 'caveat', w: 700, a: 'center', tag: 'h2' },
          { r: [203, 398, 592, 452], t: 'Pola Makan Daily', f: 'libre', w: 700, a: 'center', c: W, tag: 'h3' },
          { r: [92, 698, 334, 730], t: '1 sachet MealBlend', f: 'inter', w: 600, a: 'center' },
          { r: [468, 698, 710, 730], t: 'Menu Favorit Kamu', f: 'inter', w: 600, a: 'center' },
          { r: [176, 763, 347, 807], t: 'Breakfast', f: 'libre', w: 700 },
          { r: [558, 766, 678, 810], t: 'Lunch', f: 'libre', w: 700 },
          { r: [58, 1033, 300, 1065], t: '1 sachet MealBlend', f: 'inter', w: 600, a: 'center' },
          { r: [343, 1078, 394, 1114], t: 'Or', f: 'inter', w: 600 },
          { r: [67, 1255, 307, 1287], t: 'Menu Favorit Kamu', f: 'inter', w: 600, a: 'center' },
          { r: [523, 1201, 659, 1264], t: '1-2 sachet<br>MealBlend', f: 'inter', w: 600, a: 'center', lhr: 1.2 },
          { r: [401, 1323, 534, 1367], t: 'Dinner', f: 'libre', w: 700 },
        ],
      },
    },
  },
  'emergency-snack': {
    frames: {
      'm-7620c6': {
        blocks: [
          { r: [123, 83, 657, 160], t: 'Suka tiba-tiba lapar di waktu yang<br>tidak tepat ?', f: 'inter', w: 600, a: 'center', lhr: 1.25, tag: 'h2' },
          { r: [173, 173, 608, 212], t: 'No worries anymore, beb !', f: 'inter', w: 700, a: 'center' },
          { r: [123, 436, 246, 468], t: 'For Your', f: 'poppins', w: 500 },
          { r: [120, 476, 378, 574], t: 'Emergency<br>But Safe', f: 'libre', w: 700, lhr: 1.0 },
          { r: [390, 478, 684, 568], t: 'Snack', f: 'libre', w: 700 },
          { r: [210, 653, 420, 757], t: 'Snacking<br>Pagi ?', f: 'libre', w: 700, lhr: 1.1, c: W },
          { r: [210, 773, 327, 807], t: 'Bisaa...', f: 'libre', w: 700, c: W },
          { r: [210, 898, 420, 1002], t: 'Snacking<br>Sore ?', f: 'libre', w: 700, lhr: 1.1, c: W },
          { r: [210, 1018, 427, 1055], t: 'Bisa Banget...', f: 'libre', w: 700, c: W },
          { r: [202, 1146, 412, 1252], t: 'Snacking<br>Malam ?', f: 'libre', w: 700, lhr: 1.1, c: W },
          { r: [202, 1264, 324, 1300], t: 'Aman !', f: 'libre', w: 700, c: W },
        ],
      },
    },
  },
  'your-body': {
    frames: {
      'm-5dda19': {
        blocks: [
          { r: [73, 68, 212, 232], t: 'Your<br>Body', f: 'caveat', w: 700, lhr: 1.0 },
          { r: [48, 408, 752, 547], t: 'You’ll Realize That Your Body<br>Is The Best Gift From God Ever!', f: 'caveat', w: 700, a: 'center', lhr: 1.1 },
        ],
      },
    },
  },
  'testi-cindy-surabaya': {
    frames: {
      'm-fdfd45': {
        label: 'Testimoni Cindy, Surabaya',
        blocks: [
          quote([205, 168, 1260, 362], '“ Happy bgt, kesampaian buat ngecilin<br>lingkar pinggang. Udh susut 8 cm.<br>Enjoy banget tiap harinya ”'),
          name([432, 398, 1052, 458], '- Cindy 34th, Surabaya'),
        ],
      },
      'm-b855d2': {
        blocks: [{ r: [538, 212, 1398, 628], t: 'Lingkar Tubuh Kecil<br>Bikin Kamu Confident<br>Pake Baju Apapun !', f: 'caveat', w: 700, a: 'center', lhr: 1.15, tag: 'h2' }],
      },
    },
  },
  'testi-maria-yolanda': {
    frames: {
      'm-381e69': {
        label: 'Testimoni Maria Yolanda',
        blocks: [
          quote([203, 212, 1282, 402], 'Bebas Beli Baju Apapun<br>itu Happy Banget', 700, 1.1),
          name([68, 438, 1412, 502], '- Maria Yolanda, Indonesia’s Next Top Model 2'),
        ],
      },
    },
  },
  'testi-sherly': {
    frames: {
      'm-a8b007': {
        label: 'Testimoni Sherly, Surabaya',
        blocks: [
          quote([110, 53, 692, 162], 'Dipuji Suami Lingkar<br>Perut Susut 8 CM!', 700, 1.0),
          name([198, 178, 600, 214], '- Sherly 40 th, Surabaya'),
        ],
      },
    },
  },
  'testi-adelia': {
    frames: {
      'm-b35c92': {
        label: 'Testimoni Adelia, Surabaya: Day 1 100kg, Day 53 86kg',
        blocks: [
          quote([140, 144, 1366, 372], '“Capek dibvlly dan dipanggil “gendut”.<br>Berkat MealBlend aku bisa<br>bangkit lagi 💛”'),
          name([446, 426, 1078, 493], '- Adelia 30th, Surabaya'),
          { r: [276, 678, 440, 739], t: 'Day 1', f: 'inter', w: 800, s: 'italic', a: 'center', fill: W },
          { r: [1060, 678, 1272, 741], t: 'Day 53', f: 'inter', w: 800, s: 'italic', a: 'center', fill: W },
          { r: [36, 797, 404, 859], t: 'Before: <b style="font-weight:800">100</b><b style="font-weight:800;font-size:.6em">kg</b>', f: 'inter', s: 'italic', fill: W },
          { r: [1132, 797, 1428, 861], t: 'After: <b style="font-weight:800">86</b><b style="font-weight:800;font-size:.6em">kg</b>', f: 'inter', s: 'italic', a: 'right', fill: W },
        ],
      },
    },
  },
  'resep-bekerja': {
    frames: {
      'm-cf57a8': {
        blocks: [
          { r: [198, 60, 1292, 142], t: 'Resep Kami <span style="color:#e86c72">Sudah Bekerja</span>', f: 'libre', w: 700, a: 'center', tag: 'h2' },
          { r: [143, 158, 1362, 302], t: 'Mengecilkan Hingga Ratusan Centimeter<br>Total Lingkar Tangan, Perut &amp; Paha Dari', f: 'libre', a: 'center', lhr: 1.2 },
          { r: [460, 316, 1042, 382], t: 'Ratusan Customer.', f: 'libre', w: 700, a: 'center' },
        ],
      },
    },
  },
  'cta-1': { frames: { 'cta-siap': ctaSiap, 'btn-chat-admin': chatAdmin } },
  'cta-2': { frames: { 'cta-siap': ctaSiap, 'btn-chat-admin': chatAdmin } },
  'pembayaran-distributor-1': { frames: { pembayaran, 'btn-distributor': btnDistributor, 'm-60f0a6': distributorCard() } },
  'pembayaran-distributor-2': {
    frames: {
      pembayaran, 'btn-distributor': btnDistributor,
      'm-f676f9': distributorCard([{ r: [194, 541, 608, 585], t: 'Seperti kisah nyata mereka:', f: 'inter', w: 700, s: 'italic', a: 'center', css: 'text-decoration:underline;text-underline-offset:.12em' }]),
    },
  },
  'offline-judul': {
    frames: {
      'm-37a252': {
        blocks: [
          { r: [83, 202, 1247, 292], t: 'OFFLINE EXPERIENCES', f: 'libre', w: 700, tag: 'h2', g: 'linear-gradient(90deg,#000 0%,#3a1530 40%,#a32a7a 70%,#ff40b8 100%)' },
          { rs: [[90, 322, 897, 392], [90, 392, 640, 468]], t: 'Beyond Presence, Into Connection.<br>Closer to a Better You.', f: 'inter', lhr: 1.2 },
        ],
      },
    },
  },
  'selera-wanita': {
    frames: {
      'm-02bd6a': {
        blocks: [
          { r: [399, 381, 1103, 446], t: 'Breakfast N Dinner Praktis', f: 'josefin', w: 700, a: 'center' },
          { r: [254, 479, 1252, 584], t: 'Dengan Resep Nutrisi Alami &amp; Ilmiah<br>Yang <span style="color:#f5a300">BEKERJA</span> Kecilkan Lingkar Tubuh Kamu', f: 'josefin', w: 700, a: 'center', lhr: 1.0 },
          { r: [563, 1052, 935, 1200], t: 'Menyusutkan<br>Lingkar Pinggang<br>2-3cm /Week', f: 'libre', w: 700, a: 'center', lhr: 1.0 },
          { r: [129, 1314, 562, 1461], t: 'Mengencangkan<br>Tangan Bergelambir<br>1cm /Week', f: 'libre', w: 700, a: 'center', lhr: 1.0 },
          { r: [946, 1328, 1374, 1480], t: 'Mengikis Timbunan<br>Lemak Paha<br>1-2cm /Week', f: 'libre', w: 700, a: 'center', lhr: 1.0 },
          { r: [32, 1748, 379, 1898], t: 'BB Turun Alami<br>2-8kg Dalam<br>2 Minggu', f: 'libre', w: 700, a: 'center', lhr: 1.0 },
          { r: [1132, 1748, 1486, 1898], t: 'Mengurangi<br>Lipatan Kulit<br>Dalam 2 Minggu', f: 'libre', w: 700, a: 'center', lhr: 1.0 },
          { r: [772, 3125, 1205, 3192], t: 'Minuman Serbuk Biji-Bijian<br>dan Kacang-Kacangan', f: 'inter', w: 500, s: 'italic', a: 'right', lhr: 1.15 },
          { r: [230, 3212, 1320, 3297], t: '*berdasarkan survey 1.860 customer yang telah<br>mengikuti program Spencer’s MealBlend', f: 'inter', s: 'italic', a: 'center', lhr: 1.1 },
          { r: [116, 3423, 1397, 3607], t: 'Kami memahami bahwa selera<br>itu penting bagi wanita.', f: 'caveat', w: 700, a: 'center', lhr: 1.15, c: W, tag: 'h2' },
        ],
      },
    },
  },
  'soal-rasa': {
    frames: {
      'm-237c42': {
        blocks: [
          { r: [143, 52, 1367, 270], t: 'Soal rasa,<br>kami berkolaborasi dengan para chef<br>&amp; Tim RnD terbaik di bidangnya.', f: 'libre', a: 'center', lhr: 1.15 },
          { r: [38, 352, 1457, 528], t: 'Memberikan pengalaman kelezatan<br>terbaik untuk selera Kamu.', f: 'libre', w: 700, a: 'center', lhr: 1.15, tag: 'h2' },
        ],
      },
    },
  },
  flavors: {
    name: 'Explore 10 Delightful Flavors',
    frames: {
      'm-22552d': {
        blocks: [{ r: [50, 20, 740, 100], t: 'Explore 10 Delightful Flavors', f: 'caveat', w: 700, a: 'center', tag: 'h2' }],
        tiles: [
          [0, 139, 263, 389, 'Pina Colada Mocktail'], [270, 139, 531, 389, 'Vanilla Ice Cream'], [537, 139, 796, 389, 'Wild Blueberry Splash'],
          [0, 396, 393, 776, 'Belgian Dark Choco'], [403, 396, 799, 776, 'Naked Strawberry'],
          [1, 784, 263, 1049, 'Popcorn Marshmallow'], [269, 784, 529, 1049, 'Royal Taro Delight'], [535, 784, 797, 1049, 'Korean Banana Milk'],
          [0, 1055, 405, 1447, 'Cookies &amp; Cream'], [414, 1055, 799, 1447, 'Venetian Cappuccino'],
        ],
      },
    },
  },
  'testimoni-judul': { frames: { 'testimoni-header': { blocks: [{ r: [118, 72, 314, 112], t: 'Testimoni', f: 'libre', w: 700, tag: 'h2' }] } } },
  disclaimer: {
    frames: {
      disclaimer: {
        blocks: [
          { r: [50, 55, 1450, 118], t: 'IMPORTANT: MEDICAL AND LEGAL DISCLAIMERS', f: 'libre', w: 700, tag: 'h2' },
          { r: [60, 250, 1447, 608], f: 'inter', lhr: 1.15, t: 'The information provided by Spencer’s (“we,” “us,” or “our”) on this website<br>is for general informational and educational purposes only. We make<br>reasonable efforts to keep it accurate and up to date, but we make no<br>warranties of any kind about its completeness or accuracy. To the extent<br>permitted by applicable law, we are not liable for any loss or damage arising<br>from your use of this website or reliance on its content. Nothing in this<br>disclaimer limits your rights as a consumer under the laws of the Republic of<br>Indonesia.' },
          { r: [60, 650, 1447, 962], f: 'inter', lhr: 1.15, t: 'This website does not provide medical advice, diagnosis, or treatment, and<br>using it does not create a doctor-patient relationship. The health<br>information here is not a substitute for professional medical advice. Please<br>consult a qualified healthcare professional before acting on any information<br>on this website, especially if you are pregnant, nursing, taking medication,<br>or have an existing medical condition. In an emergency, call 119 or go to the<br>nearest healthcare facility immediately.' },
          { r: [60, 1010, 1447, 1232], f: 'inter', lhr: 1.15, t: 'This website may feature testimonials from users of our products. These<br>reflect the personal experiences and opinions of those users, are not<br>guarantees of results, and may not represent the typical experience.<br>Individual results may vary. If a testimonial was given in exchange for free<br>products, compensation, or any other benefit, we will disclose it.' },
        ],
      },
      'footer-copyright': { blocks: [{ r: [203, 98, 1052, 152], t: '©2026 Spencer’s MealBlend. All rights reserved.', f: 'inter' }] },
    },
  },
};
