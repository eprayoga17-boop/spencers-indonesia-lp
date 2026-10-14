// Rebuilds image sections as "clean plate + real HTML text" from the original live artwork.
//
//   node design-src/plates.mjs build [sectionId...]      plates + HTML into the page JSON
//   node design-src/plates.mjs calibrate [sectionId...]  render, measure, fit text (3 rounds)
//
// For every text block in plates-spec.mjs the text is erased from the artwork (each row is
// re-filled by interpolating the background on both sides of the block) and the same text is
// rendered as HTML on top. Calibration measures the ink of our rendered text against the live
// artwork and adjusts font size / position until they line up.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';

let shotBrowser = null;
async function shotPage(url, file, height) {
  shotBrowser ||= await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const pg = await shotBrowser.newPage();
  await pg.setViewport({ width: 600, height, deviceScaleFactor: 2 });
  await pg.goto(url, { waitUntil: 'networkidle0' });
  await pg.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  await pg.screenshot({ path: file });
  await pg.close();
}
import { SPEC } from './plates-spec.mjs';

// ---------------------------------------------------------------- font metrics (headless Chrome)
const FAMILY = { inter: 'Inter', poppins: 'Poppins', libre: 'Libre Baskerville', caveat: 'Caveat', carlito: 'Carlito',
  josefin: 'Josefin Sans', roboto: 'Roboto', opensans: 'Open Sans', raleway: 'Raleway', imprima: 'Imprima' };
