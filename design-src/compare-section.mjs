// Side-by-side check of rebuilt sections: live artwork vs our render (server on :3000).
// Usage: node design-src/compare-section.mjs <sectionId...>  -> compare-out/sbs-<id>.png (+ mean diff)
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'design-src', 'compare-out');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = JSON.parse(await fs.readFile(path.join(ROOT, 'data/pages/slimmealsolutionmintidn2.json'), 'utf8'));

for (const id of process.argv.slice(2)) {
  const sec = page.sections.find((s) => s.id === id);
  const items = (sec._items || sec.items).map((it, i) => (i === 0 ? { ...it, mt: 0 } : it));
  let H = 0; const tops = [];
  for (const it of items) { H += it.mt || 0; tops.push(H); H += it.h; }
  const shot = path.join(TMP, `shot-${id}.png`);
  await shotPage(`http://localhost:3000/slimmealsolutionmintidn2?only=${id}`, shot, Math.ceil(H * 1.5) + 60);
  const ours = await sharp(shot).extract({ left: 120, top: 0, width: 960, height: Math.round(H * 3) }).removeAlpha().png().toBuffer();
  // live: each artwork cover-fitted into its box, clipped to the page
  const comps = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const src = path.join(ROOT, 'public', `${it.src}.${it.ext || 'webp'}`);
    let img = await sharp(src).resize(Math.round(it.w * 3), Math.round(it.h * 3), { fit: 'cover' }).png().toBuffer();
    const x = Math.round((it.x || 0) * 3);
    const l = Math.max(0, -x), w = Math.min(960 - Math.max(0, x), Math.round(it.w * 3) - l);
    img = await sharp(img).extract({ left: l, top: 0, width: w, height: Math.round(it.h * 3) }).png().toBuffer();
    comps.push({ input: img, left: Math.max(0, x), top: Math.round(tops[i] * 3) });
  }
  const live = await sharp({ create: { width: 960, height: Math.round(H * 3), channels: 3, background: '#fff' } }).composite(comps).png().toBuffer();
  const a = await sharp(live).removeAlpha().raw().toBuffer(), b = await sharp(ours).removeAlpha().raw().toBuffer();
  let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  await sharp({ create: { width: 1930, height: Math.round(H * 3), channels: 3, background: '#888' } })
    .composite([{ input: live, left: 0, top: 0 }, { input: ours, left: 970, top: 0 }]).png().toFile(path.join(TMP, `sbs-${id}.png`));
  console.log(`${id.padEnd(26)} mean abs diff ${(sum / a.length).toFixed(2)}`);
}
if (shotBrowser) await shotBrowser.close();
