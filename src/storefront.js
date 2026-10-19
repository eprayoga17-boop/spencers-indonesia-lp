// Public shop pages: product page with one-product checkout (/produk/<slug>), order page (/pesanan/<no>)
// and the small JSON API they use (/api/shop/*). Mobile-first, same width/font/favicon as the landing pages.
import express from 'express';
import rateLimit from 'express-rate-limit';
import * as shop from './shop.js';
import * as orders from './orders.js';
import * as discounts from './discounts.js';
import { getGlobal } from './global.js';
import { audit } from './admin/security.js';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const imgUrl = (im) => (im ? `${im.src}.${im.ext || 'webp'}` : '');

function doc({ title, description = '', body, global, assetVersion, robots = 'index, follow', image = '' }) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<meta name="robots" content="${esc(robots)}">
<meta property="og:title" content="${esc(title)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
${global.favicon ? `<link rel="icon" href="${esc(global.favicon)}">` : ''}
<link rel="stylesheet" href="/assets/css/shop.css?v=${esc(assetVersion)}">
</head>
<body style="--page-w:${Number(global.maxWidth) || 480}px">
${body}
<script src="/assets/js/shop.js?v=${esc(assetVersion)}" defer></script>
</body>
</html>`;
}

/** The parts of a product the public page needs (no stock numbers, SKUs, notes or capital price). */
function publicProduct(p) {
  const units = shop.unitsOf(p);
  return {
    id: p.id, name: p.name, type: p.type, price: p.price, comparePrice: p.comparePrice, weight: p.weight, range: shop.priceRange(p), minOrder: p.minOrder || 1, maxOrder: p.maxOrder || 0,
    wholesale: p.wholesale || [],
    groups: p.variants ? p.variants.options.map((g) => ({ id: g.id, name: g.name, values: g.values.map((v) => ({ id: v.id, name: v.name, price: v.price, comparePrice: v.comparePrice, weight: v.weight, image: v.image || '' })) })) : [],
    stockAxis: p.variants ? p.variants.stockAxis : null,
    // only "habis" flags are public, never the numbers
    soldOut: p.trackStock && !p.backorder ? units.filter((u) => (u.stock ?? 0) <= 0).map((u) => u.vid || '') : [],
  };
}

function productPage(p, { global, assetVersion, settings, k }) {
  const pp = publicProduct(p);
  const range = shop.priceRange(p);
  const imgs = p.images.length ? p.images : [];
  const gallery = imgs.length
    ? `<div class="sf-gallery" data-gallery>${imgs.map((im, i) => `<picture>${im.ext ? '' : `<source type="image/avif" srcset="${esc(im.src)}.avif">`}<img src="${esc(imgUrl(im))}" alt="${esc(p.name)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} ${im.iw && im.ih ? `width="${im.iw}" height="${im.ih}"` : ''}></picture>`).join('')}</div>
      ${imgs.length > 1 ? `<div class="sf-dots">${imgs.map((_, i) => `<button type="button" aria-label="Gambar ${i + 1}" data-dot="${i}"${i ? '' : ' aria-current="true"'}></button>`).join('')}</div>` : ''}`
    : '';
  const physical = p.type !== 'digital';
  const body = `<main class="sf">
${gallery}
<section class="sf-head">
  <h1>${esc(p.name)}</h1>
  <p class="sf-price"><b data-price>${range.min === range.max ? rp(range.min) : `${rp(range.min)} – ${rp(range.max)}`}</b> <s data-compare>${p.comparePrice > p.price ? rp(p.comparePrice) : ''}</s></p>
  ${p.wholesale && p.wholesale.length ? `<p class="sf-tier">Harga grosir: ${p.wholesale.map((t) => `beli ≥${t.min} ${rp(t.price)}/pcs`).join(' · ')}</p>` : ''}
