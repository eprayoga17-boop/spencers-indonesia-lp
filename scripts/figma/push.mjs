// Sends converted sections to the local admin as a DRAFT, through the normal admin API (same sanitiser and image
// pipeline as uploads in the editor). Nothing goes live until someone presses "Publikasikan".
//
//   node scripts/figma/push.mjs <manifest.json> [--base http://localhost:3000]
//
// manifest.json (paths relative to the manifest) — v1 below; v2 = { "templates": [{ "name", "sections" }],
// "page": { "slug", "title", "sections": [{ "template": 0 }, { "type": "promo", "part": "banner" }, …] } } (what build.mjs writes):
// {
//   "target": { "template": "MealBlend Men 1 · Hero s/d Testimoni" }   // new template  — or —
//   "target": { "page": "slug-yang-sudah-ada" },                        // append to an existing page
//   "sections": [
//     { "name": "Hero", "type": "html", "file": "html/01-hero.html", "assets": ["assets/hero-bg.png", "assets/logo.png"] },
//     { "name": "Testimoni foto", "type": "image", "layout": "stack", "images": [{ "file": "assets/testi.png", "alt": "…", "href": "" }] },
//     { "name": "FAQ", "type": "block", "kind": "faq", "props": { "title": "…", "items": [{ "q": "…", "a": "<p>…</p>" }] } }
//   ]
// }
// HTML refers to its assets by bare file name (src="hero-bg.png"); the server swaps in the uploaded URLs.
// Login: ADMIN_EMAIL / ADMIN_PASSWORD from the environment, or the local test account in data/secrets/admin-credentials.txt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* optional */ }
const args = process.argv.slice(2);
const manifestPath = args.find((a) => !a.startsWith('--'));
const base = (() => { const i = args.indexOf('--base'); return i >= 0 ? args[i + 1] : `http://localhost:${process.env.PORT || 3000}`; })();
if (!manifestPath) { console.log('usage: node scripts/figma/push.mjs <manifest.json> [--base http://localhost:3000]'); process.exit(1); }
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) { console.error('push.mjs only talks to a local dev server (localhost).'); process.exit(1); }

const dir = path.dirname(path.resolve(manifestPath));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
const fileBlob = (rel) => {
  const p = path.resolve(dir, rel);
  const ext = p.split('.').pop().toLowerCase();
  if (!MIME[ext]) throw new Error(`${rel}: only PNG/JPG/WebP/GIF/AVIF can be uploaded (SVG is not allowed — export vectors as PNG @3x)`);
  return [new Blob([fs.readFileSync(p)], { type: MIME[ext] }), path.basename(p)];
};

// ---- login (local test account)
function credentials() {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) return [process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD];
  const f = path.join(ROOT, 'data', 'secrets', 'admin-credentials.txt');
  if (!fs.existsSync(f)) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (local admin) in the environment.');
  // local dummy admin; the file holds its password as the third word of the last line
  return [process.env.ADMIN_EMAIL || 'admin@mealblend.test', fs.readFileSync(f, 'utf8').trim().split('\n').pop().split(/\s+/)[2]];
}
const [email, password] = credentials();
const login = await fetch(`${base}/admin/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) });
if (login.status !== 303) throw new Error(`Login failed (${login.status}). Is the dev server running at ${base}?`);
const cookie = login.headers.get('set-cookie').split(';')[0];
const csrf = (await (await fetch(`${base}/admin`, { headers: { cookie } })).text()).match(/csrf-token" content="([^"]+)/)[1];
async function call(method, url, body) {
  const headers = { cookie, 'x-csrf-token': csrf, accept: 'application/json' };
  let payload = body;
  if (body && !(body instanceof FormData)) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(`${base}${url}`, { method, headers, body: payload });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url}: ${j.error || r.status}`);
  return j;
}

// ---- one section, appended at the end of a document (page or template)
async function pushSection(api, s, label, templateIds) {
  let out;
  if (s.type === 'html') {
    const fd = new FormData();
    fd.append('type', 'html');
    fd.append('name', s.name);
    fd.append('code', fs.readFileSync(path.resolve(dir, s.file), 'utf8'));
    if (s.mt) fd.append('mt', String(s.mt));
    for (const a of s.assets || []) fd.append('assets', ...fileBlob(a));
    out = await call('POST', `${api}/sections`, fd);
  } else if (s.type === 'image') {
    const fd = new FormData();
    fd.append('type', 'image');
    fd.append('name', s.name);
    fd.append('layout', s.layout === 'slider' ? 'slider' : 'stack');
    if (s.mt) fd.append('mt', String(s.mt));
    fd.append('items', JSON.stringify(s.images.map((im, k) => ({ file: k, alt: im.alt || '', href: im.href || '' }))));
    for (const im of s.images) fd.append('images', ...fileBlob(im.file));
    out = await call('POST', `${api}/sections`, fd);
  } else if (s.type === 'block') {
    const before = await call('GET', api);
    const ids = new Set(before.page.sections.map((x) => x.id));
    out = await call('POST', `${api}/sections`, { type: 'block', kind: s.kind });
    const added = out.page.sections.find((x) => !ids.has(x.id));
    out = await call('PATCH', `${api}/sections/${added.id}`, { name: s.name, props: { ...added.props, ...(s.props || {}) }, ...(s.mt ? { mt: s.mt } : {}) });
  } else if (s.type === 'promo') {
    out = await call('POST', `${api}/sections`, { type: 'promo', part: s.part === 'bar' ? 'bar' : 'banner' });
  } else if (typeof s.template === 'number' || typeof s.template === 'string') {
    const id = typeof s.template === 'number' ? templateIds[s.template] : s.template;
    out = await call('POST', `${api}/sections`, { type: 'template', template: id });
  } else throw new Error(`${label}: unknown type "${s.type}"`);
  console.log(`  ok ${label}${out.notes && out.notes.length ? `  (notes: ${out.notes.join('; ')})` : ''}`);
}

