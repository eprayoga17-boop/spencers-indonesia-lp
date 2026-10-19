// Discounts (menu "Diskon", like Berdu): automatic or coupon-code discounts with conditions, schedule and usage limits.
// One discount per order: a valid coupon code wins; otherwise the automatic discount with the biggest benefit applies.
// Usage is counted from the order index (cancelled orders do not count), so there is no separate counter to drift.
import crypto from 'node:crypto';
import path from 'node:path';
import { fs, writeAtomic } from './storage.js';
import { ROOT } from './store.js';

const FILE = path.join(ROOT, 'data', 'shop', 'discounts.json');
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const int = (v, min, max, d = 0) => {
  const n = Math.round(Number(String(v ?? '').replace(/[^\d-]/g, '')));
  return v === '' || v == null || !Number.isFinite(n) ? d : Math.min(max, Math.max(min, n));
};

export class DiscountError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.expose = true; }
}

export const TYPES = {
  order_amount: 'Potongan Harga',
  product_percent: '% Diskon Produk',
  product_amount: 'Potongan Harga per Produk',
  free_product: 'Dapat produk gratis',
  free_shipping: 'Gratis Ongkir',
  shipping_amount: 'Potongan Ongkir',
  shipping_percent: '% Diskon Ongkir',
};

export async function loadDiscounts() {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return { discounts: [] };
    throw e;
  }
}
export async function saveDiscounts(data) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await writeAtomic(FILE, JSON.stringify(data) + '\n');
}

/** Coupon codes compare without case, spaces and a leading "#". */
export const normCode = (c) => String(c || '').toUpperCase().replace(/\s+/g, '').replace(/^#+/, '');
const phone = (v) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  else if (d.startsWith('8')) d = `62${d}`;
  return d;
};
const iso = (v) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : '');

