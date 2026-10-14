// Builds ONE continuous flowchart of the whole website (admin side + how it reaches the landing page),
// without the visitor's section-by-section journey. Output: docs/flowchart-website/Alur-Keseluruhan.{pdf,png}.
// The page size follows the diagram so it stays readable on a single page. Needs Google Chrome. Run:
//   node scripts/build-flowchart-overall.mjs
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

const diagram = `flowchart TB
  AD(["<b>Tim Admin</b><br/>buka website admin"]):::admin
  LG["<b>Login</b><br/>email + password"]:::admin
  OK{"Email & password<br/>benar?"}:::dec
  LK(["Salah 5 kali<br/>dikunci 15 menit"]):::out
  MN{{"<b>Menu samping</b><br/>mode terang / gelap"}}:::dec
  AD --> LG --> OK
  OK -- "tidak" --> LK
  LK -.-> LG
  OK -- "ya" --> MN

  MN --> DB["<b>Dashboard</b><br/>ringkasan 7 hari<br/>promo yang berjalan<br/>aktivitas terbaru tim"]:::admin
  MN --> RP["<b>Laporan</b><br/>pilih tanggal & halaman"]:::admin
  RP --> RP1["<b>Ringkasan</b><br/>tren · perangkat · sumber<br/>peta provinsi · unduh CSV"]:::sub
  RP --> RP2["<b>Per Bagian</b><br/>bagian dilihat · lama dilihat<br/>klik + heatmap"]:::sub
  RP --> RP3["<b>Log</b><br/>aktivitas admin"]:::sub
  DB --> KP
  RP1 --> KP
  RP2 --> KP
  KP{"Keputusan tim<br/>perlu diubah?"}:::dec
  KP -- "isi halaman" --> HL
  KP -- "promo" --> PR

  MN --> HL["<b>Halaman</b><br/>daftar halaman · cari<br/>sampul · Statistik"]:::admin
  HL --> HN["Halaman baru<br/>dari template / salin"]:::sub
  HL --> AR["Arsip & pulihkan"]:::sub
  HL --> ED["<b>Editor halaman</b><br/>tab Konten · Desain · SEO<br/>Global · Riwayat"]:::admin
  HN --> ED
  ED --> UB["Ubah isi<br/>geser urutan · klik kanan<br/>upload gambar / HTML"]:::sub
  UB --> CK["Cek tampilan<br/>preview iPhone<br/>Coba di HP (QR)"]:::sub
  CK --> BN{"Sudah benar?"}:::dec
  BN -- "belum: Undo / ubah" --> UB
  BN -- "ya" --> SV["Klik <b>Simpan</b><br/>versi lama masuk Riwayat"]:::admin

  MN --> PR["<b>Promo</b><br/>timeline promo<br/>& peringatan hari kosong"]:::admin
  PR --> PB["Pilih / buat promo<br/>Insidentil: toggle / tanggal<br/>Regular: tanggal"]:::sub
  PB --> PI["Isi promo<br/>banner · badge<br/>teks bar merah"]:::sub
  PI --> PD["Tersimpan sebagai draft<br/>titik oranye di menu"]:::sub
  PD --> PP["Klik <b>Publish</b>"]:::admin
  PP --> R1{"Insidentil<br/>toggle ON?"}:::dec
  R1 -- "tidak" --> R2{"Insidentil sesuai<br/>tanggal hari ini?"}:::dec
  R2 -- "tidak" --> R3{"Regular sesuai<br/>tanggal?"}:::dec
  R1 -- "ya" --> PA
  R2 -- "ya" --> PA
  R3 -- "ya" --> PA(["Promo tampil<br/>bar merah · banner · badge"]):::goal
  R3 -- "tidak" --> PN(["Tanpa promo<br/>bagian promo disembunyikan"]):::out

  SV -- "langsung tayang" --> LP
  PA --> LP
  PN --> LP
  LP["<b>Landing page live</b><br/>Spencer's MealBlend"]:::page
  LP --> VS(["Pengunjung membaca<br/>& klik Chat Admin (WhatsApp)"]):::visit
  RP -. "data kunjungan & klik<br/>otomatis masuk ke Laporan" .- VS

  MN --> LO(["Logout"]):::out
  MN -. "diam 30 menit" .-> SE(["Sesi berakhir<br/>login ulang, kembali<br/>ke halaman terakhir"]):::out

  classDef visit fill:#fff1f1,stroke:#d92b2b,stroke-width:1.5px,color:#2b1a1a;
  classDef page fill:#ffffff,stroke:#d92b2b,stroke-width:2px,color:#2b1a1a;
  classDef goal fill:#e8f7ee,stroke:#1f9d55,stroke-width:1.5px,color:#123b24;
  classDef out fill:#f4f4f5,stroke:#a1a1aa,stroke-width:1.2px,color:#3f3f46;
  classDef admin fill:#eef3ff,stroke:#3b5bdb,stroke-width:1.5px,color:#1b2559;
  classDef sub fill:#ffffff,stroke:#b6c3ee,stroke-width:1.2px,color:#1b2559;
  classDef dec fill:#fff8e6,stroke:#d99a00,stroke-width:1.5px,color:#4a3500;
`;

const legend = [['#eef3ff', '#3b5bdb', 'Menu / aksi admin'], ['#ffffff', '#b6c3ee', 'Langkah'], ['#fff8e6', '#d99a00', 'Keputusan / pengecekan'],
  ['#e8f7ee', '#1f9d55', 'Hasil'], ['#ffffff', '#d92b2b', 'Landing page'], ['#fff1f1', '#d92b2b', 'Pengunjung'], ['#f4f4f5', '#a1a1aa', 'Keluar / tanpa promo']];
