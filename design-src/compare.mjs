// Visual regression helper: renders the local page with headless Chrome and compares
// each rebuilt section with the original live artwork it replaces.
// Usage: node design-src/compare.mjs [outDir]   (server must be running on :3000)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || path.join(ROOT, 'design-src', 'compare-out');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const D = 3; // px per page unit (window 480 css px wide at DPR 2)

// [section id, live image, box x, box width, box top (page units), box height]
const SECTIONS = [
  ['promo-bar', 'promo-bar', -34, 388, 0, 46],
  ['event-offline', 'event-offline', 0, 320, 46, 109],
  ['hero-testimoni', 'hero-testimoni', 0, 320, 155, 445],
  ['manfaat-utama', 'pertama-di-indonesia', 0, 320, 593, 646],
  ['nutrition-facts', 'm-201f3c', 0, 320, 1239, 307],
];

await fs.mkdir(OUT, { recursive: true });
const shot = path.join(OUT, 'page.png');
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
  '--window-size=600,2400', '--virtual-time-budget=10000', `--screenshot=${shot}`,
  'http://localhost:3000/slimmealsolutionmintidn2?cmp=' + Date.now()], { stdio: 'ignore' });

const report = [];
for (const [id, live, bx, bw, top, h] of SECTIONS) {
  const W = 320 * D, H = Math.round(h * D);
  const ours = await sharp(shot).extract({ left: 120, top: Math.round(top * D), width: W, height: H }).removeAlpha().raw().toBuffer();
  // live artwork rendered like Wix: cover into its box, then clipped to the page width
  let ref = await sharp(path.join(ROOT, 'public/uploads/seed', `${live}.webp`))
    .resize(Math.round(bw * D), H, { fit: 'cover', position: 'centre' }).png().toBuffer();
  if (bx < 0 || bw > 320) ref = await sharp(ref).extract({ left: Math.round(-bx * D), top: 0, width: W, height: H }).png().toBuffer();
  const refRaw = await sharp(ref).removeAlpha().raw().toBuffer();
  const diff = Buffer.alloc(ours.length);
  let sum = 0;
  for (let i = 0; i < ours.length; i++) { const d = Math.abs(ours[i] - refRaw[i]); sum += d; diff[i] = Math.min(255, d * 3); }
  const mean = sum / ours.length;
  const raw = { raw: { width: W, height: H, channels: 3 } };
  await sharp(ours, raw).png().toFile(path.join(OUT, `${id}-ours.png`));
  await sharp(ref).png().toFile(path.join(OUT, `${id}-live.png`));
  await sharp(diff, raw).png().toFile(path.join(OUT, `${id}-diff.png`));
  // side by side: live | ours | diff
  await sharp({ create: { width: W * 3 + 20, height: H, channels: 3, background: '#888' } })
    .composite([{ input: ref, left: 0, top: 0 }, { input: await sharp(ours, raw).png().toBuffer(), left: W + 10, top: 0 }, { input: await sharp(diff, raw).png().toBuffer(), left: W * 2 + 20, top: 0 }])
    .png().toFile(path.join(OUT, `${id}-sbs.png`));
  report.push(`${id.padEnd(16)} mean abs diff ${mean.toFixed(2)}`);
}
console.log(report.join('\n'));