</section>
${p.description ? `<section class="sf-desc">${p.description}</section>` : ''}
<form class="sf-form" id="checkout" novalidate>
  <h2>Pesan sekarang</h2>
  <div data-groups></div>
  <label class="sf-field"><span>Jumlah</span>
    <span class="sf-qty"><button type="button" data-qty="-1" aria-label="Kurangi">−</button><input name="qty" type="number" inputmode="numeric" min="${pp.minOrder}" ${pp.maxOrder ? `max="${pp.maxOrder}"` : ''} value="${pp.minOrder}"><button type="button" data-qty="1" aria-label="Tambah">+</button></span>
  </label>
  <h3>Data penerima</h3>
  <label class="sf-field"><span>Nama lengkap</span><input name="name" autocomplete="name" required maxlength="80"></label>
  <label class="sf-field"><span>Nomor WhatsApp</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" placeholder="08xxxxxxxxxx"></label>
  <label class="sf-field"><span>Email <small>(opsional)</small></span><input name="email" type="email" autocomplete="email" maxlength="120"></label>
  ${physical ? `<h3>Alamat pengiriman</h3>
  <label class="sf-field"><span>Provinsi</span><select name="prov" required><option value="">Pilih provinsi</option></select></label>
  <label class="sf-field"><span>Kota/Kabupaten</span><select name="kab" required disabled><option value="">Pilih kota/kabupaten</option></select></label>
  <label class="sf-field"><span>Kecamatan</span><select name="kec" required disabled><option value="">Pilih kecamatan</option></select></label>
  <label class="sf-field"><span>Alamat lengkap</span><textarea name="detail" rows="3" required maxlength="300" placeholder="Nama jalan, nomor rumah, RT/RW, patokan"></textarea></label>
  <label class="sf-field"><span>Kode pos <small>(opsional)</small></span><input name="postal" inputmode="numeric" maxlength="5"></label>
  <div class="sf-field"><span>Pengiriman</span><div data-ship class="sf-ship"><p class="sf-muted">Pilih alamat dulu untuk melihat ongkir.</p></div></div>` : ''}
  <div class="sf-field"><span>Kode kupon <small>(opsional)</small></span><span class="sf-coupon"><input name="code" maxlength="40" autocomplete="off" autocapitalize="characters" placeholder="Masukkan kode"><button type="button" data-apply>Pakai</button></span><small class="sf-code-msg" data-code-msg></small></div>
  <label class="sf-field"><span>Catatan <small>(opsional)</small></span><textarea name="note" rows="2" maxlength="500"></textarea></label>
  <input type="text" name="website" class="sf-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
  <div class="sf-summary" data-summary></div>
  <label class="sf-consent"><input type="checkbox" name="consent" required> <span>${esc(settings.privacyNote)}</span></label>
  <p class="sf-error" role="alert" data-error hidden></p>
  <button class="sf-buy" type="submit">Buat Pesanan</button>
  <p class="sf-muted sf-center">Pembayaran: transfer bank. Detail rekening muncul setelah pesanan dibuat.</p>
</form>
</main>
<script type="application/json" id="sf-data">${json({ product: pp, k: k || '', physical })}</script>`;
  const noindex = p.visibility !== 'public' || (p.seo && p.seo.noindex);
  return doc({
    title: (p.seo && p.seo.title) || `${p.name} · ${settings.storeName}`,
    description: (p.seo && p.seo.description) || '',
    image: imgs[0] ? imgUrl(imgs[0]) : '', robots: noindex ? 'noindex, nofollow' : 'index, follow', body, global, assetVersion,
  });
}

function orderPage(o, settings, { global, assetVersion }) {
  const st = orders.STATUSES[o.status];
  const wa = settings.whatsapp ? `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(orders.waText(o, settings))}` : '';
  const expired = o.status === 'unpaid' && Date.now() - Date.parse(o.createdAt) > settings.expiryHours * 3600e3;
  const body = `<main class="sf sf-order">
<section class="sf-card sf-ok">
  <p class="sf-muted">Nomor pesanan</p>
  <h1>${esc(o.no)}</h1>
  <p><span class="sf-badge sf-badge-${esc(o.status)}">${esc(st)}</span>${expired ? ' <span class="sf-badge sf-badge-cancelled">Lewat batas bayar</span>' : ''}</p>
</section>
${o.status === 'unpaid' ? `<section class="sf-card">
  <h2>Selesaikan pembayaran</h2>
  <p class="sf-total"><span>Total transfer</span><b data-copy="${o.total}">${rp(o.total)}</b></p>
  ${(o.payment.banks || []).map((b) => `<div class="sf-bank"><div><b>${esc(b.bank)}</b><span data-copy="${esc(b.number.replace(/\D/g, ''))}">${esc(b.number)}</span><small>a.n. ${esc(b.holder)}</small></div><button type="button" class="sf-copy" data-copy-btn="${esc(b.number.replace(/\D/g, ''))}">Salin</button></div>`).join('') || '<p class="sf-muted">Rekening akan dikirim admin lewat WhatsApp.</p>'}
  <p class="sf-muted">${esc(settings.paymentNote)}</p>
  ${wa ? `<a class="sf-buy sf-wa" href="${esc(wa)}" target="_blank" rel="noopener">Konfirmasi via WhatsApp</a>` : ''}
</section>` : ''}
${o.status === 'shipped' && o.shipping && o.shipping.resi ? `<section class="sf-card"><h2>Dikirim</h2><p>${esc(o.shipping.courier || o.shipping.name)} · No. resi <b>${esc(o.shipping.resi)}</b></p></section>` : ''}
<section class="sf-card">
  <h2>Rincian</h2>
  ${o.items.map((it) => `<div class="sf-item">${it.image ? `<img src="${esc(it.image)}" alt="" width="64" height="64">` : ''}<div><b>${esc(it.name)}${it.gift ? ' <em class="sf-gift">Hadiah</em>' : ''}</b>${it.label ? `<small>${esc(it.label)}</small>` : ''}<span>${it.qty} × ${it.gift ? 'Gratis' : rp(it.price)}</span></div></div>`).join('')}
  <p class="sf-row"><span>Subtotal</span><span>${rp(o.subtotal)}</span></p>
  ${o.discount && o.discount.amount ? `<p class="sf-row sf-disc"><span>Diskon ${esc(o.discount.code || o.discount.name)}</span><span>−${rp(o.discount.amount)}</span></p>` : ''}
  ${o.shipping ? `<p class="sf-row"><span>Ongkir (${esc(o.shipping.name)}${o.shipping.eta ? `, ${esc(o.shipping.eta)}` : ''})</span><span>${rp(o.shipping.cost)}</span></p>` : ''}
  ${o.discount && o.discount.shippingOff ? `<p class="sf-row sf-disc"><span>Potongan ongkir ${esc(o.discount.code || o.discount.name)}</span><span>−${rp(o.discount.shippingOff)}</span></p>` : ''}
  <p class="sf-row sf-strong"><span>Total</span><span>${rp(o.total)}</span></p>
