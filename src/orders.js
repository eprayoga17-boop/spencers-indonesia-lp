// Orders + shop settings (bank accounts, WhatsApp, manual shipping rates per region) — Berdu-style checkout.
// Storage: one JSON file per order (data/shop/orders/<no>.json) plus an index with list rows
// (data/shop/orders-index.json) so the admin list is a single read. Stock is reserved at checkout
// (like Berdu: "Checkout (SP…)" in Riwayat Stok) and given back when an order is cancelled.
import crypto from 'node:crypto';
import path from 'node:path';
import { fs, writeAtomic, readMany } from './storage.js';
import nodeFs from 'node:fs/promises'; // bundled static data (public/assets/wilayah), not the data store
import { ROOT } from './store.js';
import * as shop from './shop.js';
import * as discounts from './discounts.js';

const DIR = path.join(ROOT, 'data', 'shop');
const ORDER_DIR = path.join(DIR, 'orders');
const INDEX = path.join(DIR, 'orders-index.json');
const SETTINGS = path.join(DIR, 'settings.json');
export const ORDER_NO = /^SP\d{12}$/;

const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const int = (v, min, max, d = 0) => {
  const n = Math.round(Number(String(v ?? '').replace(/[^\d-]/g, '')));
  return v === '' || v == null || !Number.isFinite(n) ? d : Math.min(max, Math.max(min, n));
};

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

// ---------------------------------------------------------------- settings
export const DEFAULT_SETTINGS = {
  storeName: "Spencer's Indonesia",
  whatsapp: '', // admin number for "Konfirmasi via WhatsApp", e.g. 6281234567890
  banks: [], // [{ bank, number, holder }]
  paymentNote: 'Transfer sesuai total, lalu konfirmasi lewat WhatsApp dengan menyertakan bukti transfer.',
  expiryHours: 48, // unpaid orders older than this show as "kedaluwarsa" (admin decides to cancel)
  shipping: {
    methods: [
      // rates: [{ prov: '<kode>'|'*', kab: '<kode>'|'', price, perKg, eta }]; most specific match wins
      { id: 'reguler', name: 'Reguler', note: '', enabled: true, rates: [] },
    ],
  },
  privacyNote: 'Data kamu hanya dipakai untuk memproses dan mengirim pesanan ini.',
};

const phoneDigits = (v) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  else if (d.startsWith('8')) d = `62${d}`;
  return d.slice(0, 16);
};
export { phoneDigits };

export function normalizeSettings(s = {}) {
  const out = structuredClone(DEFAULT_SETTINGS);
  out.storeName = clip(s.storeName, 80) || out.storeName;
  out.whatsapp = phoneDigits(s.whatsapp);
  out.banks = (Array.isArray(s.banks) ? s.banks : []).slice(0, 10)
    .map((b) => ({ bank: clip(b && b.bank, 40), number: clip(b && b.number, 40).replace(/[^\d\s.-]/g, ''), holder: clip(b && b.holder, 80) }))
    .filter((b) => b.bank && b.number);
  if (typeof s.paymentNote === 'string') out.paymentNote = clip(s.paymentNote, 600);
  if (typeof s.privacyNote === 'string') out.privacyNote = clip(s.privacyNote, 600);
  out.expiryHours = int(s.expiryHours, 1, 720, out.expiryHours);
  const methods = s.shipping && Array.isArray(s.shipping.methods) ? s.shipping.methods : out.shipping.methods;
  const ids = new Set();
  out.shipping.methods = methods.slice(0, 10).map((m) => {
    let id = clip(m && m.id, 24).toLowerCase().replace(/[^a-z0-9-]/g, '') || shop.slugify(m && m.name) || 'kirim';
    while (ids.has(id)) id = `${id}-2`;
    ids.add(id);
    return {
      id, name: clip(m.name, 60) || 'Pengiriman', note: clip(m.note, 160), enabled: m.enabled !== false,
      rates: (Array.isArray(m.rates) ? m.rates : []).slice(0, 600).map((r) => ({
        prov: /^(\*|\d{2})$/.test(String(r && r.prov)) ? String(r.prov) : '*',
        kab: /^\d{2}\.\d{2}$/.test(String(r && r.kab)) ? String(r.kab) : '',
        price: int(r && r.price, 0, 1e9, 0),
        perKg: Boolean(r && r.perKg),
        eta: clip(r && r.eta, 40),
      })),
    };
  });
  return out;
}

