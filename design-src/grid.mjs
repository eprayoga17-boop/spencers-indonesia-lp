// Renders design-src/live/<name>.png with a labelled coordinate grid (in the image's own pixels)
// Usage: node design-src/grid.mjs <name> [step=100] [x0 y0 x1 y1]  -> design-src/compare-out/grid-<name>.png
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [name, stepArg, ...crop] = process.argv.slice(2);
const step = Number(stepArg) || 100;
const src = path.join(ROOT, 'design-src', 'live', `${name}.png`);
const meta = await sharp(src).metadata();
const [x0, y0, x1, y1] = crop.length === 4 ? crop.map(Number) : [0, 0, meta.width, meta.height];
const w = x1 - x0, h = y1 - y0;
let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">`;
for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) {
  svg += `<line x1="${x - x0}" y1="0" x2="${x - x0}" y2="${h}" stroke="#00f" stroke-opacity=".45" stroke-width="1"/>`;
  svg += `<text x="${x - x0 + 2}" y="12" font-size="12" font-family="Arial" fill="#00f">${x}</text>`;
}
for (let y = Math.ceil(y0 / step) * step; y < y1; y += step) {
  svg += `<line x1="0" y1="${y - y0}" x2="${w}" y2="${y - y0}" stroke="#f00" stroke-opacity=".45" stroke-width="1"/>`;
  svg += `<text x="2" y="${y - y0 - 2}" font-size="12" font-family="Arial" fill="#f00">${y}</text>`;
}
svg += '</svg>';
await sharp(src).extract({ left: x0, top: y0, width: w, height: h }).composite([{ input: Buffer.from(svg) }])
  .png().toFile(path.join(ROOT, 'design-src', 'compare-out', `grid-${name}.png`));
console.log(`grid-${name}.png ${w}x${h}`);
