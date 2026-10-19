// Public shop pages: product gallery, variant/qty picker, address + shipping quote, checkout, copy buttons.
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const rp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let quoteTimer = null;

  // ---- copy buttons (order page)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy-btn]');
    if (!b) return;
    navigator.clipboard?.writeText(b.dataset.copyBtn).then(() => { b.textContent = 'Tersalin'; setTimeout(() => { b.textContent = 'Salin'; }, 1500); });
  });

  // ---- gallery dots
  const gal = $('[data-gallery]');
  if (gal) {
    const dots = [...document.querySelectorAll('[data-dot]')];
    dots.forEach((d) => d.addEventListener('click', () => gal.scrollTo({ left: gal.clientWidth * Number(d.dataset.dot), behavior: 'smooth' })));
    gal.addEventListener('scroll', () => {
      const i = Math.round(gal.scrollLeft / gal.clientWidth);
      dots.forEach((d, j) => d.setAttribute('aria-current', String(i === j)));
    }, { passive: true });
  }

  const dataEl = $('#sf-data');
  const form = $('#checkout');
  if (!dataEl || !form) return;
  const { product: P, k, physical } = JSON.parse(dataEl.textContent);
  const sel = {};
  const qtyIn = form.elements.qty;
  const errEl = $('[data-error]');
  let ship = null; // chosen shipping option
  let shipOptions = [];
  let Q = null; // last server quote (prices, shipping, discount, total)
  let code = '';
  let quoteSeq = 0;
  const codeMsg = $('[data-code-msg]');

  const params = new URLSearchParams(location.search);
  const source = {
    page: params.get('from') || (document.referrer && new URL(document.referrer).host === location.host ? new URL(document.referrer).pathname.slice(1, 81) : ''),
    ref: document.referrer ? new URL(document.referrer).host : '',
    utm_source: params.get('utm_source') || '', utm_medium: params.get('utm_medium') || '', utm_campaign: params.get('utm_campaign') || '',
    os: /android/i.test(navigator.userAgent) ? 'Android' : /iphone|ipad/i.test(navigator.userAgent) ? 'iOS' : /windows/i.test(navigator.userAgent) ? 'Windows' : /mac os/i.test(navigator.userAgent) ? 'macOS' : 'Lainnya',
  };

  // ---- price for the current selection (mirrors the server: later groups' overrides win; wholesale by qty)
  function current() {
    let price = P.price, compare = P.comparePrice, weight = P.weight;
    for (const g of P.groups) {
      const v = g.values.find((x) => x.id === sel[g.id]);
      if (!v) continue;
      if (v.price != null) price = v.price;
      if (v.comparePrice != null) compare = v.comparePrice;
      if (v.weight != null) weight = v.weight;
    }
    const qty = Math.max(1, Number(qtyIn.value) || 1);
    const tier = [...P.wholesale].reverse().find((t) => qty >= t.min);
    if (tier && tier.price < price) price = tier.price;
    return { price, compare, weight, qty };
  }

  // ---- variant buttons
  const groupsBox = $('[data-groups]');
  for (const g of P.groups) {
    const wrap = document.createElement('div');
    wrap.className = 'sf-field';
    const label = document.createElement('span');
    label.textContent = g.name;
    const opts = document.createElement('div');
    opts.className = 'sf-opts';
    for (const v of g.values) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sf-opt';
      b.textContent = v.name;
      b.setAttribute('aria-pressed', 'false');
      if (P.stockAxis === g.id && P.soldOut.includes(`${g.id}:${v.id}`)) { b.disabled = true; b.title = 'Stok habis'; }
      b.addEventListener('click', () => {
        sel[g.id] = v.id;
        opts.querySelectorAll('.sf-opt').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        if (v.image) { const img = $('[data-gallery] img'); if (img) { img.src = v.image; img.closest('picture')?.querySelector('source')?.remove(); } }
        update(true);
      });
      opts.append(b);
    }
    wrap.append(label, opts);
    groupsBox.append(wrap);
    if (g.values.length === 1) opts.firstChild.click();
  }

  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-qty]');
    if (!b) return;
    const min = P.minOrder || 1;
    const max = P.maxOrder || 9999;
    qtyIn.value = Math.min(max, Math.max(min, (Number(qtyIn.value) || min) + Number(b.dataset.qty)));
    update(true);
  });
  qtyIn.addEventListener('input', () => update(true));



  function update(requote) {
    const c = current();
    const partial = P.groups.some((g) => !sel[g.id]) && P.range.min !== P.range.max;
    $('[data-price]').textContent = partial ? `${rp(P.range.min)} – ${rp(P.range.max)}` : rp(c.price);
    $('[data-compare]').textContent = c.compare > c.price ? rp(c.compare) : '';
    const subtotal = Q ? Q.subtotal : c.price * c.qty;
    const rows = [`<p class="sf-row"><span>${c.qty} × ${rp(Q ? Q.unitPrice : c.price)}</span><span>${rp(subtotal)}</span></p>`];
    if (Q && Q.gift) rows.push(`<p class="sf-row sf-disc"><span>Hadiah: ${esc(Q.gift.name)}${Q.gift.label ? ` (${esc(Q.gift.label)})` : ''} × ${Q.gift.qty}</span><span>Gratis</span></p>`);
    if (Q && Q.discount && Q.discount.amount) rows.push(`<p class="sf-row sf-disc"><span>Diskon ${esc(Q.discount.code || Q.discount.name)}</span><span>−${rp(Q.discount.amount)}</span></p>`);
    if (physical) rows.push(`<p class="sf-row"><span>Ongkir${ship ? ` (${esc(ship.name)})` : ''}</span><span>${ship ? rp(ship.cost) : '-'}</span></p>`);
    if (Q && Q.discount && Q.discount.shippingOff) rows.push(`<p class="sf-row sf-disc"><span>Potongan ongkir</span><span>−${rp(Q.discount.shippingOff)}</span></p>`);
    const total = Q ? Q.total : subtotal + (ship ? ship.cost : 0);
    rows.push(`<p class="sf-row sf-strong"><span>Total</span><span>${rp(total)}</span></p>`);
    $('[data-summary]').innerHTML = rows.join(''); // numbers + escaped names only
    if (requote) quote();
  }

  // ---- address selects (data: public/assets/wilayah, Kepmendagri 2025, MIT)
  if (physical) {
    const { prov, kab, kec } = form.elements;
    let region = null;
    const fill = (select, list, placeholder) => {
      select.replaceChildren(new Option(placeholder, ''), ...list.map(([c2, name]) => new Option(name, c2)));
      select.disabled = !list.length;
    };
    fetch('/assets/wilayah/provinsi.json').then((r) => r.json()).then((list) => fill(prov, list, 'Pilih provinsi'));
    prov.addEventListener('change', async () => {
      fill(kab, [], 'Pilih kota/kabupaten');
      fill(kec, [], 'Pilih kecamatan');
      region = prov.value ? await fetch(`/assets/wilayah/${prov.value}.json`).then((r) => r.json()) : null;
      if (region) fill(kab, region.kab, 'Pilih kota/kabupaten');
      quote();
    });
    kab.addEventListener('change', () => {
      fill(kec, region && kab.value ? region.kec[kab.value] || [] : [], 'Pilih kecamatan');
      quote();
    });
  }

  // ---- coupon
  const codeIn = form.elements.code;
  const applyCode = () => { code = codeIn.value.trim(); quote(); };
  form.querySelector('[data-apply]').addEventListener('click', applyCode);
  codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } });
  form.elements.phone.addEventListener('change', () => { if (code) quote(); }); // coupons can be limited per customer

  function drawShipping() {
    const box = $('[data-ship]');
    if (!box) return;
    const { prov, kab } = form.elements;
    if (!prov.value || !kab.value) { box.innerHTML = '<p class="sf-muted">Pilih alamat dulu untuk melihat ongkir.</p>'; return; }
    box.replaceChildren(...(shipOptions.length ? shipOptions.map((o) => {
      const l = document.createElement('label');
      const r = document.createElement('input');
      r.type = 'radio'; r.name = 'shipping'; r.value = o.id; r.checked = Boolean(ship && ship.id === o.id);
      r.addEventListener('change', () => { ship = o; quote(); });
      const t = document.createElement('span');
      t.textContent = o.name;
      if (o.eta || o.note) { const s = document.createElement('small'); s.textContent = [o.eta, o.note].filter(Boolean).join(' · '); t.append(s); }
      const pr = document.createElement('b');
      pr.textContent = o.cost ? rp(o.cost) : 'Gratis';
      l.append(r, t, pr);
      return l;
    }) : [Object.assign(document.createElement('p'), { className: 'sf-muted', textContent: 'Pengiriman ke wilayah ini belum tersedia. Hubungi admin lewat WhatsApp.' })]));
  }

  function quote() {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(async () => {
      const f = form.elements;
      const seq = ++quoteSeq;
      const body = {
        pid: P.id, k, sel, qty: Number(qtyIn.value) || 1, code, phone: f.phone.value,
        address: physical ? { prov: f.prov.value, kab: f.kab.value } : null, shipping: ship ? ship.id : '',
      };
      const out = await fetch('/api/shop/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then((r) => r.json()).catch(() => null);
      if (seq !== quoteSeq || !out) return;
      if (out.error) { errEl.textContent = out.error; errEl.hidden = false; return; }
      errEl.hidden = true;
      Q = out;
      shipOptions = out.options || [];
      ship = out.shipping ? shipOptions.find((o) => o.id === out.shipping.id) || null : null;
      if (code) {
        codeMsg.textContent = out.codeError ? out.codeError : `Kupon ${out.discount ? out.discount.code || out.discount.name : ''} dipakai.`;
        codeMsg.className = `sf-code-msg ${out.codeError ? 'bad' : 'good'}`;
      } else {
        codeMsg.textContent = out.discount ? `Otomatis: ${out.discount.name}` : '';
        codeMsg.className = 'sf-code-msg good';
      }
      if (physical) drawShipping();
      update(false);
    }, 200);
  }

  update(true);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const f = form.elements;
    const missing = P.groups.find((g) => !sel[g.id]);
    const fail = (msg, el) => { errEl.textContent = msg; errEl.hidden = false; (el || errEl).scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    if (missing) return fail(`Pilih ${missing.name} dulu.`, groupsBox);
    if (code && Q && Q.codeError) return fail(`Kode kupon: ${Q.codeError} Hapus kodenya untuk lanjut tanpa kupon.`, codeIn);
    const body = {
      pid: P.id, k, sel, qty: Number(f.qty.value) || 1, code,
      customer: { name: f.name.value, phone: f.phone.value, email: f.email.value },
      address: physical ? { prov: f.prov.value, kab: f.kab.value, kec: f.kec.value, detail: f.detail.value, postal: f.postal.value } : null,
      shipping: ship ? ship.id : '', note: f.note.value, consent: f.consent.checked, website: f.website.value, source,
    };
    const btn = form.querySelector('.sf-buy');
    btn.disabled = true;
    btn.textContent = 'Memproses…';
    try {
      const r = await fetch('/api/shop/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || 'Pesanan gagal dibuat, coba lagi.');
      location.href = out.url;
    } catch (err) {
      fail(err.message);
      btn.disabled = false;
      btn.textContent = 'Buat Pesanan';
    }
  });
})();