</section>
<section class="sf-card">
  <h2>Penerima</h2>
  <p>${esc(o.customer.name)} · ${esc(o.customer.phone)}</p>
  ${o.address ? `<p class="sf-muted">${esc(o.address.detail)}, ${esc(o.address.kecName)}, ${esc(o.address.kabName)}, ${esc(o.address.provName)} ${esc(o.address.postal)}</p>` : ''}
</section>
<p class="sf-muted sf-center">Simpan link halaman ini untuk melihat status pesanan.</p>
</main>`;
  return doc({ title: `Pesanan ${o.no} · ${settings.storeName}`, robots: 'noindex, nofollow', body, global, assetVersion });
}

export function storefront({ assetVersion }) {
  const r = express.Router();
  const sameSite = (req, res, next) => {
    const origin = req.get('origin');
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Origin tidak diizinkan.' });
    next();
  };

  async function findBySlug(slug) {
    const data = await shop.loadProducts();
    return data.products.find((p) => p.slug === slug) || null;
  }

  r.get('/produk/:slug', async (req, res, next) => {
    try {
      const slug = String(req.params.slug).toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) return next();
      const [p, global, settings] = await Promise.all([findBySlug(slug), getGlobal(), orders.getSettings()]);
      const k = typeof req.query.k === 'string' ? req.query.k.slice(0, 40) : '';
      if (!p || !orders.buyable(p, k)) return next();
      res.set('Cache-Control', 'no-store'); // shows live stock state
      res.type('html').send(productPage(p, { global, assetVersion, settings, k }));
    } catch (e) {
      next(e);
    }
  });

  r.get('/pesanan/:no', async (req, res, next) => {
    try {
      const o = await orders.getOrder(req.params.no);
      if (!o || typeof req.query.t !== 'string' || req.query.t !== o.token) return next();
      const [global, settings] = await Promise.all([getGlobal(), orders.getSettings()]);
      res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
      res.type('html').send(orderPage(o, settings, { global, assetVersion }));
    } catch (e) {
      next(e);
    }
  });

  const api = express.Router();
  r.use('/api/shop', api);
  // Live price preview for the checkout form: shipping options, discount (coupon or automatic), gift and total.
  api.post('/quote', sameSite, rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: 'draft-7', legacyHeaders: false }), express.json({ limit: '4kb' }), async (req, res, next) => {
    try {
      const [data, settings, index, disc] = await Promise.all([shop.loadProducts(), orders.getSettings(), orders.loadIndex(), discounts.loadDiscounts()]);
      const b = req.body || {};
      const q = await orders.priceOrder({ pid: b.pid, k: b.k, sel: b.sel, qty: b.qty, address: b.address, shipping: b.shipping, code: b.code, customer: { phone: b.phone } },
        { data, settings, index, discountList: disc.discounts, strict: false });
      res.json({
        unitPrice: q.price.price, comparePrice: q.price.comparePrice, qty: q.qty, subtotal: q.subtotal, weight: q.weight,
        options: q.options, shipping: q.shipping ? { id: q.shipping.id, name: q.shipping.name, cost: q.shipping.cost } : null,
        discount: q.discount ? { name: q.discount.name, code: q.discount.code, amount: q.discount.amount, shippingOff: q.discount.shippingOff } : null,
        gift: q.gift ? { name: q.gift.name, label: q.gift.label, qty: q.gift.qty } : null,
        codeError: q.codeError, total: q.total,
      });
    } catch (e) {
      if (e instanceof orders.CheckoutError) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });

  api.post('/checkout', sameSite, rateLimit({ windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' }) }),
  express.json({ limit: '8kb' }), async (req, res, next) => {
    try {
      const b = req.body || {};
      if (b.website) return res.status(400).json({ error: 'Permintaan ditolak.' }); // honeypot (bots)
      const o = await shop.withShopLock(() => orders.createOrder(b, { ip: req.ip }));
      await audit(null, 'order.create', { no: o.no, total: o.total, actor: 'pembeli' });
      res.json({ no: o.no, url: `/pesanan/${o.no}?t=${o.token}` });
    } catch (e) {
      if (e instanceof orders.CheckoutError) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });
  return r;
}
