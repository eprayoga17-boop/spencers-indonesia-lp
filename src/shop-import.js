// Import products from a Berdu export (JSON produced from the Berdu admin, see HANDOFF.md).
// Runs in small steps (a few products per request) so image downloads never hit a serverless time limit.
import crypto from 'node:crypto';
import path from 'node:path';
import { fs } from './storage.js';
import { ROOT } from './store.js';
import * as shop from './shop.js';
import { processImage } from './admin/media.js';

const JOB_DIR = path.join(ROOT, 'data', 'shop', 'import-jobs');
const IMAGE_HOSTS = new Set(['bdsingapore.com', 'berducdn.com']);
const MAX_IMAGE = 15 * 1024 * 1024;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Draft.js raw content (Berdu descriptions) -> simple HTML. Only headings, bold and italic are used in Berdu data. */
export function draftToHtml(raw) {
  if (!raw || !Array.isArray(raw.blocks)) return typeof raw === 'string' ? raw : '';
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const b of raw.blocks) {
    const text = String(b.text || '');
    const marks = Array.from({ length: text.length }, () => new Set());
    for (const r of b.inlineStyleRanges || []) {
      const tag = r.style === 'BOLD' ? 'strong' : r.style === 'ITALIC' ? 'em' : r.style === 'UNDERLINE' ? 'u' : r.style === 'STRIKETHROUGH' ? 's' : null;
      if (!tag) continue;
      for (let i = r.offset; i < Math.min(text.length, r.offset + r.length); i++) marks[i].add(tag);
    }
    let html = '';
    let open = [];
    for (let i = 0; i <= text.length; i++) {
      const want = i < text.length ? [...marks[i]].sort() : [];
      if (want.join() !== open.join()) {
        html += open.slice().reverse().map((t) => `</${t}>`).join('') + want.map((t) => `<${t}>`).join('');
        open = want;
      }
      if (i < text.length) html += esc(text[i]);
    }
    html = html.replace(/\n/g, '<br>');
    const type = b.type || 'unstyled';
    const li = type === 'unordered-list-item' ? 'ul' : type === 'ordered-list-item' ? 'ol' : null;
    if (li) {
      if (list !== li) { closeList(); out.push(`<${li}>`); list = li; }
      out.push(`<li>${html}</li>`);
      continue;
    }
    closeList();
    if (type === 'header-one' || type === 'header-two') out.push(`<h2>${html}</h2>`);
    else if (type === 'header-three' || type === 'header-four') out.push(`<h3>${html}</h3>`);
    else out.push(`<p>${html || '<br>'}</p>`);
  }
  closeList();
  return out.join('');
}

export function imageUrl(u) {
  let s = String(u || '').replace(/#.*$/, '');
  if (s.startsWith('cdn://')) s = `https://bdsingapore.com/${s.slice(6)}`;
  try {
    const url = new URL(s);
    return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname) ? url.href : '';
  } catch {
    return '';
  }
}

