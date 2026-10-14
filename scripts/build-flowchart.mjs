// Builds the non-technical website flowchart (visitor + admin) as A4 pages: one PDF + one PNG per page,
// written to docs/flowchart-website/. Needs Google Chrome (CHROME_PATH to override). Run:
//   node scripts/build-flowchart.mjs
// Update the Mermaid texts below when the landing page sections or the admin menus change.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(ROOT, 'docs', 'flowchart-website');
fs.mkdirSync(OUT, { recursive: true });
const { default: puppeteer } = await import(pathToFileURL(`${ROOT}/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js`));

const logo = `data:image/png;base64,${fs.readFileSync(`${ROOT}/public/admin/logo.png`).toString('base64')}`;
const font = pathToFileURL(`${ROOT}/public/assets/fonts/geist-variable.woff2`).href;

// ---------------------------------------------------------------- diagrams (Mermaid)
const CLASSES = `
  classDef visit fill:#fff1f1,stroke:#d92b2b,stroke-width:1.5px,color:#2b1a1a;
  classDef page fill:#ffffff,stroke:#e3b4b4,stroke-width:1.2px,color:#2b1a1a;
  classDef cta fill:#d92b2b,stroke:#b51f1f,stroke-width:1.5px,color:#ffffff;
  classDef goal fill:#e8f7ee,stroke:#1f9d55,stroke-width:1.5px,color:#123b24;
  classDef out fill:#f4f4f5,stroke:#a1a1aa,stroke-width:1.2px,color:#3f3f46;
  classDef admin fill:#eef3ff,stroke:#3b5bdb,stroke-width:1.5px,color:#1b2559;
  classDef sub fill:#ffffff,stroke:#b6c3ee,stroke-width:1.2px,color:#1b2559;
  classDef dec fill:#fff8e6,stroke:#d99a00,stroke-width:1.5px,color:#4a3500;
`;

const overview = `flowchart LR
  S(["<b>Calon customer</b><br/>melihat iklan / postingan<br/>Instagram · TikTok · Facebook · WhatsApp"]):::visit
  AD["<b>Tim Admin</b><br/>login ke website admin"]:::admin
  H["<b>Menu Halaman</b><br/>menyusun & mengubah<br/>isi landing page"]:::sub
  P["<b>Menu Promo</b><br/>banner, badge,<br/>teks bar merah"]:::sub
  LP["<b>Landing page</b><br/>Spencer's MealBlend<br/>satu halaman panjang, khusus HP"]:::page
  WA(["<b>Chat Admin di WhatsApp</b><br/>= order"]):::goal
  L["<b>Dashboard & Laporan</b><br/>berapa pengunjung, klik WhatsApp,<br/>bagian yang paling dilihat"]:::admin
  S -- "klik link" --> LP
  AD --> H & P
  H -- "Simpan → langsung tayang" --> LP
  P -- "Publish → tampil di semua halaman" --> LP
  LP -- "klik Chat Admin" --> WA
  LP -. "kunjungan & klik<br/>tercatat otomatis" .-> L
  AD -. "dibaca tim" .-> L
${CLASSES}`;

const visitor = `flowchart LR
  subgraph K1["① DATANG & TERTARIK"]
    direction TB
    IN(["Pengunjung klik link<br/>iklan · Instagram · TikTok · WhatsApp"]):::visit
    B0["<b>1 · Bar promo merah</b><br/>promo yang sedang berlaku"]:::page
    B1["<b>2 · Pembuka</b><br/>event offline · testimoni<br/>'Langsing, Cantik, Glowing'"]:::page
    B2["<b>3 · Manfaat utama</b><br/>'Pertama di Indonesia'<br/>nutrition facts · badge promo"]:::page
    IN --> B0 --> B1 --> B2
  end
  subgraph K2["② PERCAYA & PAHAM"]
    direction TB
    B3["<b>4 · Bukti & kepercayaan</b><br/>200.000++ customer · 12 tahun & award<br/>bahan alami · telah teruji · diliput media"]:::page
    B4["<b>5 · Produk & cara kerja</b><br/>Artisan Tea · cara kerja<br/>tanpa efek samping · dampak positif"]:::page
    B5["<b>6 · Cara pakai & testimoni</b><br/>langsung kenyang · pola makan<br/>emergency snack · testimoni & video"]:::page
    B6["<b>7 · Hasil nyata</b><br/>Artisan Tea series<br/>'resep kami sudah bekerja'"]:::page
    B3 --> B4 --> B5 --> B6
  end
  subgraph K3["③ AJAKAN BELI"]
    direction TB
    C1["<b>8 · AJAKAN BELI #1</b><br/>banner promo · tombol Chat Admin<br/>pembayaran resmi & distributor"]:::cta
    B7["<b>9 · Pengalaman & rasa</b><br/>offline experiences · selera wanita<br/>Chef Wina · 10 varian rasa"]:::page
    C2["<b>10 · AJAKAN BELI #2</b><br/>banner promo · tombol Chat Admin<br/>distributor · kisah distributor"]:::cta
    B8["<b>11 · Penutup</b><br/>testimoni chat · tips dokter<br/>FAQ · disclaimer · footer"]:::page
    C1 --> B7 --> C2 --> B8
  end
  subgraph K4["④ TUJUAN AKHIR"]
    direction TB
    WA(["<b>WhatsApp Admin Spencer's</b><br/>tanya, konsultasi, order<br/><i>tombol Chat Admin di 8 & 10</i>"]):::goal
    DS(["Halaman Distributor spencers.id<br/><i>dari bagian 8 & 10</i>"]):::out
    FT(["Halaman spencers.id<br/>privacy · pembayaran · pengiriman · blog<br/><i>link footer di 11</i>"]):::out
    X(["Keluar / belum tertarik"]):::out
    WA ~~~ DS ~~~ FT ~~~ X
  end
  K1 --> K2 --> K3 --> K4
${CLASSES}`;

