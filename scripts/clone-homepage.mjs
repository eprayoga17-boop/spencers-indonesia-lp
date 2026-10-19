// One-off: rebuild the homepage of www.spencers.id (Berdu) as our page "home", served at "/".
// Downloads the banner images (1600px source), re-encodes them like an admin upload (WebP + AVIF, no EXIF) into
// public/uploads/sections/<id>/, and writes data/pages/home.json. Run locally:  node scripts/clone-homepage.mjs [--force]
// The result is committed; on Vercel src/migrate-home.js copies the bundled page into Redis once.
import { processImage } from '../src/admin/media.js';
import { normalizeBlock, blockDefaults } from '../src/admin/block-props.js';
import { getPage, createPage, savePage } from '../src/store.js';

const SLUG = 'home';
const CDN = 'https://bdsgp.my.id/img/1600/bsob0d3ebsogk72t2x_2/';
const SITE = 'https://www.spencers.id';
const K = 320 / 600; // Berdu column is 600px; our design unit is 1/320 of the page width

if ((await getPage(SLUG)) && !process.argv.includes('--force')) {
  console.log('home already exists (use --force to rebuild)');
  process.exit(0);
}

async function download(file) {
  for (const size of [1600, 1600, 1200, 800]) {
    const r = await fetch(CDN.replace('/1600/', `/${size}/`) + file).catch(() => null);
    if (r && r.ok) return r;
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  throw new Error(`${file}: download failed`);
}
async function img(file, sectionId, alt, extra = {}) {
  const r = await download(file);
  const out = await processImage(Buffer.from(await r.arrayBuffer()), sectionId);
  return { ...out, alt, ...extra };
}
const gap = (px) => Math.round(px * K * 10) / 10;

// [section id, name, [[file, alt, {href, gapBefore}]]] — in page order, gaps measured on the live site
const STACK = [
  ['home-mealblend-women', 'MealBlend Women', [
    ['CFGDSdh7VbK2hcXCFGZHCZr0K61E8oQV2ygAcqyiP5cg.webp', 'Spencer’s MealBlend Women — program langsing untuk wanita', { gap: 53 }],
    ['CFGuScPrG50l0lRCFGZKZ4LudwgYVPROSAcMo3ceKw.webp', 'More info MealBlend Women', { href: '/slimmealsolutionmintidn2' }]]],
  ['home-mealblend-men', 'MealBlend Men', [
    ['CFGr1XG0CnhiSixACFGZjKtN2xoBHXkT2rsdgcyfQA.webp', 'MealBlend Men', { gap: 14 }],
    ['CawHQoJw48H0f7SCawGySIXW7tdBXmSrOTTdhkEjLUgg.webp', 'Spencer’s MealBlend Men — program langsing untuk pria'],
    ['Caw1Yj10fd54W0LaCawGMtxz2ZNkCMRvabAt91aZA6eA.webp', 'More info MealBlend Men', { href: `${SITE}/slimmealsolutionmanidn2` }]]],
  ['home-distributor', 'Distributor MealBlend', [
    ['Caw1Z2RZr8E4CZuCawG1wlxG289tJ8QoidiFrRxaLnVQ.webp', 'Distributor MealBlend'],
    ['CawKnErT1jGIhkBCawGUGBAjXtQJ4NSlLHgvDzKQpJA.webp', 'Jadi distributor pertama MealBlend di kotamu', { gap: 19 }],
    ['CawKnErT1jGIhkBCawej1aR2j501dYTXW4onJd5sVgmQ.webp', 'More info distributor', { href: `${SITE}/agentslimdistributorretail1` }]]],
  ['home-mealblend-mix', 'MealBlend', [
    ['Cawsy0I15uu23rCawem62qS5eEnEWTgubX4skJTIfkQ.webp', 'Spencer’s MealBlend'],
    ['CawHz4KXqEQiLDNCaw9SidBE13x1xRT6iXgymoaDzKUg.webp', 'Spencer’s MealBlend meal replacement'],
    ['Caw2znzP6XTYUeCaw9tgvp0xpq4NT9DHwFlgqs5CQ.webp', 'Order MealBlend', { href: `${SITE}/slimmealsolutionmidn2` }]]],
  ['home-burnx-fiber', 'BurnX Fiber', [
    ['CawFOC6T0nb2CkrCaw9QDbgjRxrRHfTiycZ0hroK4jCA.webp', 'Spencer’s BurnX Fiber'],
    ['L8mbBeE0hcre9tJL8m901Y9QXRqmZWSZuW2nyCRcDfOA.webp', 'Spencer’s BurnX Fiber — natural detox, pelancar pencernaan'],
    ['L8mbJOuel2MiewL8m9O5y29mBKTWJSN2gPHCHO4aFFw.webp', 'Order BurnX Fiber', { href: `${SITE}/spencersburnxfiberbfidn` }]]],
  ['home-burnx', 'BurnX', [
    ['L8mGAH97MmAf0lZL8m9m9LRcFh60fBSISiTDaMqsodg.webp', 'Spencer’s BurnX'],
    ['Caw2znzP6XTYUeCaP03PeuHurWXpAQdSu7cWGUOWPiQ.webp', 'Spencer’s BurnX fat burner'],
    ['CawNQ6IzaMuY02GCaP0uYzVWSZhBzzRYyY8OXKDzKrrA.webp', 'Order BurnX', { href: `${SITE}/slimmealsolutionburnxidn2` }]]],
  ['home-contact-us', 'Contact Us', [
    ['CawHz4KXqEQiLDNCaP0rgCFjugwBqpSVaXMxh40xDaMw.webp', ''],
    ['CQpbFF52olAThmACQN4YUXXufRtBNCTQWOI0OyTVNytg.webp', 'Need help? Contact us'],
    ['CQpci4k1ZtrDsdPCQNB7fz87eTOwrWTQai1wogd5PjCw.webp', 'Our customer care'],
    ['CQN3POxASSzk09jCQN1RG4gsTHftX6QCaahQJX3SdYlA.webp', 'Chat admin customer care', { href: `${SITE}/_/cs/rotate?group=1718091609609&text=Hi%20Admin%2C%20Saya%20mau%20tanya%20ya.` }]]],
  ['home-pembayaran-paper', 'Pembayaran Paper.id', [
    ['CQN43bNLy9lM0cgCQNtuNLzTDtr0YkSWyVSWBXQ8wOlw.webp', ''],
    ['LQw5z97ttMt4f6DLQPHveS1TkYILOTi6xh0qz4OKag.webp', 'Pembayaran official hanya melalui Paper.id'],
    ['LQwqAwC0a74UCvrLQPHNXOqwK0tZ7T9ebxFtH5IVnQ.webp', 'Pastikan rekening atas nama PAPER.ID'],
    ['LQwzaoe0h5dhah19LQPH1PXDaLiLzUnSiOWbxJO664Iw.webp', 'Cara pembayaran Paper.id']]],
  ['home-diliput-media', 'Diliput Media', [
    ['LTzQT63Bm7J0hYkLTzFDGOVDEPzJrTfmGTlTXF3OCRA.webp', 'Spencer’s diliput berbagai media nasional', { gap: 23 }]]],
];
const SLIDES = ['CFGuyeM0hz1mHqECFGwDTsCOLDRXYSNOqOdZSBA5gw', 'CFGuGX7EBkoOir7CFGwtXrdvonhbIyTEmwmcaQoqnZQ', 'CFG4LSb0MjYhfWmCFGwVKL7AnLat0iQ3ecGJLipVd5w',
  'CQpry8a0hYMGsC44CQpg7XaCJj0VBlSh6sgLR3FNu4w', 'CFtlK7DYt2H4fttCFEcj6j4xNPWxsbQxOlaMjK5CLmAw', 'L8mc131QrgAJH8fL8mezGk16KlyIZpRCKcihcF9FdvRQ',
  'CFEgxct05TZ6M2CFEcTzui08DUAT27FRdggIJRQ'];

const block = (id, name, kind, props) => ({ id, name, type: 'block', kind, props: normalizeBlock(kind, { ...blockDefaults(kind), ...props }) });

console.log('downloading + converting images…');
const sections = [];
// header: logo centred on a white bar (the live site has a sticky white header)
sections.push({ id: 'home-header-logo', name: 'Header Logo', type: 'image', items: [await (async () => {
  const sharp = (await import('sharp')).default;
  const r = await fetch('https://bdsgp.my.id/img/800/bsob0d3ebsogk72t2x_2/CQNuYUS0fdaO0iuCCQNV2Os7QBgnvGqQQWL8XgvByMkxw.webp');
  const logo = await sharp(Buffer.from(await r.arrayBuffer())).resize({ width: 320 }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  const bar = await sharp({ create: { width: 1200, height: 128, channels: 3, background: '#ffffff' } })
    .composite([{ input: logo, left: Math.round((1200 - meta.width) / 2), top: Math.round((128 - meta.height) / 2) }]).png().toBuffer();
  return { ...(await processImage(bar, 'home-header-logo')), alt: 'Spencer’s', href: '/' };
})()] });
const slides = [];
for (const f of SLIDES) slides.push(await img(`${f}.webp`, 'home-banner-slider', 'Promo Spencer’s'));
const sh = Math.max(...slides.map((s) => (320 * s.ih) / s.iw));
sections.push({ id: 'home-banner-slider', name: 'Banner Slider', type: 'image', layout: 'slider', items: slides,
  slider: { transition: 'slide', interval: 4000, dots: 'square-dark', arrows: false }, box: { w: 320, h: Math.round(sh), mt: 0 } });
for (const [id, name, files] of STACK) {
  const items = [];
  for (const [file, alt, o = {}] of files) items.push(await img(file, id, alt, { ...(o.href ? { href: o.href } : {}), ...(o.gap ? { mt: gap(o.gap) } : {}) }));
  sections.push({ id, name, type: 'image', items });
  process.stdout.write('.');
}
console.log();

sections.push(block('home-distributor-info', 'List Official Distributor', 'text', {
  html: '<h3>LIST OFFICIAL DISTRIBUTOR MEALBLEND</h3><p><strong>Free Delivery with Fast &amp; Safe Service :</strong></p><p>1. Pilih dan cari Official Distributor MealBlend di kota terdekat Anda<br>2. Klik link order untuk memesan melalui Distributor Spencer\'s MealBlend</p>',
  size: 11, color: '#333333', pt: 18, pb: 6, px: 10,
}));
// The distributor list itself lives in data/distributors.json (admin menu Distributor).
sections.push(block('home-distributor-kota', 'Daftar Distributor', 'distributors', {
  title: '', search: true, group: 'province', size: 10, accent: '#000000', color: '#424242', pt: 4, pb: 20, px: 10,
  emptyText: 'Belum ada distributor di daerah itu.', emptyLabel: 'Tanya admin',
  emptyLink: { type: 'url', url: 'https://www.spencers.id/_/cs/rotate?group=1718091609609&text=Hi%20Admin%2C%20Saya%20mau%20tanya%20ya.' },
}));
sections.push(block('home-footer-contact', 'Footer Kontak', 'text', {
  html: '<p><strong>Our Contact</strong></p><p><a href="https://www.sfsgroupid.com/"><span style="color: #ffffff">About Us</span></a><br><a href="https://www.spencers.id/"><span style="color: #ffffff">spencers.id</span></a><br><a href="https://www.instagram.com/spencersindonesia/"><span style="color: #ffffff">Instagram @spencersindonesia</span></a><br><a href="tel:+623160010626"><span style="color: #ffffff">031 - 600 106 26</span></a><br><a href="https://wa.me/628132524235"><span style="color: #ffffff">+62 813-2524-235</span></a></p><p><small>© 2026 Spencer\'s Indonesia Inc.</small></p>',
  size: 10, color: '#ffffff', bg: '#000000', pt: 16, pb: 18, px: 12, lineHeight: 1.7,
}));

const page = {
  name: 'Homepage',
  title: 'Spencer\'s Premium Grocery',
  description: 'Dapatkan ratusan produk Healthy Daily Needs dalam 1 klik',
  robots: '',
  settings: { maxWidth: null, designWidth: 320, background: '#ffffff', outerBackground: '#f2f2f2' },
  thumbnail: `${slides[0].src}.webp`,
  sections, badges: [], category: '',
};
if (await getPage(SLUG)) await savePage(SLUG, page, 'clone-homepage');
else await createPage(SLUG, page, 'clone-homepage');
console.log(`home: ${sections.length} sections`);