let browserP = null;
async function metricsPage() {
  if (!browserP) browserP = (async () => {
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
    const pg = await browser.newPage();
    await pg.goto('http://localhost:3000/slimmealsolutionmintidn2?only=promo-bar', { waitUntil: 'networkidle0' });
    return { browser, pg };
  })();
  return (await browserP).pg;
}
const plain = (t) => t.replace(/<(?!br)[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
async function measure(b) {
  const pg = await metricsPage();
  const font = `${b.s || 'normal'} ${b.w || 400} 100px "${FAMILY[b.f]}"`;
  return pg.evaluate(async (font, lines, ls) => {
    await document.fonts.load(font, lines.join(''));
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = font; ctx.letterSpacing = ls ? `${ls * 100}px` : '0px';
    return lines.map((l) => { const m = ctx.measureText(l); return { L: m.actualBoundingBoxLeft, R: m.actualBoundingBoxRight, adv: m.width, aA: m.actualBoundingBoxAscent, fA: m.fontBoundingBoxAscent, fD: m.fontBoundingBoxDescent }; });
  }, font, plain(b.t).split('<br>'), b.ls || 0);
}
export async function closeMetrics() { if (browserP) (await browserP).browser.close(); browserP = null; }


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = path.join(ROOT, 'design-src', 'live');
const OUT = path.join(ROOT, 'public', 'uploads', 'sections');
const PAGE = path.join(ROOT, 'data', 'pages', 'slimmealsolutionmintidn2.json');
const CALIB = path.join(ROOT, 'design-src', 'plates-calib.json');
const TMP = path.join(ROOT, 'design-src', 'compare-out');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const r3 = (n) => +(+n).toFixed(3);

// ---------------------------------------------------------------- image helpers
async function loadRaw(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}
const idx = (img, x, y) => (y * img.W + x) * 3;
function avg(img, x0, x1, y) {
  const c = [0, 0, 0]; let n = 0;
  for (let x = Math.max(0, x0); x <= Math.min(img.W - 1, x1); x++) { const i = idx(img, x, y); c[0] += img.data[i]; c[1] += img.data[i + 1]; c[2] += img.data[i + 2]; n++; }
  return n ? c.map((v) => v / n) : [255, 255, 255];
}
// Background estimate inside a rect: per-row linear interpolation between both outer edges
function bgRow(img, [x0, , x1], y) {
  return { L: avg(img, x0 - 4, x0 - 1, y), R: avg(img, x1 + 1, x1 + 4, y) };
}
function fillRect(img, rect, fill) {
  const [x0, y0, x1, y1] = rect;
  const solid = typeof fill === 'string' && fill.startsWith('#') ? [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16)) : null;
  for (let y = Math.max(0, y0); y <= Math.min(img.H - 1, y1); y++) {
    const { L, R } = solid ? { L: solid, R: solid } : bgRow(img, rect, y);
    for (let x = Math.max(0, x0); x <= Math.min(img.W - 1, x1); x++) {
      const t = x1 > x0 ? (x - x0) / (x1 - x0) : 0;
      const i = idx(img, x, y);
      for (let c = 0; c < 3; c++) img.data[i + c] = Math.round(L[c] + (R[c] - L[c]) * t);
    }
  }
}
// Ink = pixels that differ from the clean plate
function inkBox(a, b, rects, thr = 42, valid = null) {
  let box = null; const rows = new Map(); const samples = [];
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = Math.max(0, y0); y <= Math.min(a.H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(a.W - 1, x1); x++) {
        if (valid && !valid(x, y)) continue;
        const i = idx(a, x, y);
        const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
        if (d < thr) continue;
        if (!box) box = [x, y, x, y];
        box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
        rows.set(y, (rows.get(y) || 0) + 1);
        if (samples.length < 40000) samples.push([a.data[i], a.data[i + 1], a.data[i + 2], d]);
      }
    }
  }
  if (!box) return null;
  // trim stray specks: rows/cols with very little ink at the edges
  const cols = new Map();
  for (const [x0, y0, x1, y1] of rects) for (let y = Math.max(box[1], y0); y <= Math.min(box[3], y1); y++) for (let x = Math.max(box[0], x0); x <= Math.min(box[2], x1); x++) {
    if (valid && !valid(x, y)) continue; const i = idx(a, x, y);
    if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) >= thr) cols.set(x, (cols.get(x) || 0) + 1);
  }
  while (box[1] < box[3] && (rows.get(box[1]) || 0) < 3) box[1]++;
  while (box[3] > box[1] && (rows.get(box[3]) || 0) < 3) box[3]--;
  while (box[0] < box[2] && (cols.get(box[0]) || 0) < 2) box[0]++;
  while (box[2] > box[0] && (cols.get(box[2]) || 0) < 2) box[2]--;
  // line clusters
  const ys = [...rows.keys()].filter((y) => rows.get(y) > 1).sort((p, q) => p - q);
  const lines = [];
  for (const y of ys) { const l = lines[lines.length - 1]; if (l && y - l[1] <= 4) l[1] = y; else lines.push([y, y]); }
  const maxD = samples.reduce((m, s) => Math.max(m, s[3]), 0);
  const core = samples.filter((s) => s[3] >= maxD * 0.8);
  const med = (k) => { const v = core.map((s) => s[k]).sort((p, q) => p - q); return v[Math.floor(v.length / 2)] ?? 0; };
  const color = core.length ? '#' + [0, 1, 2].map((k) => med(k).toString(16).padStart(2, '0')).join('') : null;
  return { x0: box[0], y0: box[1], x1: box[2], y1: box[3], w: box[2] - box[0] + 1, h: box[3] - box[1] + 1, lines: lines.filter((l) => l[1] - l[0] >= 3), color };
}