const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const html = (w, h) => `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>
@font-face { font-family: Geist; src: url("${font}") format("woff2"); font-weight: 100 900; }
@page { size: ${w}px ${h}px; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #1f1717; font-family: Geist, "Segoe UI", Arial, sans-serif; }
.page { width: ${w}px; height: ${h}px; padding: 48px 56px 40px; display: flex; flex-direction: column; overflow: hidden; }
.head { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 3px solid #d92b2b; }
.head img { width: 40px; height: 40px; border-radius: 50%; }
.brand { font-weight: 700; font-size: 18px; }
.doc { margin-left: auto; font-size: 14px; color: #8a7d7d; }
h1 { margin: 22px 0 6px; font-size: 32px; letter-spacing: -.4px; }
.sub { margin: 0 0 12px; font-size: 16px; line-height: 1.5; color: #5d5252; max-width: 1100px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 0 0 10px; font-size: 14px; color: #5d5252; }
.legend span { display: inline-flex; align-items: center; gap: 8px; }
.legend i { width: 18px; height: 12px; border-radius: 3px; border: 1.5px solid; display: inline-block; }
.dia { flex: 1; min-height: 0; display: flex; }
.dia > pre { margin: 0; width: 100%; height: 100%; display: flex; }
.dia svg { width: 100% !important; height: 100% !important; max-width: none !important; }
.foot { display: flex; justify-content: space-between; font-size: 13px; color: #a39696; padding-top: 10px; border-top: 1px solid #eee; }
@media print { body > *:not(.page) { display: none !important; } }
</style></head><body>
<section class="page" id="all">
  <div class="head"><img src="${logo}" alt=""><span class="brand">Spencer's Indonesia</span><span class="doc">Flowchart Website · Alur Keseluruhan</span></div>
  <h1>Alur Keseluruhan Website</h1>
  <p class="sub">Dari tim admin login, mengelola Dashboard, Laporan, Halaman dan Promo, sampai perubahan tayang di landing page dan data kunjungan kembali ke Laporan.</p>
  <div class="legend">${legend.map(([bg, bd, t]) => `<span><i style="background:${bg};border-color:${bd}"></i>${t}</span>`).join('')}</div>
  <div class="dia"><pre class="mermaid">${diagram.replace(/</g, '&lt;')}</pre></div>
  <div class="foot"><span>spencers-indonesia-lp.vercel.app</span><span>${today}</span></div>
</section>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'base',
  flowchart: { htmlLabels: true, curve: 'basis', nodeSpacing: 30, rankSpacing: 38, padding: 10, wrappingWidth: 300 },
  themeVariables: { fontFamily: 'Geist, Segoe UI, Arial, sans-serif', fontSize: '15px', lineColor: '#8f8383', primaryTextColor: '#1f1717',
    edgeLabelBackground: '#ffffff', tertiaryColor: '#ffffff' } });
// The visit-data link is declared Laporan -> Pengunjung (keeps Laporan up with the other menus);
// its arrowhead is moved to the Laporan end so it reads "data flows into Laporan".
function flipVisitArrow() {
  const edge = [...document.querySelectorAll('.dia svg path')].find((p) => /RP/.test(p.id) && /VS/.test(p.id));
  if (!edge) throw new Error('visit edge not found');
  const ref = (edge.getAttribute('marker-end') || '').match(/#([^)"']+)/);
  const marker = ref && document.getElementById(ref[1]);
  if (!marker) throw new Error('arrow marker not found');
  const rev = marker.cloneNode(true);
  rev.id = marker.id + '-start';
  rev.setAttribute('orient', 'auto-start-reverse');
  marker.parentNode.append(rev);
  edge.removeAttribute('marker-end');
  edge.setAttribute('marker-start', 'url(#' + rev.id + ')');
}
mermaid.run({ querySelector: '.mermaid' }).then(() => { flipVisitArrow(); document.body.dataset.ready = '1'; }).catch((e) => { document.body.dataset.ready = 'error: ' + e.message; });
</script></body></html>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const tab = await browser.newPage();
const file = path.join(os.tmpdir(), 'spencers-flowchart-overall.html');
const render = async (w, h) => {
  fs.writeFileSync(file, html(w, h));
  await tab.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await tab.goto(pathToFileURL(file).href, { waitUntil: 'networkidle0', timeout: 120000 });
  await tab.waitForFunction(() => document.body.dataset.ready, { timeout: 60000 });
  const state = await tab.evaluate(() => document.body.dataset.ready);
  if (state !== '1') throw new Error(state);
  await tab.evaluate(() => document.fonts.ready);
  return tab.evaluate(() => { const svg = document.querySelector('.dia svg'); const vb = svg.viewBox.baseVal; return { w: vb.width, h: vb.height }; });
};
// first pass measures the diagram; the page is then sized so the diagram is drawn at full size
const nat = await render(1600, 1100);
const W = Math.ceil(nat.w + 112);
const H = Math.ceil(nat.h + 300);
await render(W, H);
const fit = await tab.evaluate(() => { const svg = document.querySelector('.dia svg'); const vb = svg.viewBox.baseVal; const r = svg.getBoundingClientRect(); return +Math.min(r.width / vb.width, r.height / vb.height).toFixed(2); });
console.log('diagram', Math.round(nat.w), 'x', Math.round(nat.h), '| page', W, 'x', H, '| scale', fit);
await tab.pdf({ path: path.join(OUT, 'Alur-Keseluruhan.pdf'), width: `${W}px`, height: `${H}px`, printBackground: true, pageRanges: '1' });
await (await tab.$('#all')).screenshot({ path: path.join(OUT, 'Alur-Keseluruhan.png') });
await browser.close();
console.log('done');