export function cleanDiscount(input, old) {
  const name = clip(input.name, 160);
  if (!name) throw new DiscountError('Nama diskon wajib diisi.');
  const type = Object.hasOwn(TYPES, input.type) ? input.type : 'order_amount';
  const percent = type === 'product_percent' || type === 'shipping_percent';
  const value = int(input.value, 0, percent ? 100 : 1e12, 0);
  if (type !== 'free_shipping' && type !== 'free_product' && !value) throw new DiscountError(percent ? 'Isi persentase diskon.' : 'Isi besar potongan.');
  const c = input.conditions || {};
  const sched = input.schedule || {};
  const start = iso(sched.start);
  const end = sched.noEnd ? '' : iso(sched.end);
  if (start && end && end <= start) throw new DiscountError('Tanggal akhir harus setelah tanggal mulai.');
  const coupon = input.coupon || {};
  const code = clip(coupon.code, 40);
  if (coupon.use && !normCode(code)) throw new DiscountError('Isi kode kupon, atau matikan "Gunakan Kode Kupon".');
  const gift = input.gift || {};
  if (type === 'free_product' && !gift.pid) throw new DiscountError('Pilih produk hadiah.');
  const list = (v, n, f = (x) => clip(x, 40)) => [...new Set((Array.isArray(v) ? v : []).map(f).filter(Boolean))].slice(0, n);
  return {
    id: old ? old.id : `d_${crypto.randomBytes(5).toString('hex')}`,
    name,
    type,
    value,
    maxShippingOff: type === 'free_shipping' ? int(input.maxShippingOff, 0, 1e9, 0) : 0, // 0 = whole shipping cost
    // gift.pid "same" = the product the buyer purchases (Berdu "Dapat produk gratis": buy X, get N free)
    gift: type === 'free_product' ? { pid: clip(gift.pid, 20), vid: gift.pid !== 'same' && gift.vid ? clip(gift.vid, 40) : null, qty: int(gift.qty, 1, 999, 1) } : null,
    conditions: {
      total: Boolean(c.total), minTotal: int(c.minTotal, 0, 1e12, 0), maxTotal: int(c.maxTotal, 0, 1e12, 0),
      customers: Boolean(c.customers), phones: list(c.phones, 500, phone),
      products: Boolean(c.products), by: c.by === 'category' ? 'category' : 'product', productIds: list(c.productIds, 1000, (x) => clip(x, 20)), categoryIds: list(c.categoryIds, 100, (x) => clip(x, 20)),
      payment: Boolean(c.payment), methods: list(c.methods, 10),
      qty: Boolean(c.qty), minQty: int(c.minQty, 0, 1e6, 0), maxQty: int(c.maxQty, 0, 1e6, 0),
      // shipping destination: province codes ("31") or city codes ("31.71")
      locations: Boolean(c.locations), regions: list(c.regions, 600, (x) => (/^\d{2}(\.\d{2})?$/.test(String(x)) ? String(x) : '')),
    },
    schedule: { start, end, noEnd: !end },
    coupon: { use: Boolean(coupon.use), code: coupon.use ? code : '' },
    limits: { maxUses: int((input.limits || {}).maxUses, 0, 1e9, 0), perCustomer: int((input.limits || {}).perCustomer, 0, 1e6, 0) },
    tags: list(input.tags, 30),
    note: clip(input.note, 5000),
    disabled: Boolean(input.disabled),
    ...(old && old.source ? { source: old.source } : {}),
    createdAt: old ? old.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function statusOf(d, now = Date.now()) {
  if (d.disabled) return 'off';
  if (d.schedule.start && Date.parse(d.schedule.start) > now) return 'scheduled';
  if (d.schedule.end && Date.parse(d.schedule.end) < now) return 'ended';
  return 'active';
}

/** Usage counts from the order index: { [discountId]: { all, byPhone: { [phone]: n } } } */
export function usage(index) {
  const out = {};
  for (const o of index.orders) {
    if (!o.disc || o.status === 'cancelled') continue;
    const u = (out[o.disc] ||= { all: 0, byPhone: {} });
    u.all += 1;
    u.byPhone[o.phone] = (u.byPhone[o.phone] || 0) + 1;
  }
  return out;
}

/**
 * Why a discount does not apply (null = it applies). ctx: { product, qty, subtotal, phone, payment, now, used }
 * Single-product checkout: the whole cart is one product line.
 */
export function blocker(d, ctx) {
  const st = statusOf(d, ctx.now);
  if (st === 'off') return 'Kupon tidak aktif.';
  if (st === 'scheduled') return 'Kupon belum berlaku.';
  if (st === 'ended') return 'Kupon sudah berakhir.';
  const c = d.conditions;
  if (c.products) {
    const ok = c.by === 'category' ? ctx.product.categories.some((x) => c.categoryIds.includes(x)) : c.productIds.includes(ctx.product.id);
    if (!ok) return 'Kupon tidak berlaku untuk produk ini.';
  }
  if (c.total && ctx.subtotal < c.minTotal) return `Minimal belanja Rp ${c.minTotal.toLocaleString('id-ID')}.`;
  if (c.total && c.maxTotal && ctx.subtotal > c.maxTotal) return `Maksimal belanja Rp ${c.maxTotal.toLocaleString('id-ID')}.`;
  if (c.qty && ctx.qty < c.minQty) return `Minimal ${c.minQty} pcs.`;
  if (c.qty && c.maxQty && ctx.qty > c.maxQty) return `Maksimal ${c.maxQty} pcs.`;
  if (c.payment && c.methods.length && !c.methods.includes(ctx.payment)) return 'Kupon tidak berlaku untuk metode pembayaran ini.';
  if (c.locations && c.regions.length) {
    if (!ctx.prov) return 'Pilih alamat pengiriman dulu.';
    if (!c.regions.includes(ctx.prov) && !c.regions.includes(ctx.kab)) return 'Kupon tidak berlaku untuk wilayah pengiriman ini.';
  }
  if (c.customers) {
    if (!ctx.phone) return 'Isi nomor WhatsApp dulu untuk memakai kupon ini.';
    if (!c.phones.includes(phone(ctx.phone))) return 'Kupon tidak berlaku untuk nomor ini.';
  }
  const u = (ctx.used && ctx.used[d.id]) || { all: 0, byPhone: {} };
  if (d.limits.maxUses && u.all >= d.limits.maxUses) return 'Kuota kupon sudah habis.';
  if (d.limits.perCustomer && ctx.phone && (u.byPhone[phone(ctx.phone)] || 0) >= d.limits.perCustomer) return 'Kupon sudah pernah kamu pakai.';
  return null;
}

/** Benefit of a discount for the context. -> { amount (off subtotal), shippingOff, gift } */
export function benefit(d, ctx) {
  const shipping = ctx.shippingCost || 0;
  switch (d.type) {
    case 'order_amount': return { amount: Math.min(d.value, ctx.subtotal), shippingOff: 0 };
    case 'product_percent': return { amount: Math.round((ctx.subtotal * d.value) / 100), shippingOff: 0 };
    case 'product_amount': return { amount: Math.min(d.value * ctx.qty, ctx.subtotal), shippingOff: 0 };
    case 'free_shipping': return { amount: 0, shippingOff: d.maxShippingOff ? Math.min(d.maxShippingOff, shipping) : shipping };
    case 'shipping_amount': return { amount: 0, shippingOff: Math.min(d.value, shipping) };
    case 'shipping_percent': return { amount: 0, shippingOff: Math.round((shipping * d.value) / 100) };
    case 'free_product': return { amount: 0, shippingOff: 0, gift: d.gift };
    default: return { amount: 0, shippingOff: 0 };
  }
}

/**
 * Picks the discount for an order. code = what the buyer typed (may be empty).
 * -> { discount|null, amount, shippingOff, gift|null, codeError|null }
 */
export function choose(list, ctx, code) {
  const none = { discount: null, amount: 0, shippingOff: 0, gift: null, codeError: null };
  const want = normCode(code);
  if (want) {
    const matches = list.filter((d) => d.coupon.use && normCode(d.coupon.code) === want);
    let firstError = matches.length ? null : 'Kode kupon tidak ditemukan.';
    for (const d of matches) {
      const why = blocker(d, ctx);
      if (why) { firstError ||= why; continue; }
      const b = benefit(d, ctx);
      return { discount: d, amount: b.amount, shippingOff: b.shippingOff, gift: b.gift || null, codeError: null };
    }
    // the code does not apply: keep the automatic discount, but report why the code failed
    return { ...choose(list, ctx, ''), codeError: firstError };
  }
  let best = none;
  let bestValue = -1;
  for (const d of list) {
    if (d.coupon.use || blocker(d, ctx)) continue;
    const b = benefit(d, ctx);
    const v = b.amount + b.shippingOff + (b.gift ? 1 : 0);
    if (v <= 0) continue; // e.g. free shipping before an address is chosen
    if (v > bestValue) { best = { discount: d, amount: b.amount, shippingOff: b.shippingOff, gift: b.gift || null, codeError: null }; bestValue = v; }
  }
  return best;
}
