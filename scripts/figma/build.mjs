// Figma frame -> "fx" HTML sections (real text) + assets + push manifest. Step 2 of the figma-lp-to-sections skill.
//
//   node scripts/figma/build.mjs <fetch-dir> <spec.json>
//
// <fetch-dir> is the output of `figma.mjs fetch` (needs node.raw.json + fills/). The spec says how the frame is cut and
// where every part goes (see .claude/skills/figma-lp-to-sections/reference/spec-format.md). For each "fx" part the
// script walks the Figma layers that fall inside [y0, y1) in paint order:
//   TEXT            -> real text (<p>/<h2>) with font, size, line height, spacing, colours, mixed styles, lists
//   simple shape    -> <div> with background / gradient / border / radius / shadow
//   layer w/o text  -> rendered by Figma as one PNG @3x (photos, icons, logos, masks, effects…)
//   frame with text -> its own background (colour, gradient or image fill) + its children
// Writes <fetch-dir>/build/<NN-name>.html, build/assets/*.png and build/manifest.json for push.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* optional */ }
const [dirArg, specArg] = process.argv.slice(2);
if (!dirArg || !specArg) { console.log('usage: node scripts/figma/build.mjs <fetch-dir> <spec.json>'); process.exit(1); }
const DIR = path.resolve(dirArg);
const spec = JSON.parse(fs.readFileSync(path.resolve(specArg), 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(DIR, 'node.raw.json'), 'utf8'));
const OUT = path.join(DIR, 'build');
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
const TOKEN = process.env.FIGMA_TOKEN;

const R0 = raw.absoluteBoundingBox; // frame origin
const FW = R0.width;
const asImage = new Set(spec.asImage || []); // layers forced to one picture (logos built from text + vectors…)
const skip = new Set(spec.skip || []);
const n2 = (v) => Math.round(v * 100) / 100;
const K = (v) => `calc(${n2(v)}*var(--k))`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rgba = (c, o = 1) => { const a = n2((c.a ?? 1) * o); const h = [c.r, c.g, c.b].map((v) => Math.round(v * 255)); return a >= 1 ? `#${h.map((v) => v.toString(16).padStart(2, '0')).join('')}` : `rgba(${h.join(',')},${a})`; };
const vis = (n) => n.visible !== false && (n.opacity ?? 1) > 0.001;
const fillsOf = (n) => (n.fills || []).filter((f) => f.visible !== false && (f.opacity ?? 1) > 0);
const hasText = (n) => n.type === 'TEXT' || (n.children || []).some((c) => vis(c) && hasText(c));
const FONT = { Inter: 'ff-inter', Poppins: 'ff-poppins', Montserrat: 'ff-montserrat', Caveat: 'ff-caveat', 'Libre Baskerville': 'ff-libre', 'Open Sans': 'ff-opensans',
  Roboto: 'ff-roboto', 'Bebas Neue': 'ff-bebas', 'DM Sans': 'ff-dmsans', 'Josefin Sans': 'ff-josefin', Raleway: 'ff-raleway', Imprima: 'ff-imprima' };
const FALLBACK = { 'Red Hat Display': 'ff-montserrat', InaiMathi: 'ff-inter', Lato: 'ff-inter' };
const STACK = { Alegreya: "Georgia,'Times New Roman',serif" };

