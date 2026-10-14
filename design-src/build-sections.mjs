// Rebuilds image sections as real HTML from Figma layers.
// Usage: node design-src/build-sections.mjs
//  - processes the Figma exports in design-src/figma into public/uploads/sections/<id>/
//  - writes the generated HTML into data/pages/slimmealsolutionmintidn2.json
//
// Coordinates below are Figma units of each section's source frame. Each section maps
// its frame onto the page box with a scale S (page units per Figma unit, page = 320 wide)
// and an origin (ox, oy) = the Figma point shown at the box's top-left corner.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'design-src', 'figma');
const OUT = path.join(ROOT, 'public', 'uploads', 'sections');
const PAGE = path.join(ROOT, 'data', 'pages', 'slimmealsolutionmintidn2.json');
const URL_BASE = '/uploads/sections';

// ---------------------------------------------------------------- assets
async function raster(src, out, { crop, width, avifQ = 55, webpQ = 80 } = {}) {
  const dir = path.dirname(path.join(OUT, out));
  await fs.mkdir(dir, { recursive: true });
  let img = sharp(src);
  if (crop) img = img.extract(crop);
  if (width) img = img.resize({ width, withoutEnlargement: true });
  const buf = await img.png().toBuffer();
  await sharp(buf).avif({ quality: avifQ, effort: 6 }).toFile(path.join(OUT, `${out}.avif`));
  await sharp(buf).webp({ quality: webpQ, alphaQuality: 90, effort: 6 }).toFile(path.join(OUT, `${out}.webp`));
}
async function copy(src, out) {
  await fs.mkdir(path.dirname(path.join(OUT, out)), { recursive: true });
  await fs.copyFile(src, path.join(OUT, out));
}

// Combine positioned SVG pieces (insets in % of a square box) into one SVG file.
async function combineSvg(pieces, out) {
  let n = 0;
  const parts = [];
  for (const { file, inset: [t, r, b, l] } of pieces) {
    const raw = await fs.readFile(path.join(SRC, file), 'utf8');
    const vb = raw.match(/viewBox="([^"]+)"/)[1];
    let inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const p = `p${n++}_`;
    inner = inner.replace(/id="([^"]+)"/g, (m, id) => `id="${p}${id.replace(/\s+/g, '_')}"`)
                 .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${p}${id.replace(/\s+/g, '_')})`);
    parts.push(`<svg x="${l}" y="${t}" width="${(100 - l - r).toFixed(3)}" height="${(100 - t - b).toFixed(3)}" viewBox="${vb}" preserveAspectRatio="none" overflow="visible">${inner}</svg>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">${parts.join('')}</svg>`;
  await fs.mkdir(path.dirname(path.join(OUT, out)), { recursive: true });
  await fs.writeFile(path.join(OUT, out), svg);
}