export const getSettings = async () => normalizeSettings(await readJson(SETTINGS, {}));
export const saveSettings = (s) => writeJson(SETTINGS, normalizeSettings(s));

/** Shipping options for an address and weight (grams). -> [{ id, name, note, cost, eta }] */
export function shippingOptions(settings, { prov, kab }, grams) {
  const kg = Math.max(1, Math.ceil((Number(grams) || 0) / 1000));
  const out = [];
  for (const m of settings.shipping.methods) {
    if (!m.enabled) continue;
    const rate = m.rates.find((r) => r.kab && r.kab === kab) || m.rates.find((r) => r.prov === prov && !r.kab) || m.rates.find((r) => r.prov === '*');
    if (!rate) continue;
    out.push({ id: m.id, name: m.name, note: m.note, cost: rate.perKg ? rate.price * kg : rate.price, eta: rate.eta });
  }
  return out;
}

// ---------------------------------------------------------------- statuses
export const STATUSES = {
  unpaid: 'Belum Bayar', paid: 'Terbayar', processing: 'Diproses', shipped: 'Dikirim', done: 'Selesai', cancelled: 'Dibatalkan',
};
const NEXT = { unpaid: ['paid', 'cancelled'], paid: ['processing', 'shipped', 'cancelled', 'unpaid'], processing: ['shipped', 'cancelled'], shipped: ['done'], done: [], cancelled: [] };
export const canMove = (from, to) => (NEXT[from] || []).includes(to);
export const isPaid = (status) => ['paid', 'processing', 'shipped', 'done'].includes(status);

// ---------------------------------------------------------------- storage
const orderFile = (no) => path.join(ORDER_DIR, `${no}.json`);
export const loadIndex = () => readJson(INDEX, { seq: {}, orders: [] });

export async function getOrder(no) {
  if (!ORDER_NO.test(String(no))) return null;
  return readJson(orderFile(no), null);
}
export async function getOrders(nos) {
  const texts = await readMany(nos.filter((n) => ORDER_NO.test(n)).map(orderFile));
  return texts.map((t) => (t ? JSON.parse(t) : null)).filter(Boolean);
}

/** List row kept in the index. */
function row(o) {
  return {
    no: o.no, createdAt: o.createdAt, status: o.status, total: o.total, name: o.customer.name, phone: o.customer.phone,
    items: o.items.map((it) => ({ pid: it.pid, name: it.name, qty: it.qty, price: it.price })),
    prov: o.address ? o.address.provName : '', kab: o.address ? o.address.kabName : '', kec: o.address ? o.address.kecName : '',
    ship: o.shipping ? o.shipping.name : '', resi: o.shipping ? o.shipping.resi || '' : '', paidAt: o.paidAt || null,
    disc: o.discount ? o.discount.id : null, discCode: o.discount ? o.discount.code : '', discAmount: o.discount ? o.discount.amount + o.discount.shippingOff : 0,
    src: o.source || {},
  };
}

async function saveOrder(o, index) {
  await writeJson(orderFile(o.no), o);
  const i = index.orders.findIndex((x) => x.no === o.no);
  if (i >= 0) index.orders[i] = row(o); else index.orders.unshift(row(o));
  await writeJson(INDEX, index);
}

/** SP + YYMMDD (WIB) + 6-digit counter of the day, like Berdu (SP261015000005). */
function nextNo(index, now = Date.now()) {
  const day = new Date(now + 7 * 3600e3).toISOString().slice(2, 10).replace(/-/g, '');
  index.seq[day] = (index.seq[day] || 0) + 1;
  for (const k of Object.keys(index.seq)) if (k < day) delete index.seq[k];
  return `SP${day}${String(index.seq[day]).padStart(6, '0')}`;
}

// ---------------------------------------------------------------- checkout
export class CheckoutError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.expose = true; }
}

/** Unit price for qty (harga grosir applies when qty reaches a tier). */
export function unitPrice(p, sel, qty) {
  const base = shop.priceFor(p, sel);
  const tier = [...(p.wholesale || [])].reverse().find((t) => qty >= t.min);
  return { ...base, price: tier && tier.price < base.price ? tier.price : base.price };
}

/** Can the public see/buy this product? token = access link (?k=) */
export function buyable(p, token, now = Date.now()) {
  if (shop.visibleNow(p, now)) return true;
  return p.visibility === 'link' && token && token === p.accessToken;
}

