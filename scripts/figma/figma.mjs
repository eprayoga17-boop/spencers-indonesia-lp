// Figma -> local design data for the "figma-lp-to-sections" skill (.claude/skills/figma-lp-to-sections).
// Reads FIGMA_TOKEN from the environment or .env (never commit it, never print it).
//
//   node scripts/figma/figma.mjs fetch  <figma-url> [--out <dir>] [--scale 2]
//        node tree (raw + simplified), a readable outline, a PNG render of the frame and of each section,
//        and every image fill used.  Default out dir: design-src/figma/<fileKey>-<nodeId>/ (git-ignored).
//   node scripts/figma/figma.mjs export <figma-url> --ids 1:2,1:3 [--format png|jpg|svg] [--scale 3] [--out <dir>]
//        renders chosen layers (logos, icons, photos with masks/effects) to <out>/assets/<name>.<format>
//        (svg: for small logos/icons that are pasted INLINE into the HTML; .svg files cannot be uploaded)
//
// The URL must point at the landing-page frame: in Figma right-click the frame -> Copy/Paste as -> Copy link to selection.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env */ }
const TOKEN = process.env.FIGMA_TOKEN;
const API = 'https://api.figma.com/v1';

const [cmd, url, ...rest] = process.argv.slice(2);
const opt = (name, d) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : d; };
if (!['fetch', 'export'].includes(cmd) || !url) {
  console.log('usage: node scripts/figma/figma.mjs fetch <figma-url> [--out dir] [--scale 2]\n       node scripts/figma/figma.mjs export <figma-url> --ids 1:2,1:3 [--format png|jpg|svg] [--scale 3] [--out dir]');
  process.exit(1);
}
if (!TOKEN) {
  console.error('FIGMA_TOKEN is missing. Figma -> Settings -> Security -> Personal access tokens (scope: File content, read-only),\nthen add a line FIGMA_TOKEN=... to .env (never commit .env).');
  process.exit(1);
}

/** figma.com/{design|file|proto}/<key>[/branch/<branchKey>]/...?node-id=12-34 */
function parseUrl(u) {
  const m = String(u).match(/figma\.com\/(?:design|file|proto|board)\/([A-Za-z0-9]+)(?:\/branch\/([A-Za-z0-9]+))?/);
  if (!m) throw new Error('Not a Figma file link.');
  const node = new URL(u).searchParams.get('node-id');
  if (!node) throw new Error('The link has no node-id. Select the landing-page frame in Figma, then "Copy link to selection".');
  return { key: m[2] || m[1], node: decodeURIComponent(node).replace('-', ':') };
}

