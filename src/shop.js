// Shop data (menu "Produk", modelled on Berdu): products with variants, categories, catalogs, bundles and a
// stock log. Stored as a few JSON files under data/shop/ (Redis on Vercel via storage.js). All writes go through
// one lock so two quick edits (or a checkout and a stock edit) cannot overwrite each other in this process.
import crypto from 'node:crypto';
import path from 'node:path';
import { fs, writeAtomic, readMany } from './storage.js';
import { ROOT, withPageLock } from './store.js';
import { sanitizeRich } from './admin/sanitize.js';

const DIR = path.join(ROOT, 'data', 'shop');
const F = {
  products: path.join(DIR, 'products.json'),
  categories: path.join(DIR, 'categories.json'),
  catalogs: path.join(DIR, 'catalogs.json'),
  bundles: path.join(DIR, 'bundles.json'),
  deleted: path.join(DIR, 'deleted.jsonl'),
};
const LOG_DIR = path.join(DIR, 'stock-log');

export class ShopError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.expose = true; }
}

export const withShopLock = (fn) => withPageLock('__shop', fn);

const newId = (prefix) => `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const int = (v, min, max, d = 0) => {
  const n = Math.round(Number(String(v ?? '').replace(/[^\d-]/g, '')));
  return v === '' || v == null || !Number.isFinite(n) ? d : Math.min(max, Math.max(min, n));
};
const MAX_PRICE = 1e12;
export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const uploadUrl = (v) => (typeof v === 'string' && /^\/uploads\/[\w./-]+$/.test(v) && !v.includes('..') ? v : '');

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return structuredClone(fallback);
    throw e;
  }
}
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await writeAtomic(file, JSON.stringify(data) + '\n');
}

export const loadProducts = () => readJson(F.products, { seq: 0, products: [] });
export const saveProducts = (data) => writeJson(F.products, data);
export const loadCategories = () => readJson(F.categories, { categories: [] });
export const saveCategories = (data) => writeJson(F.categories, data);
export const loadCatalogs = () => readJson(F.catalogs, { catalogs: [] });
export const saveCatalogs = (data) => writeJson(F.catalogs, data);
export const loadBundles = () => readJson(F.bundles, { bundles: [] });
export const saveBundles = (data) => writeJson(F.bundles, data);

// ---------------------------------------------------------------- visibility
// public: listed and buyable · hidden: only in the admin · scheduled: public from publishAt (WIB input)
// link: not listed, reachable only through its access link (/produk/<slug>?k=<token>)
export const VISIBILITY = ['public', 'hidden', 'scheduled', 'link'];
export function visibleNow(p, now = Date.now()) {
  if (p.visibility === 'public') return true;
  if (p.visibility === 'scheduled') return Boolean(p.publishAt) && Date.parse(p.publishAt) <= now;
  return false;
}
export function tabOf(p, now = Date.now()) {
  if (p.visibility === 'scheduled') return Date.parse(p.publishAt) > now ? 'scheduled' : 'public';
  return p.visibility;
}

// ---------------------------------------------------------------- products
// Variants work like Berdu: up to 3 option groups ("Ukuran", "Rasa"…), each with values; the buyer picks one value per
// group. A value may override price, compare price and weight (a later group wins). Stock is shared by the product,
// unless one group is the "stock group": then every value of that group has its own SKU and stock.
export const PRODUCT_TYPES = ['physical', 'digital'];
const groupsOf = (p) => (p.variants ? p.variants.options : []);
const stockGroup = (p) => (p.variants && p.variants.stockAxis ? p.variants.options.find((o) => o.id === p.variants.stockAxis) || null : null);

/** Price, compare price and weight for a selection { groupId: valueId }. */
export function priceFor(p, sel = {}) {
  let price = p.price;
  let comparePrice = p.comparePrice;
  let weight = p.weight;
  for (const o of groupsOf(p)) {
    const v = o.values.find((x) => x.id === sel[o.id]);
    if (!v) continue;
    if (v.price != null) price = v.price;
    if (v.comparePrice != null) comparePrice = v.comparePrice;
    if (v.weight != null) weight = v.weight;
  }
  return { price, comparePrice, weight };
}
/** Lowest and highest price a buyer can see (base price and every value override). */
export function priceRange(p) {
  const all = [p.price, ...groupsOf(p).flatMap((o) => o.values.map((v) => v.price).filter((x) => x != null))];
  return { min: Math.min(...all), max: Math.max(...all) };
}
/** Stock units: the product itself, or each value of the stock group. vid = "<groupId>:<valueId>". */
export function unitsOf(p) {
  const g = stockGroup(p);
  if (!g) return [{ vid: null, label: '', sku: p.sku, stock: p.stock, price: p.price }];
  return g.values.map((v) => ({ vid: `${g.id}:${v.id}`, label: `${g.name}: ${v.name}`, sku: v.sku, stock: v.stock, price: priceFor(p, { [g.id]: v.id }).price, image: v.image }));
}
/** The object that holds a unit's sku/stock (product or a value of the stock group), or null. */
export function unitRef(p, vid) {
  const g = stockGroup(p);
  if (!vid) return g ? null : p;
  if (!g) return null;
  const [gid, id] = String(vid).split(':');
  return gid === g.id ? g.values.find((v) => v.id === id) || null : null;
}

function skuPrefix(name) {
  const words = String(name).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
  const letters = words.length >= 3 ? words.slice(0, 3).map((w) => w[0]).join('') : (words.join('') + 'XXX').slice(0, 3);
  return letters.padEnd(3, 'X');
}
export function nextSku(data, name) {
  data.seq = (data.seq || 0) + 1;
  return `${skuPrefix(name)}${String(data.seq).padStart(7, '0')}`;
}

function cleanImages(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 20).map((im) => {
    const src = uploadUrl(im && im.src);
    if (!src) return null;
    return { src, ...(im.ext === 'webp' ? { ext: 'webp' } : {}), ...(im.iw ? { iw: int(im.iw, 1, 20000) } : {}), ...(im.ih ? { ih: int(im.ih, 1, 20000) } : {}) };
  }).filter(Boolean);
}

const stockVal = (v) => (v === null || v === '' || v === undefined || v === '-' ? null : int(v, -1e9, 1e9, 0));
const optInt = (v, max) => (v === '' || v == null ? null : int(v, 0, max, 0));
const ID_RE = /^[\w-]{1,16}$/;
const strList = (v, n, len) => [...new Set((Array.isArray(v) ? v : []).map((x) => clip(x, len)).filter(Boolean))].slice(0, n);

function cleanVariants(input, data, name, old) {
  if (!input || !Array.isArray(input.options)) return null;
  const oldGroups = new Map(((old && old.options) || []).map((o) => [o.id, o]));
  const usedG = new Set();
  const options = [];
  for (const o of input.options.slice(0, 3)) {
    let gid = ID_RE.test(String(o.id ?? '')) && !usedG.has(String(o.id)) ? String(o.id) : '';
    if (!gid) { let n = 1; while (usedG.has(`g${n}`) || input.options.some((x) => String(x.id) === `g${n}`)) n++; gid = `g${n}`; }
    const prevG = oldGroups.get(gid);
    const values = [];
    const usedV = new Set();
    const names = new Set();
    for (const v of (Array.isArray(o.values) ? o.values : []).slice(0, 100)) {
      const vname = clip(v && v.name, 80);
      if (!vname || names.has(vname.toLowerCase())) continue;
      names.add(vname.toLowerCase());
      let id = ID_RE.test(String(v.id ?? '')) && !usedV.has(String(v.id)) ? String(v.id) : '';
      if (!id) { let n = 1; while (usedV.has(String(n)) || o.values.some((x) => String(x.id) === String(n))) n++; id = String(n); }
      usedV.add(id);
      const prevV = prevG && prevG.values.find((x) => x.id === id);
      values.push({
        id, name: vname,
        price: optInt(v.price, MAX_PRICE), comparePrice: optInt(v.comparePrice, MAX_PRICE), weight: optInt(v.weight, 1e6),
        sku: clip(v.sku, 40), stock: prevV ? prevV.stock ?? null : null,
        ...(uploadUrl(v.image) ? { image: uploadUrl(v.image) } : {}),
      });
    }
    if (!values.length) continue;
    usedG.add(gid);
    options.push({ id: gid, name: clip(o.name, 60) || 'Variasi', values });
  }
  if (!options.length) return null;
  const stockAxis = options.some((o) => o.id === String(input.stockAxis)) ? String(input.stockAxis) : null;
  for (const o of options) {
    if (o.id === stockAxis) { for (const v of o.values) if (!v.sku) v.sku = nextSku(data, name); } else for (const v of o.values) { v.stock = null; v.sku = ''; }
  }
  return { options, stockAxis };
}

function uniqueSlug(data, base, selfId) {
  const clean = slugify(base) || 'produk';
  const used = new Set(data.products.filter((p) => p.id !== selfId).map((p) => p.slug));
  let s = clean;
  for (let n = 2; used.has(s); n++) s = `${clean}-${n}`;
  return s;
}

/** Harga grosir: [{ min (qty), price }] sorted by min, min >= 2. */
function cleanWholesale(list) {
  const out = (Array.isArray(list) ? list : []).slice(0, 10)
    .map((t) => ({ min: int(t && t.min, 0, 1e6, 0), price: int(t && t.price, 0, MAX_PRICE, 0) }))
    .filter((t) => t.min >= 2 && t.price > 0);
  return [...new Map(out.map((t) => [t.min, t])).values()].sort((a, b) => a.min - b.min);
}

/** Builds a product from admin input. `old` is the stored product when editing. */
export function buildProduct(data, input, old, cats) {
  const name = clip(input.name, 160);
  if (!name) throw new ShopError('Nama produk wajib diisi.');
  const visibility = VISIBILITY.includes(input.visibility) ? input.visibility : 'public';
  const publishAt = visibility === 'scheduled' ? clip(input.publishAt, 40) : '';
  if (visibility === 'scheduled' && Number.isNaN(Date.parse(publishAt))) throw new ShopError('Isi tanggal & jam tayang untuk produk terjadwal.');
  const catIds = new Set(cats.categories.map((c) => c.id));
  const minOrder = int(input.minOrder, 1, 1e6, 1);
  const maxOrder = int(input.maxOrder, 0, 1e6, 0);
  if (maxOrder && maxOrder < minOrder) throw new ShopError('Jumlah pembelian maksimal harus lebih besar dari minimal.');
  const seo = input.seo || {};
  const dims = input.dims || {};
  const p = {
    id: old ? old.id : newId('p'),
    name,
    slug: uniqueSlug(data, clip(input.slug, 80) || (old && old.slug) || name, old && old.id),
    type: PRODUCT_TYPES.includes(input.type) ? input.type : 'physical',
    description: sanitizeRich(clip(input.description, 60000)),
    images: cleanImages(input.images),
    categories: [...new Set((Array.isArray(input.categories) ? input.categories : []).filter((c) => catIds.has(c)))].slice(0, 20),
    price: int(input.price, 0, MAX_PRICE, 0),
    comparePrice: int(input.comparePrice, 0, MAX_PRICE, 0),
    capitalPrice: int(input.capitalPrice, 0, MAX_PRICE, 0),
    wholesale: cleanWholesale(input.wholesale),
    paymentMethods: strList(input.paymentMethods, 20, 40), // empty = semua metode
    minOrder,
    maxOrder,
    sku: '',
    trackStock: Boolean(input.trackStock),
    stock: null,
    backorder: Boolean(input.backorder),
    weight: int(input.weight, 0, 1e6, 0),
    dims: { l: int(dims.l, 0, 10000, 0), w: int(dims.w, 0, 10000, 0), h: int(dims.h, 0, 10000, 0) },
    shippingMethods: strList(input.shippingMethods, 30, 40), // empty = semua
    seo: { title: clip(seo.title, 120), description: clip(seo.description, 300), noindex: Boolean(seo.noindex) },
    visibility,
    publishAt: publishAt ? new Date(publishAt).toISOString() : '',
    accessToken: (old && old.accessToken) || crypto.randomBytes(9).toString('base64url'),
    tags: strList(input.tags, 30, 40),
    note: clip(input.note, 5000),
    variants: null,
    ...(old && old.source ? { source: old.source } : {}),
    createdAt: old ? old.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  p.variants = cleanVariants(input.variants, data, name, old && old.variants);
  const perValue = Boolean(stockGroup(p));
  p.sku = perValue ? '' : clip(input.sku, 40) || (old && old.sku) || nextSku(data, name);
  // stock values are set afterwards through applyStock (logged); keep the stored product stock meanwhile
  p.stock = !perValue && old && !stockGroup(old) ? old.stock : null;
  if (!p.trackStock) {
    p.stock = null;
    for (const o of groupsOf(p)) for (const v of o.values) v.stock = null;
  }
  const skus = new Set();
  for (const other of data.products) if (other.id !== p.id) for (const u of unitsOf(other)) if (u.sku) skus.add(u.sku.toUpperCase());
  for (const u of unitsOf(p)) {
    if (u.sku && skus.has(u.sku.toUpperCase())) throw new ShopError(`SKU ${u.sku} sudah dipakai produk lain.`);
    if (u.sku) skus.add(u.sku.toUpperCase());
  }
  return p;
}

export function duplicateOf(data, p) {
  const copy = structuredClone(p);
  copy.id = newId('p');
  copy.name = `${p.name} (Salinan)`.slice(0, 160);
  copy.slug = uniqueSlug(data, copy.name);
  copy.accessToken = crypto.randomBytes(9).toString('base64url');
  copy.visibility = 'hidden';
  delete copy.source;
  copy.createdAt = copy.updatedAt = new Date().toISOString();
  const g = stockGroup(copy);
  if (g) for (const v of g.values) v.sku = nextSku(data, copy.name);
  else copy.sku = nextSku(data, copy.name);
  return copy;
}

/** Stock wanted by the edit form -> changes for applyStock (only units whose value differs). */
export function stockEdits(p, input) {
  if (!p.trackStock) return [];
  const want = new Map();
  const g = stockGroup(p);
  if (g) {
    const ig = ((input.variants && input.variants.options) || []).find((o) => String(o.id) === g.id);
    const byName = new Map(((ig && ig.values) || []).map((v) => [String(v.name || '').trim().toLowerCase(), v]));
    for (const v of g.values) {
      const iv = byName.get(v.name.toLowerCase());
      want.set(`${g.id}:${v.id}`, iv && 'stock' in iv ? stockVal(iv.stock) ?? 0 : v.stock ?? 0);
    }
  } else want.set(null, 'stock' in input ? stockVal(input.stock) ?? 0 : p.stock ?? 0);
  const out = [];
  for (const u of unitsOf(p)) {
    const w = want.get(u.vid);
    if (w === undefined || w === u.stock) continue;
    out.push({ pid: p.id, vid: u.vid, mode: 'set', qty: w });
  }
  return out;
}

export async function moveToTrash(p, actor) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.appendFile(F.deleted, JSON.stringify({ ts: new Date().toISOString(), by: actor, product: p }) + '\n');
}

// ---------------------------------------------------------------- stock
/**
 * Changes stock of several units at once and logs every change.
 * changes: [{ pid, vid|null, mode: 'add'|'set', qty }] · reason: 'manual'|'set'|'edit'|'initial'|'checkout'|'cancel'|'import'
 * Must be called inside withShopLock with the loaded products `data` (caller saves).
 * Stock edits switch stock tracking on for the product.
 */
export function applyStock(data, changes, { reason = 'manual', ref = '', actor = null } = {}) {
  const ts = new Date().toISOString();
  const log = [];
  for (const c of changes) {
    const p = data.products.find((x) => x.id === c.pid);
    if (!p) throw new ShopError('Produk tidak ditemukan.', 404);
    const unit = unitRef(p, c.vid);
    if (!unit) throw new ShopError(`Variasi produk "${p.name}" tidak ditemukan.`, 404);
    const before = unit.stock;
    const qty = int(c.qty, -1e9, 1e9, 0);
    if (c.mode !== 'set' && qty === 0) continue;
    const after = c.mode === 'set' ? qty : (before ?? 0) + qty;
    unit.stock = after;
    p.trackStock = true;
    log.push({ ts, pid: p.id, vid: c.vid || null, delta: after - (before ?? 0), after, before, reason, ref: clip(ref, 40), by: actor });
  }
  return log;
}

export async function appendStockLog(entries) {
  if (!entries.length) return;
  await fs.mkdir(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, `${entries[0].ts.slice(0, 7)}.jsonl`);
  await fs.appendFile(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

/** Newest first. pid filters to one product; limit caps the result. */
export async function readStockLog({ pid = null, limit = 300 } = {}) {
  let files;
  try {
    files = (await fs.readdir(LOG_DIR)).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort().reverse();
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const out = [];
  for (let i = 0; i < files.length && out.length < limit; i += 3) {
    const texts = await readMany(files.slice(i, i + 3).map((f) => path.join(LOG_DIR, f)));
    for (const text of texts) {
      const lines = String(text || '').split('\n').filter(Boolean).reverse();
      for (const line of lines) {
        try {
          const e = JSON.parse(line);
          if (!pid || e.pid === pid) out.push(e);
        } catch { /* skip broken line */ }
        if (out.length >= limit) break;
      }
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- categories / catalogs / bundles
export function cleanCategory(input, old) {
  const name = clip(input.name, 80);
  if (!name) throw new ShopError('Nama kategori wajib diisi.');
  return { id: old ? old.id : newId('c'), name, parent: typeof input.parent === 'string' ? input.parent : null };
}

export function cleanCatalog(input, old, data, products) {
  const name = clip(input.name, 120);
  if (!name) throw new ShopError('Nama katalog wajib diisi.');
  const ids = new Set(products.products.map((p) => p.id));
  const base = slugify(clip(input.slug, 80) || (old && old.slug) || name) || 'katalog';
  const used = new Set(data.catalogs.filter((c) => !old || c.id !== old.id).map((c) => c.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  return {
    id: old ? old.id : newId('k'),
    name,
    slug,
    description: clip(input.description, 2000),
    products: [...new Set((Array.isArray(input.products) ? input.products : []).filter((id) => ids.has(id)))].slice(0, 500),
    createdAt: old ? old.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const PRICE_TYPES = ['sum', 'fixed'];
export function cleanBundle(input, old, products) {
  const name = clip(input.name, 120);
  if (!name) throw new ShopError('Nama bundle wajib diisi.');
  const byId = new Map(products.products.map((p) => [p.id, p]));
  const groups = (Array.isArray(input.groups) ? input.groups : []).slice(0, 20).map((g) => ({
    name: clip(g.name, 120) || 'Grup',
    optional: Boolean(g.optional),
    items: (Array.isArray(g.items) ? g.items : []).slice(0, 50).map((it) => {
      const p = byId.get(it.pid);
      if (!p) return null;
      const vid = it.vid && unitRef(p, it.vid) ? String(it.vid) : null;
      return { pid: p.id, vid, rename: clip(it.rename, 120), qty: int(it.qty, 1, 9999, 1) };
    }).filter(Boolean),
  }));
  return {
    id: old ? old.id : newId('b'),
    name,
    groups,
    priceType: PRICE_TYPES.includes(input.priceType) ? input.priceType : 'sum',
    price: int(input.price, 0, MAX_PRICE, 0),
    hidden: Boolean(input.hidden),
    tags: [...new Set((Array.isArray(input.tags) ? input.tags : []).map((t) => clip(t, 40)).filter(Boolean))].slice(0, 30),
    note: clip(input.note, 5000),
    createdAt: old ? old.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Price of a bundle: sum of its non-optional items (unit price x qty), or the fixed price. */
export function bundlePrice(b, products) {
  if (b.priceType === 'fixed') return b.price;
  const byId = new Map(products.products.map((p) => [p.id, p]));
  let sum = 0;
  for (const g of b.groups) {
    if (g.optional) continue;
    for (const it of g.items) {
      const p = byId.get(it.pid);
      if (!p) continue;
      const u = unitsOf(p).find((x) => x.vid === it.vid);
      sum += (u ? u.price : p.price) * it.qty;
    }
  }
  return sum;
}
