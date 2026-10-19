// Import discounts from a Berdu export (read from the Berdu admin GraphQL, see HANDOFF.md).
// Berdu fields: trigger 1 = coupon code, 2 = automatic · type 1 Potongan Harga, 2 % Diskon Produk, 3 Gratis Ongkir,
// 4 Potongan Ongkir, 5 Potongan Harga per Produk, 6 Dapat produk gratis (productCount free units of the bought product),
// 7 % Diskon Ongkir · useDateTo in year 2200 = no end · conditions: products, productCategories, quantity, totalOrder,
// shippingLocations ("ID/<n>" = n-th of the 34 old provinces in Kemendagri order, "ID/<n>/<city>" = Berdu city id),
// customers (Berdu customer ids), use (max uses), customerUse (max per customer).
import * as shop from './shop.js';
import * as discounts from './discounts.js';

const TYPE = { 1: 'order_amount', 2: 'product_percent', 3: 'free_shipping', 4: 'shipping_amount', 5: 'product_amount', 6: 'free_product', 7: 'shipping_percent' };
// 34 provinces before the 2022 Papua split, in Kemendagri code order (Berdu "ID/1" … "ID/34")
const OLD_PROVINCES = ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '31', '32', '33', '34', '35', '36', '51', '52', '53',
  '61', '62', '63', '64', '65', '71', '72', '73', '74', '75', '76', '81', '82', '91', '92'];
const SPLIT = { 91: ['91', '93', '94', '95'], 92: ['92', '96'] }; // new Papua provinces belong to the old ones

function regionsOf(ids, warn, name) {
  const out = new Set();
  let cityLevel = false;
  for (const raw of ids || []) {
    const m = /^ID\/(\d+)(?:\/\d+)?$/.exec(String(raw));
    if (!m) continue;
    if (String(raw).split('/').length > 2) cityLevel = true;
    const code = OLD_PROVINCES[Number(m[1]) - 1];
    if (code) for (const c of SPLIT[code] || [code]) out.add(c);
  }
  if (cityLevel) warn(`${name}: batas kota/kabupaten dari Berdu dibuat per provinsi (kode kota Berdu tidak dikenal). Cek ulang wilayahnya.`);
  return [...out];
}

/** -> { created, updated, skipped, warnings[] } */
export async function importBerduDiscounts(json, { onlyActive = true, mode = 'skip', now = Date.now() } = {}) {
  if (!json || json.source !== 'berdu-discounts' || !Array.isArray(json.discounts)) throw new discounts.DiscountError('Format tidak dikenal. Gunakan file export diskon Berdu.');
  const res = { created: 0, updated: 0, skipped: 0, ended: 0, warnings: [] };
  const warn = (w) => { if (res.warnings.length < 300) res.warnings.push(w); };
  return shop.withShopLock(async () => {
    const [data, cats, disc] = await Promise.all([shop.loadProducts(), shop.loadCategories(), discounts.loadDiscounts()]);
    const byBerdu = new Map(data.products.filter((p) => p.source && p.source.berduId).map((p) => [p.source.berduId, p.id]));
    const catByName = new Map(cats.categories.map((c) => [c.name.toLowerCase(), c.id]));
    const berduCat = new Map((json.categories || []).map((c) => [c.id, catByName.get(String(c.name).trim().toLowerCase())]));
    const existing = new Map(disc.discounts.filter((d) => d.source && d.source.berduId).map((d) => [d.source.berduId, d]));

    for (const bd of json.discounts) {
      const ended = bd.useDateTo && new Date(bd.useDateTo).getUTCFullYear() < 2100 && bd.useDateTo < now;
      if (ended && onlyActive) { res.ended++; continue; }
      const old = existing.get(bd.id);
      if (old && mode === 'skip') { res.skipped++; continue; }
      const type = TYPE[bd.type];
      if (!type) { warn(`${bd.name}: tipe Berdu ${bd.type} tidak dikenal, dilewati.`); continue; }
      const cond = { total: false, customers: false, products: false, by: 'product', productIds: [], categoryIds: [], payment: false, methods: [], qty: false, locations: false, regions: [] };
      const limits = { maxUses: 0, perCustomer: 0 };
      let giftQty = 1;
      let disabled = false;
      const notes = [];
      for (const c of bd.conditions || []) {
        if (c.type === 'products') {
          cond.products = true;
          cond.by = 'product';
          cond.productIds = (c.ids || []).map((id) => byBerdu.get(id)).filter(Boolean);
          if (c.productCount) giftQty = c.productCount;
          if ((c.ids || []).length && !cond.productIds.length) { disabled = true; warn(`${bd.name}: produknya belum di-import, diskon dinonaktifkan.`); }
        } else if (c.type === 'productCategories') {
          cond.products = true;
          cond.by = 'category';
          cond.categoryIds = (c.ids || []).map((id) => berduCat.get(id)).filter(Boolean);
        } else if (c.type === 'quantity') {
          cond.qty = true;
          cond.minQty = c.min || 0;
          cond.maxQty = c.max || 0;
        } else if (c.type === 'totalOrder') {
          cond.total = true;
          cond.minTotal = c.totalOrderCondition || 0;
          cond.maxTotal = c.totalOrderConditionMax || 0;
        } else if (c.type === 'shippingLocations') {
          cond.locations = true;
          cond.regions = regionsOf(c.ids, warn, bd.name);
        } else if (c.type === 'customers') {
          cond.customers = true;
          cond.phones = [];
          disabled = true;
          notes.push('Di Berdu dibatasi untuk pelanggan tertentu (ID pelanggan Berdu). Isi nomor WhatsApp pelanggannya lalu aktifkan lagi.');
          warn(`${bd.name}: dibatasi pelanggan tertentu di Berdu, diimpor dalam keadaan nonaktif.`);
        } else if (c.type === 'use') {
          limits.maxUses = Number(c.value) || 0;
        } else if (c.type === 'customerUse') {
          limits.perCustomer = Number(c.value) || 0;
        }
      }
      const percent = type === 'product_percent' || type === 'shipping_percent';
      const input = {
        name: String(bd.name || '').trim() || '(tanpa nama)',
        type,
        value: percent ? bd.discountPercent : bd.discountPrice,
        gift: type === 'free_product' ? { pid: 'same', qty: giftQty } : null,
        conditions: cond,
        schedule: {
          start: bd.useDateFrom ? new Date(bd.useDateFrom).toISOString() : '',
          end: bd.useDateTo && new Date(bd.useDateTo).getUTCFullYear() < 2100 ? new Date(bd.useDateTo).toISOString() : '',
          noEnd: !bd.useDateTo || new Date(bd.useDateTo).getUTCFullYear() >= 2100,
        },
        coupon: { use: bd.trigger === 1 && Boolean(bd.couponCode), code: bd.couponCode || '' },
        limits,
        tags: String(bd.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
        note: [bd.notes, ...notes].filter(Boolean).join('\n'),
        disabled,
      };
      if (!input.value && (type === 'order_amount' || type === 'product_amount' || type === 'shipping_amount' || percent)) { warn(`${bd.name}: nilai potongan 0, dilewati.`); continue; }
      try {
        const d = discounts.cleanDiscount(input, old);
        d.source = { from: 'berdu', berduId: bd.id, importedAt: new Date().toISOString() };
        if (old) { disc.discounts[disc.discounts.indexOf(old)] = d; res.updated++; } else { disc.discounts.push(d); res.created++; }
      } catch (e) {
        warn(`${bd.name}: ${e.message}`);
      }
    }
    await discounts.saveDiscounts(disc);
    return res;
  });
}