// The live page shows newer product box renders than the Figma frame. Patch that photo area
// from the live artwork into the Figma backdrop (feathered; text areas are excluded).
async function pertamaBackdrop() {
  const live = path.join(ROOT, 'public', 'uploads', 'seed', 'pertama-di-indonesia.webp');
  const pxPerPage = 3;                 // live artwork: 960 px for 320 page units
  const coverTop = (1953 - 1938) / 2;  // live artwork is cover-cropped into its 646-unit box
  const toBg = 3 / (pxPerPage * PERTAMA_S); // backdrop is 3 px per Figma unit
  const R = { x0: 150, x1: 890, y0: 1290, y1: 1590 };          // region, live page px
  const cut = { x: 485, y: 1528 };                             // keep the label/arrow area out
  const w = Math.round((R.x1 - R.x0) * toBg), h = Math.round((R.y1 - R.y0) * toBg);
  const patch = await sharp(live).extract({ left: R.x0, top: Math.round(R.y0 + coverTop), width: R.x1 - R.x0, height: R.y1 - R.y0 })
    .resize(w, h).png().toBuffer();
  const px = (v) => +(v * toBg).toFixed(1);
  const poly = [[0, 0], [R.x1 - R.x0, 0], [R.x1 - R.x0, cut.y - R.y0], [cut.x - R.x0, cut.y - R.y0], [cut.x - R.x0, R.y1 - R.y0], [0, R.y1 - R.y0]]
    .map(([x, y]) => `${px(x)},${px(y)}`).join(' ');
  const inset = 14;
  const mask = await sharp(Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#000"/><polygon points="${poly}" fill="#fff" transform="translate(${w / 2} ${h / 2}) scale(${(w - inset * 2) / w} ${(h - inset * 2) / h}) translate(${-w / 2} ${-h / 2})"/></svg>`))
    .flatten({ background: "#000" }).blur(8).extractChannel(0).png().toBuffer();
  await fs.writeFile(path.join(ROOT, "design-src", "compare-out", "patch-mask.png"), mask);
  const rgb = await sharp(patch).removeAlpha().png().toBuffer(); // removeAlpha must run before joinChannel
  const masked = await sharp(rgb).joinChannel(mask).png().toBuffer();
  const left = Math.round(R.x0 * toBg);
  const top = Math.round((R.y0 / pxPerPage / PERTAMA_S + PERTAMA_OY) * 3);
  return sharp(path.join(SRC, 'pertama-bg.png')).composite([{ input: masked, left, top }]).png().toBuffer();
}

async function buildAssets() {
  // Event: masked photos (flattened from Figma layers), logo, bottom fade
  await raster(path.join(SRC, 'event-flat.png'), 'event-offline/photos', { avifQ: 50, webpQ: 78 });
  await copy(path.join(SRC, 'event/logo.svg'), 'event-offline/logo.svg');
  await copy(path.join(SRC, 'event/rect10266.svg'), 'event-offline/fade.svg');

  // Hero: background, story screenshot, WhatsApp crops, vectors
  await raster(path.join(SRC, 'hero/bg837.png'), 'hero-testimoni/bg', { crop: { left: 435, top: 65, width: 511, height: 542 } });
  await raster(path.join(SRC, 'story-flat.png'), 'hero-testimoni/story', { avifQ: 60, webpQ: 82 });
  const wa = [
    ['wa17', 'bubble-1', { left: 0, top: 109, width: 310, height: 102 }],
    ['wa62', 'bubble-2', { left: 11, top: 60, width: 281, height: 69 }],
    ['wa61', 'bubble-3', { left: 10, top: 58, width: 287, height: 97 }],
    ['wa10', 'thumb-1', { left: 0, top: 51, width: 304, height: 447 }],
    ['wa121', 'thumb-2', { left: 0, top: 52, width: 302, height: 395 }],
    ['wa9', 'thumb-3', { left: 0, top: 52, width: 304, height: 400 }],
  ];
  for (const [src, out, crop] of wa) await raster(path.join(SRC, `hero/${src}.png`), `hero-testimoni/${out}`, { crop, avifQ: 65, webpQ: 85 });
  for (const f of ['logo', 'check', 'underline']) await copy(path.join(SRC, `hero/${f}.svg`), `hero-testimoni/${f}.svg`);

  // Pertama + nutrition: one shared photo backdrop
  await raster(await pertamaBackdrop(), 'manfaat-utama/bg', { avifQ: 50, webpQ: 76 });
  for (const f of ['iconScale', 'iconThigh', 'iconWaist', 'iconFace', 'divider', 'arrow']) await copy(path.join(SRC, `pertama/${f}.svg`), `manfaat-utama/${f}.svg`);
  await combineSvg([
    { file: 'pertama/x459.svg', inset: [10.21, 44.42, 77.59, 44.4] },
    { file: 'pertama/x468.svg', inset: [5.35, 36.17, 73.87, 37.22] },
    { file: 'pertama/x689.svg', inset: [45.62, 73.74, 45.66, 17.54] },
    { file: 'pertama/x689.svg', inset: [17.35, 17.55, 73.93, 73.73] },
    { file: 'pertama/x689.svg', inset: [71.96, 24.01, 19.31, 67.27] },
    { file: 'pertama/x465.svg', inset: [23.9, 42.35, 69.82, 41.27] },
    { file: 'pertama/x613.svg', inset: [41.28, 58.53, 55.24, 38.33] },
    { file: 'pertama/x614.svg', inset: [48.78, 37.44, 46.94, 58.77] },
    { file: 'pertama/x612.svg', inset: [61.67, 54.02, 36.59, 42.49] },
    { file: 'pertama/x615.svg', inset: [60.97, 40.44, 36.58, 52.12] },
    { file: 'pertama/x612.svg', inset: [87.32, 56.29, 10.94, 40.22] },
    { file: 'pertama/x617.svg', inset: [88.34, 32.94, 9.36, 63.18] },
    { file: 'pertama/x598.svg', inset: [15.43, 47.4, 82.82, 50.86] },
    { file: 'pertama/x598.svg', inset: [15.43, 50.88, 82.82, 47.38] },
    { file: 'pertama/x1448.svg', inset: [20.67, 27.53, 5.35, 26.75] },
  ], 'manfaat-utama/iconArm.svg');
  // Promo badge (live-only element): live artwork crop, feathered so it blends into the backdrop
  {
    const live = path.join(ROOT, "design-src", "live", "pertama-di-indonesia.png");
    const sL = 320 / 1500, cy = (3052 * sL - 646) / 2 / sL;
    const toLive = (fx, fy) => [Math.round((fx * PERTAMA_S) / sL), Math.round(((fy - PERTAMA_OY) * PERTAMA_S) / sL + cy)];
    const [x0, y0] = toLive(233, 14), [x1, y1] = toLive(375, 102);
    const w = Math.min(1500, x1) - x0, h = y1 - y0;
    const feather = 10;
    const mask = await sharp(Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#000"/><rect x="${feather}" y="${feather}" width="${w - feather * 2 + (x1 > 1500 ? feather * 2 : 0)}" height="${h - feather * 2}" fill="#fff"/></svg>`)).flatten({ background: "#000" }).blur(feather / 2).extractChannel(0).png().toBuffer();
    const rgb = await sharp(live).removeAlpha().extract({ left: x0, top: y0, width: w, height: h }).png().toBuffer();
    const badge = await sharp(rgb).joinChannel(mask).png().toBuffer();
    await raster(badge, "manfaat-utama/badge", { avifQ: 70, webpQ: 88 });
  }
  // Halal logo badge (live-only element): cropped from the live artwork, masked to its circle
  const live = path.join(ROOT, 'public', 'uploads', 'seed', 'pertama-di-indonesia.webp');
  const c = { x: 860, y: 1601, r: 68 };
  const circle = Buffer.from(`<svg width="${c.r * 2}" height="${c.r * 2}"><circle cx="${c.r}" cy="${c.r}" r="${c.r - 1}" fill="#fff"/></svg>`);
  const halal = await sharp(live).extract({ left: c.x - c.r, top: c.y - c.r, width: c.r * 2, height: c.r * 2 }).composite([{ input: circle, blend: 'dest-in' }]).png().toBuffer();
  await raster(halal, 'manfaat-utama/halal', { avifQ: 70, webpQ: 90 });
}

// ---------------------------------------------------------------- html helpers
const r3 = (n) => +(+n).toFixed(3);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function frame({ S, ox = 0, oy = 0, H }) {
  const k = (n) => `calc(${r3(n)}*var(--k))`;
  const X = (x) => k(x - ox);
  const Y = (y) => k(y - oy);
  const box = ({ x, y, w, h }) =>
    `left:${X(x)};top:${Y(y)};` + (w != null ? `width:${k(w)};` : '') + (h != null ? `height:${k(h)};` : '');
  const right = (xr) => `right:${k(ox + 320 / S - xr)};`;
  const wrap = (cls, inner, css = '', extra = '') =>
    `<div class="fx ${cls}" style="--k:calc(100cqw*${r3(S)}/320);aspect-ratio:320/${r3(H)};${extra}">${css ? `<style>${css}</style>` : ''}${inner}</div>`;
  const pic = (src, alt = '', extra = '', { eager = false } = {}) =>
    `<picture><source type="image/avif" srcset="${src}.avif"><img src="${src}.webp" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" style="width:100%;height:100%;${extra}"></picture>`;
  return { k, X, Y, box, right, wrap, pic };
}

// ---------------------------------------------------------------- sections

function promoBar() {
  // Built directly in page units (S = 1); measured from the live banner.
  const { k, wrap } = frame({ S: 1, H: 46 });
  const inner =
    `<p class="a nw ff-inter pb-1" style="left:0;right:0;top:${k(7.77)};font-size:${k(12.69)}">Promo “14 DAY SLIMMING PROGRAM”</p>` +
    `<p class="a nw ff-inter pb-2" style="right:${k(320 - 109)};top:${k(27.57)};font-size:${k(12.65)}">Disc up to 60%</p>` +
    `<span class="a pb-div" style="left:${k(118.6)};top:${k(26)};width:${k(0.6)};height:${k(14.7)}" aria-hidden="true"></span>` +
    `<p class="a nw ff-inter pb-2" style="left:${k(128.86)};top:${k(25.54)};font-size:${k(15.49)}">FREE Ongkir Jawa - Bali</p>`;
  const css = `.s-promo{background:#ff0000;color:#fff}.s-promo p{font-weight:700;line-height:1;text-align:center;letter-spacing:-.01em}.s-promo .pb-div{background:#fff}`;
  return wrap('s-promo', `<h2 class="a" style="inset:0;margin:0;font:inherit">${inner}</h2>`, css);
}

function eventOffline() {
  const S = 109 / 126;
  const f = frame({ S, ox: (373 * S - 320) / 2 / S, oy: 0, H: 109 });
  const { k, box, right, wrap, pic } = f;
  const t = (b, cls, style, html) => `<p class="a ${cls}" style="${box(b)}${style}">${html}</p>`;
  const inner =
    `<div class="a" style="${box({ x: 0, y: 0, w: 373, h: 126 })}">${pic(`${URL_BASE}/event-offline/photos`, 'MealBlend Sparkling Winter bersama Catherine Njoo dan PORSCHE Driven By Her', 'object-fit:cover', { eager: true })}</div>` +
    `<div class="a" style="${box({ x: 0, y: -11.06, w: 169.125, h: 136.933 })}transform:scaleX(-1);background:linear-gradient(-64.59deg,#000 36.38%,rgba(0,0,0,0) 80.037%)"></div>` +
    `<div class="a" style="${box({ x: 242, y: -11.06, w: 131, h: 136.933 })}background:linear-gradient(-90deg,#000 0%,rgba(0,0,0,0) 93.966%)"></div>` +
    `<img class="a" src="${URL_BASE}/event-offline/fade.svg" alt="" style="${box({ x: 125.28, y: -120.56, w: 64, h: 454.863 })}transform:rotate(90deg)">` +
    `<img class="a" src="${URL_BASE}/event-offline/logo.svg" alt="Spencer's MealBlend" style="${box({ x: 12.35, y: 10.04, w: 91.12, h: 27.02 })}">` +
    t({ x: 12.39, y: 37.9 }, 'nw ff-imprima', `font-size:${k(11.29)};letter-spacing:${k(-0.5115)}`, 'offline experiences.') +
    t({ x: 12.39, y: 57.4, w: 136.605 }, 'ff-inter ev-it', `font-size:${k(9.209)};letter-spacing:${k(-0.5526)};text-shadow:0 0 ${k(10)} rgba(0,0,0,.9)`, 'Beyond Presence, Into Connection.<br>Closer to a Better You.') +
    t({ x: 12.39, y: 97.39 }, 'nw ff-inter ev-it', `font-size:${k(8.611)};letter-spacing:${k(-0.5167)}`, 'MealBlend Sparkling Winter<br>with Catherine Njoo - International Fashion Designer') +
    `<p class="a nw ff-inter ev-it" style="${right(363.04)}top:${k(97.48)};font-size:${k(8.533)};letter-spacing:${k(-0.512)};text-align:right">PORSCHE Driven By Her<br>with MealBlend</p>`;
  const css = `.s-event{background:#000;color:#fff}.s-event p{line-height:normal}.s-event .ev-it{font-style:italic;font-weight:400}`;
  return wrap('s-event', inner, css);
}

function heroTestimoni() {
  const S = 320 / 375;
  const oy = (1387 / 2.56 * S - 445) / 2 / S; // live artwork is cover-cropped top & bottom
  const f = frame({ S, ox: 0, oy, H: 445 });
  const { k, box, X, Y, wrap, pic } = f;
  const img = (b, src, alt, rad, extra = '') =>
    `<div class="a" style="${box(b)}border-radius:${k(rad)};overflow:hidden;${extra}">${pic(`${URL_BASE}/hero-testimoni/${src}`, alt, 'object-fit:fill')}</div>`;
  const emoji = (x, y, fz, ch) => `<span class="a ht-emoji" style="${box({ x, y })}font-size:${k(fz)}" aria-hidden="true">${ch}</span>`;
  const time = (px, py, tx, ty, label) =>
    `<span class="a" style="${box({ x: px, y: py, w: 35, h: 9 })}background:#fff" aria-hidden="true"></span>` +
    `<span class="a nw ff-roboto ht-time" style="${box({ x: tx, y: ty })}font-size:${k(8.73)};line-height:${k(11.856)};letter-spacing:${k(0.1746)}">${label}</span>`;
  const check = `<img src="${URL_BASE}/hero-testimoni/check.svg" alt="" style="width:${k(23.175)};height:${k(23.175)}">`;
  const word = (w) => `<span class="ht-word"><span>${w}</span>${check}</span>`;
  const cardDy = -19; // card sits higher on the live page than in the Figma frame
  const inner =
    `<div class="a" style="${box({ x: 0, y: 0, w: 375, h: 398 })}">${pic(`${URL_BASE}/hero-testimoni/bg`, '', 'object-fit:fill', { eager: true })}</div>` +
    `<div class="a" style="${box({ x: 0, y: -13, w: 375, h: 156 })}background:linear-gradient(#fefefe,rgba(254,254,254,0))"></div>` +
    `<div class="a" style="${box({ x: 9.41, y: 55.66, w: 156.926, h: 331.337 })}">${pic(`${URL_BASE}/hero-testimoni/story`, 'Instagram story Bu Cinthya, client MealBlend', 'object-fit:fill', { eager: true })}</div>` +
    img({ x: 193.48, y: 209, w: 178.324, h: 60.192 }, 'bubble-3', 'Chat: Ak takut bgt kl sedot lemak, jd yg alami2 aj udh bs cepet kok!', 9.39) +
    img({ x: 148, y: 216.0, w: 42.671, h: 56.161 }, 'thumb-3', 'Foto progres customer', 2.404) +
    `<div class="a" style="${box({ x: 3.0, y: 292, w: 221.503, h: 71.63 })}background:rgba(0,0,0,.6);border-radius:${k(6.826)};-webkit-backdrop-filter:blur(${k(3.413)});backdrop-filter:blur(${k(3.413)})"></div>` +
    `<p class="a ff-roboto ht-cap" style="${box({ x: 9, y: 302, w: 209 })}font-size:${k(14.151)}">suka senyum2 sendiri <span class="ht-em">😍🤣😝</span><br>dibilang suami “duh bodynya<br>skrg toned bgt kyk artis kpop“<span class="ht-em">😝</span></p>` +
    img({ x: 195.32, y: 80.11, w: 172.681, h: 56.895 }, 'bubble-1', 'Chat: Eh dikira aku nge-gym, padahal enggaaa', 9.406) +
    img({ x: 152, y: 83.0, w: 40.675, h: 59.768 }, 'thumb-1', 'Foto progres customer', 2) +
    emoji(299.5, 106.42, 14.579, '🤣') + emoji(315, 106, 14.579, '🤣') +
    img({ x: 172, y: 154, w: 183.898, h: 45.375 }, 'bubble-2', 'Chat: skrg jd bebas pilih baju yg lucu2', 10.915) +
    emoji(331, 160, 14.501, '😍') +
    img({ x: 138, y: 154, w: 31.402, h: 41 }, 'thumb-2', 'Foto progres customer', 2.131) +
    `<p class="a nw ff-caveat ht-mau" style="left:${X(282.64)};top:${Y(319.82)};font-size:${k(39.769)};letter-spacing:${k(-0.7954)}">Mau?</p>` +
    `<img class="a" src="${URL_BASE}/hero-testimoni/underline.svg" alt="" style="${box({ x: 240.45, y: 353.04, w: 84.374, h: 7.764 })}">` +
    `<h2 class="a ht-row" style="left:0;width:${k(375)};top:${Y(8)};padding:${k(5)} ${k(20)};gap:${k(20)};font-size:${k(23.167)}">${word('Langsing')}${word('Cantik')}${word('Glowing')}</h2>` +
    time(312, 182, 326, 180, '12:03') + time(326, 251, 338, 249, '17:03') +
    // Product card
    `<div class="a ht-card" style="${box({ x: 42.5, y: 396 + cardDy, w: 290, h: 147.5 })}border-radius:${k(10)};border-width:${k(3)}"></div>` +
    `<img class="a" src="${URL_BASE}/hero-testimoni/logo.svg" alt="Spencer's MealBlend" style="${box({ x: 94.01, y: 409.92 + cardDy, w: 187.5, h: 55.27 })}">` +
    `<p class="a nw ff-josefin ht-sub1" style="${box({ x: 51, y: 476.17 + cardDy, w: 273 })}font-size:${k(14)};letter-spacing:${k(-0.28)}">Breakfast n Dinner praktis</p>` +
    `<p class="a ff-josefin ht-sub2" style="${box({ x: 51.49, y: 502.7 + cardDy, w: 273 })}font-size:${k(11.734)};letter-spacing:${k(-0.2347)}">Dengan Resep Nutrisi alami &amp; Ilmiah<br>yang <b>BEKERJA</b> Kecilkan Lingkar Tubuh Kamu</p>`;
  const css =
    `.s-hero{background:#fff}` +
    `.s-hero .ht-row{display:flex;justify-content:center;align-items:center;margin:0;color:#fd6968;line-height:normal}` +
    `.s-hero .ht-word{display:inline-flex;align-items:center;gap:calc(7*var(--k));font-family:Caveat,cursive;font-weight:700}` +
    `.s-hero .ht-cap{color:#fff;font-weight:600;line-height:normal;text-align:center;white-space:nowrap}.s-hero .ht-em{font-size:.86em;letter-spacing:-.08em}` +
    `.s-hero .ht-emoji{line-height:1.1}` +
    `.s-hero .ht-time{color:#bababa;filter:blur(.15px)}` +
    `.s-hero .ht-mau{color:#fe5757;line-height:.8;transform:translateX(-50%)}` +
    `.s-hero .ht-card{background:linear-gradient(#fff,#fff) padding-box,linear-gradient(to bottom left,rgba(241,144,148,0) 18%,rgba(241,144,148,.9) 55%,rgba(241,144,148,.45) 90%) border-box;border-style:solid;border-color:transparent}` +
    `.s-hero .ht-sub1,.s-hero .ht-sub2{text-align:center;line-height:1;text-transform:capitalize}` +
    `.s-hero .ht-sub1{color:#f19094}.s-hero .ht-sub2{color:#1a1a1a}.s-hero .ht-sub2 b{color:#ffa500;font-weight:inherit}`;
  return wrap('s-hero', inner, css);
}

// Shared Figma frame for "Pertama di Indonesia" + nutrition facts (frame width 373)
const PERTAMA_S = 320 / 373;
const PERTAMA_OY = 4.3;

function iconCircle(f, { x, y, size, icon, inset }, label, lb) {
  const { k, box } = f;
  const [t, r, b, l] = inset;
  return (
    `<li><div class="a mu-ic" style="${box({ x, y, w: size, h: size })}box-shadow:inset 0 ${k(8.6)} ${k(8.6)} rgba(0,0,0,.1)">` +
    `<img src="${URL_BASE}/manfaat-utama/${icon}.svg" alt="" style="position:absolute;top:${t}%;left:${l}%;width:${r3(100 - l - r)}%;height:${r3(100 - t - b)}%"></div>` +
    `<p class="a ff-libre mu-lb" style="${box({ x: lb.cx - lb.w / 2, y: lb.y, w: lb.w })}font-size:${k(10)};letter-spacing:${k(-0.2)}">${label}</p></li>`
  );
}

function promoBadge(f) {
  // Promo badge stays an image (cut from the live artwork with feathered edges)
  const { box, pic } = f;
  return `<div class="a mu-badge" style="${box({ x: 233, y: 14, w: 142, h: 88 })}">${pic(`${URL_BASE}/manfaat-utama/badge`, "Special Promo 14 Day Slimming Program, diskon hingga 60%", "")}</div>`;
}

function manfaatUtama() {
  const f = frame({ S: PERTAMA_S, ox: 0, oy: PERTAMA_OY, H: 646 });
  const { k, box, X, Y, right, wrap, pic } = f;
  const stat = (num, numSz, nx, ny, unit, unitSz, ux, uy, color) =>
    `<span class="a nw ff-carlito" style="${box({ x: nx, y: ny })}font-size:${k(numSz)};color:${color}">${num}</span>` +
    `<span class="a nw ff-carlito" style="${box({ x: ux, y: uy })}font-size:${k(unitSz)};color:${color}">${unit}</span>`;
  const statLabel = (cx, w, y, small, big, color, lh) =>
    `<p class="a ff-inter mu-sl" style="${box({ x: cx - w / 2, y, w })}line-height:${lh ? k(lh) : 'normal'};color:${color}"><i style="font-size:${k(9.734)}">${small}</i> <b style="font-size:${k(15.006)}">${big}</b></p>`;
  const divider = (x) => `<img class="a" src="${URL_BASE}/manfaat-utama/divider.svg" alt="" style="${box({ x: x - 0.54, y: 680.69, w: 1.072, h: 66.309 })}">`;
  const inner =
    `<div class="a" style="${box({ x: 0, y: 0, w: 373, h: 1145 })}">${pic(`${URL_BASE}/manfaat-utama/bg`, 'Model memegang produk Spencer\'s MealBlend dengan minuman pina colada, latte, dan strawberry', '')}</div>` +
    `<div class="a mu-first" style="${box({ x: 14.6, y: 5.55, w: 178.79, h: 70.758 })}"><p class="ff-caveat nw" style="font-size:${k(19.755)};padding:${k(6.585)} ${k(13.17)};transform:rotate(-13.25deg)">Pertama di Indonesia!</p></div>` +
    `<ul class="a mu-list" style="inset:0">` +
    iconCircle(f, { x: 160.56, y: 46.2, size: 47.848, icon: 'iconWaist', inset: [13.11, 13, 11.45, 12.15] }, 'Menyusutkan<br>lingkar pinggang<br>2-3cm /week', { cx: 185.6, w: 120.27, y: 99.87 }) +
    iconCircle(f, { x: 266.12, y: 114.53, size: 45.674, icon: 'iconThigh', inset: [17.18, 18.79, 20.95, 18.78] }, 'Mengikis Timbunan<br>lemak paha<br>1-2cm /week', { cx: 288.67, w: 119, y: 169.28 }) +
    iconCircle(f, { x: 59.95, y: 114.2, size: 47.526, icon: 'iconArm', inset: [0, 0, 0, 0] }, 'Mengencangkan tangan Bergelambir<br>1cm /week', { cx: 84.71, w: 124.045, y: 164.97 }) +
    iconCircle(f, { x: 26.73, y: 223.32, size: 45.674, icon: 'iconScale', inset: [20.69, 16.32, 16.31, 20.7] }, 'BB turun alami<br>2-8kg dalam<br>2 minggu', { cx: 50.57, w: 111.682, y: 273.99 }) +
    iconCircle(f, { x: 302.07, y: 223.21, size: 45.763, icon: 'iconFace', inset: [15.2, 18.83, 15.2, 15.07] }, 'Mengurangi Lipatan kulit<br>dalam 2 minggu', { cx: 325.95, w: 104.283, y: 273.99 }) +
    `</ul>` +
    `<div class="a mu-susut" style="${box({ x: 12.4, y: 373.03, w: 219.572, h: 44.875 })}"><p class="ff-raleway" style="width:${k(218.089)};font-size:${k(11.969)};line-height:${k(11.406)};transform:rotate(-4.73deg);filter:drop-shadow(${k(-0.885)} ${k(0.885)} ${k(0.88)} rgba(0,0,0,.25))"><span>Susut lingkar pinggang</span><span style="margin-top:${k(4.047)}">tidak pernah se MENYENANGKAN ini !</span></p></div>` +
    `<img class="a" src="${URL_BASE}/manfaat-utama/arrow.svg" alt="" style="${box({ x: 184.6, y: 596.9, w: 120.4, h: 26 })}transform:rotate(180deg)">` +
    `<p class="a ff-inter mu-label" style="${right(305.4)}top:${Y(603.6)};font-size:${k(8.6)};line-height:${k(9.3)};letter-spacing:-.02em">Minuman Serbuk Biji-Bijian<br>dan Kacang-Kacangan</p>` +
    `<div class="a mu-halal" style="${box({ x: 307.8, y: 595.3, w: 52.8, h: 52.8 })}">${pic(`${URL_BASE}/manfaat-utama/halal`, 'Halal Indonesia', '')}</div>` +
    `<p class="a ff-inter mu-survey" style="${box({ x: 23, y: 633.9, w: 260 })}font-size:${k(10.716)};line-height:${k(10.716)}">*berdasarkan survey 1.860 customer yang<br>telah mengikuti program Spencer’s MealBlend</p>` +
    promoBadge(f) +
    `<div class="a mu-bar" style="${box({ x: -54.3, y: 669.32, w: 455.731, h: 90.779 })}border-width:${k(1.072)};box-shadow:0 ${k(2.68)} ${k(10.719)} rgba(0,0,0,.15)"></div>` +
    `<div class="a mu-bar" style="${box({ x: -54.3, y: 669.32, w: 455.731, h: 90.779 })}border-width:${k(1.072)};box-shadow:0 ${k(2.68)} ${k(10.719)} rgba(0,0,0,.15)"></div>` +
    `<div class="a" style="inset:0" role="list" aria-label="Kandungan per sajian">` +
    `<div role="listitem">` + stat('0', 32.86, 29.61, 681.57, '%', 15.716, 47.7, 692.53, '#2a2a2a') + statLabel(44.11, 71.876, 715.17, 'Added', 'SUGAR', '#2a2a2a', 15.971) + `</div>` +
    `<div role="listitem">` + stat('9', 34.331, 112.91, 678.39, 'gr', 16.419, 130.99, 689.84, '#2a2a2a') + statLabel(127.67, 71.876, 715.21, 'HIGH QUALITY', 'FIBER', '#2a2a2a', 15.971) + `</div>` +
    `<div role="listitem">` + stat('15', 29.146, 191.64, 681.61, 'gr', 13.939, 224.42, 691.64, '#2a2a2a') + statLabel(213.55, 68.686, 714.14, 'BALANCED', 'PROTEIN', '#2a2a2a', 16.185) + `</div>` +
    `<div role="listitem">` + stat('<span style="display:inline-block;transform:scaleX(.917);transform-origin:0 0">170</span>', 34, 270.2, 678.2, 'kkal', 15.712, 323, 692.56, '#000') + statLabel(300.8, 74.378, 714.14, 'LOW', 'CALORIE', '#000', null) + `</div>` +
    `</div>` + divider(84.15) + divider(172.19) + divider(253.73);
  const css =
    `.s-manfaat{background:#fff}.s-manfaat .mu-list{margin:0;padding:0;list-style:none}` +
    `.s-manfaat .mu-first{display:flex;align-items:center;justify-content:center}.s-manfaat .mu-first p{color:#e34d58;line-height:.9}` +
    `.s-manfaat .mu-ic{border-radius:50%;background:linear-gradient(#ffa6ac,#e24954)}` +
    `.s-manfaat .mu-lb{font-weight:700;color:#2a2a2a;text-align:center;line-height:1.2;text-transform:capitalize}` +
    `.s-manfaat .mu-susut{display:flex;align-items:center;justify-content:center}` +
    `.s-manfaat .mu-susut p{margin:0}.s-manfaat .mu-susut span{display:block;color:transparent;-webkit-background-clip:text;background-clip:text;background-image:linear-gradient(-56.31deg,#d44650 6.95%,#ff6651 93.05%)}` +
    `.s-manfaat .mu-label{font-style:italic;font-weight:500;color:#4e2f31;text-align:right}` +
    `.s-manfaat .mu-halal{border-radius:50%;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12)}` +
    `.s-manfaat .mu-survey{font-style:italic;color:#a598a1}` +
    `.s-manfaat .mu-badge{overflow:visible}.s-manfaat .mb-t{font-family:Inter,Arial,sans-serif}` +
    `.s-manfaat .mu-bar{border-style:solid;border-color:#fff;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.5) 25%,#fff 50.4%,rgba(255,255,255,.5) 75%,rgba(255,255,255,0) 100%)}` +
    `.s-manfaat .ff-carlito{line-height:normal}` +
    `.s-manfaat .mu-sl{text-align:center}.s-manfaat .mu-sl i{font-weight:600}.s-manfaat .mu-sl b{font-weight:700}`;
  return wrap('s-manfaat', inner, css);
}

// White outline around script headlines (live artwork has a sticker-style stroke)
const OUTLINE = (k, r = 3) => Array.from({ length: 24 }, (_, i) => [r * Math.cos(i * Math.PI / 12), r * Math.sin(i * Math.PI / 12)]).map(([x,y])=>`${k(x)} ${k(y)} 0 #fff`).join(',');

function nutritionFacts() {
  const oy = PERTAMA_OY + 646 / PERTAMA_S + 13.6;
  const f = frame({ S: PERTAMA_S, ox: 0, oy, H: 307 });
  const { k, box, X, Y, wrap, pic } = f;
  const row = (x, y, fz, html, cls = '') => `<p class="a nw ${cls}" style="${box({ x, y })}font-size:${k(fz)};line-height:${cls.includes('nf-b') ? .772 : .879}">${html}</p>`;
  const rowR = (xr, y, fz, html, cls = '') => `<p class="a nw ${cls}" style="right:${k(320 / PERTAMA_S - xr)};top:${Y(y)};font-size:${k(fz)};line-height:${html.includes('%') ? .826 : .906};text-align:right">${html}</p>`;
  const rule = (y, h) => `<span class="a nf-rule" style="${box({ x: 62.61, y, w: 246.339, h })}"></span>`;
  const inner =
    `<div class="a nf-card" style="${box({ x: 55.1, y: 781.39, w: 262, h: 212 })}border-width:${k(1.121)};border-radius:${k(9.531)}"></div>` +
    `<h2 class="a nw nf-b" style="${box({ x: 63.1, y: 785.54 })}font-size:${k(9.531)};letter-spacing:${k(-0.4766)}">INFORMASI NILAI GISI / <i>NUTRITION FACTS</i></h2>` +
    `<span class="a nf-rule" style="${box({ x: 62.72, y: 802.25, w: 246.369, h: 2.242 })}"></span>` +
    row(63.1, 809.44, 7.868, 'Takaran Saji / <i>Serving Size</i>', 'nf-b') +
    row(289.1, 809.51, 8.084, '38gr', 'nf-b') +
    row(63.1, 818.59, 7.715, '1 Sajian per Kemasan / <i>1 Serving per Pack</i>') +
    rule(829.81, 0.634) +
    row(63.1, 835.83, 7.987, 'JUMLAH PER SAJIAN / <i>AMOUNT PER SERVING</i>', 'nf-b') +
    row(63.1, 847.47, 7.901, 'Energi Total / <i>Total Calories</i>', 'nf-b') +
    row(244.1, 846.82, 7.942, '140 kkal / <i>kcal</i>', 'nf-b') +
    row(91.1, 856.88, 7.89, 'Energi dari Lemak / <i>Calories from Fat</i>') +
    row(252.1, 857.09, 8.118, '70 kkal / <i>kcal</i>') +
    rule(867.54, 0.634) +
    row(247.13, 872.29, 7.682, '% AKG / <i>%DV*</i>', 'nf-b') +
    row(63.1, 883.7, 7.978, 'Lemak Total / <i>Total Fat</i>', 'nf-b') +
    rowR(264.1, 883.7, 7.926, '8 g', 'nf-b') + rowR(308.29, 883.7, 7.926, '12 %', 'nf-b') +
    row(63.1, 894.31, 7.978, 'Protein', 'nf-b') +
    rowR(264.1, 893.73, 7.926, '15 g', 'nf-b') + rowR(308.29, 893.39, 7.926, '24 %', 'nf-b') +
    row(63.1, 903.22, 7.978, 'Karbohidrat Total / <i>Total Carbohydrate</i>', 'nf-b') +
    rowR(264.1, 902.95, 7.926, '12 g', 'nf-b') + rowR(307.73, 903.22, 7.926, '4 %', 'nf-b') +
    row(91.1, 912.73, 7.911, 'Serat Pangan / <i>Dietary Fiber</i>') +
    rowR(264.1, 912.18, 7.926, '9 g') + rowR(307.93, 913.68, 7.926, '30 %') +
    row(63.1, 922.87, 7.978, 'Gula / <i>Sugar</i>', 'nf-b') +
    rowR(264.1, 921.41, 7.926, '0.5 g', 'nf-b') +
    rule(935.39, 0.634) +
    `<p class="a nf-note" style="${box({ x: 63.1, y: 941.41, w: 255.851 })}font-size:${k(8.237)};line-height:${k(7.593)}">* % AKG berdasarkan kebutuhan energi 2150 kkal.<br>Kebutuhan energi anda  mungkin lebih tinggi atau lebih rendah.</p>` +
    `<p class="a nf-note" style="${box({ x: 63.1, y: 961.22, w: 218.123 })}font-size:${k(8.237)};line-height:${k(7.593)};font-style:italic">* % Daily Values are based on a 2150 calorie diet.<br>Your daily values may be higher or lower depending on your calorie needs.</p>` +
    `<div class="a nf-komb" style="${box({ x: 11.1, y: 996.4, w: 348.322, h: 113.243 })}"><p class="ff-caveat" style="width:${k(343.914)};font-size:${k(31.054)};line-height:${k(24.798)};transform:rotate(-2.89deg);text-shadow:${OUTLINE(k)},0 ${k(2.6)} ${k(2.4)} rgba(0,0,0,.28)"><span>Kombinasi Ilmiah</span><span style="margin-top:${k(10.499)}">dari Nutrisi Alami Terbaik</span><span style="margin-top:${k(10.499)}">untuk Tubuh Impian Kamu</span></p></div>`;
  const css =
    `.s-nutri{color:#000;background:linear-gradient(rgba(90,50,70,.28),rgba(90,50,70,0) 1.2%),linear-gradient(#e0c7d8,#e8cbdb 70%,#eac7d6)}` +
    `.s-nutri .a{font-family:"Open Sans",Arial,sans-serif;line-height:normal}` +
    `.s-nutri .nf-card{background:#fff;border-style:solid;border-color:#000}` +
    `.s-nutri .nf-rule{background:#000}` +
    `.s-nutri .nf-b{font-weight:700}.s-nutri .a:not(.nf-b){font-weight:400}` +
    `.s-nutri .nf-komb{display:flex;align-items:center;justify-content:center}` +
    `.s-nutri .nf-komb p{margin:0;font-family:Caveat,cursive;font-weight:700;color:#fa525e;text-align:center}.s-nutri .nf-komb span{display:block}`;
  return wrap('s-nutri', inner, css);
}

// ---------------------------------------------------------------- write page
async function main() {
  if (!process.argv.includes('--html-only')) await buildAssets();
  const page = JSON.parse(await fs.readFile(PAGE, 'utf8'));
  const set = (id, html, extra = {}) => {
    const i = page.sections.findIndex((s) => s.id === id);
    if (i < 0) throw new Error(`section ${id} not found`);
    const { name, mt } = page.sections[i];
    page.sections[i] = { id, name, type: 'html', ...(mt ? { mt } : {}), ...extra, html };
  };
  set('promo-bar', promoBar());
  set('event-offline', eventOffline());
  set('hero-testimoni', heroTestimoni());
  set('manfaat-utama', manfaatUtama(), { mt: -7 });
  set('nutrition-facts', nutritionFacts());
  await fs.writeFile(PAGE, JSON.stringify(page, null, 2) + '\n');
  console.log('sections written');
}
main().catch((e) => { console.error(e); process.exit(1); });
