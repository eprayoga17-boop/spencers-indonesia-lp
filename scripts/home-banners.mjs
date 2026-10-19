// One-off step 2 after scripts/clone-homepage.mjs: the product cards of the homepage were flat images with the
// headline and the "ORDER NOW" button baked in. This turns each card into a "Banner + Teks" element:
//   - the baked-in text/button is removed from the image (only "ink" pixels between the background and black are
//     repainted, product photos are left alone),
//   - the same words become a real <h2> + a real button, positioned and sized from what was measured in the image.
// Run locally:  node scripts/home-banners.mjs [--debug]   (idempotent: cards already converted are skipped)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { processImage } from '../src/admin/media.js';
import { normalizeBlock, blockDefaults } from '../src/admin/block-props.js';
import { getPage, savePage } from '../src/store.js';
import { discardDraft } from '../src/drafts.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const DEBUG = process.argv.includes('--debug');
const W = 1440; // working width (px); the page is 320 design units wide
const U = 320 / W;
const CAP = 0.7; // Montserrat cap height / em
const ASC = 0.968; const DESC = 0.251; // Montserrat ascent / descent (em)
const r1 = (n) => Math.round(n * 10) / 10;

// eyebrow, title lines, optional small line, button label + whether the last item holds the button
const CARDS = {
  'home-mealblend-women': { eyebrow: 'SPENCER’S MEALBLEND', title: ['SLIMMING PROGRAM', 'FOR WOMAN'], button: 'ORDER NOW' },
  'home-mealblend-men': { eyebrow: 'SPENCER’S MEALBLEND', title: ['1st WEIGHT LOSS', 'PROGRAM FOR MEN'], button: 'ORDER NOW' },
  'home-distributor': { eyebrow: 'DISTRIBUTOR', title: ['MEALBLEND'], button: 'MORE INFO' },
  'home-mealblend-mix': { eyebrow: 'SPENCER’S MEALBLEND', title: ['FOR MEAL', 'REPLACEMENT', '& SUPPORT'], button: 'ORDER NOW' },
  'home-burnx-fiber': { eyebrow: 'SPENCER’S BURNX FIBER', title: ['NATURAL DETOX'], desc: '(PELANCAR PENCERNAAN)', button: 'ORDER NOW' },
  'home-burnx': { eyebrow: 'SPENCER’S BURNX MATCHA', title: ['LAGI CARI', 'NATURAL FAT', 'BURNER?'], button: 'ORDER NOW' },
};

const page = await getPage('home');
if (!page) throw new Error('no homepage — run scripts/clone-homepage.mjs first');