const WILAYAH = path.join(ROOT, 'public', 'assets', 'wilayah');
async function region(a) {
  const provList = JSON.parse(await nodeFs.readFile(path.join(WILAYAH, 'provinsi.json'), 'utf8').catch(() => '[]'));
  const prov = provList.find(([k]) => k === String(a.prov));
  if (!prov) return { prov: null };
  const reg = JSON.parse(await nodeFs.readFile(path.join(WILAYAH, `${prov[0]}.json`), 'utf8'));
  const kab = reg.kab.find(([k]) => k === String(a.kab)) || null;
  const kec = kab ? (reg.kec[kab[0]] || []).find(([k]) => k === String(a.kec)) || null : null;
  return { prov, kab, kec };
}

/**
 * Prices a one-product order: variant, qty, wholesale, shipping, discount (coupon or automatic) and gift.
 * strict = true for creating the order (everything required), false for the live preview in the checkout.
 */
export async function priceOrder(input, { data, settings, index, discountList, strict }) {
  const fail = (msg, status) => { throw new CheckoutError(msg, status); };
  const p = data.products.find((x) => x.id === input.pid);
  if (!p || !buyable(p, input.k)) fail('Produk tidak tersedia.', 404);
  const sel = {};
  let complete = true;
  for (const g of p.variants ? p.variants.options : []) {
    const v = g.values.find((x) => x.id === String((input.sel || {})[g.id] ?? ''));
    if (!v) { if (strict) fail(`Pilih ${g.name} dulu.`); complete = false; continue; }
    sel[g.id] = v.id;
  }
  const qty = int(input.qty, 1, 9999, 1);
  if (qty < (p.minOrder || 1)) fail(`Minimal pembelian ${p.minOrder} pcs.`);
  if (p.maxOrder && qty > p.maxOrder) fail(`Maksimal pembelian ${p.maxOrder} pcs.`);
  const stockGroup = p.variants && p.variants.stockAxis;
  const vid = stockGroup && sel[stockGroup] ? `${stockGroup}:${sel[stockGroup]}` : null;
  const unit = complete ? shop.unitRef(p, vid) : null;
  const price = unitPrice(p, sel, qty);
  const weight = (price.weight || 0) * qty;
  const subtotal = price.price * qty;
  const phone = phoneDigits(input.customer && input.customer.phone);

  // shipping
  let address = null;
  let options = [];
  let where = { prov: '', kab: '' };
  let shipping = null;
  if (p.type !== 'digital') {
    const a = input.address || {};
    const r = await region(a);
    where = { prov: r.prov ? r.prov[0] : '', kab: r.kab ? r.kab[0] : '' };
    if (strict) {
      if (!r.prov) fail('Pilih provinsi.');
      if (!r.kab) fail('Pilih kota/kabupaten.');
      if (!r.kec) fail('Pilih kecamatan.');
      const detail = clip(a.detail, 300);
      if (detail.length < 8) fail('Isi alamat lengkap (jalan, nomor rumah, RT/RW).');
      address = { prov: r.prov[0], provName: r.prov[1], kab: r.kab[0], kabName: r.kab[1], kec: r.kec[0], kecName: r.kec[1], detail, postal: clip(a.postal, 5).replace(/\D/g, '') };
    }
    if (r.prov && r.kab) {
      options = shippingOptions(settings, { prov: r.prov[0], kab: r.kab[0] }, weight);
      const pick = options.find((o) => o.id === input.shipping) || options[0] || null;
      if (strict && !options.length) fail('Maaf, pengiriman ke wilayah ini belum tersedia. Hubungi admin lewat WhatsApp.');
      if (pick) shipping = { id: pick.id, name: pick.name, cost: pick.cost, eta: pick.eta, weight, resi: '' };
    }
  }

  // discount: one per order (valid coupon wins, else the best automatic one)
  const ctx = { product: p, qty, subtotal, phone, payment: 'transfer', now: Date.now(), used: discounts.usage(index), shippingCost: shipping ? shipping.cost : 0, ...where };
  const picked = discounts.choose(discountList, ctx, input.code);
  if (strict && picked.codeError) fail(picked.codeError);
  let gift = null;
  if (picked.gift && complete) {
    const same = picked.gift.pid === 'same'; // "buy X get N free" of the product being bought, same variant
    const gp = same ? p : data.products.find((x) => x.id === picked.gift.pid);
    const gvid = same ? vid : picked.gift.vid;
    const gu = gp && shop.unitRef(gp, gvid);
    const need = picked.gift.qty + (same ? qty : 0);
    const enough = gp && gu && (!gp.trackStock || gp.backorder || (gu.stock ?? 0) >= need);
    if (gp && gu && enough) {
      const gsel = same ? sel : gvid ? { [gvid.split(':')[0]]: gvid.split(':')[1] } : {};
      const gl = gp.variants ? gp.variants.options.filter((g) => gsel[g.id]).map((g) => `${g.name}: ${g.values.find((v) => v.id === gsel[g.id])?.name}`).join(', ') : '';
      gift = { pid: gp.id, vid: gvid || null, sel: gsel, name: gp.name, label: gl, sku: gu.sku || gp.sku, qty: picked.gift.qty, price: 0, comparePrice: shop.priceFor(gp, gsel).price, weight: shop.priceFor(gp, gsel).weight || 0, image: gp.images[0] ? `${gp.images[0].src}.${gp.images[0].ext || 'webp'}` : '', type: gp.type, gift: true };
    }
  }
  const discountAmount = picked.discount ? picked.amount : 0;
  const shippingOff = picked.discount && shipping ? Math.min(picked.shippingOff, shipping.cost) : 0;
  const discount = picked.discount ? { id: picked.discount.id, name: picked.discount.name, code: picked.discount.coupon.use ? picked.discount.coupon.code : '', type: picked.discount.type, amount: discountAmount, shippingOff, gift: Boolean(gift) } : null;
  const total = Math.max(0, subtotal - discountAmount) + (shipping ? shipping.cost - shippingOff : 0);
  return { p, sel, complete, qty, vid, unit, price, weight, subtotal, address, options, shipping, discount, gift, codeError: picked.codeError, total };
}