const adminMap = `flowchart LR
  LG(["<b>Login</b><br/>email + password"]):::admin
  LG --> M{{"Menu samping · mode terang / gelap"}}:::dec
  M --> D["<b>Dashboard</b>"]:::admin
  M --> R["<b>Laporan</b>"]:::admin
  M --> H["<b>Halaman</b>"]:::admin
  M --> P["<b>Promo</b>"]:::admin
  M --> O(["Logout"]):::out
  D --> D1["Ringkasan 7 hari<br/>pengunjung · tayangan<br/>klik WhatsApp · konversi"]:::sub
  D --> D2["Promo yang sedang<br/>berjalan & berikutnya"]:::sub
  D --> D3["Aktivitas terbaru tim"]:::sub
  R --> R1["<b>Ringkasan</b><br/>tren · perangkat · sumber<br/>peta provinsi · unduh CSV"]:::sub
  R --> R2["<b>Per Bagian</b><br/>bagian yang dilihat · lama dilihat<br/>klik + heatmap"]:::sub
  R --> R3["<b>Log</b><br/>aktivitas admin"]:::sub
  H --> H1["Daftar halaman<br/>cari · sampul · Statistik · Lihat live"]:::sub
  H --> H2["Halaman baru<br/>dari template / salin halaman"]:::sub
  H --> H3["Arsip & pulihkan"]:::sub
  H --> E["<b>Editor halaman</b><br/>tab <b>Konten</b>: susun bagian, upload gambar / HTML<br/>tab <b>Desain</b>: lebar · warna · font · sampul<br/>tab <b>SEO</b>: judul · deskripsi · link · indeks Google<br/>tab <b>Global</b>: font & favicon semua halaman<br/>tab <b>Riwayat</b>: versi lama & aktivitas<br/>preview iPhone · Coba di HP · Simpan"]:::admin
  P --> P1["Timeline promo<br/>& peringatan hari kosong"]:::sub
  P --> P2["Promo Insidentil<br/>1.1 · 10.10 · Natal · Idul Fitri<br/>toggle manual / tanggal"]:::sub
  P --> P3["Promo Regular<br/>14 Day · PayDay<br/>sesuai tanggal"]:::sub
  P --> P4["Isi promo<br/>banner · badge · teks bar merah"]:::sub
${CLASSES}`;

const adminFlows1 = `flowchart LR
  subgraph F1["UBAH ISI HALAMAN"]
    direction TB
    a1(["Buka Halaman → pilih halaman"]):::admin --> a2["Ubah isi<br/>geser urutan · klik kanan<br/>upload gambar / HTML"]:::sub
    a2 --> a3["Cek tampilan<br/>preview iPhone · Coba di HP (QR)"]:::sub
    a3 --> a4{"Sudah benar?"}:::dec
    a4 -- "belum: Undo / ubah lagi" --> a2
    a4 -- "ya" --> a5["Klik <b>Simpan</b>"]:::admin
    a5 --> a6(["Halaman live berubah<br/>versi lama masuk Riwayat"]):::goal
  end
  F1 ~~~ F2
  subgraph F2["ATUR PROMO"]
    direction TB
    b1(["Buka Promo"]):::admin --> b2["Pilih / buat promo<br/>Insidentil atau Regular"]:::sub
    b2 --> b3["Atur tanggal / toggle<br/>upload banner & badge<br/>tulis teks bar merah"]:::sub
    b3 --> b4["Tersimpan sebagai draft<br/>(titik oranye di menu)"]:::sub
    b4 --> b5["Klik <b>Publish</b>"]:::admin
    b5 --> b6(["Tampil di semua<br/>landing page"]):::goal
  end
${CLASSES}`;