// Split an ink box into n text lines: cut at the emptiest row near each expected boundary.
function bands(img, ref, box, n, thr, valid) {
  if (!box) return null;
  const counts = [];
  for (let y = box.y0; y <= box.y1; y++) {
    let c = 0;
    for (let x = box.x0; x <= box.x1; x++) {
      if (valid && !valid(x, y)) continue;
      const i = idx(img, x, y);
      if (Math.max(Math.abs(img.data[i] - ref.data[i]), Math.abs(img.data[i + 1] - ref.data[i + 1]), Math.abs(img.data[i + 2] - ref.data[i + 2])) >= thr) c++;
    }
    counts.push(c);
  }
  const h = counts.length, cuts = [0];
  for (let i = 1; i < n; i++) {
    const e = Math.round((h * i) / n), win = Math.max(2, Math.round(h / n / 3));
    let best = e;
    for (let y = Math.max(1, e - win); y <= Math.min(h - 2, e + win); y++) if (counts[y] < counts[best]) best = y;
    cuts.push(best);
  }
  cuts.push(h);
  const out = [];
  for (let i = 0; i < n; i++) {
    let a = cuts[i], b = cuts[i + 1] - 1;
    while (a < b && counts[a] <= 1) a++;
    while (b > a && counts[b] <= 1) b--;
    out.push([box.y0 + a, box.y0 + b]);
  }
  return out;
}

// ---------------------------------------------------------------- geometry
function frameGeom(item, W, H) {
  const S = Math.max(item.w / W, item.h / H); // page units per image px (cover)
  return { S, cx0: (W * S - item.w) / 2 / S, cy0: (H * S - item.h) / 2 / S };
}
const rectsOf = (b) => (b.rs || [b.r]);
const pad = (r, p) => [r[0] - p, r[1] - p, r[2] + p, r[3] + p];