/** One Berdu product -> admin input for shop.buildProduct (images still remote URLs). */
export function mapProduct(bp, catByBerduId, now = Date.now()) {
  const priceOf = (vid) => bp.prices.find((x) => x.variationID === vid);
  const weightOf = (vid) => bp.weights.find((x) => x.variationID === vid);
  const plain = bp.prices.filter((x) => !x.variationID.startsWith('$'));
  const tiers = bp.prices.filter((x) => x.variationID.startsWith('$minCount:'))
    .map((x) => ({ min: Number(x.variationID.split(':')[1]), price: x.price }));
  const base = priceOf('') || null;
  const minTier = tiers.find((t) => t.min <= 1);
  const price = base ? base.price : plain.length ? Math.min(...plain.map((x) => x.price)) : minTier ? minTier.price : 0;
  const compare = base && base.salePrice && base.salePrice > base.price ? base.salePrice : 0;
  const w = weightOf('') || bp.weights[0] || null;

  const groups = (bp.variations || []).map((v) => ({
    id: `g${v.ID}`,
    name: String(v.name || '').trim() || 'Variasi',
    values: v.options.map((o) => {
      const vid = `${v.ID}:${o.ID}`;
      const pr = priceOf(vid);
      const wt = weightOf(vid);
      return {
        id: String(o.ID), name: String(o.name || '').trim() || `Pilihan ${o.ID}`,
        price: pr ? pr.price : null, comparePrice: pr && pr.salePrice && pr.salePrice > pr.price ? pr.salePrice : null,
        weight: wt ? wt.weight : null, remoteImage: imageUrl(o.image),
      };
    }),
  })).filter((g) => g.values.length);

  // Stock: Berdu 0 = not tracked, 1 = tracked + can still be bought when empty, 2 = tracked.
  const perValue = bp.stocks.filter((s) => s.variationID && /^\d+:\d+$/.test(s.variationID));
  let stockAxis = null;
  if (perValue.length) {
    stockAxis = `g${perValue[0].variationID.split(':')[0]}`;
    const g = groups.find((x) => x.id === stockAxis);
    if (g) for (const val of g.values) val.stock = (perValue.find((s) => s.variationID === `${stockAxis.slice(1)}:${val.id}`) || {}).stock ?? 0;
    else stockAxis = null;
  }
  const shared = bp.stocks.find((s) => !s.variationID);
  const pub = Number(bp.publishTime) || 0;
  const visibility = new Date(pub).getUTCFullYear() >= 2100 ? 'hidden' : bp.unlisted ? 'link' : pub > now ? 'scheduled' : 'public';
  const cat = catByBerduId.get(bp.categoryID);
  return {
    name: String(bp.name || '').trim() || '(tanpa nama)',
    slug: bp.slug || '',
    type: bp.type === 2 ? 'digital' : 'physical',
    description: draftToHtml(bp.description),
    remoteImages: (bp.pictures || []).map(imageUrl).filter(Boolean),
    categories: cat ? [cat] : [],
    price, comparePrice: compare, capitalPrice: base && base.capitalPrice ? base.capitalPrice : 0,
    wholesale: tiers.filter((t) => t.min >= 2),
    minOrder: bp.minPurchaseCount || 1, maxOrder: bp.maxPurchaseCount || 0,
    sku: String(bp.sku || '').trim(),
    trackStock: bp.stockManagement !== 0,
    backorder: bp.stockManagement === 1,
    stock: shared ? shared.stock : 0,
    weight: w ? w.weight || 0 : 0,
    dims: w ? { l: w.dy || 0, w: w.dx || 0, h: w.dz || 0 } : { l: 0, w: 0, h: 0 },
    seo: { title: bp.seoTitle || '', description: bp.seoDescription || '', noindex: bp.seoIndex === false },
    visibility, publishAt: visibility === 'scheduled' ? new Date(pub).toISOString() : '',
    tags: Array.isArray(bp.tags) ? bp.tags.map(String) : [],
    note: '',
    variants: groups.length ? { options: groups, stockAxis } : null,
    berduId: bp.id,
    createdAt: bp.createdAt ? new Date(Number(bp.createdAt)).toISOString() : null,
  };
}

// ---------------------------------------------------------------- jobs
const jobFile = (id) => path.join(JOB_DIR, `${id}.json`);
const JOB_ID = /^[a-f0-9]{16}$/;

/** Parses an uploaded export and stores it as a job. -> summary for the confirm dialog */
export async function createJob(text, actor) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new shop.ShopError('File bukan JSON yang valid.');
  }
  if (!data || data.source !== 'berdu' || !Array.isArray(data.products)) throw new shop.ShopError('Format tidak dikenal. Gunakan file export produk Berdu.');
  if (data.products.length > 5000) throw new shop.ShopError('Maksimal 5.000 produk per import.');
  const id = crypto.randomBytes(8).toString('hex');
  const job = { id, createdAt: new Date().toISOString(), by: actor, store: String(data.store || ''), categories: (data.categories || []).map((c) => ({ id: String(c.id), name: String(c.name || '').trim() })).filter((c) => c.name), products: data.products, images: {} };
  await fs.mkdir(JOB_DIR, { recursive: true });
  await fs.writeFile(jobFile(id), JSON.stringify(job));
  const current = await shop.loadProducts();
  const known = new Set(current.products.map((p) => p.source && p.source.berduId).filter(Boolean));
  return { job: id, store: job.store, total: job.products.length, categories: job.categories.map((c) => c.name), existing: job.products.filter((p) => known.has(p.id)).length };
}