async function get(p, tries = 4) {
  const r = await fetch(`${API}${p}`, { headers: { 'X-Figma-Token': TOKEN } });
  if (r.status === 429 && tries > 0) {
    const wait = Number(r.headers.get('retry-after') || 20);
    console.log(`  rate limited, waiting ${wait}s…`);
    await new Promise((ok) => setTimeout(ok, wait * 1000));
    return get(p, tries - 1);
  }
  if (r.status === 403) throw new Error('Figma refused (403): token wrong/expired, or this account cannot open the file.');
  if (r.status === 404) throw new Error('Figma file or node not found (404). Check the link.');
  if (!r.ok) throw new Error(`Figma API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function download(src, file) {
  const r = await fetch(src);
  if (!r.ok) throw new Error(`download ${r.status}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}
/** Renders nodes in batches; returns { id: url } */
async function render(key, ids, format = 'png', scale = 2) {
  const out = {};
  for (let i = 0; i < ids.length; i += 40) {
    const batch = ids.slice(i, i + 40);
    const j = await get(`/images/${key}?ids=${encodeURIComponent(batch.join(','))}&format=${format}&scale=${scale}&use_absolute_bounds=true`);
    if (j.err) throw new Error(`Figma render: ${j.err}`);
    Object.assign(out, j.images);
  }
  return out;
}
const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'layer';
const hex = (c) => `#${[c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
const r1 = (n) => Math.round(n * 10) / 10;

/** Compact layer tree relative to the root frame (Figma units). */
function simplify(n, origin) {
  if (n.visible === false) return null;
  const b = n.absoluteBoundingBox || { x: 0, y: 0, width: 0, height: 0 };
  const o = { id: n.id, name: n.name, type: n.type, x: r1(b.x - origin.x), y: r1(b.y - origin.y), w: r1(b.width), h: r1(b.height) };
  if (n.rotation) o.rot = r1((n.rotation * 180) / Math.PI);
  if (n.opacity != null && n.opacity < 1) o.opacity = r1(n.opacity * 100) / 100;
  if (n.cornerRadius) o.radius = n.cornerRadius;
  if (n.rectangleCornerRadii) o.radii = n.rectangleCornerRadii;
  if (n.clipsContent) o.clip = true;
  if (n.layoutMode && n.layoutMode !== 'NONE') o.layout = { mode: n.layoutMode, gap: n.itemSpacing, pad: [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft] };
  const fills = (n.fills || []).filter((f) => f.visible !== false).map((f) => {
    if (f.type === 'SOLID') return { solid: hex(f.color), a: r1((f.color.a ?? 1) * (f.opacity ?? 1) * 100) / 100 };
    if (f.type === 'IMAGE') return { image: f.imageRef, scale: f.scaleMode };
    if (f.type.startsWith('GRADIENT')) return { gradient: f.type, stops: f.gradientStops.map((s) => [hex(s.color), r1((s.color.a ?? 1) * 100) / 100, r1(s.position * 100)]), handles: f.gradientHandlePositions };
    return { type: f.type };
  });
  if (fills.length) o.fills = fills;
  const strokes = (n.strokes || []).filter((f) => f.visible !== false && f.type === 'SOLID');
  if (strokes.length && n.strokeWeight) o.stroke = { color: hex(strokes[0].color), w: n.strokeWeight };
  const fx = (n.effects || []).filter((e) => e.visible !== false);
  if (fx.length) o.effects = fx.map((e) => ({ type: e.type, r: e.radius, x: e.offset?.x, y: e.offset?.y, color: e.color ? hex(e.color) : undefined, a: e.color ? r1(e.color.a * 100) / 100 : undefined }));
  if (n.type === 'TEXT') {
    const s = n.style || {};
    o.text = n.characters;
    o.font = { family: s.fontFamily, weight: s.fontWeight, size: s.fontSize, lh: s.lineHeightPx ? r1(s.lineHeightPx) : null, ls: s.letterSpacing ? r1(s.letterSpacing) : 0,
      align: s.textAlignHorizontal, valign: s.textAlignVertical, case: s.textCase, italic: s.italic || undefined, deco: s.textDecoration, autoResize: s.textAutoResize };
    // mixed styles inside one text layer (bold word, other colour…)
    if (n.characterStyleOverrides && n.characterStyleOverrides.length && n.styleOverrideTable) {
      const runs = []; let cur = null;
      [...n.characters].forEach((ch, i) => {
        const k = n.characterStyleOverrides[i] || 0;
        if (!cur || cur.k !== k) { cur = { k, t: '' }; runs.push(cur); }
        cur.t += ch;
      });
      o.runs = runs.map(({ k, t }) => {
        const st = k ? n.styleOverrideTable[k] || {} : {};
        const fill = st.fills && st.fills[0] && st.fills[0].color ? hex(st.fills[0].color) : undefined;
        return { t, weight: st.fontWeight, size: st.fontSize, family: st.fontFamily, italic: st.italic, fill, deco: st.textDecoration };
      });
    }
  }
  if (n.children) o.children = n.children.map((c) => simplify(c, origin)).filter(Boolean);
  return o;
}
function outline(n, depth = 0, lines = []) {
  const pad = '  '.repeat(depth);
  const fill = (n.fills || []).map((f) => f.solid || (f.image ? `img:${f.image.slice(0, 8)}` : f.gradient ? 'gradient' : '')).filter(Boolean).join(' ');
  const font = n.font ? ` [${n.font.family} ${n.font.weight} ${n.font.size}/${n.font.lh ?? 'auto'}${n.font.ls ? ` ls${n.font.ls}` : ''} ${n.font.align || ''}${n.font.case && n.font.case !== 'ORIGINAL' ? ` ${n.font.case}` : ''}]` : '';
  const text = n.text ? ` "${n.text.replace(/\s+/g, ' ').slice(0, 80)}"` : '';
  lines.push(`${pad}${n.type} ${n.id} "${n.name}" @${n.x},${n.y} ${n.w}x${n.h}${fill ? ` fill:${fill}` : ''}${n.radius ? ` r${n.radius}` : ''}${n.rot ? ` rot${n.rot}` : ''}${font}${text}`);
  for (const c of n.children || []) outline(c, depth + 1, lines);
  return lines;
}

const { key, node } = parseUrl(url);
const out = path.resolve(ROOT, opt('out', path.join('design-src', 'figma', `${key}-${node.replace(':', '-')}`)));
fs.mkdirSync(out, { recursive: true });

if (cmd === 'fetch') {
  const scale = Number(opt('scale', 2));
  console.log(`Figma ${key} node ${node} -> ${path.relative(ROOT, out)}`);
  const j = await get(`/files/${key}/nodes?ids=${encodeURIComponent(node)}`);
  const doc = j.nodes[node] && j.nodes[node].document;
  if (!doc) throw new Error('Node not found in the file.');
  fs.writeFileSync(path.join(out, 'node.raw.json'), JSON.stringify(doc));
  const origin = doc.absoluteBoundingBox;
  const tree = simplify(doc, origin);
  fs.writeFileSync(path.join(out, 'tree.json'), JSON.stringify(tree, null, 1));
  fs.writeFileSync(path.join(out, 'outline.txt'), outline(tree).join('\n'));
  // sections = visible direct children, top to bottom (an LP frame is a vertical stack of blocks)
  const sections = (tree.children || []).filter((c) => c.w >= tree.w * 0.5).sort((a, b) => a.y - b.y)
    .map((c, i) => ({ n: i + 1, id: c.id, name: c.name, file: `render/${String(i + 1).padStart(2, '0')}-${slug(c.name)}.png`, x: c.x, y: c.y, w: c.w, h: c.h }));
  fs.writeFileSync(path.join(out, 'sections.json'), JSON.stringify({ frame: { id: tree.id, name: tree.name, w: tree.w, h: tree.h }, sections }, null, 1));
  const urls = await render(key, [tree.id, ...sections.map((s) => s.id)], 'png', scale);
  await download(urls[tree.id], path.join(out, 'render', '00-frame.png'));
  for (const s of sections) if (urls[s.id]) await download(urls[s.id], path.join(out, s.file));
  // image fills (photos placed in rectangles/frames), original resolution
  const refs = new Set();
  (function walk(n) { for (const f of n.fills || []) if (f.image) refs.add(f.image); (n.children || []).forEach(walk); })(tree);
  if (refs.size) {
    const fills = (await get(`/files/${key}/images`)).meta.images;
    for (const r of refs) if (fills[r]) await download(fills[r], path.join(out, 'fills', `${r}.png`));
  }
  const fonts = new Set();
  (function walk(n) { if (n.font) fonts.add(`${n.font.family} ${n.font.weight}${n.font.italic ? ' italic' : ''}`); for (const r of n.runs || []) if (r.family || r.weight) fonts.add(`${r.family || n.font.family} ${r.weight || n.font.weight}`); (n.children || []).forEach(walk); })(tree);
  fs.writeFileSync(path.join(out, 'fonts.txt'), [...fonts].sort().join('\n'));
  console.log(`frame "${tree.name}" ${tree.w}x${tree.h}, ${sections.length} sections, ${refs.size} image fills, fonts: ${[...fonts].join(', ')}`);
  console.log('next: read outline.txt + render/*.png, then export logos/icons/photos with: figma.mjs export <url> --ids …');
}

if (cmd === 'export') {
  const ids = String(opt('ids', '')).split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) throw new Error('--ids is required (layer ids from outline.txt, e.g. 12:34,12:40)');
  const format = ['jpg', 'svg'].includes(opt('format')) ? opt('format') : 'png';
  const scale = Math.min(4, Math.max(1, Number(opt('scale', 3))));
  let names = {};
  try {
    const tree = JSON.parse(fs.readFileSync(path.join(out, 'tree.json'), 'utf8'));
    (function walk(n) { names[n.id] = n.name; (n.children || []).forEach(walk); })(tree);
  } catch { names = {}; }
  const urls = await render(key, ids, format, scale);
  for (const id of ids) {
    if (!urls[id]) { console.log(`  ${id}: nothing to render (empty or hidden layer)`); continue; }
    const file = path.join(out, 'assets', `${slug(names[id] || id)}-${id.replace(/[:;]/g, '-')}.${format}`);
    await download(urls[id], file);
    console.log(`  ${id} -> ${path.relative(ROOT, file)}`);
  }
}