async function stack(items) {
  const bufs = await Promise.all(items.map((it) => sharp(path.join(ROOT, 'public', `${it.src}.${it.ext || 'webp'}`)).resize({ width: W }).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  const H = bufs.reduce((n, b) => n + b.info.height, 0);
  const data = Buffer.concat(bufs.map((b) => b.data));
  const tops = []; let y = 0;
  for (const b of bufs) { tops.push(y); y += b.info.height; }
  return { data, H, tops, heights: bufs.map((b) => b.info.height) };
}
const px = (img, x, y) => { const i = (y * W + x) * 3; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
const set = (img, x, y, c) => { const i = (y * W + x) * 3; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; };
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const chroma = (c) => Math.max(...c) - Math.min(...c);
const isInk = (c) => lum(c) < 110 && chroma(c) < 45;

/** Text lines left-aligned near x0 inside rows [y0, y1): [{ top, bottom, left, right }] */
function textLines(img, y0, y1) {
  const xa = Math.round(W * 0.03); const xb = Math.round(W * 0.53); const lead = Math.round(W * 0.11);
  const rows = [];
  for (let y = y0; y < y1; y++) {
    let n = 0; let first = -1; let last = -1;
    for (let x = xa; x < xb; x++) if (isInk(px(img, x, y))) { n++; if (first < 0) first = x; last = x; }
    rows.push(n >= 2 && first < lead ? { y, first, last } : null);
  }
  const lines = [];
  let cur = null; let gap = 0;
  for (const r of rows) {
    if (r) {
      if (!cur) cur = { top: r.y, bottom: r.y, left: r.first, right: r.last };
      else { cur.bottom = r.y; cur.left = Math.min(cur.left, r.first); cur.right = Math.max(cur.right, r.last); }
      gap = 0;
    } else if (cur && ++gap > 4) { lines.push(cur); cur = null; gap = 0; }
  }
  if (cur) lines.push(cur);
  return lines.filter((l) => l.bottom - l.top >= 8);
}

/** Repaints ink (pixels between the row background and black) with the background, inside a box. */
function eraseInk(img, box, ink = [17, 17, 17]) {
  for (let y = Math.max(0, box.top - 4); y <= Math.min(img.H - 1, box.bottom + 4); y++) {
    const bg = px(img, Math.max(0, box.left - 14), y);
    const d = [ink[0] - bg[0], ink[1] - bg[1], ink[2] - bg[2]];
    const dd = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
    for (let x = Math.max(0, box.left - 4); x <= Math.min(W - 1, box.right + 4); x++) {
      const c = px(img, x, y);
      const t = ((c[0] - bg[0]) * d[0] + (c[1] - bg[1]) * d[1] + (c[2] - bg[2]) * d[2]) / dd;
      // faint halo around letters (compression noise): anything close to the background becomes background
      if (Math.hypot(c[0] - bg[0], c[1] - bg[1], c[2] - bg[2]) < 60) { set(img, x, y, bg); continue; }
      if (t < 0.03) continue;
      const q = [bg[0] + t * d[0], bg[1] + t * d[1], bg[2] + t * d[2]];
      if (Math.hypot(c[0] - q[0], c[1] - q[1], c[2] - q[2]) < 45) set(img, x, y, bg);
    }
  }
}

/** Outline button (ink) in the left part of rows [y0, y1). */
function buttonBox(img, y0, y1) {
  let b = null;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W * 0.335; x++) {
    if (!isInk(px(img, x, y))) continue;
    if (!b) b = { top: y, bottom: y, left: x, right: x };
    else { b.top = Math.min(b.top, y); b.bottom = Math.max(b.bottom, y); b.left = Math.min(b.left, x); b.right = Math.max(b.right, x); }
  }
  return b;
}

async function save(img, sectionId) {
  const png = await sharp(img.data, { raw: { width: W, height: img.H, channels: 3 } }).png().toBuffer();
  if (DEBUG) fs.writeFileSync(path.join(ROOT, `debug-${sectionId}.png`), png);
  return processImage(png, sectionId);
}

const removed = [];
let changed = 0;
for (let si = 0; si < page.sections.length; si++) {
  const sec = page.sections[si];
  const spec = CARDS[sec.id];
  if (!spec || sec.type !== 'image') continue;
  const img = await stack(sec.items);
  const last = sec.items.length - 1;
  const stripTop = img.tops[last];
  const lines = textLines(img, 0, stripTop);
  const want = 1 + spec.title.length + (spec.desc ? 1 : 0);
  if (lines.length < want) throw new Error(`${sec.id}: found ${lines.length} text lines, expected ${want}`);
  const [eb, ...rest] = lines.slice(0, want);
  const tl = rest.slice(0, spec.title.length);
  const dl = spec.desc ? rest[spec.title.length] : null;
  const btn = buttonBox(img, stripTop, img.H);
  if (!btn) throw new Error(`${sec.id}: button not found`);
  for (const l of [eb, ...tl, dl].filter(Boolean)) eraseInk(img, l);
  eraseInk(img, btn);

  // sizes (px at W) -> design units
  const fe = (eb.bottom - eb.top + 1) / CAP;
  const capT = tl.map((l) => l.bottom - l.top + 1).sort((a, b) => a - b)[Math.floor(tl.length / 2)];
  const ft = capT / CAP;
  const lh = tl.length > 1 ? (tl[tl.length - 1].top - tl[0].top) / (tl.length - 1) / ft : 1.2;
  const capOff = (size, lineH) => size * ((lineH - (ASC + DESC)) / 2 + ASC - CAP); // line box top -> cap top
  const boxTop = eb.top - capOff(fe, 1.2);
  const gap = tl[0].top - capOff(ft, lh) - (boxTop + 1.2 * fe);
  const right = Math.max(...[eb, ...tl, dl].filter(Boolean).map((l) => l.right));
  const out = await save(img, sec.id);
  const href = sec.items[last].href || '';
  const props = normalizeBlock('banner', {
    ...blockDefaults('banner'),
    image: { ...out, alt: '' },
    eyebrow: spec.eyebrow, title: spec.title.join('\n'), text: spec.desc || '', descBold: Boolean(spec.desc), font: 'Montserrat', color: '#111111',
    eyebrowSize: r1(fe * U * 0.95), titleSize: r1(ft * U * 0.95), titleLh: Math.round(lh * 20) / 20, gap: r1(Math.max(0, gap * U)),
    x: r1((eb.left / W) * 100), y: r1((boxTop / img.H) * 100), w: r1(Math.min(95, ((right - eb.left) / W) * 100 + 10)),
    bx: r1((btn.left / W) * 100), by: r1((btn.top / img.H) * 100),
    button: { label: spec.button, link: href.startsWith('/') ? { type: 'page', page: href.slice(1) } : { type: 'url', url: href },
      style: 'outline', size: 'xs', color: '#111111', textColor: '#ffffff', radius: 4.5, icon: 'arrow', iconPos: 'right', track: 'ViewContent' },
  });
  removed.push(...sec.items.map((it) => it.src));
  page.sections[si] = { id: sec.id, name: sec.name, type: 'block', kind: 'banner', props, ...(sec.items[0].mt ? { mt: sec.items[0].mt } : {}) };
  changed++;
  console.log(`${sec.id}: eyebrow ${r1(fe * U)}u, title ${r1(ft * U)}u x${tl.length} lh ${r1(lh)}, button @${r1((btn.left / W) * 100)}%,${r1((btn.top / img.H) * 100)}%`);
}

// "OUR CUSTOMER CARE" + green "CHAT ADMIN": the last strip of the contact section becomes its own banner.
const ci = page.sections.findIndex((s) => s.id === 'home-contact-us' && s.type === 'image');
if (ci >= 0) {
  const sec = page.sections[ci];
  const strip = sec.items[sec.items.length - 1];
  const img = await stack([strip]);
  const lines = textLines(img, 0, img.H);
  if (lines.length < 2) throw new Error('contact: text lines not found');
  const [eb, tl] = lines;
  let g = null; // green button
  for (let y = 0; y < img.H; y++) for (let x = Math.round(W * 0.45); x < W; x++) {
    const c = px(img, x, y);
    if (!(c[1] > c[0] + 25 && c[1] > c[2] + 15)) continue;
    if (!g) g = { top: y, bottom: y, left: x, right: x };
    else { g.top = Math.min(g.top, y); g.bottom = Math.max(g.bottom, y); g.left = Math.min(g.left, x); g.right = Math.max(g.right, x); }
  }
  if (!g) throw new Error('contact: button not found');
  const green = px(img, g.left + 12, Math.round((g.top + g.bottom) / 2));
  eraseInk(img, eb); eraseInk(img, tl);
  for (let y = Math.max(0, g.top - 4); y <= Math.min(img.H - 1, g.bottom + 6); y++) {
    const bg = px(img, Math.max(0, g.left - 16), y);
    for (let x = Math.max(0, g.left - 6); x <= Math.min(W - 1, g.right + 6); x++) set(img, x, y, bg);
  }
  const fe = (eb.bottom - eb.top + 1) / CAP;
  const ft = (tl.bottom - tl.top + 1) / CAP;
  const capOff = (size, lineH) => size * ((lineH - (ASC + DESC)) / 2 + ASC - CAP);
  const boxTop = eb.top - capOff(fe, 1.2);
  const gap = tl.top - capOff(ft, 1.2) - (boxTop + 1.2 * fe);
  const out = await save(img, 'home-contact-us');
  const hex = `#${green.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const cta = { id: 'home-customer-care', name: 'Customer Care', type: 'block', kind: 'banner', props: normalizeBlock('banner', {
    ...blockDefaults('banner'), image: { ...out, alt: '' }, eyebrow: 'OUR', title: 'CUSTOMER CARE', font: 'Montserrat', color: '#111111',
    eyebrowSize: r1(fe * U), titleSize: r1(ft * U), gap: r1(Math.max(0, gap * U)), x: r1((eb.left / W) * 100), y: r1((boxTop / img.H) * 100), w: 48,
    bx: r1((g.left / W) * 100), by: r1((g.top / img.H) * 100),
    button: { label: 'CHAT ADMIN', link: { type: 'url', url: strip.href }, style: 'fill', size: 's', color: hex, textColor: '#ffffff', radius: r1(8 * U), icon: 'wa', iconPos: 'right', track: 'Contact' },
  }) };
  removed.push(strip.src);
  sec.items = sec.items.slice(0, -1);
  page.sections.splice(ci + 1, 0, cta);
  changed++;
  console.log(`contact: button ${hex} @${cta.props.bx}%,${cta.props.by}%`);
}

if (!changed) { console.log('nothing to convert'); process.exit(0); }
await savePage('home', page, 'home-banners');
await discardDraft('home');
for (const src of removed) for (const ext of ['webp', 'avif']) fs.rmSync(path.join(ROOT, 'public', `${src}.${ext}`), { force: true });
console.log(`converted ${changed} card(s)`);