/**
 * Creates an order for ONE product (Berdu "Checkout Satu Produk"). Must run inside withShopLock.
 * input: { pid, sel: {groupId: valueId}, qty, customer{name,phone,email}, address{prov,kab,kec,detail,postal}, shipping, code, note, consent, source }
 */
export async function createOrder(input, { ip = null } = {}) {
  const [data, settings, index, disc] = await Promise.all([shop.loadProducts(), getSettings(), loadIndex(), discounts.loadDiscounts()]);
  const c = input.customer || {};
  const customer = { name: clip(c.name, 80), phone: phoneDigits(c.phone), email: clip(c.email, 120).toLowerCase() };
  if (customer.name.length < 2) throw new CheckoutError('Isi nama penerima.');
  if (customer.phone.length < 9) throw new CheckoutError('Isi nomor WhatsApp yang benar.');
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new CheckoutError('Format email tidak valid.');
  if (!input.consent) throw new CheckoutError('Centang persetujuan penggunaan data untuk melanjutkan.');

  const q = await priceOrder(input, { data, settings, index, discountList: disc.discounts, strict: true });
  const { p, unit, vid, qty } = q;
  if (p.type !== 'digital' && !q.shipping) throw new CheckoutError('Pilih metode pengiriman.');
  // stock: reserve now (Berdu logs "Checkout (SP…)"); refuse when empty unless backorder is allowed
  if (p.trackStock && unit && !p.backorder && (unit.stock ?? 0) < qty) {
    throw new CheckoutError((unit.stock ?? 0) > 0 ? `Stok tinggal ${unit.stock}.` : 'Maaf, stok habis.');
  }
  const label = p.variants ? p.variants.options.map((g) => `${g.name}: ${g.values.find((v) => v.id === q.sel[g.id]).name}`).join(', ') : '';
  const now = Date.now();
  const no = nextNo(index, now);
  const items = [{
    pid: p.id, vid, sel: q.sel, name: p.name, label, sku: unit && unit.sku ? unit.sku : p.sku, qty,
    price: q.price.price, comparePrice: q.price.comparePrice || 0, weight: q.price.weight || 0,
    image: p.images[0] ? `${p.images[0].src}.${p.images[0].ext || 'webp'}` : '', type: p.type,
  }];
  if (q.gift) items.push(q.gift);
  const order = {
    no,
    token: crypto.randomBytes(12).toString('base64url'),
    createdAt: new Date(now).toISOString(),
    status: 'unpaid',
    customer,
    address: q.address,
    items,
    subtotal: q.subtotal,
    discount: q.discount,
    shipping: q.shipping,
    total: q.total,
    payment: { method: 'transfer', banks: settings.banks },
    note: clip(input.note, 500),
    source: {
      page: clip(input.source && input.source.page, 80), ref: clip(input.source && input.source.ref, 120),
      utm_source: clip(input.source && input.source.utm_source, 80), utm_medium: clip(input.source && input.source.utm_medium, 80),
      utm_campaign: clip(input.source && input.source.utm_campaign, 120), os: clip(input.source && input.source.os, 30),
    },
    adminNote: '',
    history: [{ ts: new Date(now).toISOString(), by: 'pembeli', action: 'create', to: 'unpaid' }],
    ipHash: ip ? crypto.createHash('sha256').update(`${ip}|${no}`).digest('hex').slice(0, 16) : null, // no raw IP (PDP)
  };
  const actor = `pembeli ${customer.phone.slice(0, 4)}…`;
  const changes = [];
  for (const it of items) {
    const ip2 = data.products.find((x) => x.id === it.pid);
    if (ip2 && ip2.trackStock && shop.unitRef(ip2, it.vid)) changes.push({ pid: it.pid, vid: it.vid, mode: 'add', qty: -it.qty });
  }
  const log = shop.applyStock(data, changes, { reason: 'checkout', ref: no, actor });
  await shop.saveProducts(data);
  await shop.appendStockLog(log);
  await saveOrder(order, index);
  return order;
}