// ---------------------------------------------------------------- build
async function buildFrame(sectionId, name, fspec, item, calib) {
  const live = await loadRaw(path.join(LIVE, `${name}.png`));
  const plate = { ...live, data: Buffer.from(live.data) };
  for (const b of fspec.blocks) if (b.fill !== 'none') for (const r of rectsOf(b)) fillRect(plate, pad(r, b.pad ?? 3), b.fill || 'row');
  for (const r of fspec.erase || []) fillRect(plate, r.r, r.fill || 'row');
  // Tiles: separate images cut from the artwork (e.g. one image per flavour)
  let tilesHtml = '';
  if (fspec.tiles) {
    const g = frameGeom(item, live.W, live.H);
    const kk = (n) => `calc(${r3(n)}*var(--k))`;
    for (const [ti, t] of fspec.tiles.entries()) {
      const [x0, y0, x1, y1, alt] = t;
      const base = path.join(OUT, sectionId, `${name}-tile-${ti + 1}`);
      await fs.mkdir(path.dirname(base), { recursive: true });
      const crop = await sharp(path.join(LIVE, `${name}.png`)).removeAlpha().extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
      await sharp(crop).avif({ quality: 60, effort: 6 }).toFile(`${base}.avif`);
      await sharp(crop).webp({ quality: 82, effort: 6 }).toFile(`${base}.webp`);
      const u = `/uploads/sections/${sectionId}/${name}-tile-${ti + 1}`;
      tilesHtml += `<div class="a" style="left:${kk(x0 - g.cx0)};top:${kk(y0 - g.cy0)};width:${kk(x1 - x0 + 1)};height:${kk(y1 - y0 + 1)}"><picture><source type="image/avif" srcset="${u}.avif"><img src="${u}.webp" alt="${alt}" loading="lazy" decoding="async" style="width:100%;height:100%"></picture></div>`;
      fillRect(plate, [x0 - 2, y0 - 2, x1 + 2, y1 + 2], fspec.tileFill || '#ffffff');
    }
  }
  const outBase = path.join(OUT, sectionId, `${name}-plate`);
  await fs.mkdir(path.dirname(outBase), { recursive: true });
  const png = await sharp(plate.data, { raw: { width: plate.W, height: plate.H, channels: 3 } }).png().toBuffer();
  const width = Math.min(plate.W, 1125);
  await sharp(png).resize({ width }).avif({ quality: 55, effort: 6 }).toFile(`${outBase}.avif`);
  await sharp(png).resize({ width }).webp({ quality: 80, effort: 6 }).toFile(`${outBase}.webp`);
  await sharp(png).toFile(path.join(TMP, `plate-${name}.png`));

  const { S, cx0, cy0 } = frameGeom(item, live.W, live.H);
  const k = (n) => `calc(${r3(n)}*var(--k))`;
  const url = `/uploads/sections/${sectionId}/${name}-plate`;
  const cal = calib[name] || (calib[name] = {});
  const texts = (await Promise.all(fspec.blocks.map(async (b, i) => {
    const T = inkBox(live, plate, rectsOf(b).map((r) => pad(r, 2)));
    if (!T) throw new Error(`${name} block ${i}: no ink found`);
    const lineN = (b.t.match(/<br>/g) || []).length + 1;
    const TB = bands(live, plate, T, lineN, 42);
    const pitch = lineN > 1 ? (TB[lineN - 1][0] - TB[0][0]) / (lineN - 1) : null;
    const c = b.fixed ? (cal[i] = { ...b.fixed }) : (cal[i] || (cal[i] = {}));
    c.target = { x0: T.x0, y0: T.y0, x1: T.x1, y1: T.y1, line1: TB[0], pitch, n: lineN };
    if (c.size == null) {
      const M = await measure(b);
      const w = M.map((m) => m.L + m.R);
      const wi = w.indexOf(Math.max(...w)), W = M[wi];
      const sz = b.size || ((T.x1 - T.x0 + 1) / w[wi]) * 100;
      const u = sz / 100;
      c.size = sz;
      if (b.a === 'center') c.left = (T.x0 + T.x1) / 2 + (W.adv / 2 - (W.R - W.L) / 2) * u;
      else if (b.a === 'right') c.left = T.x1 - (W.R - W.adv) * u;
      else c.left = T.x0 + Math.max(...M.map((m) => m.L)) * u;
      const lhx = b.lh || (pitch ?? sz * 1.2);
      c.top = T.y0 + M[0].aA * u - (lhx - (M[0].fA + M[0].fD) * u) / 2 - M[0].fA * u;
    }
    const lh = b.lh || (pitch ?? c.size * 1.2);
    const color = b.g ? 'transparent' : (b.c || T.color);
    const anchor = b.a === 'center' ? 'transform:translateX(-50%);text-align:center;' : b.a === 'right' ? 'transform:translateX(-100%);text-align:right;' : '';
    const grad = b.g ? `background-image:${b.g};-webkit-background-clip:text;background-clip:text;` : '';
    const ls = c.ls ? `letter-spacing:${r3(c.ls)}em;` : (b.ls ? `letter-spacing:${b.ls}em;` : '');
    const tag = b.tag || 'p';
    return `<${tag} class="a nw ff-${b.f}" data-b="${i}" style="left:${k(c.left - cx0)};top:${k(c.top - cy0)};font-size:${k(c.size)};line-height:${k(lh)};font-weight:${b.w || 400};${b.s ? `font-style:${b.s};` : ''}color:${color};${anchor}${grad}${ls}${b.css || ''}">${b.t}</${tag}>`;
  }))).join('');
  const style = `--k:calc(100cqw*${r3(S)}/320);--x:${item.x ?? 0};--w:${item.w};--h:${item.h};--mt:${item.mt ?? 0}`;
  const pic = `<picture><source type="image/avif" srcset="${url}.avif"><img src="${url}.webp" alt="" loading="lazy" decoding="async" style="position:absolute;left:${k(-cx0)};top:${k(-cy0)};width:${k(live.W)};height:${k(live.H)}"></picture>`;
  const extra = (fspec.html || '').replace(/\{k:([-\d.]+)\}/g, (m, n) => k(n)).replace(/\{x:([-\d.]+)\}/g, (m, n) => k(n - cx0)).replace(/\{y:([-\d.]+)\}/g, (m, n) => k(n - cy0));
  const inner = `${pic}${tilesHtml}${texts}${extra}`;
  const label = fspec.label ? ` role="group" aria-label="${fspec.label}"` : '';
  if (item.href) {
    const ext = /^https?:/.test(item.href) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a class="lp-box fx" href="${item.href}"${ext} style="${style}"${label}>${inner}</a>`;
  }
  return `<div class="lp-box fx" style="${style}"${label}>${inner}</div>`;
}

function imageFrame(item) {
  const style = `--x:${item.x ?? 0};--w:${item.w};--h:${item.h};--mt:${item.mt ?? 0}`;
  const pic = item.ext
    ? `<img src="${item.src}.${item.ext}" alt="${item.alt || ''}" loading="lazy" decoding="async">`
    : `<picture><source type="image/avif" srcset="${item.src}.avif"><img src="${item.src}.webp" alt="${(item.alt || '').replace(/"/g, '&quot;')}" loading="lazy" decoding="async"></picture>`;
  if (item.href) return `<a class="lp-box" href="${item.href}" target="_blank" rel="noopener noreferrer" style="${style}">${pic}</a>`;
  return `<div class="lp-box" style="${style}">${pic}</div>`;
}