function gradientCss(f, w, h) {
  const stops = f.gradientStops.map((s) => `${rgba(s.color, f.opacity ?? 1)} ${n2(s.position * 100)}%`).join(',');
  if (f.type === 'GRADIENT_LINEAR') {
    const [p0, p1] = f.gradientHandlePositions;
    const dx = (p1.x - p0.x) * w; const dy = (p1.y - p0.y) * h;
    return `linear-gradient(${n2((Math.atan2(dx, -dy) * 180) / Math.PI)}deg,${stops})`;
  }
  return `radial-gradient(ellipse at center,${stops})`;
}
const paintCss = (f, w, h) => (f.type === 'SOLID' ? rgba(f.color, f.opacity ?? 1) : f.type.startsWith('GRADIENT') ? gradientCss(f, w, h) : null);
function shadowCss(n) {
  return (n.effects || []).filter((e) => e.visible !== false && /SHADOW/.test(e.type))
    .map((e) => `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${K(e.offset.x)} ${K(e.offset.y)} ${K(e.radius)} ${K(e.spread || 0)} ${rgba(e.color)}`).join(',');
}
function radiusCss(n) {
  if (n.type === 'ELLIPSE') return '50%';
  if (n.rectangleCornerRadii) return n.rectangleCornerRadii.map(K).join(' ');
  return n.cornerRadius ? K(n.cornerRadius) : '';
}
/** A shape CSS can draw exactly. */
function simpleShape(n) {
  if (n.children && n.children.length) return false;
  if (!['RECTANGLE', 'ELLIPSE', 'FRAME', 'LINE', 'INSTANCE', 'COMPONENT'].includes(n.type)) return false;
  if (n.rotation && Math.abs(Math.abs((n.rotation * 180) / Math.PI) % 180) > 0.5) return false;
  const fl = fillsOf(n);
  if (fl.some((f) => f.type === 'IMAGE' || f.type === 'GRADIENT_ANGULAR' || f.type === 'GRADIENT_DIAMOND') || fl.length > 1) return false;
  if ((n.effects || []).some((e) => e.visible !== false && /BLUR/.test(e.type))) return false;
  if (n.type === 'LINE') return true;
  return fl.length > 0 || (n.strokes || []).length > 0;
}