/** Admin status change. Cancelling returns reserved stock; un-cancelling is not allowed. */
export async function setStatus(no, to, actor, extra = {}) {
  const [o, index] = await Promise.all([getOrder(no), loadIndex()]);
  if (!o) throw new CheckoutError('Order tidak ditemukan.', 404);
  if (!STATUSES[to]) throw new CheckoutError('Status tidak dikenal.');
  if (!canMove(o.status, to)) throw new CheckoutError(`Status "${STATUSES[o.status]}" tidak bisa diubah ke "${STATUSES[to]}".`);
  const ts = new Date().toISOString();
  if (to === 'cancelled') {
    const data = await shop.loadProducts();
    const changes = [];
    for (const it of o.items) {
      const p = data.products.find((x) => x.id === it.pid);
      if (p && p.trackStock && shop.unitRef(p, it.vid)) changes.push({ pid: it.pid, vid: it.vid, mode: 'add', qty: it.qty });
    }
    const log = shop.applyStock(data, changes, { reason: 'cancel', ref: o.no, actor });
    await shop.saveProducts(data);
    await shop.appendStockLog(log);
  }
  if (to === 'paid') o.paidAt = ts;
  if (to === 'unpaid') o.paidAt = null;
  if (to === 'shipped' && o.shipping) {
    o.shipping.resi = clip(extra.resi, 60);
    o.shipping.courier = clip(extra.courier, 40);
    o.shipping.shippedAt = ts;
  }
  o.history.push({ ts, by: actor, action: 'status', from: o.status, to, ...(extra.resi ? { resi: clip(extra.resi, 60) } : {}) });
  o.status = to;
  await saveOrder(o, index);
  return o;
}

export async function updateOrderMeta(no, { adminNote, resi }, actor) {
  const [o, index] = await Promise.all([getOrder(no), loadIndex()]);
  if (!o) throw new CheckoutError('Order tidak ditemukan.', 404);
  if (typeof adminNote === 'string') o.adminNote = clip(adminNote, 2000);
  if (typeof resi === 'string' && o.shipping) o.shipping.resi = clip(resi, 60);
  o.history.push({ ts: new Date().toISOString(), by: actor, action: 'edit' });
  await saveOrder(o, index);
  return o;
}

/** WhatsApp text the buyer sends to the admin. */
export function waText(o, settings) {
  const lines = [
    `Halo ${settings.storeName}, saya mau konfirmasi pesanan *${o.no}*`,
    ...o.items.map((it) => `• ${it.name}${it.label ? ` (${it.label})` : ''} x${it.qty}${it.gift ? ' (hadiah)' : ''}`),
    ...(o.discount ? [`Diskon: ${o.discount.code || o.discount.name}`] : []),
    `Total: Rp ${o.total.toLocaleString('id-ID')}`,
    `Nama: ${o.customer.name}`,
  ];
  return lines.join('\n');
}