async function build(ids) {
  const page = JSON.parse(await fs.readFile(PAGE, 'utf8'));
  const calib = JSON.parse(await fs.readFile(CALIB, 'utf8').catch(() => '{}'));
  for (const id of ids) {
    const sec = page.sections.find((s) => s.id === id);
    const spec = SPEC[id];
    if (!sec || !spec) throw new Error(`unknown section ${id}`);
    const items = sec.items || sec._items; // keep the original image list for rebuilds
    if (!items) throw new Error(`${id}: no image items to rebuild`);
    const its = items.map((it, i) => (i === 0 ? { ...it, mt: 0 } : it));
    const frames = [];
    for (const it of its) {
      const name = path.basename(it.src);
      frames.push(spec.frames[name] ? await buildFrame(id, name, spec.frames[name], it, calib) : imageFrame(it));
    }
    const mt = items[0].mt || sec.mt || 0;
    Object.assign(sec, { type: 'html', html: frames.join(''), _items: items });
    if (mt) sec.mt = mt; else delete sec.mt;
    delete sec.items; delete sec.layout;
    if (spec.name) sec.name = spec.name;
  }
  await fs.writeFile(PAGE, JSON.stringify(page, null, 2) + '\n');
  await fs.writeFile(CALIB, JSON.stringify(calib, null, 1) + '\n');
}

// ---------------------------------------------------------------- calibrate
async function shoot(id, heightUnits) {
  const file = path.join(TMP, `shot-${id}.png`);
  await shotPage(`http://localhost:3000/slimmealsolutionmintidn2?only=${id}`, file, Math.ceil(heightUnits * 1.5) + 60);
  return file;
}