async function readJob(id) {
  if (!JOB_ID.test(id)) throw new shop.ShopError('Import tidak ditemukan.', 404);
  try {
    return JSON.parse(await fs.readFile(jobFile(id), 'utf8'));
  } catch {
    throw new shop.ShopError('Import tidak ditemukan atau sudah selesai.', 404);
  }
}

async function download(url, cache) {
  if (cache[url]) return cache[url];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'error' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX_IMAGE) throw new Error('gambar terlalu besar');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_IMAGE) throw new Error('gambar terlalu besar');
    const img = await processImage(buf, 'products');
    cache[url] = { src: img.src, ...(img.ext ? { ext: img.ext } : {}), iw: img.iw, ih: img.ih };
    return cache[url];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Imports products [offset, offset+size). mode: 'skip' keeps products imported before, 'update' overwrites them.
 * -> { next, total, created, updated, skipped, errors[] } (next = null when finished; the job is deleted then)
 */
export async function runStep(id, { offset = 0, size = 8, mode = 'skip', images = true, actor = null } = {}) {
  const job = await readJob(id);
  const slice = job.products.slice(offset, offset + size);
  const res = { created: 0, updated: 0, skipped: 0, errors: [], warnings: [] };

  // categories: map Berdu category ids to ours (create missing ones by name) — once per step, cheap
  const catByBerduId = await shop.withShopLock(async () => {
    const cats = await shop.loadCategories();
    const byName = new Map(cats.categories.map((c) => [c.name.toLowerCase(), c]));
    let changed = false;
    const map = new Map();
    for (const c of job.categories) {
      let ours = byName.get(c.name.toLowerCase());
      if (!ours) { ours = shop.cleanCategory({ name: c.name }); cats.categories.push(ours); byName.set(c.name.toLowerCase(), ours); changed = true; }
      map.set(c.id, ours.id);
    }
    if (changed) await shop.saveCategories(cats);
    return map;
  });

  // download images outside the lock (slow), then write all products of this step at once
  const prepared = [];
  for (const bp of slice) {
    try {
      const input = mapProduct(bp, catByBerduId);
      input.images = [];
      if (images) {
        for (const u of input.remoteImages) {
          try { input.images.push(await download(u, job.images)); } catch (e) { res.warnings.push(`${input.name}: gambar gagal diunduh (${e.message})`); }
        }
        for (const g of input.variants ? input.variants.options : []) {
          for (const v of g.values) {
            if (!v.remoteImage) continue;
            try { const im = await download(v.remoteImage, job.images); v.image = `${im.src}.${im.ext || 'webp'}`; } catch { /* optional */ }
          }
        }
      }
      prepared.push(input);
    } catch (e) {
      res.errors.push(`${bp && bp.name}: ${e.message}`);
    }
  }

  await shop.withShopLock(async () => {
    const [data, cats] = await Promise.all([shop.loadProducts(), shop.loadCategories()]);
    const log = [];
    for (const input of prepared) {
      try {
        const old = data.products.find((p) => p.source && p.source.berduId === input.berduId) || null;
        if (old && mode === 'skip') { res.skipped++; continue; }
        if (!images && old) input.images = old.images;
        let p;
        try {
          p = shop.buildProduct(data, input, old, cats);
        } catch (e) {
          if (!/SKU/.test(e.message)) throw e;
          res.warnings.push(`${input.name}: SKU ${input.sku} dobel di Berdu, diberi SKU baru.`);
          p = shop.buildProduct(data, { ...input, sku: '' }, old, cats);
        }
        p.source = { from: 'berdu', berduId: input.berduId, store: job.store, importedAt: new Date().toISOString() };
        if (!old && input.createdAt) p.createdAt = input.createdAt;
        log.push(...shop.applyStock({ products: [p] }, shop.stockEdits(p, input), { reason: 'import', actor }));
        if (old) { data.products[data.products.indexOf(old)] = p; res.updated++; } else { data.products.push(p); res.created++; }
      } catch (e) {
        res.errors.push(`${input.name}: ${e.message}`);
      }
    }
    await shop.saveProducts(data);
    await shop.appendStockLog(log);
  });

  const next = offset + size < job.products.length ? offset + size : null;
  if (next === null) await fs.rm(jobFile(id), { force: true });
  else await fs.writeFile(jobFile(id), JSON.stringify(job)); // keeps the image cache for the next step
  return { next, total: job.products.length, ...res };
}