const adminFlows2 = `flowchart LR
  subgraph F3["PROMO MANA YANG TAMPIL?"]
    direction LR
    c1{"Ada Insidentil<br/>yang toggle-nya ON?"}:::dec
    c1 -- "ya" --> c4(["Tampilkan Insidentil itu"]):::goal
    c1 -- "tidak" --> c2{"Ada Insidentil<br/>sesuai tanggal hari ini?"}:::dec
    c2 -- "ya" --> c4
    c2 -- "tidak" --> c3{"Ada Regular<br/>sesuai tanggal?"}:::dec
    c3 -- "ya" --> c5(["Tampilkan Regular itu"]):::goal
    c3 -- "tidak" --> c6(["Tanpa promo<br/>bagian promo disembunyikan"]):::out
  end
  subgraph F4["BACA HASIL"]
    direction TB
    d1(["Pengunjung membuka halaman"]):::visit --> d2["Tercatat otomatis<br/>tanpa cookie, tanpa data pribadi"]:::sub
    d2 --> d3["Dashboard & Laporan<br/>pengunjung · klik WhatsApp<br/>bagian yang paling dilihat"]:::admin
    d3 --> d4(["Keputusan tim<br/>ubah isi halaman atau promo"]):::goal
  end
  F3 ~~~ F4
${CLASSES}`;

const pages = [
  { title: 'Gambaran Besar', sub: 'Dua sisi website: pengunjung yang membaca landing page, dan tim admin yang mengelola isinya.', id: 'overview', code: overview, land: true,
    legend: [['visit', 'Pengunjung'], ['page', 'Halaman / bagian'], ['goal', 'Tujuan'], ['admin', 'Admin']] },
  { title: 'Alur Pengunjung', sub: 'Perjalanan calon customer dari link iklan sampai chat WhatsApp. Landing page dibaca dari atas ke bawah; bagian-bagiannya dikelompokkan per topik.', id: 'visitor', code: visitor, land: true,
    legend: [['visit', 'Pengunjung'], ['page', 'Bagian halaman'], ['cta', 'Ajakan beli'], ['goal', 'Tujuan utama'], ['out', 'Keluar / halaman lain']] },
  { title: 'Struktur Website Admin', sub: 'Peta menu admin: setelah login, tim bekerja dari 4 menu di samping kiri.', id: 'admin-map', code: adminMap,
    legend: [['admin', 'Menu / layar'], ['sub', 'Isi menu'], ['dec', 'Navigasi'], ['out', 'Keluar']] },
  { title: 'Alur Kerja Admin (1)', sub: 'Mengubah isi halaman dan mengatur promo. Semua perubahan disiapkan dulu sebagai draft, baru tayang setelah Simpan / Publish.', id: 'admin-flows-1', code: adminFlows1,
    legend: [['admin', 'Aksi admin'], ['sub', 'Langkah'], ['dec', 'Keputusan'], ['goal', 'Hasil']] },
  { title: 'Alur Kerja Admin (2)', sub: 'Aturan promo yang tampil (hanya satu promo pada satu waktu) dan bagaimana hasil kunjungan dibaca untuk keputusan berikutnya.', id: 'admin-flows-2', code: adminFlows2, land: true,
    legend: [['dec', 'Pengecekan'], ['goal', 'Hasil'], ['out', 'Tanpa promo'], ['visit', 'Pengunjung'], ['admin', 'Admin']] },
];