async function calibrate(ids, rounds = 3) {
  for (let round = 1; round <= rounds; round++) {
    await build(ids);
    const page = JSON.parse(await fs.readFile(PAGE, 'utf8'));
    const calib = JSON.parse(await fs.readFile(CALIB, 'utf8'));
    for (const id of ids) {
      const sec = page.sections.find((s) => s.id === id);
      const items = sec._items.map((it, i) => (i === 0 ? { ...it, mt: 0 } : it));
      let top = 0; const tops = [];
      for (const it of items) { top += it.mt || 0; tops.push(top); top += it.h; }
      const shot = await shoot(id, top);
      const report = [];
      for (let fi = 0; fi < items.length; fi++) {
        const it = items[fi]; const name = path.basename(it.src); const fspec = SPEC[id].frames[name];
        if (!fspec) continue;
        const plate = await loadRaw(path.join(TMP, `plate-${name}.png`));
        const { S, cx0, cy0 } = frameGeom(it, plate.W, plate.H);
        // visible part of the frame inside the 320-unit page
        const px0 = Math.max(0, it.x ?? 0), px1 = Math.min(320, (it.x ?? 0) + it.w);
        const sx = Math.round(120 + px0 * 3), sw = Math.round((px1 - px0) * 3), sy = Math.round(tops[fi] * 3), sh = Math.round(it.h * 3);
        const ix0 = Math.round(cx0 + (px0 - (it.x ?? 0)) / S), iy0 = Math.round(cy0);
        const iw = Math.round((px1 - px0) / S), ih = Math.round(it.h / S);
        const crop = await sharp(shot).extract({ left: sx, top: sy, width: sw, height: sh }).resize(iw, ih, { fit: 'fill' }).removeAlpha().png().toBuffer();
        const canvas = await loadRaw(await sharp(path.join(TMP, `plate-${name}.png`)).composite([{ input: crop, left: ix0, top: iy0 }]).png().toBuffer());
        await sharp(canvas.data, { raw: { width: canvas.W, height: canvas.H, channels: 3 } }).png().toFile(path.join(TMP, `canvas-${name}.png`));
        const valid = (x, y) => x >= ix0 && x < ix0 + iw && y >= iy0 && y < iy0 + ih;
        fspec.blocks.forEach((b, i) => {
          if (b.fixed) return;
          const c = calib[name][i];
          const O = inkBox(canvas, plate, b.m ? [b.m] : rectsOf(b).map((r) => pad(r, b.measurePad ?? 2)), 60, valid);
          const T = c.target;
          if (!O) { report.push(`${name}#${i} NOT FOUND`); return; }
          const multi = c.target.pitch != null;
          const Th = (multi ? T.line1[1] - T.line1[0] : T.y1 - T.y0) + 1;
          const OB = bands(canvas, plate, O, T.n || 1, 60, valid);
          const Oh = (multi ? OB[0][1] - OB[0][0] : O.h - 1) + 1;
          const Tw = T.x1 - T.x0 + 1;
          let f = b.fitH ? Th / Oh : Tw / O.w;
          f = Math.max(0.7, Math.min(1.4, f));
          const ref = b.a === 'center' ? (O.x0 + O.x1) / 2 : b.a === 'right' ? O.x1 : O.x0;
          const want = b.a === 'center' ? (T.x0 + T.x1) / 2 : b.a === 'right' ? T.x1 : T.x0;
          c.left = want - (ref - c.left) * f;
          const sane = Math.abs(Oh / Th - O.w / Tw) < 0.18 || (Math.abs(Oh - Th) <= Math.max(3, Th * 0.25) && Math.abs(O.w - Tw) <= Math.max(6, Tw * 0.3));
          if (!sane) { report.push(`${name}#${i} skipped (O=${O.w}x${Oh} T=${Tw}x${Th})`); return; }
          c.top = T.y0 - (O.y0 - c.top) * f;
          c.size *= f;
          if (!multi && !b.fitH && b.lsFit) { /* width already exact */ }
          if (b.fitH && b.lsFit !== false) {
            const chars = b.t.replace(/<[^>]+>/g, '').split('<br>')[0].length || 10;
            const wErr = Tw - O.w * f; // remaining width error in px
            c.ls = (c.ls || 0) + wErr / Math.max(1, chars) / c.size * 0.8;
          }
          report.push(`${name}#${i} f=${f.toFixed(3)} dx=${(want - ref).toFixed(1)} dy=${(T.y0 - O.y0).toFixed(1)} T=${Tw}x${Th} O=${O.w}x${Oh}`);
        });
      }
      console.log(`[round ${round}] ${id}\n  ${report.join('\n  ')}`);
    }
    await fs.writeFile(CALIB, JSON.stringify(calib, null, 1) + '\n');
  }
  await build(ids);
}

const [cmd, ...rest] = process.argv.slice(2);
const ids = rest.length ? rest : Object.keys(SPEC);
if (cmd === 'build') await build(ids);
else if (cmd === 'calibrate') await calibrate(ids);
else console.log('usage: plates.mjs build|calibrate [ids]');
await closeMetrics();
if (shotBrowser) await shotBrowser.close();