// ---- manifest v2: { templates: [{ name, sections }], page: { slug, title, sections: [… { template: <index> } …] } }
// ---- manifest v1: { target: { template | page }, sections }
let editUrl; let previewUrl;
const templateIds = [];
for (const t of manifest.templates || []) {
  const r = await call('POST', '/admin/api/templates', { name: String(t.name).slice(0, 160) });
  templateIds.push(r.id);
  console.log(`template "${t.name}" -> ${r.id}`);
  for (const [i, s] of t.sections.entries()) await pushSection(`/admin/api/templates/${r.id}`, s, `${i + 1}. ${s.name || s.type}`, templateIds);
  editUrl = `/admin/templates/${r.id}`; previewUrl = `/admin/preview-template/${r.id}`;
}
const target = manifest.page || (manifest.target && manifest.target.page ? { slug: manifest.target.page, sections: manifest.sections } : null);
if (target) {
  const exists = await fetch(`${base}/admin/api/pages/${target.slug}`, { headers: { cookie, accept: 'application/json' } });
  if (exists.status === 404) {
    await call('POST', '/admin/api/pages', { slug: target.slug, title: target.title || target.slug });
    console.log(`page /${target.slug} created`);
  }
  for (const [i, s] of target.sections.entries()) await pushSection(`/admin/api/pages/${target.slug}`, s, `page ${i + 1}. ${s.name || s.type || 'template'}`, templateIds);
  editUrl = `/admin/pages/${target.slug}`; previewUrl = `/admin/preview/${target.slug}`;
} else if (manifest.target && manifest.target.template) {
  const r = await call('POST', '/admin/api/templates', { name: String(manifest.target.template).slice(0, 160) });
  for (const [i, s] of manifest.sections.entries()) await pushSection(`/admin/api/templates/${r.id}`, s, `${i + 1}. ${s.name}`, templateIds);
  editUrl = `/admin/templates/${r.id}`; previewUrl = `/admin/preview-template/${r.id}`;
}
if (!editUrl) throw new Error('manifest needs "templates", "page" or "target".');
console.log(`\nDraft ready. Review: ${base}${editUrl}\nPreview: ${base}${previewUrl}\nNothing is live until "Publikasikan".`);

// ---- --compare: Figma render (left) next to the draft preview (right), both 414 px wide, for a visual check
if (args.includes('--compare')) {
  const figmaDir = manifest.figma && path.resolve(dir, manifest.figma);
  const frame = figmaDir && path.join(figmaDir, 'render', '00-frame.png');
  if (!frame || !fs.existsSync(frame)) throw new Error('--compare needs "figma": "<fetch output dir>" in the manifest (with render/00-frame.png).');
  const { createRequire } = await import('node:module');
  const req = createRequire(path.join(ROOT, 'package.json'));
  const sharp = req('sharp');
  const { default: puppeteer } = await import(new URL(`file:///${path.join(ROOT, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js').replace(/\\/g, '/')}`));
  const chrome = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  const tab = await browser.newPage();
  await tab.setViewport({ width: 414, height: 896 });
  await tab.setCookie({ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: base });
  await tab.goto(`${base}${previewUrl}`, { waitUntil: 'networkidle0' });
  const H = await tab.evaluate(() => document.documentElement.scrollHeight);
  const parts = [];
  for (let y = 0; y < H; y += 896) {
    await tab.evaluate((v) => window.scrollTo(0, v), y);
    await new Promise((ok) => setTimeout(ok, 500));
    parts.push({ input: await tab.screenshot(), top: await tab.evaluate(() => window.scrollY) });
  }
  await browser.close();
  const ours = await sharp({ create: { width: 414, height: H, channels: 3, background: '#fff' } }).composite(parts.map((p) => ({ input: p.input, left: 0, top: p.top }))).png().toBuffer();
  const fig = await sharp(frame).resize({ width: 414 }).png().toBuffer();
  const fh = (await sharp(fig).metadata()).height;
  const file = path.join(figmaDir, 'compare.png');
  await sharp({ create: { width: 414 * 2 + 16, height: Math.max(H, fh), channels: 3, background: '#888' } })
    .composite([{ input: fig, left: 0, top: 0 }, { input: ours, left: 430, top: 0 }]).png().toFile(file);
  console.log(`compare: ${path.relative(ROOT, file)}  (left = Figma, right = website draft)`);
}