// ---- text
function textHtml(n, x, y) {
  const s = n.style || {};
  const b = n.absoluteBoundingBox;
  const fill = fillsOf(n)[0];
  const color = fill ? (fill.type === 'SOLID' ? rgba(fill.color, (fill.opacity ?? 1) * (n.opacity ?? 1)) : rgba(fill.gradientStops[0].color)) : '#000';
  const fam = s.fontFamily;
  const cls = ['a', FONT[fam] || FALLBACK[fam] || ''].filter(Boolean);
  const auto = s.textAutoResize === 'WIDTH_AND_HEIGHT';
  if (auto) cls.push('nw');
  const st = [`left:${K(x)}`, `top:${K(y)}`, `font-size:${K(STACK[fam] ? s.fontSize * 0.92 : s.fontSize)}`, `line-height:${K(s.lineHeightPx || s.fontSize * 1.2)}`, `font-weight:${s.fontWeight || 400}`, `color:${color}`];
  // a little slack so slightly wider web glyphs do not wrap earlier than in Figma
  const slack = auto ? 0 : s.textAlignHorizontal === 'LEFT' || !s.textAlignHorizontal ? Math.max(3, b.width * 0.06) : Math.max(2, b.width * 0.02);
  const align = { CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' }[s.textAlignHorizontal] || 'left';
  if (align === 'center') st[0] = `left:${K(x - slack / 2)}`;
  if (align === 'right') st[0] = `left:${K(x - slack)}`;
  st.push(`width:${K(b.width + slack)}`);
  if (align !== 'left') st.push(`text-align:${align}`);
  if (s.letterSpacing) st.push(`letter-spacing:${K(s.letterSpacing)}`);
  if (s.italic) st.push('font-style:italic');
  if (s.textCase === 'UPPER') st.push('text-transform:uppercase');
  if (s.textCase === 'LOWER') st.push('text-transform:lowercase');
  if (s.textCase === 'TITLE') st.push('text-transform:capitalize');
  if (s.textDecoration === 'UNDERLINE') st.push('text-decoration:underline');
  if (s.textDecoration === 'STRIKETHROUGH') st.push('text-decoration:line-through');
  if (!FONT[fam] && !FALLBACK[fam]) st.push(`font-family:'${fam}',${STACK[fam] || 'Arial,sans-serif'}`);
  const ts = shadowCss({ effects: (n.effects || []).filter((e) => e.type === 'DROP_SHADOW') });
  if (ts) st.push(`text-shadow:${ts.replace(/ calc\([^)]*\) (#|rgba)/, ' $1')}`);
  if (s.textAutoResize === 'NONE' && s.textAlignVertical && s.textAlignVertical !== 'TOP') {
    st.push(`height:${K(b.height)}`, 'display:flex', 'flex-direction:column', `justify-content:${s.textAlignVertical === 'CENTER' ? 'center' : 'flex-end'}`);
  }
  // runs (mixed styles)
  const chars = Array.from(n.characters || ''); // Figma style overrides count code points, not UTF-16 units
  const ov = n.characterStyleOverrides || [];
  const table = n.styleOverrideTable || {};
  let html = '';
  let i = 0;
  while (i < chars.length) {
    const k = ov[i] || 0;
    let j = i;
    while (j < chars.length && (ov[j] || 0) === k) j++;
    const t = esc(chars.slice(i, j).join(''));
    const o = k ? table[k] || {} : {};
    const rs = [];
    if (o.fontWeight && o.fontWeight !== s.fontWeight) rs.push(`font-weight:${o.fontWeight}`);
    if (o.fontSize && o.fontSize !== s.fontSize) rs.push(`font-size:${K(o.fontSize)}`);
    if (o.italic !== undefined && o.italic !== s.italic) rs.push(`font-style:${o.italic ? 'italic' : 'normal'}`);
    if (o.fontFamily && o.fontFamily !== fam) rs.push(`font-family:'${o.fontFamily}',${STACK[o.fontFamily] || 'Arial,sans-serif'}`);
    const of = o.fills && o.fills.find((f) => f.visible !== false);
    if (of && of.type === 'SOLID') rs.push(`color:${rgba(of.color, of.opacity ?? 1)}`);
    if (o.textDecoration === 'UNDERLINE') rs.push('text-decoration:underline');
    if (o.textDecoration === 'STRIKETHROUGH') rs.push('text-decoration:line-through');
    html += rs.length ? `<span style="${rs.join(';')}">${t}</span>` : t;
    i = j;
  }
  const lines = html.split('\n');
  const types = n.lineTypes || [];
  let body;
  if (types.some((t) => t && t !== 'NONE')) {
    let open = null;
    body = '';
    lines.forEach((l, li) => {
      const t = types[li] || 'NONE';
      const tag = t === 'ORDERED' ? 'ol' : t === 'UNORDERED' ? 'ul' : null;
      if (open && open !== tag) { body += `</${open}>`; open = null; }
      if (tag && !open) { body += `<${tag} style="margin:0;padding-left:1.25em">`; open = tag; }
      body += tag ? `<li>${l || '&nbsp;'}</li>` : `${l}${li < lines.length - 1 ? '<br>' : ''}`;
    });
    if (open) body += `</${open}>`;
  } else body = lines.join('<br>');
  const heading = (s.fontSize >= 18 && (s.fontWeight || 400) >= 600) || s.fontSize >= 26;
  const tag = body.includes('<ul') || body.includes('<ol') ? 'div' : heading ? 'h2' : 'p'; // lists cannot live inside <p>
  return `<${tag} class="${cls.join(' ')}" style="${st.join(';')}">${body}</${tag}>`;
}

// ---- shapes
function shapeHtml(n, x, y) {
  const b = n.absoluteBoundingBox;
  const st = [`left:${K(x)}`, `top:${K(y)}`, `width:${K(b.width)}`];
  if (n.type === 'LINE') {
    const sk = (n.strokes || []).find((f) => f.visible !== false);
    st.push(`height:${K(n.strokeWeight || 1)}`, `background:${sk ? paintCss(sk, b.width, 1) : '#000'}`);
    return `<div class="a" style="${st.join(';')}"></div>`;
  }
  st.push(`height:${K(b.height)}`);
  const f = fillsOf(n)[0];
  if (f) st.push(`background:${paintCss(f, b.width, b.height)}`);
  const sk = (n.strokes || []).find((s) => s.visible !== false && s.type === 'SOLID');
  if (sk && n.strokeWeight) st.push(`border:${K(n.strokeWeight)} solid ${rgba(sk.color, sk.opacity ?? 1)}`, 'box-sizing:border-box');
  const r = radiusCss(n);
  if (r) st.push(`border-radius:${r}`);
  const sh = shadowCss(n);
  if (sh) st.push(`box-shadow:${sh}`);
  if ((n.opacity ?? 1) < 1) st.push(`opacity:${n2(n.opacity)}`);
  return `<div class="a" style="${st.join(';')}"></div>`;
}

// ---- walk one cut
const exports = new Map(); // node id -> { file, box }
function want(n, y0, y1) {
  const b = n.absoluteRenderBounds || n.absoluteBoundingBox;
  if (!b) return false;
  const top = b.y - R0.y; const bot = top + b.height;
  return bot > y0 && top < y1 && b.width > 0 && b.height > 0;
}
/** clip-path for a box (section coords) so it shows only inside clip (also section coords) */
function clipCss(box, clip) {
  if (!clip) return '';
  const t = Math.max(0, clip.y - box.y); const l = Math.max(0, clip.x - box.x);
  const b = Math.max(0, box.y + box.h - (clip.y + clip.h)); const rr = Math.max(0, box.x + box.w - (clip.x + clip.w));
  if (t + l + b + rr < 0.3) return '';
  if (t >= box.h || l >= box.w || b >= box.h || rr >= box.w) return ';display:none';
  return `;clip-path:inset(${K(t)} ${K(rr)} ${K(b)} ${K(l)}${clip.r ? ` round ${K(clip.r)}` : ''})`;
}
function walk(n, y0, y1, out, assets, clip = null) {
  if (!vis(n) || skip.has(n.id) || !want(n, y0, y1)) return;
  const b = n.absoluteBoundingBox;
  const x = b.x - R0.x; const y = b.y - R0.y - y0;
  const rotated = n.rotation && Math.abs((n.rotation * 180) / Math.PI) > 0.5;
  const withClip = (html, box) => { const c = clipCss(box, clip); return c ? html.replace(/style="([^"]*)"/, (m, v) => `style="${v}${c}"`) : html; };
  if (!asImage.has(n.id) && n.type === 'TEXT' && !rotated) { out.push(textHtml(n, x, y)); return; }
  if (!asImage.has(n.id) && !hasText(n) && simpleShape(n)) { out.push(withClip(shapeHtml(n, x, y), { x, y, w: b.width, h: b.height })); return; }
  if (asImage.has(n.id) || !hasText(n) || rotated) {
    // Figma renders the layer unclipped: union of bounding box and render bounds (shadows, or bounds clipped by the frame)
    const rr0 = n.absoluteRenderBounds || b;
    const ux = Math.min(rr0.x, b.x); const uy = Math.min(rr0.y, b.y);
    const rb = { x: ux, y: uy, width: Math.max(rr0.x + rr0.width, b.x + b.width) - ux, height: Math.max(rr0.y + rr0.height, b.y + b.height) - uy };
    const file = `n${n.id.replace(/[^0-9a-z]+/gi, '-')}.png`;
    exports.set(n.id, { file, w: rb.width });
    assets.add(file);
    const alt = /^(image|rectangle|group|frame|vector|ellipse|line|union|subtract|mask|layer|\d)/i.test(n.name) ? '' : n.name.slice(0, 120);
    out.push(`<img class="a" src="${file}" alt="${esc(alt)}" loading="lazy" decoding="async" style="left:${K(rb.x - R0.x)};top:${K(rb.y - R0.y - y0)};width:${K(rb.width)};height:${K(rb.height)}${clipCss({ x: rb.x - R0.x, y: rb.y - R0.y - y0, w: rb.width, h: rb.height }, clip)}">`);
    return;
  }
  // container holding text: own background, then children in paint order
  const own = fillsOf(n);
  const st = [`left:${K(x)}`, `top:${K(y)}`, `width:${K(b.width)}`, `height:${K(b.height)}`];
  const r = radiusCss(n);
  if (r) st.push(`border-radius:${r}`, 'overflow:hidden');
  const sh = shadowCss(n);
  if (sh) st.push(`box-shadow:${sh}`);
  const img = own.find((f) => f.type === 'IMAGE');
  if (img && fs.existsSync(path.join(DIR, 'fills', `${img.imageRef}.png`))) {
    const file = `f${img.imageRef.slice(0, 12)}.png`;
    fs.copyFileSync(path.join(DIR, 'fills', `${img.imageRef}.png`), path.join(OUT, 'assets', file));
    assets.add(file);
    out.push(`<img class="a" src="${file}" alt="" loading="lazy" decoding="async" style="${st.join(';')};object-fit:${img.scaleMode === 'FIT' ? 'contain' : 'cover'}">`);
  } else {
    const paint = own.filter((f) => f.type !== 'IMAGE').map((f) => paintCss(f, b.width, b.height)).filter(Boolean);
    const sk = (n.strokes || []).find((s) => s.visible !== false && s.type === 'SOLID');
    if (paint.length || sk || sh) {
      if (paint.length) st.push(`background:${paint.reverse().join(',')}`);
      if (sk && n.strokeWeight) st.push(`border:${K(n.strokeWeight)} solid ${rgba(sk.color, sk.opacity ?? 1)}`, 'box-sizing:border-box');
      if ((n.opacity ?? 1) < 1) st.push(`opacity:${n2(n.opacity)}`);
      out.push(`<div class="a" style="${st.join(';')}"></div>`);
    }
  }
  // children are clipped to this frame when it clips content (intersected with any outer clip)
  let inner = clip;
  if (n.clipsContent) {
    const me = { x, y, w: b.width, h: b.height, r: n.cornerRadius || 0 };
    inner = clip ? (() => { const x1 = Math.max(me.x, clip.x); const y1 = Math.max(me.y, clip.y); return { x: x1, y: y1, r: me.r || clip.r, w: Math.max(0, Math.min(me.x + me.w, clip.x + clip.w) - x1), h: Math.max(0, Math.min(me.y + me.h, clip.y + clip.h) - y1) }; })() : me;
  }
  for (const c of n.children || []) walk(c, y0, y1, out, assets, inner);
}

// ---- Figma renders
async function renderAll() {
  if (!exports.size) return;
  if (!TOKEN) throw new Error('FIGMA_TOKEN missing (.env)');
  const key = spec.fileKey;
  const todo = [...exports].filter(([, e]) => !fs.existsSync(path.join(OUT, 'assets', e.file)));
  const byScale = new Map();
  for (const [id, e] of todo) { const sc = Math.min(3, Math.max(1, Math.floor((1440 / Math.max(1, e.w)) * 10) / 10)); if (!byScale.has(sc)) byScale.set(sc, []); byScale.get(sc).push(id); }
  for (const [sc, ids] of byScale) {
    for (let i = 0; i < ids.length; i += 40) {
      const batch = ids.slice(i, i + 40);
      let j;
      for (let t = 0; t < 4; t++) {
        const r = await fetch(`https://api.figma.com/v1/images/${key}?ids=${encodeURIComponent(batch.join(','))}&format=png&scale=${sc}`, { headers: { 'X-Figma-Token': TOKEN } });
        if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 20000)); continue; }
        if (!r.ok) throw new Error(`Figma render ${r.status}`);
        j = await r.json();
        break;
      }
      for (const id of batch) {
        const u = j && j.images[id];
        if (!u) { console.log(`  ! ${id} rendered empty`); continue; }
        const r = await fetch(u);
        fs.writeFileSync(path.join(OUT, 'assets', exports.get(id).file), Buffer.from(await r.arrayBuffer()));
      }
      process.stdout.write('.');
    }
  }
  console.log();
}

