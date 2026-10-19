// Admin JSON API for the shop (menu "Produk"): products, stock, categories, catalogs, bundles.
// Mounted at /admin/api/shop behind requireAdmin + requireCsrf (see routes.js).
import express from 'express';
import multer from 'multer';
import * as shop from '../shop.js';
import * as importer from '../shop-import.js';
import * as orders from '../orders.js';
import * as discounts from '../discounts.js';
import { importBerduDiscounts } from '../discount-import.js';
import { audit } from './security.js';
import { processImage, UserError } from './media.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const notFound = (what) => new shop.ShopError(`${what} tidak ditemukan.`, 404);

const images = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 20, fields: 5 },
  fileFilter(req, file, cb) {
    if (/^image\//.test(file.mimetype) && file.mimetype !== 'image/svg+xml') return cb(null, true);
    cb(new UserError(`File "${file.originalname}" bukan gambar (SVG tidak diizinkan).`));
  },
}).array('images', 20);

const importFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter(req, file, cb) {
    if (/\.json$/i.test(file.originalname)) return cb(null, true);
    cb(new UserError('File harus berekstensi .json (export produk Berdu).'));
  },
}).single('file');

/** One row of the product list. */
function summary(p, now = Date.now()) {
  const units = shop.unitsOf(p);
  const tracked = p.trackStock ? units.filter((u) => u.stock != null) : [];
  const range = shop.priceRange(p);
  return {
    id: p.id, name: p.name, slug: p.slug, image: p.images[0] || null, type: p.type,
    sku: units[0] ? units[0].sku : '', skus: units.map((u) => u.sku).filter(Boolean),
    variants: p.variants ? p.variants.options.reduce((a, o) => a + o.values.length, 0) : 0,
    stock: tracked.length ? tracked.reduce((a, u) => a + u.stock, 0) : null,
    priceMin: range.min, priceMax: range.max,
    categories: p.categories, tags: p.tags,
    visibility: p.visibility, publishAt: p.publishAt, tab: shop.tabOf(p, now), accessToken: p.visibility === 'link' ? p.accessToken : undefined,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

/** Stock units for "Kelola Stok". */
function stockRows(data) {
  const rows = [];
  for (const p of data.products) {
    for (const u of shop.unitsOf(p)) {
      rows.push({ pid: p.id, vid: u.vid, name: p.name, label: u.label, sku: u.sku, stock: p.trackStock ? u.stock : null, image: u.image || (p.images[0] ? `${p.images[0].src}.${p.images[0].ext || 'webp'}` : '') });
    }
  }
  return rows;
}

const counts = (data) => {
  const m = {};
  for (const p of data.products) for (const c of p.categories) m[c] = (m[c] || 0) + 1;
  return m;
};

export function shopApi() {
  const api = express.Router();

  // ---- images (product photos are uploaded first, then referenced by URL in the product JSON)
  api.post('/images', (req, res, next) => images(req, res, (err) => {
    if (err) return next(err instanceof multer.MulterError ? new shop.ShopError(err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran gambar maksimal 15 MB.' : 'Upload tidak valid.', 413) : err);
    wrap(async () => {
      if (!req.files?.length) throw new UserError('Pilih gambar.');
      const out = [];
      for (const f of req.files) {
        const img = await processImage(f.buffer, 'products');
        out.push({ src: img.src, ...(img.ext ? { ext: img.ext } : {}), iw: img.iw, ih: img.ih });
      }
      res.json({ images: out });
    })(req, res, next);
  }));

  // ---- import (Berdu export JSON) — step-wise so image downloads stay short per request
  api.post('/import', (req, res, next) => importFile(req, res, (err) => {
    if (err) return next(err instanceof multer.MulterError ? new shop.ShopError(err.code === 'LIMIT_FILE_SIZE' ? 'File maksimal 25 MB.' : 'Upload tidak valid.', 413) : err);
    wrap(async () => {
      if (!req.file) throw new shop.ShopError('Pilih file export Berdu (.json).');
      const out = await importer.createJob(req.file.buffer.toString('utf8'), req.admin.email);
      await audit(req, 'product.import.start', { total: out.total, store: out.store });
      res.json(out);
    })(req, res, next);
  }));
  api.post('/import/:job/run', wrap(async (req, res) => {
    const out = await importer.runStep(String(req.params.job), {
      offset: Math.max(0, Number(req.body?.offset) || 0), size: 8, mode: req.body?.mode === 'update' ? 'update' : 'skip',
      images: req.body?.images !== false, actor: req.admin.email,
    });
    if (out.next === null) await audit(req, 'product.import.done', { total: out.total });
    res.json(out);
  }));

  // ---- products
  api.get('/products', wrap(async (req, res) => {
    const [data, cats] = await Promise.all([shop.loadProducts(), shop.loadCategories()]);
    const now = Date.now();
    res.json({ products: data.products.map((p) => summary(p, now)), categories: cats.categories });
  }));

  api.get('/products/:id', wrap(async (req, res) => {
    const [data, cats] = await Promise.all([shop.loadProducts(), shop.loadCategories()]);
    const p = data.products.find((x) => x.id === req.params.id);
    if (!p) throw notFound('Produk');
    res.json({ product: p, categories: cats.categories });
  }));

  // Create / update share one path: build, apply wanted stock (logged), save.
  const saveProduct = (isNew) => wrap(async (req, res) => {
    const input = req.body || {};
    const out = await shop.withShopLock(async () => {
      const [data, cats] = await Promise.all([shop.loadProducts(), shop.loadCategories()]);
      const old = isNew ? null : data.products.find((x) => x.id === req.params.id);
      if (!isNew && !old) throw notFound('Produk');
      const p = shop.buildProduct(data, input, old, cats);
      const log = shop.applyStock({ products: [p] }, shop.stockEdits(p, input), { reason: isNew ? 'initial' : 'edit', actor: req.admin.email });
      if (isNew) data.products.unshift(p);
      else data.products[data.products.indexOf(old)] = p;
      await shop.saveProducts(data);
      await shop.appendStockLog(log);
      return p;
    });
    await audit(req, isNew ? 'product.create' : 'product.update', { id: out.id, name: out.name });
    res.json({ product: out });
  });
  api.post('/products', saveProduct(true));
  api.put('/products/:id', saveProduct(false));

  api.post('/products/:id/duplicate', wrap(async (req, res) => {
    const copy = await shop.withShopLock(async () => {
      const data = await shop.loadProducts();
      const p = data.products.find((x) => x.id === req.params.id);
      if (!p) throw notFound('Produk');
      const c = shop.duplicateOf(data, p);
      data.products.splice(data.products.indexOf(p), 0, c);
      await shop.saveProducts(data);
      return c;
    });
    await audit(req, 'product.duplicate', { id: copy.id, name: copy.name });
    res.json({ product: copy });
  }));

  // Bulk actions from the list (checkboxes): delete, change visibility, add/remove a category.
  api.post('/products/bulk', wrap(async (req, res) => {
    const ids = new Set(Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 1000) : []);
    const action = String(req.body?.action || '');
    if (!ids.size) throw new shop.ShopError('Pilih produk dulu.');
    const n = await shop.withShopLock(async () => {
      const [data, cats] = await Promise.all([shop.loadProducts(), shop.loadCategories()]);
      const hit = data.products.filter((p) => ids.has(p.id));
      if (action === 'delete') {
        for (const p of hit) await shop.moveToTrash(p, req.admin.email);
        data.products = data.products.filter((p) => !ids.has(p.id));
      } else if (['public', 'hidden', 'link'].includes(action)) {
        for (const p of hit) { p.visibility = action; p.publishAt = ''; p.updatedAt = new Date().toISOString(); }
      } else if (action === 'addCategory' || action === 'removeCategory') {
        const cat = cats.categories.find((c) => c.id === req.body?.category);
        if (!cat) throw notFound('Kategori');
        for (const p of hit) {
          p.categories = action === 'addCategory' ? [...new Set([...p.categories, cat.id])] : p.categories.filter((c) => c !== cat.id);
          p.updatedAt = new Date().toISOString();
        }
      } else throw new shop.ShopError('Aksi tidak dikenal.');
      await shop.saveProducts(data);
      return hit.length;
    });
    await audit(req, `product.bulk.${action}`, { count: n });
    res.json({ ok: true, count: n });
  }));

  api.delete('/products/:id', wrap(async (req, res) => {
    const p = await shop.withShopLock(async () => {
      const data = await shop.loadProducts();
      const hit = data.products.find((x) => x.id === req.params.id);
      if (!hit) throw notFound('Produk');
      await shop.moveToTrash(hit, req.admin.email);
      data.products = data.products.filter((x) => x !== hit);
      await shop.saveProducts(data);
      return hit;
    });
    await audit(req, 'product.delete', { id: p.id, name: p.name });
    res.json({ ok: true });
  }));

  // ---- stock
  api.get('/stock', wrap(async (req, res) => res.json({ rows: stockRows(await shop.loadProducts()) })));

  api.post('/stock', wrap(async (req, res) => {
    const changes = (Array.isArray(req.body?.changes) ? req.body.changes : []).slice(0, 500)
      .map((c) => ({ pid: String(c.pid || ''), vid: c.vid ? String(c.vid) : null, mode: c.mode === 'set' ? 'set' : 'add', qty: c.qty }));
    if (!changes.length) throw new shop.ShopError('Tidak ada perubahan stok.');
    const log = await shop.withShopLock(async () => {
      const data = await shop.loadProducts();
      const entries = shop.applyStock(data, changes, { reason: changes[0].mode === 'set' ? 'set' : 'manual', actor: req.admin.email });
      await shop.saveProducts(data);
      await shop.appendStockLog(entries);
      return entries;
    });
    await audit(req, 'stock.update', { count: log.length });
    res.json({ rows: stockRows(await shop.loadProducts()), changed: log.length });
  }));

  api.patch('/sku', wrap(async (req, res) => {
    const sku = String(req.body?.sku || '').trim().slice(0, 40);
    if (!sku) throw new shop.ShopError('SKU tidak boleh kosong.');
    await shop.withShopLock(async () => {
      const data = await shop.loadProducts();
      const p = data.products.find((x) => x.id === req.body?.pid);
      if (!p) throw notFound('Produk');
      const taken = data.products.some((o) => shop.unitsOf(o).some((u) => u.sku && u.sku.toUpperCase() === sku.toUpperCase() && !(o.id === p.id && u.vid === (req.body.vid || null))));
      if (taken) throw new shop.ShopError(`SKU ${sku} sudah dipakai.`);
      const unit = shop.unitRef(p, req.body.vid || null);
      if (!unit) throw notFound('Variasi');
      unit.sku = sku;
      p.updatedAt = new Date().toISOString();
      await shop.saveProducts(data);
    });
    await audit(req, 'product.sku', { sku });
    res.json({ ok: true });
  }));

  api.get('/stock/log', wrap(async (req, res) => {
    const pid = req.query.pid ? String(req.query.pid) : null;
    const [entries, data] = await Promise.all([shop.readStockLog({ pid, limit: 500 }), shop.loadProducts()]);
    const byId = new Map(data.products.map((p) => [p.id, p]));
    res.json({
      entries: entries.map((e) => {
        const p = byId.get(e.pid);
        const u = p && e.vid ? shop.unitsOf(p).find((x) => x.vid === e.vid) : null;
        return { ...e, name: p ? p.name : '(produk dihapus)', label: u ? u.label : '', image: p && p.images[0] ? `${p.images[0].src}.${p.images[0].ext || 'webp'}` : '' };
      }),
    });
  }));

  // ---- categories
  const catEdit = (event, fn) => wrap(async (req, res) => {
    const info = await shop.withShopLock(async () => {
      const cats = await shop.loadCategories();
      const out = await fn(cats, req);
      await shop.saveCategories(cats);
      return out;
    });
    await audit(req, event, info || {});
    const [cats, data] = await Promise.all([shop.loadCategories(), shop.loadProducts()]);
    res.json({ categories: cats.categories, counts: counts(data), total: data.products.length });
  });
  api.get('/categories', wrap(async (req, res) => {
    const [cats, data] = await Promise.all([shop.loadCategories(), shop.loadProducts()]);
    res.json({ categories: cats.categories, counts: counts(data), total: data.products.length });
  }));
  api.post('/categories', catEdit('category.create', (cats, req) => {
    const c = shop.cleanCategory(req.body || {});
    if (cats.categories.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) throw new shop.ShopError('Nama kategori sudah ada.');
    cats.categories.push(c);
    return { name: c.name };
  }));
  api.put('/categories/:id', catEdit('category.update', (cats, req) => {
    const i = cats.categories.findIndex((c) => c.id === req.params.id);
    if (i < 0) throw notFound('Kategori');
    cats.categories[i] = shop.cleanCategory(req.body || {}, cats.categories[i]);
    return { name: cats.categories[i].name };
  }));
  api.post('/categories/reorder', catEdit('category.reorder', (cats, req) => {
    const order = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const pos = new Map(order.map((id, i) => [id, i]));
    cats.categories.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
  }));
  api.delete('/categories/:id', wrap(async (req, res, next) => {
    // Removing a category also removes it from every product (one lock for both files).
    await shop.withShopLock(async () => {
      const [cats, data] = await Promise.all([shop.loadCategories(), shop.loadProducts()]);
      const c = cats.categories.find((x) => x.id === req.params.id);
      if (!c) throw notFound('Kategori');
      cats.categories = cats.categories.filter((x) => x !== c);
      for (const p of data.products) p.categories = p.categories.filter((id) => id !== c.id);
      await Promise.all([shop.saveCategories(cats), shop.saveProducts(data)]);
      req.deleted = c.name;
    });
    await audit(req, 'category.delete', { name: req.deleted });
    const [cats, data] = await Promise.all([shop.loadCategories(), shop.loadProducts()]);
    res.json({ categories: cats.categories, counts: counts(data), total: data.products.length });
  }));

  // ---- orders
  api.get('/orders', wrap(async (req, res) => {
    const index = await orders.loadIndex();
    res.json({ orders: index.orders, statuses: orders.STATUSES });
  }));
  api.get('/orders/:no', wrap(async (req, res) => {
    const [o, settings] = await Promise.all([orders.getOrder(req.params.no), orders.getSettings()]);
    if (!o) throw notFound('Order');
    res.json({ order: o, statuses: orders.STATUSES, publicUrl: `/pesanan/${o.no}?t=${o.token}`, whatsapp: settings.whatsapp });
  }));
  api.post('/orders/:no/status', wrap(async (req, res) => {
    const to = String(req.body?.to || '');
    const o = await shop.withShopLock(() => orders.setStatus(req.params.no, to, req.admin.email, { resi: req.body?.resi, courier: req.body?.courier }));
    await audit(req, 'order.status', { no: o.no, to });
    res.json({ order: o });
  }));
  api.patch('/orders/:no', wrap(async (req, res) => {
    const o = await shop.withShopLock(() => orders.updateOrderMeta(req.params.no, { adminNote: req.body?.adminNote, resi: req.body?.resi }, req.admin.email));
    await audit(req, 'order.update', { no: o.no });
    res.json({ order: o });
  }));

  // ---- discounts (menu "Diskon")
  const discRow = (d, used) => ({
    id: d.id, name: d.name, type: d.type, typeLabel: discounts.TYPES[d.type], value: d.value, code: d.coupon.use ? d.coupon.code : '',
    status: discounts.statusOf(d), start: d.schedule.start, end: d.schedule.end, used: (used[d.id] || { all: 0 }).all, maxUses: d.limits.maxUses,
    tags: d.tags, updatedAt: d.updatedAt, createdAt: d.createdAt,
  });
  api.get('/discounts', wrap(async (req, res) => {
    const [disc, index] = await Promise.all([discounts.loadDiscounts(), orders.loadIndex()]);
    const used = discounts.usage(index);
    res.json({ discounts: disc.discounts.map((d) => discRow(d, used)), types: discounts.TYPES });
  }));
  api.get('/discounts/:id', wrap(async (req, res) => {
    const [disc, data, cats, index] = await Promise.all([discounts.loadDiscounts(), shop.loadProducts(), shop.loadCategories(), orders.loadIndex()]);
    const d = disc.discounts.find((x) => x.id === req.params.id);
    if (!d) throw notFound('Diskon');
    const ids = new Set([...d.conditions.productIds, ...(d.gift ? [d.gift.pid] : [])]);
    const used = index.orders.filter((o) => o.disc === d.id);
    res.json({
      discount: d, types: discounts.TYPES, categories: cats.categories,
      products: data.products.filter((p) => ids.has(p.id)).map((p) => ({ ...summary(p), variantList: shop.unitsOf(p).filter((u) => u.vid).map((u) => ({ id: u.vid, label: u.label })) })),
      report: {
        orders: used.filter((o) => o.status !== 'cancelled').length, paid: used.filter((o) => orders.isPaid(o.status)).length,
        discount: used.filter((o) => o.status !== 'cancelled').reduce((a, o) => a + (o.discAmount || 0), 0),
        revenue: used.filter((o) => orders.isPaid(o.status)).reduce((a, o) => a + o.total, 0),
        list: used.slice(0, 200),
      },
      statuses: orders.STATUSES,
    });
  }));
  const discSave = (isNew) => wrap(async (req, res) => {
    const d = await shop.withShopLock(async () => {
      const disc = await discounts.loadDiscounts();
      const i = isNew ? -1 : disc.discounts.findIndex((x) => x.id === req.params.id);
      if (!isNew && i < 0) throw notFound('Diskon');
      const next = discounts.cleanDiscount(req.body || {}, isNew ? null : disc.discounts[i]);
      if (isNew) disc.discounts.unshift(next); else disc.discounts[i] = next;
      await discounts.saveDiscounts(disc);
      return next;
    });
    await audit(req, isNew ? 'discount.create' : 'discount.update', { name: d.name });
    res.json({ discount: d });
  });
  api.post('/discounts/import', (req, res, next) => importFile(req, res, (err) => {
    if (err) return next(err instanceof multer.MulterError ? new shop.ShopError('File maksimal 25 MB.', 413) : err);
    wrap(async () => {
      if (!req.file) throw new shop.ShopError('Pilih file export diskon Berdu (.json).');
      let json;
      try { json = JSON.parse(req.file.buffer.toString('utf8')); } catch { throw new shop.ShopError('File bukan JSON yang valid.'); }
      const out = await importBerduDiscounts(json, { onlyActive: req.body?.onlyActive !== 'false', mode: req.body?.mode === 'update' ? 'update' : 'skip' });
      await audit(req, 'discount.import', { created: out.created, updated: out.updated });
      res.json(out);
    })(req, res, next);
  }));
  api.post('/discounts', discSave(true));
  api.put('/discounts/:id', discSave(false));
  api.post('/discounts/:id/duplicate', wrap(async (req, res) => {
    const d = await shop.withShopLock(async () => {
      const disc = await discounts.loadDiscounts();
      const src = disc.discounts.find((x) => x.id === req.params.id);
      if (!src) throw notFound('Diskon');
      const copy = discounts.cleanDiscount({ ...structuredClone(src), name: `${src.name} (Salinan)`.slice(0, 160), disabled: true }, null);
      disc.discounts.splice(disc.discounts.indexOf(src), 0, copy);
      await discounts.saveDiscounts(disc);
      return copy;
    });
    await audit(req, 'discount.duplicate', { name: d.name });
    res.json({ discount: d });
  }));
  api.delete('/discounts/:id', wrap(async (req, res) => {
    const name = await shop.withShopLock(async () => {
      const disc = await discounts.loadDiscounts();
      const d = disc.discounts.find((x) => x.id === req.params.id);
      if (!d) throw notFound('Diskon');
      disc.discounts = disc.discounts.filter((x) => x !== d);
      await discounts.saveDiscounts(disc);
      return d.name;
    });
    await audit(req, 'discount.delete', { name });
    res.json({ ok: true });
  }));

  // ---- shop settings (bank accounts, WhatsApp, shipping rates)
  api.get('/settings', wrap(async (req, res) => res.json({ settings: await orders.getSettings() })));
  api.put('/settings', wrap(async (req, res) => {
    await shop.withShopLock(() => orders.saveSettings(req.body || {}));
    await audit(req, 'shop.settings', {});
    res.json({ settings: await orders.getSettings() });
  }));

  // ---- product report + orders (from the order index; paid = Terbayar and later)
  api.get('/products/:id/orders', wrap(async (req, res) => {
    const index = await orders.loadIndex();
    res.json({ orders: index.orders.filter((o) => o.items.some((it) => it.pid === req.params.id)), statuses: orders.STATUSES });
  }));
  api.get('/products/:id/report', wrap(async (req, res) => {
    const pid = req.params.id;
    const day = (t) => new Date(Date.parse(t) + 7 * 3600e3).toISOString().slice(0, 10);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : day(new Date().toISOString());
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : day(new Date(Date.parse(to) - 6 * 864e5).toISOString());
    const pay = String(req.query.pay || 'paid'); // paid | unpaid | all
    const metric = req.query.metric === 'qty' ? 'qty' : 'sales';
    const index = await orders.loadIndex();
    const rows = index.orders.filter((o) => {
      const d = day(o.createdAt);
      if (d < from || d > to || o.status === 'cancelled') return false;
      if (pay === 'paid' && !orders.isPaid(o.status)) return false;
      if (pay === 'unpaid' && o.status !== 'unpaid') return false;
      return o.items.some((it) => it.pid === pid);
    });
    const full = await orders.getOrders(rows.map((o) => o.no));
    const series = {};
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 864e5) series[new Date(t).toISOString().slice(0, 10)] = 0;
    const tally = () => new Map();
    const groups = { variasi: tally(), pelanggan: tally(), domain: tally(), halaman: tally(), provinsi: tally(), kota: tally(), kecamatan: tally(), pengiriman: tally(), os: tally(), utm_medium: tally(), utm_source: tally(), utm_campaign: tally() };
    const add = (m, k, v) => { if (k) m.set(k, (m.get(k) || 0) + v); };
    let total = 0;
    for (const o of full) {
      for (const it of o.items.filter((x) => x.pid === pid)) {
        const v = metric === 'qty' ? it.qty : it.price * it.qty;
        total += v;
        series[day(o.createdAt)] = (series[day(o.createdAt)] || 0) + v;
        add(groups.variasi, it.label, v);
        add(groups.pelanggan, `${o.customer.name} (${o.customer.phone})`, v);
        add(groups.domain, o.source && o.source.ref, v);
        add(groups.halaman, o.source && o.source.page, v);
        add(groups.provinsi, o.address && o.address.provName, v);
        add(groups.kota, o.address && o.address.kabName, v);
        add(groups.kecamatan, o.address && o.address.kecName, v);
        add(groups.pengiriman, o.shipping && o.shipping.name, v);
        add(groups.os, o.source && o.source.os, v);
        add(groups.utm_medium, o.source && o.source.utm_medium, v);
        add(groups.utm_source, o.source && o.source.utm_source, v);
        add(groups.utm_campaign, o.source && o.source.utm_campaign, v);
      }
    }
    const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 20);
    res.json({ from, to, metric, total, orders: full.length, series: Object.entries(series).map(([d, v]) => ({ d, v })), groups: Object.fromEntries(Object.entries(groups).map(([k, m]) => [k, top(m)])) });
  }));

  // ---- catalogs
  api.get('/catalogs', wrap(async (req, res) => res.json(await shop.loadCatalogs())));
  api.get('/catalogs/:id', wrap(async (req, res) => {
    const [cat, data, cats] = await Promise.all([shop.loadCatalogs(), shop.loadProducts(), shop.loadCategories()]);
    const k = cat.catalogs.find((x) => x.id === req.params.id);
    if (!k) throw notFound('Katalog');
    const byId = new Map(data.products.map((p) => [p.id, p]));
    res.json({ catalog: k, products: k.products.map((id) => byId.get(id)).filter(Boolean).map((p) => summary(p)), categories: cats.categories });
  }));
  const catalogSave = (isNew) => wrap(async (req, res) => {
    const k = await shop.withShopLock(async () => {
      const [cat, data] = await Promise.all([shop.loadCatalogs(), shop.loadProducts()]);
      const i = isNew ? -1 : cat.catalogs.findIndex((x) => x.id === req.params.id);
      if (!isNew && i < 0) throw notFound('Katalog');
      const next = shop.cleanCatalog(req.body || {}, isNew ? null : cat.catalogs[i], cat, data);
      if (isNew) cat.catalogs.unshift(next); else cat.catalogs[i] = next;
      await shop.saveCatalogs(cat);
      return next;
    });
    await audit(req, isNew ? 'catalog.create' : 'catalog.update', { name: k.name });
    res.json({ catalog: k });
  });
  api.post('/catalogs', catalogSave(true));
  api.put('/catalogs/:id', catalogSave(false));
  api.delete('/catalogs/:id', wrap(async (req, res) => {
    const name = await shop.withShopLock(async () => {
      const cat = await shop.loadCatalogs();
      const k = cat.catalogs.find((x) => x.id === req.params.id);
      if (!k) throw notFound('Katalog');
      cat.catalogs = cat.catalogs.filter((x) => x !== k);
      await shop.saveCatalogs(cat);
      return k.name;
    });
    await audit(req, 'catalog.delete', { name });
    res.json({ ok: true });
  }));

  // ---- bundles
  api.get('/bundles', wrap(async (req, res) => {
    const [b, data] = await Promise.all([shop.loadBundles(), shop.loadProducts()]);
    res.json({ bundles: b.bundles.map((x) => ({ ...x, total: shop.bundlePrice(x, data) })) });
  }));
  api.get('/bundles/:id', wrap(async (req, res) => {
    const [b, data] = await Promise.all([shop.loadBundles(), shop.loadProducts()]);
    const x = b.bundles.find((y) => y.id === req.params.id);
    if (!x) throw notFound('Bundle');
    const ids = new Set(x.groups.flatMap((g) => g.items.map((it) => it.pid)));
    res.json({ bundle: x, total: shop.bundlePrice(x, data), products: data.products.filter((p) => ids.has(p.id)).map((p) => ({ ...summary(p), variantList: shop.unitsOf(p).filter((u) => u.vid).map((u) => ({ id: u.vid, label: u.label, price: u.price })) })) });
  }));
  const bundleSave = (isNew) => wrap(async (req, res) => {
    const x = await shop.withShopLock(async () => {
      const [b, data] = await Promise.all([shop.loadBundles(), shop.loadProducts()]);
      const i = isNew ? -1 : b.bundles.findIndex((y) => y.id === req.params.id);
      if (!isNew && i < 0) throw notFound('Bundle');
      const next = shop.cleanBundle(req.body || {}, isNew ? null : b.bundles[i], data);
      if (isNew) b.bundles.unshift(next); else b.bundles[i] = next;
      await shop.saveBundles(b);
      return next;
    });
    await audit(req, isNew ? 'bundle.create' : 'bundle.update', { name: x.name });
    res.json({ bundle: x });
  });
  api.post('/bundles', bundleSave(true));
  api.put('/bundles/:id', bundleSave(false));
  api.post('/bundles/:id/duplicate', wrap(async (req, res) => {
    const x = await shop.withShopLock(async () => {
      const [b, data] = await Promise.all([shop.loadBundles(), shop.loadProducts()]);
      const src = b.bundles.find((y) => y.id === req.params.id);
      if (!src) throw notFound('Bundle');
      const copy = shop.cleanBundle({ ...src, name: `${src.name} (Salinan)` }, null, data);
      b.bundles.splice(b.bundles.indexOf(src), 0, copy);
      await shop.saveBundles(b);
      return copy;
    });
    await audit(req, 'bundle.duplicate', { name: x.name });
    res.json({ bundle: x });
  }));
  api.delete('/bundles/:id', wrap(async (req, res) => {
    const name = await shop.withShopLock(async () => {
      const b = await shop.loadBundles();
      const x = b.bundles.find((y) => y.id === req.params.id);
      if (!x) throw notFound('Bundle');
      b.bundles = b.bundles.filter((y) => y !== x);
      await shop.saveBundles(b);
      return x.name;
    });
    await audit(req, 'bundle.delete', { name });
    res.json({ ok: true });
  }));

  return api;
}