const legendColors = { visit: ['#fff1f1', '#d92b2b'], page: ['#ffffff', '#e3b4b4'], cta: ['#d92b2b', '#b51f1f'], goal: ['#e8f7ee', '#1f9d55'], out: ['#f4f4f5', '#a1a1aa'], admin: ['#eef3ff', '#3b5bdb'], sub: ['#ffffff', '#b6c3ee'], dec: ['#fff8e6', '#d99a00'] };
const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const html = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<style>
@font-face { font-family: Geist; src: url("${font}") format("woff2"); font-weight: 100 900; }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #1f1717; font-family: Geist, "Segoe UI", Arial, sans-serif; }
@page land { size: A4 landscape; margin: 0; }
.page.land { page: land; width: 297mm; height: 210mm; }
.page { width: 210mm; height: 297mm; padding: 14mm 14mm 12mm; display: flex; flex-direction: column; page-break-after: always; break-after: page; overflow: hidden; }
.page:last-of-type { page-break-after: auto; break-after: auto; }
@media print { body > *:not(.page) { display: none !important; } }
.head { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 2px solid #d92b2b; }
.head img { width: 30px; height: 30px; border-radius: 50%; }
.brand { font-weight: 700; font-size: 13px; letter-spacing: .2px; }
.doc { margin-left: auto; font-size: 10.5px; color: #8a7d7d; }
h1 { margin: 16px 0 4px; font-size: 22px; letter-spacing: -.3px; }
h1 small { font-size: 13px; color: #d92b2b; font-weight: 600; margin-right: 8px; }
.sub { margin: 0 0 10px; font-size: 12px; line-height: 1.5; color: #5d5252; max-width: 165mm; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0 0 8px; font-size: 10.5px; color: #5d5252; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 14px; height: 10px; border-radius: 3px; border: 1.5px solid; display: inline-block; }
.dia { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
.dia > pre { margin: 0; width: 100%; height: 100%; display: flex; }
.dia svg { width: 100% !important; height: 100% !important; max-width: none !important; }
.foot { display: flex; justify-content: space-between; font-size: 9.5px; color: #a39696; padding-top: 6px; border-top: 1px solid #eee; }
</style></head><body>
${pages.map((p, i) => `<section class="page${p.land ? ' land' : ''}" id="${p.id}">
  <div class="head"><img src="${logo}" alt=""><span class="brand">Spencer's Indonesia</span><span class="doc">Flowchart Website · Landing Page & Admin</span></div>
  <h1><small>${String(i + 1).padStart(2, '0')}</small>${p.title}</h1>
  <p class="sub">${p.sub}</p>
  <div class="legend">${p.legend.map(([k, t]) => `<span><i style="background:${legendColors[k][0]};border-color:${legendColors[k][1]}"></i>${t}</span>`).join('')}</div>
  <div class="dia"><pre class="mermaid">${p.code.replace(/</g, '&lt;')}</pre></div>
  <div class="foot"><span>spencers-indonesia-lp.vercel.app</span><span>${today} · halaman ${i + 1} dari ${pages.length}</span></div>
</section>`).join('\n')}
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'base',
  flowchart: { htmlLabels: true, curve: 'basis', nodeSpacing: 22, rankSpacing: 26, padding: 8, wrappingWidth: 300 },
  themeVariables: { fontFamily: 'Geist, Segoe UI, Arial, sans-serif', fontSize: '13px', lineColor: '#8f8383', primaryTextColor: '#1f1717',
    clusterBkg: '#fbfafa', clusterBorder: '#e6dede', edgeLabelBackground: '#ffffff', tertiaryColor: '#ffffff' } });
mermaid.run({ querySelector: '.mermaid' }).then(() => { document.body.dataset.ready = '1'; }, (e) => { document.body.dataset.ready = 'error: ' + e.message; });
</script></body></html>`;

const htmlFile = path.join(os.tmpdir(), 'spencers-flowchart.html');
fs.writeFileSync(htmlFile, html);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const tab = await browser.newPage();
await tab.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
await tab.goto(pathToFileURL(htmlFile).href, { waitUntil: 'networkidle0', timeout: 120000 });
await tab.waitForFunction(() => document.body.dataset.ready, { timeout: 60000 });
const state = await tab.evaluate(() => document.body.dataset.ready);
if (state !== '1') throw new Error(state);
await tab.evaluate(() => document.fonts.ready);
// report how much each diagram had to shrink to fit its page (readability check)
const fit = await tab.evaluate(() => [...document.querySelectorAll('.dia')].map((d) => {
  const svg = d.querySelector('svg'); const vb = svg.viewBox.baseVal; const r = svg.getBoundingClientRect();
  return { id: d.parentElement.id, natural: [Math.round(vb.width), Math.round(vb.height)], box: [Math.round(r.width), Math.round(r.height)], scale: +Math.min(r.width / vb.width, r.height / vb.height).toFixed(2) };
}));
console.table(fit);
const pdf = path.join(OUT, "Flowchart-Website-Spencers-Indonesia.pdf");
await tab.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
for (const [i, p] of pages.entries()) {
  const el = await tab.$(`#${p.id}`);
  await el.screenshot({ path: path.join(OUT, `${String(i + 1).padStart(2, '0')}-${p.id}.png`) });
}
await browser.close();
console.log('done', fs.readdirSync(OUT));