// ---- build every part
const rootBg = fillsOf(raw).map((f) => paintCss(f, FW, raw.absoluteBoundingBox.height)).filter(Boolean)[0] || '#ffffff';
const htmlParts = [];
let nn = 0;
function buildFx(p) {
  const out = []; const assets = new Set();
  for (const c of raw.children || []) walk(c, p.y0, p.y1, out, assets);
  const cls = `s-${p.slug || p.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24)}`;
  const html = `<div class="fx ${cls}" style="--k:calc(100cqw/${n2(FW)});aspect-ratio:${n2(FW)}/${n2(p.y1 - p.y0)}">\n<style>.${cls}{background:${p.bg || rootBg};color:#000}.${cls} .a{margin:0}.${cls} h2,.${cls} p{font-weight:inherit}</style>\n${out.join('\n')}\n</div>\n`;
  const file = `${String(++nn).padStart(2, '0')}-${cls.slice(2)}.html`;
  fs.writeFileSync(path.join(OUT, file), html);
  if (assets.size > 30) console.log(`  ! ${p.name}: ${assets.size} assets (max 30) — cut this part in two or add logo groups to "asImage"`);
  // text that crosses the cut gets clipped: warn
  (function chk(n) {
    if (!vis(n)) return;
    if (n.type === 'TEXT' && want(n, p.y0, p.y1)) {
      const t = n.absoluteBoundingBox.y - R0.y; const bt = t + n.absoluteBoundingBox.height;
      if (t < p.y0 - 0.5 || bt > p.y1 + 0.5) console.log(`  ! ${p.name}: text "${(n.characters || '').slice(0, 30)}" crosses the cut (${n2(t)}–${n2(bt)})`);
    }
    (n.children || []).forEach(chk);
  })(raw);
  htmlParts.push({ p, file, assets });
  return { name: p.name, type: 'html', file, assets: [...assets].map((a) => `assets/${a}`), ...(p.mt ? { mt: p.mt } : {}) };
}
function buildImage(p) {
  const files = [];
  for (const id of p.ids) {
    const n = (function find(x) { if (x.id === id) return x; for (const c of x.children || []) { const r = find(c); if (r) return r; } return null; })(raw);
    if (!n) throw new Error(`${p.name}: node ${id} not found`);
    const file = `n${id.replace(/[^0-9a-z]+/gi, '-')}.png`;
    exports.set(id, { file, w: (n.absoluteRenderBounds || n.absoluteBoundingBox).width });
    files.push({ file: `assets/${file}`, alt: p.alt || '' });
  }
  return { name: p.name, type: 'image', layout: p.layout || 'stack', images: files };
}
const conv = (p) => (p.type === 'fx' ? buildFx(p) : p.type === 'image' ? buildImage(p) : p);

const manifest = { figma: '..', templates: [], page: spec.page ? { ...spec.page, sections: [] } : undefined };
for (const t of spec.templates || []) manifest.templates.push({ name: t.name, sections: t.sections.map(conv) });
if (spec.page) manifest.page.sections = spec.page.sections.map((s) => (typeof s.template === 'number' || s.type === 'promo' || s.type === 'block' ? s : conv(s)));
await renderAll();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
const total = htmlParts.reduce((a, h) => a + h.assets.size, 0);
console.log(`built ${htmlParts.length} HTML sections, ${exports.size} rendered layers, ${total} asset uses -> ${path.relative(ROOT, OUT)}`);
for (const h of htmlParts) console.log(`  ${h.file}  ${h.assets.size} assets  ${Math.round(fs.statSync(path.join(OUT, h.file)).size / 1024)} KB`);
