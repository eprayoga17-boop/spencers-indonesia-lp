// MealBlend Admin — vanilla JS, no build step. All user data is inserted as text (never innerHTML).
(() => {
  'use strict';

  const CSRF = document.querySelector('meta[name="csrf-token"]').content;
  const VIEW = document.body.dataset.view;
  const SLUG = document.body.dataset.slug;
  const EMAIL = document.body.dataset.email;
  const KIND = document.body.dataset.kind || 'page'; // editor: page | template
  const app = document.getElementById('app');

  // ------------------------------------------------------------ helpers
  const ICONS = {
    grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
    up: 'M12 19V5M5 12l7-7 7 7',
    down: 'M12 5v14M19 12l-7 7-7-7',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
    plus: 'M12 5v14M5 12h14',
    external: 'M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    image: 'M3 5h18v14H3zM8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 19',
    code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
    slider: 'M2 6h20v12H2zM7 21h.01M12 21h.01M17 21h.01',
    x: 'M18 6L6 18M6 6l12 12',
    back: 'M19 12H5M12 19l-7-7 7-7',
    phone: 'M7 2h10v20H7zM11 18h2',
    check: 'M20 6L9 17l-5-5',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    swap: 'M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16',
    undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
    cut: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
    paste: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9z',
    rename: 'M4 7V5h16v2M9 19h6M12 5v14',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
    calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  };
  const NS = 'http://www.w3.org/2000/svg';
  function icon(name) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'i');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', ICONS[name]);
    svg.append(p);
    return svg;
  }

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
    return el;
  }
  const iconBtn = (name, label, onclick, extra = {}) => h('button', { type: 'button', class: `icon-btn ${extra.class || ''}`, title: label, 'aria-label': label, onclick, ...extra.attrs }, icon(name));
  const btn = (label, onclick, cls = '', ic) => h('button', { type: 'button', class: `btn ${cls}`, onclick }, ic ? icon(ic) : null, label);
  const field = (label, control, hint) => h('label', { class: 'field' }, h('span', {}, label, hint ? h('span', { class: 'hint', text: ` ${hint}` }) : null), control);

  const fmtDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  const EVENT_LABELS = {
    'login.success': 'Login berhasil', 'login.fail': 'Login gagal', 'login.locked': 'Akun dikunci sementara', 'login.blocked': 'Login ditolak (terkunci)',
    logout: 'Logout', 'page.create': 'Buat halaman', 'page.duplicate': 'Duplikat halaman', 'page.archive': 'Arsipkan halaman', 'page.unarchive': 'Pulihkan arsip',
    'page.update': 'Ubah pengaturan halaman', 'page.restore': 'Muat versi lama ke draft', 'page.publish': 'Simpan (publikasi)', 'draft.discard': 'Buang draft',
    'page.export': 'Ekspor halaman', 'page.import': 'Impor halaman', 'global.update': 'Ubah pengaturan global',
    'template.create': 'Buat template', 'template.duplicate': 'Duplikat template', 'template.import': 'Impor template', 'template.delete': 'Hapus template',
    'template.publish': 'Simpan template', 'template.update': 'Ubah nama template', 'template.restore': 'Muat versi lama template', 'template.export': 'Ekspor template',
    'template.detach': 'Lepas template jadi section',
    'distributor.create': 'Tambah distributor', 'distributor.update': 'Ubah distributor', 'distributor.delete': 'Hapus distributor',
    'section.create': 'Tambah section', 'section.update': 'Ubah section', 'section.delete': 'Hapus section', 'section.duplicate': 'Duplikat section',
    'section.reorder': 'Ubah urutan section', 'section.cut': 'Cut section', 'section.paste': 'Tempel section',
    'badge.create': 'Tambah badge promo', 'badge.move': 'Geser badge promo', 'badge.delete': 'Hapus badge promo',
    'promo.create': 'Buat promo', 'promo.update': 'Ubah promo', 'promo.delete': 'Hapus promo', 'promo.publish': 'Publish promo', 'promo.discard': 'Buang draft promo',
    'product.create': 'Buat produk', 'product.update': 'Ubah produk', 'product.duplicate': 'Duplikat produk', 'product.delete': 'Hapus produk',
    'product.sku': 'Ubah SKU', 'stock.update': 'Ubah stok', 'category.create': 'Buat kategori', 'category.update': 'Ubah kategori',
    'category.delete': 'Hapus kategori', 'category.reorder': 'Urutkan kategori', 'catalog.create': 'Buat katalog', 'catalog.update': 'Ubah katalog',
    'catalog.delete': 'Hapus katalog', 'bundle.create': 'Buat bundle', 'bundle.update': 'Ubah bundle', 'bundle.duplicate': 'Duplikat bundle',
    'bundle.delete': 'Hapus bundle', 'product.bulk.delete': 'Hapus produk (massal)', 'product.bulk.public': 'Publikasikan produk (massal)',
    'product.bulk.hidden': 'Sembunyikan produk (massal)', 'product.bulk.link': 'Produk jadi link akses (massal)',
    'product.bulk.addCategory': 'Tambah kategori (massal)', 'product.bulk.removeCategory': 'Lepas kategori (massal)',
    'product.import.start': 'Mulai import produk', 'product.import.done': 'Import produk selesai', 'order.create': 'Order baru (checkout)',
    'order.status': 'Ubah status order', 'order.update': 'Ubah catatan/resi order', 'shop.settings': 'Ubah pengaturan toko',
    'discount.create': 'Buat diskon', 'discount.update': 'Ubah diskon', 'discount.duplicate': 'Duplikat diskon', 'discount.delete': 'Hapus diskon',
  };
  const FIELD_LABELS = { name: 'nama', title: 'judul', description: 'deskripsi', robots: 'indeks mesin pencari', keywords: 'keywords', category: 'kategori',
    thumbnail: 'thumbnail', slug: 'URL', settings: 'desain', maxWidth: 'lebar', font: 'font', favicon: 'favicon', categories: 'kategori',
    images: 'gambar', html: 'HTML', visible: 'tampil/sembunyi', spacing: 'jarak',
    banner: 'banner', badge: 'badge', bar: 'bar merah', jadwal: 'jadwal', toggle: 'toggle' };

  // ------------------------------------------------------------ toast / busy
  const toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  document.body.append(toastBox);
  function toast(msg, type = 'ok', action) {
    const t = h('div', { class: `toast ${type}` }, icon(type === 'error' ? 'x' : 'check'), h('span', { text: msg }),
      action ? h('button', { type: 'button', text: action.label, onclick: () => { t.remove(); action.onclick(); } }) : null);
    toastBox.append(t);
    setTimeout(() => t.remove(), action ? 9000 : type === 'error' ? 8000 : 3000);
  }
  let busyEl = null;
  let busyTimer = null;
  function busy(on) {
    clearTimeout(busyTimer);
    if (on && !busyEl) busyTimer = setTimeout(() => { busyEl = h('div', { class: 'busy', 'aria-label': 'Memproses' }, h('div', { class: 'spinner' })); document.body.append(busyEl); }, 150);
    if (!on && busyEl) { busyEl.remove(); busyEl = null; }
  }

  // ------------------------------------------------------------ API
  let draftRev = null;
  let lastActive = Date.now();

  // Session idle warning: the server logs out after 30 minutes without requests.
  const IDLE = 30 * 60 * 1000;
  let idleBox = null;
  setInterval(() => {
    if (VIEW === undefined || !document.getElementById('app')) return;
    const left = IDLE - (Date.now() - lastActive);
    if (left <= 0) { location.href = `/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    if (left > 2 * 60 * 1000 || idleBox) return;
    const count = h('strong');
    const tick = () => { const sec = Math.max(0, Math.round((IDLE - (Date.now() - lastActive)) / 1000)); count.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
    tick();
    const timer = setInterval(tick, 1000);
    idleBox = dialog({
      title: 'Sesi hampir berakhir', size: 'sm',
      body: h('p', {}, 'Demi keamanan, Anda akan keluar otomatis dalam ', count, '. Draft yang sudah tersimpan tetap aman.'),
      foot: [btn('Keluar', logout), btn('Tetap masuk', async () => { try { await api('GET', '/admin/api/ping'); } finally { idleBox && idleBox.close(); } }, 'btn-primary')],
      onclose: () => { clearInterval(timer); idleBox = null; },
    });
  }, 15000);
  // opt.rev: draft revision of another document (a template edited inside the page editor); it does not touch draftRev.
  async function api(method, url, body, opt = {}) {
    const own = 'rev' in opt;
    const rev = own ? opt.rev : draftRev;
    const opts = { method, headers: { 'x-csrf-token': CSRF, accept: 'application/json' }, credentials: 'same-origin' };
    if (rev && method !== 'GET') opts.headers['x-draft-rev'] = String(rev);
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try {
      res = await fetch(url, opts);
    } catch {
      throw new Error('Tidak bisa terhubung ke server.');
    }
    if (res.status === 401) { location.href = `/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`; throw new Error('Sesi berakhir.'); }
    lastActive = Date.now();
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Gagal (${res.status})`), { status: res.status, code: data.code });
    if (data.draft && !own) draftRev = data.draft.rev;
    return data;
  }
  async function run(fn, okMsg) {
    busy(true);
    try {
      const out = await fn();
      if (okMsg) toast(okMsg);
      return out;
    } catch (e) {
      if (e.code !== 'LIVE_CHANGED') toast(e.message, 'error', e.status === 409 ? { label: 'Muat ulang', onclick: () => location.reload() } : null);
      if (e.code === 'LIVE_CHANGED') throw e;
      return undefined;
    } finally {
      busy(false);
    }
  }

  // ------------------------------------------------------------ dialogs
  const anyDialogOpen = () => Boolean(document.querySelector('dialog[open]'));
  function dialog({ title, body, foot, size = '', onclose }) {
    const close = () => d.close();
    const d = h('dialog', { class: size, 'aria-label': title },
      h('div', { class: 'dlg' },
        h('div', { class: 'dlg-head' }, h('h2', { text: title }), iconBtn('x', 'Tutup', close)),
        h('div', { class: 'dlg-body' }, body),
        foot ? h('div', { class: 'dlg-foot' }, foot) : null));
    d.addEventListener('close', () => { d.remove(); onclose && onclose(); });
    document.body.append(d);
    d.showModal();
    return d;
  }
  function confirmBox(message, { ok = 'Ya, lanjutkan', danger = false, title = 'Konfirmasi' } = {}) {
    return new Promise((resolve) => {
      let result = false;
      const okBtn = btn(ok, () => { result = true; d.close(); }, danger ? 'btn-danger solid' : 'btn-primary');
      const d = dialog({ title, size: 'sm', body: h('p', { text: message }), foot: [btn('Batal', () => d.close()), okBtn], onclose: () => resolve(result) });
      okBtn.focus();
    });
  }
  function choiceBox(title, message, choices) {
    return new Promise((resolve) => {
      let result = null;
      const d = dialog({
        title, size: 'sm', body: h('p', { text: message }),
        foot: choices.map((c) => btn(c.label, () => { result = c.value; d.close(); }, c.cls || '')),
        onclose: () => resolve(result),
      });
    });
  }
  function promptBox(title, label, value = '', { ok = 'Simpan', maxlength = 120 } = {}) {
    return new Promise((resolve) => {
      let result = null;
      const input = h('input', { type: 'text', value, maxlength });
      const submit = () => { result = input.value.trim(); d.close(); };
      const d = dialog({
        title, size: 'sm',
        body: h('form', { onsubmit: (e) => { e.preventDefault(); submit(); } }, field(label, input)),
        foot: [btn('Batal', () => d.close()), btn(ok, submit, 'btn-primary')],
        onclose: () => resolve(result || null),
      });
      input.select();
    });
  }

  // ------------------------------------------------------------ context menu
  let openMenu = null;
  function closeMenu() {
    if (openMenu) { openMenu.remove(); openMenu = null; }
  }
  function contextMenu(x, y, items) {
    closeMenu();
    const menu = h('div', { class: 'ctx', role: 'menu' });
    for (const it of items) {
      if (it === '-') { menu.append(h('div', { class: 'ctx-sep', role: 'separator' })); continue; }
      menu.append(h('button', {
        type: 'button', role: 'menuitem', class: `ctx-item${it.danger ? ' danger' : ''}`, disabled: Boolean(it.disabled),
        onclick: () => { closeMenu(); it.action(); },
      }, icon(it.icon), h('span', { text: it.label }), it.kbd ? h('kbd', { text: it.kbd }) : null));
    }
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
    openMenu = menu;
    const enabled = () => [...menu.querySelectorAll('.ctx-item:not([disabled])')];
    enabled()[0]?.focus();
    menu.addEventListener('keydown', (e) => {
      const list = enabled();
      const i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); }
    });
  }
  document.addEventListener('pointerdown', (e) => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }, true);
  addEventListener('blur', closeMenu);
  addEventListener('resize', closeMenu);

  // ------------------------------------------------------------ shell (dark sidebar + app bar)
  Object.assign(ICONS, {
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    menu: 'M3 6h18M3 12h18M3 18h18',
    chevL: 'M15 18l-6-6 6-6',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
    share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    filter: 'M22 3H2l8 9.5V19l4 2v-8.5z',
    wa: 'M3 21l1.6-4.8A8.5 8.5 0 1 1 7.9 19.6zM8.5 9.5c.3 2.4 2.6 4.8 5 5.2l1.2-1.2 2.1 1-.3 1.6c-3.8.6-9.2-4.4-8.8-8.6l1.6-.4 1 2.1z',
    trendUp: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
    trendDown: 'M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6',
    cartNav: 'M3 3h2l2.4 12.2a2 2 0 0 0 2 1.8h8.2a2 2 0 0 0 2-1.6L21 8H6M9 21h.01M18 21h.01',
    percent: 'M19 5L5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
    tablet: 'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
    unlink: 'M18.8 13.2l1.6-1.6a4.5 4.5 0 0 0-6.4-6.4l-1.6 1.6M5.2 10.8l-1.6 1.6a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6M8 16l-3 3M16 8l3-3',
    chevD: 'M6 9l6 6 6-6',
    chevR: 'M9 18l6-6-6-6',
    home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
    banner: 'M3 4h18v16H3zM7 9h7M7 12h5M7 16h4',
    pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    more: 'M12 5h.01M12 12h.01M12 19h.01',
    type: 'M4 7V4h16v3M9 20h6M12 4v16',
    button: 'M5 7h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM8 12h8',
    spacer: 'M4 3h16M4 21h16M12 7v10M9 10l3-3 3 3M9 14l3 3 3-3',
    divider: 'M3 12h4M10 12h4M17 12h4',
    quote: 'M7 7H4v6h3l-2 4M17 7h-3v6h3l-2 4',
    video: 'M3 5h18v14H3zM10 9l5 3-5 3z',
    gallery: 'M7 3h14v14H7zM3 7v14h14M11 13l3-3 4 4',
    imagetext: 'M3 5h8v8H3zM14 6h7M14 10h7M3 17h18M3 21h12',
    faq: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
    testi: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5',
    timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 10v4l2 2M9 2h6',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    copytext: 'M9 9h11v11H9zM5 15H4V4h11v1M12 13h5M12 16h3',
    bank: 'M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M12 3l9 5H3z',
    popup: 'M3 5h18v14H3zM7 9h10v6H7z',
    bold: 'M6 4h7a4 4 0 0 1 0 8H6zM6 12h8a4 4 0 0 1 0 8H6z',
    italic: 'M19 4h-9M14 20H5M15 4 9 20',
    underline: 'M6 3v7a6 6 0 0 0 12 0V3M4 21h16',
    textColor: 'M4 21h16M7 17l5-13 5 13M8.6 13h6.8',
    marker: 'M9 11l-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4',
    alignL: 'M3 6h18M3 12h12M3 18h16',
    alignC: 'M3 6h18M6 12h12M4 18h16',
    alignR: 'M3 6h18M9 12h12M5 18h16',
    listOl: 'M10 6h11M10 12h11M10 18h11M4 4h1v4M4 8h2M6 20H4c0-1 2-2 2-3s-1-1.5-2-1',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    eraser: 'M4 7V4h13M10 4 6 20M4 20h5M15 15l5 5M20 15l-5 5',
  });
  const nf = (n) => Number(n || 0).toLocaleString('id-ID');
  const dLabel = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const pctDelta = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);
  const initials = (e) => String(e || '?').replace(/@.*/, '').split(/[._-]/).map((x) => x[0]).join('').slice(0, 2) || 'A';

  function themeToggle() {
    const b = h('button', { type: 'button', class: 'icon-btn theme-toggle' });
    const sync = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      b.replaceChildren(icon(dark ? 'sun' : 'moon'));
      b.title = dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap';
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', String(dark));
    };
    b.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme !== 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      try { localStorage.setItem('mb-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
      document.dispatchEvent(new CustomEvent('mb-theme'));
    });
    document.addEventListener('mb-theme', sync);
    sync();
    return b;
  }

  async function logout() {
    try { await fetch('/admin/logout', { method: 'POST', headers: { 'x-csrf-token': CSRF }, credentials: 'same-origin' }); } finally { location.href = '/admin/login'; }
  }

  /** App frame. active: dashboard | laporan | halaman. Returns { content, appbar, root }. */
  function layout({ active, title, subtitle, tools = [], collapsed, bare = false }) {
    let isCollapsed = collapsed;
    if (isCollapsed == null) { try { isCollapsed = localStorage.getItem('mb-side') === '1'; } catch { isCollapsed = false; } }
    const link = (id, href, ic, label) => h('a', { class: 'side-link', href, 'aria-current': active === id ? 'page' : null, title: label }, icon(ic), h('span', { text: label }));
    const root = h('div', { class: `layout${isCollapsed ? ' collapsed' : ''}` });
    const collapseBtn = h('button', { type: 'button', class: 'side-collapse', 'aria-label': 'Ciutkan menu', title: 'Ciutkan / lebarkan menu',
      onclick: () => {
        const on = root.classList.toggle('collapsed');
        if (!collapsed) { try { localStorage.setItem('mb-side', on ? '1' : '0'); } catch { /* ignore */ } }
      } }, icon('chevL'));
    const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Menu utama' },
      h('div', { class: 'side-top' },
        h('a', { class: 'side-brand', href: '/admin' }, h('img', { class: 'brand-logo', src: '/admin/static/logo.png', alt: '', width: 36, height: 36 }),
          h('span', {}, "Spencer's Indonesia", h('small', { text: 'Admin' }))),
        collapseBtn),
      h('div', { class: 'side-label', text: 'Menu' }),
      h('nav', { class: 'side-nav' },
        link('dashboard', '/admin', 'grid', 'Dashboard'),
        link('laporan', '/admin/reports', 'chart', 'Laporan'),
        link('halaman', '/admin/pages', 'file', 'Halaman'),
        link('distributor', '/admin/distributors', 'pin', 'Distributor'),
        link('promo', '/admin/promo', 'megaphone', 'Promo'),
        link('produk', '/admin/products', 'tag', 'Produk'),
        link('order', '/admin/orders', 'cartNav', 'Order'),
        link('diskon', '/admin/discounts', 'percent', 'Diskon')),
      h('div', { class: 'side-foot' },
        h('div', { class: 'side-user', title: EMAIL }, h('span', { class: 'avatar', 'aria-hidden': 'true', text: initials(EMAIL) }),
          h('span', { class: 'who2' }, h('b', { text: EMAIL }), h('span', { text: 'Admin' }))),
        h('button', { type: 'button', class: 'side-link', onclick: logout, title: 'Logout' }, icon('logout'), h('span', { text: 'Logout' }))));
    const content = h('div', { class: 'content' });
    const appbar = bare ? null : h('header', { class: 'appbar' },
      h('button', { type: 'button', class: 'icon-btn nav-toggle', 'aria-label': 'Buka menu', onclick: () => root.classList.add('nav-open') }, icon('menu')),
      h('div', { class: 'titles' }, h('h1', { text: title }), subtitle ? h('p', { text: subtitle }) : null),
      h('div', { class: 'tools' }, ...tools, themeToggle()));
    root.append(sidebar, h('div', { class: 'side-scrim', onclick: () => root.classList.remove('nav-open') }), h('div', { class: 'main' }, appbar, h('main', { id: 'main' }, content)));
    app.replaceWith(root);
    root.id = 'app';
    api('GET', '/admin/api/status').then((st) => {
      const dot = (el, title) => { if (el && !el.querySelector('.ndot')) el.append(h('span', { class: 'ndot', title, 'aria-label': title })); };
      if (st.unsavedPages) dot(root.querySelector('.side-link[href="/admin/pages"]'), 'Ada draft halaman yang belum disimpan');
      if (st.promoDraft) dot(root.querySelector('.side-link[href="/admin/promo"]'), 'Draft promo belum dipublish');
      if (st.unsavedPages - (st.unsavedTemplates || 0) > 0) dot(root.querySelector('.subtab[href="/admin/pages"]'), 'Ada draft halaman belum disimpan');
      if (st.unsavedTemplates) dot(root.querySelector('.subtab[href="/admin/templates"]'), 'Ada draft template belum disimpan');
    }).catch(() => {});
    return { root, content, appbar };
  }
  const subtabs = (items, current) => h('nav', { class: 'subtabs', 'aria-label': 'Sub menu' },
    items.map(([id, href, ic, label]) => h('a', { class: 'subtab', href, 'aria-current': id === current ? 'page' : null }, icon(ic), label)));

  // ------------------------------------------------------------ charts (SVG, theme-aware via CSS variables)
  function niceMax(v) {
    if (v <= 0) return 4;
    const p = 10 ** Math.floor(Math.log10(v));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

  /** Line chart: series[0] solid (current period) with area, series[1] dashed (previous period). */
  function lineChart({ labels, series, names, height = 230 }) {
    const box = h('div', { class: 'chart' });
    const tip = h('div', { class: 'chart-tip', hidden: true });
    let lastW = 0;
    const draw = () => {
      const W = Math.max(280, box.clientWidth);
      if (W === lastW) return;
      lastW = W;
      const H = height; const pl = 44; const pr = 14; const pt = 14; const pb = 30;
      const max = niceMax(Math.max(1, ...series.flat()));
      const n = labels.length;
      const x = (i) => pl + (n === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1));
      const y = (v) => pt + (H - pt - pb) * (1 - v / max);
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': `${names[0]}: total ${nf(series[0].reduce((a, b) => a + b, 0))}` });
      const defs = svgEl('defs');
      const grad = svgEl('linearGradient', { id: 'ga', x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.append(svgEl('stop', { offset: '0', 'stop-color': 'var(--chart-1)', 'stop-opacity': '.22' }), svgEl('stop', { offset: '1', 'stop-color': 'var(--chart-1)', 'stop-opacity': '0' }));
      defs.append(grad);
      svg.append(defs);
      for (let k = 0; k <= 4; k++) {
        const v = (max * k) / 4;
        svg.append(svgEl('line', { class: 'gl', x1: pl, x2: W - pr, y1: y(v), y2: y(v) }));
        const t = svgEl('text', { class: 'axis', x: pl - 8, y: y(v) + 4, 'text-anchor': 'end' });
        t.textContent = v >= 1000 ? `${Math.round(v / 100) / 10}rb` : nf(Math.round(v));
        svg.append(t);
      }
      const every = Math.ceil(n / Math.max(2, Math.floor((W - pl) / 64)));
      labels.forEach((l, i) => {
        if (i % every && i !== n - 1) return;
        const t = svgEl('text', { class: 'axis', x: x(i), y: H - 8, 'text-anchor': 'middle' });
        t.textContent = dLabel(l);
        svg.append(t);
      });
      const pts = (vals) => vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      if (series[1]) svg.append(svgEl('polyline', { class: 's2', points: pts(series[1]) }));
      svg.append(svgEl('polygon', { class: 'area', points: `${x(0)},${y(0)} ${pts(series[0])} ${x(n - 1)},${y(0)}` }));
      svg.append(svgEl('polyline', { class: 's1', points: pts(series[0]) }));
      const guide = svgEl('line', { class: 'guide', y1: pt, y2: H - pb, visibility: 'hidden' });
      const d1 = svgEl('circle', { class: 'dot', r: 4.5, visibility: 'hidden' });
      const d2 = svgEl('circle', { class: 'dot2', r: 3.5, visibility: 'hidden' });
      svg.append(guide, d2, d1);
      const show = (i) => {
        const X = x(i);
        guide.setAttribute('x1', X); guide.setAttribute('x2', X); guide.setAttribute('visibility', 'visible');
        d1.setAttribute('cx', X); d1.setAttribute('cy', y(series[0][i])); d1.setAttribute('visibility', 'visible');
        if (series[1]) { d2.setAttribute('cx', X); d2.setAttribute('cy', y(series[1][i])); d2.setAttribute('visibility', 'visible'); }
        tip.replaceChildren(h('div', { text: new Date(`${labels[i]}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long' }) }),
          h('div', {}, h('i'), `${names[0]}: `, h('b', { text: nf(series[0][i]) })),
          series[1] ? h('div', {}, h('i', { class: 'd2' }), `${names[1]}: `, h('b', { text: nf(series[1][i]) })) : null);
        tip.hidden = false;
        tip.style.left = `${Math.min(Math.max(X, 80), W - 80)}px`;
        tip.style.top = `${Math.min(y(series[0][i]), y(series[1] ? series[1][i] : series[0][i]))}px`;
      };
      const hide = () => { tip.hidden = true; for (const e of [guide, d1, d2]) e.setAttribute('visibility', 'hidden'); };
      const hit = svgEl('rect', { x: pl, y: 0, width: W - pl - pr, height: H, fill: 'transparent', tabindex: '0', 'aria-label': 'Geser untuk melihat angka per hari' });
      let cur = n - 1;
      hit.addEventListener('pointermove', (e) => { const r = svg.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; cur = Math.max(0, Math.min(n - 1, Math.round(((px - pl) / (W - pl - pr)) * (n - 1)))); show(cur); });
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('focus', () => show(cur));
      hit.addEventListener('blur', hide);
      hit.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); cur = Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))); show(cur); } });
      svg.append(hit);
      box.replaceChildren(svg, tip);
    };
    new ResizeObserver(() => draw()).observe(box);
    return box;
  }

  function sparkline(vals, good = true) {
    const W = 112; const H = 36; const max = Math.max(1, ...vals); const min = Math.min(...vals);
    const x = (i) => (i * W) / Math.max(1, vals.length - 1);
    const y = (v) => H - 3 - ((v - min) / Math.max(1, max - min)) * (H - 6);
    const svg = svgEl('svg', { class: 'spark', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
    const color = good ? 'var(--ok)' : 'var(--danger)';
    svg.append(svgEl('polyline', { points: vals.map((v, i) => `${x(i)},${y(v)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    return svg;
  }

  function donut(parts, centerLabel) {
    const total = parts.reduce((a, p) => a + p.n, 0) || 1;
    const R = 50; const C = 2 * Math.PI * R;
    const svg = svgEl('svg', { class: 'donut', viewBox: '0 0 128 128', role: 'img', 'aria-label': parts.map((p) => `${p.label} ${p.pct}%`).join(', ') });
    svg.append(svgEl('circle', { class: 'track', cx: 64, cy: 64, r: R }));
    let off = 0;
    parts.forEach((p, i) => {
      const len = (p.n / total) * C;
      svg.append(svgEl('circle', { class: `c${i + 1}`, cx: 64, cy: 64, r: R, 'stroke-dasharray': `${Math.max(0, len - 2)} ${C}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 64 64)' }));
      off += len;
    });
    const t = svgEl('text', { x: 64, y: 66 }); t.textContent = `${parts[0] ? parts[0].pct : 0}%`;
    const l = svgEl('text', { class: 'lbl', x: 64, y: 82 }); l.textContent = centerLabel;
    svg.append(t, l);
    return svg;
  }

  let mapData = null;
  async function indoMap(regions) {
    if (!mapData) mapData = await fetch('/admin/static/id-map.json').then((r) => r.json()).catch(() => null);
    if (!mapData) return h('p', { class: 'empty-sm', text: 'Peta tidak bisa dimuat.' });
    const byShape = new Map();
    for (const r of regions) byShape.set(r.map, (byShape.get(r.map) || 0) + r.n);
    const max = Math.max(1, ...byShape.values());
    const names = new Map();
    for (const r of regions) names.set(r.map, [...(names.get(r.map) || []), r.name]);
    const svg = svgEl('svg', { class: 'idmap', viewBox: mapData.viewBox, role: 'img', 'aria-label': 'Peta sebaran pengunjung per provinsi' });
    for (const p of mapData.provinces) {
      const v = byShape.get(p.code) || 0;
      const path = svgEl('path', { d: p.d });
      if (v) { path.classList.add('on'); path.setAttribute('fill-opacity', (0.18 + 0.82 * Math.sqrt(v / max)).toFixed(2)); }
      const t = svgEl('title'); t.textContent = `${(names.get(p.code) || [p.code]).join(', ')}: ${nf(v)} pengunjung`;
      path.append(t);
      svg.append(path);
    }
    return h('div', {}, svg, h('div', { class: 'map-legend' }, 'Sedikit', h('span', { class: 'scale' }), 'Banyak'));
  }

  /** Ranked list with an inline share bar. */
  function rankList(list, { key = (r) => r.key, limit = 8, empty = 'Belum ada data.', more: allowMore = true } = {}) {
    if (!list || !list.length) return h('p', { class: 'empty-sm', text: empty });
    const ol = h('ol', { class: 'rank' });
    const fill = (n) => ol.replaceChildren(...list.slice(0, n).map((r) => h('li', { style: `--p:${Math.max(1, r.pct)}`, title: `${key(r)} — ${nf(r.n)} (${r.pct}%)` },
      h('span', { class: 'bar', 'aria-hidden': 'true' }), h('span', { class: 'k', text: key(r) }), h('span', { class: 'n', text: nf(r.n) }), h('span', { class: 'pc', text: `${r.pct}%` }))));
    fill(limit);
    if (list.length <= limit || !allowMore) return ol;
    const more = btn('Perlihatkan lagi', () => { const open = more.dataset.open !== '1'; more.dataset.open = open ? '1' : '0'; fill(open ? list.length : limit); more.lastChild.textContent = open ? 'Ringkas' : 'Perlihatkan lagi'; }, 'btn-sm btn-ghost rank-more');
    return h('div', {}, ol, more);
  }
  const card = (title, body, { sub, more, cls = '' } = {}) => h('section', { class: `card2 ${cls}` },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', { text: title }), sub ? h('div', { class: 'sub2', text: sub }) : null), more || null), body);

  function kpi({ ic, tone = '', label, value, delta, spark, foot }) {
    const d = delta == null ? null : h('span', { class: `delta ${delta >= 0 ? 'up' : 'down'}` }, icon(delta >= 0 ? 'trendUp' : 'trendDown'), ` ${String(Math.abs(delta)).replace('.', ',')}% `, h('small', { text: 'vs periode lalu' }));
    return h('section', { class: 'card2 kpi' },
      h('div', { class: 'kpi-top' }, h('span', { class: `kpi-ic ${tone}` }, icon(ic)), h('div', {}, h('div', { class: 'kpi-label', text: label }), h('div', { class: 'kpi-val' }, value))),
      h('div', { class: 'kpi-foot' }, foot || d || h('span'), spark || null));
  }
  const host = location.host;
  const pageKey = (r) => `${host}/${r.key}`;

  // ============================================================ DASHBOARD
  async function viewDashboard() {
    const hello = new Date().getHours() < 11 ? 'Selamat pagi' : new Date().getHours() < 15 ? 'Selamat siang' : new Date().getHours() < 19 ? 'Selamat sore' : 'Selamat malam';
    const { content } = layout({ active: 'dashboard', title: 'Dashboard', subtitle: `${hello}, ${EMAIL.replace(/@.*/, '')}. Ringkasan 7 hari terakhir.`,
      tools: [h('a', { class: 'btn', href: '/admin/reports' }, icon('chart'), h('span', { class: 'hide-sm', text: 'Laporan lengkap' }))] });
    content.append(h('div', { class: 'kpis' }, [0, 1, 2, 3].map(() => h('div', { class: 'card2 skeleton', style: 'height:128px' }))));
    const d = await run(() => api('GET', '/admin/api/dashboard'));
    if (!d) return;
    const r = d.report;
    const social = r.domains.filter((x) => /instagram|facebook|threads|tiktok|twitter|x\.com|youtube|linktr|wl\.co/.test(x.key)).reduce((a, x) => a + x.n, 0);
    const socialPct = r.totals.landings ? Math.round((social / r.totals.landings) * 100) : 0;
    const vDelta = pctDelta(r.totals.visitors, r.totals.prevVisitors);
    const pDelta = pctDelta(r.totals.views, r.totals.prevViews);
    const promoCard = d.promo
      ? h('div', { class: 'promo-now' },
        d.promo.banner ? h('div', { class: 'pn-banner' }, h('img', { src: d.promo.banner, alt: `Banner ${d.promo.name}` })) : null,
        h('div', { class: 'pn-row' }, h('div', {}, h('div', { class: 'pn-name', text: d.promo.name }),
          h('span', { class: 'chip-st aktif', text: d.promo.kind === 'insidentil' ? 'Insidentil · aktif' : 'Regular · aktif' })),
        d.promo.badge ? h('img', { class: 'pn-badge', src: d.promo.badge, alt: '' }) : null),
        h('div', { class: 'pn-meta' },
          h('span', {}, icon('clock'), d.promo.reason === 'manual' ? 'Aktif lewat toggle manual' : d.promo.end ? `Sampai ${fmtDate(d.promo.end)} WIB` : 'Tanpa batas waktu'),
          d.nextPromo ? h('span', {}, icon('calendar'), `Berikutnya: ${d.nextPromo.name}, ${fmtDate(d.nextPromo.start)}`) : null,
          d.promoDraft ? h('span', { class: 'delta down' }, 'Ada perubahan promo yang belum dipublish') : null))
      : h('p', { class: 'empty-sm', text: 'Tidak ada promo yang berjalan saat ini.' });
    const types = { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet' };
    const typeParts = r.types.map((t) => ({ label: types[t.key] || t.key, n: t.n, pct: t.pct }));
    content.replaceChildren(
      r.sample ? h('div', { class: 'sample-note' }, icon('chart'), h('span', {}, h('b', { text: 'Data contoh. ' }), 'Angka di bawah ini belum data asli. Hapus di menu Laporan setelah ada pengunjung.')) : null,
      h('div', { class: 'kpis' },
        kpi({ ic: 'users', label: 'Pengunjung', value: nf(r.totals.visitors), delta: vDelta, spark: sparkline(r.series.map((s) => s.visitors), vDelta == null || vDelta >= 0) }),
        kpi({ ic: 'eye', tone: 'info', label: 'Page view', value: nf(r.totals.views), delta: pDelta, spark: sparkline(r.series.map((s) => s.views), pDelta == null || pDelta >= 0) }),
        kpi({ ic: 'share', tone: 'ok', label: 'Dari media sosial', value: h('span', {}, `${socialPct}`, h('small', { text: '%' })),
          foot: h('span', { class: 'delta' }, h('small', { text: r.domains[0] ? `Teratas: ${r.domains[0].key}` : 'Belum ada rujukan' })) }),
        kpi({ ic: 'wa', tone: 'warn', label: 'Klik WhatsApp', value: nf(r.totals.waClicks),
          foot: h('span', { class: 'delta up' }, `Konversi ${String(r.totals.conversion).replace('.', ',')}%`, h('small', { text: ' dari pengunjung' })) })),
      h('div', { class: 'dash-grid' },
        card('Tren kunjungan', h('div', {},
          h('div', { class: 'legend' }, h('span', {}, h('i'), '7 hari terakhir'), h('span', {}, h('i', { class: 'd2' }), '7 hari sebelumnya')),
          lineChart({ labels: r.series.map((s) => s.d), series: [r.series.map((s) => s.visitors), r.prevSeries.map((s) => s.visitors)], names: ['Pengunjung', 'Periode lalu'], height: 250 })),
        { cls: 's-8', more: h('a', { class: 'more', href: '/admin/reports', text: 'Lihat laporan →' }) }),
        card('Promo berjalan', promoCard, { cls: 's-4', more: h('a', { class: 'more', href: '/admin/promo', text: 'Kelola →' }) }),
        card('Sumber kunjungan', rankList(r.domains, { limit: 5, more: false, empty: 'Belum ada rujukan dari situs lain.' }), { cls: 's-7', sub: `${nf(r.totals.direct)} kunjungan langsung (tanpa rujukan)` }),
        card('Wilayah teratas', rankList(r.regions, { key: (x) => x.name, limit: 5, more: false, empty: 'Lokasi terisi setelah situs online.' }), { cls: 's-5', more: h('a', { class: 'more', href: '/admin/reports', text: 'Peta →' }) }),
        card('Perangkat', typeParts.length ? h('div', { class: 'donut-wrap' }, donut(typeParts, typeParts[0].label),
          h('ul', { class: 'dlist' }, typeParts.map((p, i) => h('li', {}, h('span', { class: `sw c${i + 1}` }), p.label, h('b', { text: `${p.pct}%` }))))) : h('p', { class: 'empty-sm', text: 'Belum ada data.' }), { cls: 's-5' }),
        card('Halaman terpopuler', rankList(r.pages, { key: pageKey, limit: 5, more: false }), { cls: 's-7' }),
        card('Aktivitas terbaru', d.activity.length ? h('ul', { class: 'act' }, d.activity.map((e) => h('li', {},
          h('span', { class: 'ai' }, icon(/promo/.test(e.event) ? 'megaphone' : /badge/.test(e.event) ? 'tag' : /publish/.test(e.event) ? 'check' : 'edit')),
          h('span', { class: 'at' }, EVENT_LABELS[e.event] || e.event, h('small', { text: [e.slug && `/${e.slug}`, e.name && `"${e.name}"`, e.actor].filter(Boolean).join(' · ') })),
          h('time', { datetime: e.ts, text: fmtDate(e.ts) })))) : h('p', { class: 'empty-sm', text: 'Belum ada aktivitas.' }),
        { cls: 's-12', more: h('a', { class: 'more', href: '/admin/reports?tab=log', text: 'Semua log →' }) })));
  }

  // ============================================================ LAPORAN
  async function renderRotators(body) {
    body.append(h('div', { class: 'card skeleton', style: 'height:220px' }));
    const d = await run(() => api('GET', '/admin/api/rotators/stats'));
    if (!d) return;
    const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    if (!d.rotators.length) {
      body.replaceChildren(h('div', { class: 'empty' }, icon('wa'), h('strong', { text: 'Belum ada CS Rotator' }),
        h('span', { text: 'Buat grup nomor WhatsApp di editor halaman → tab Global → CS Rotator, lalu pakai di Tombol (Tujuan: CS Rotator).' })));
      return;
    }
    body.replaceChildren(...d.rotators.map((r) => {
      const max = Math.max(1, ...r.numbers.map((n) => n.week));
      const sum = r.numbers.reduce((a, n) => a + n.week, 0);
      return h('section', { class: 'panel rot-rep' },
        h('div', { class: 'panel-head' }, h('h2', { text: r.name }), h('span', { class: 'fine', text: `${sum} chat dalam 7 hari · link /go/wa/${r.id}` })),
        r.numbers.length ? h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, h('th', { text: 'Nomor' }), h('th', { text: '7 hari terakhir' }), ...d.days.slice().reverse().map((x) => h('th', { class: 'num', text: dayLabel(x) })), h('th', { class: 'num', text: 'Total' }))),
          h('tbody', {}, r.numbers.map((n) => h('tr', {},
            h('td', {}, h('a', { href: `https://wa.me/${n.number}`, target: '_blank', rel: 'noopener', text: `+${n.number}` })),
            h('td', {}, h('div', { class: 'rot-bar', title: `${n.week} chat` }, h('span', { style: `width:${(n.week / max) * 100}%` }), h('b', { text: String(n.week) }))),
            ...n.perDay.slice().reverse().map((v) => h('td', { class: 'num', text: v ? String(v) : '·' })),
            h('td', { class: 'num', text: nf(n.total) })))))
          : h('p', { class: 'empty', text: 'Grup ini belum punya nomor.' }));
    }), h('p', { class: 'fine', text: 'Dihitung setiap kali pengunjung menekan tombol CS Rotator (sebelum diarahkan ke WhatsApp). Nomor diberi giliran merata.' }));
  }

  async function viewReports() {
    const params = new URLSearchParams(location.search);
    const tab = ['log', 'bagian', 'cs'].includes(params.get('tab')) ? params.get('tab') : 'ringkasan';
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const back = (n) => new Date(Date.parse(today) - n * 864e5).toISOString().slice(0, 10);
    let st = { preset: '7', from: back(6), to: today, slug: '' };
    try { st = { ...st, ...JSON.parse(sessionStorage.getItem('rep') || '{}') }; } catch { /* ignore */ }
    if (params.get('slug')) st.slug = params.get('slug');
    const preset = h('select', { 'aria-label': 'Rentang tanggal' },
      [['7', '7 hari terakhir'], ['14', '14 hari terakhir'], ['30', '30 hari terakhir'], ['90', '90 hari terakhir'], ['custom', 'Pilih tanggal…']].map(([v, t]) => h('option', { value: v, text: t, selected: st.preset === v })));
    const fromIn = h('input', { type: 'date', value: st.from, max: today, 'aria-label': 'Dari tanggal' });
    const toIn = h('input', { type: 'date', value: st.to, max: today, 'aria-label': 'Sampai tanggal' });
    const custom = h('span', { class: 'custom', hidden: st.preset !== 'custom' }, fromIn, '–', toIn);
    const pageSel = h('select', { 'aria-label': 'Filter halaman' }, h('option', { value: '', text: 'Semua halaman' }));
    const csvBtn = btn('CSV', () => {
      const a = h('a', { href: `/admin/api/reports.csv?from=${st.from}&to=${st.to}${st.slug ? `&slug=${st.slug}` : ''}`, download: '' });
      document.body.append(a); a.click(); a.remove();
    }, 'btn-sm', 'download');
    csvBtn.title = 'Unduh laporan (CSV untuk Excel / Google Sheets)';
    const filters = h('div', { class: 'filters' }, icon('filter'), preset, custom, pageSel, tab === 'ringkasan' ? csvBtn : null);
    const { content } = layout({ active: 'laporan', title: 'Laporan', subtitle: tab === 'cs' ? 'Berapa chat WhatsApp yang dikirim ke tiap nomor CS Rotator.' : tab === 'log' ? 'Catatan login dan setiap perubahan.' : tab === 'bagian' ? 'Bagian mana yang dilihat dan diklik pengunjung.' : 'Statistik kunjungan landing page.' });
    content.append(h('div', { class: 'tabbar' }, subtabs([['ringkasan', '/admin/reports', 'chart', 'Page View'], ['bagian', '/admin/reports?tab=bagian', 'grid', 'Per Bagian'], ['cs', '/admin/reports?tab=cs', 'wa', 'CS Rotator'], ['log', '/admin/reports?tab=log', 'clock', 'Log Aktivitas']], tab), tab === 'log' || tab === 'cs' ? null : filters));
    const body = h('div');
    content.append(body);
    if (tab === 'log') return renderLog(body);
    if (tab === 'cs') return renderRotators(body);

    const pagesReady = api('GET', '/admin/api/pages').then((d) => {
      for (const p of d.pages) pageSel.append(h('option', { value: p.slug, text: p.name, selected: p.slug === st.slug }));
      if (tab === 'bagian') {
        pageSel.firstElementChild.remove(); // per-section stats need one page
        if (!d.pages.some((p) => p.slug === st.slug) && d.pages[0]) st.slug = d.pages[0].slug;
        pageSel.value = st.slug;
      }
    }).catch(() => {});
    const save = () => { sessionStorage.setItem('rep', JSON.stringify(st)); load(); };
    preset.addEventListener('change', () => {
      st.preset = preset.value;
      custom.hidden = st.preset !== 'custom';
      if (st.preset !== 'custom') { st.from = back(Number(st.preset) - 1); st.to = today; save(); }
    });
    for (const el of [fromIn, toIn]) el.addEventListener('change', () => { if (fromIn.value && toIn.value && fromIn.value <= toIn.value) { st.from = fromIn.value; st.to = toIn.value; save(); } });
    pageSel.addEventListener('change', () => { st.slug = pageSel.value; save(); });

    async function load() {
      if (st.preset !== 'custom') { st.from = back(Number(st.preset) - 1); st.to = today; }
      if (tab === 'bagian') { await pagesReady; return loadSections(); }
      body.replaceChildren(h('div', { class: 'kpis' }, [0, 1, 2, 3].map(() => h('div', { class: 'card2 skeleton', style: 'height:118px' }))));
      const r = await run(() => api('GET', `/admin/api/reports?from=${st.from}&to=${st.to}${st.slug ? `&slug=${st.slug}` : ''}`));
      if (!r) return;
      const period = `${dLabel(r.from)} – ${dLabel(r.to)}`;
      const vDelta = pctDelta(r.totals.visitors, r.totals.prevVisitors);
      const pDelta = pctDelta(r.totals.views, r.totals.prevViews);
      const perVisit = r.totals.visitors ? (r.totals.views / r.totals.visitors).toFixed(2).replace('.', ',') : '0';
      const typesLbl = { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet' };
      const typeParts = r.types.map((t) => ({ label: typesLbl[t.key] || t.key, n: t.n, pct: t.pct }));
      const sampleBox = r.sample ? h('div', { class: 'sample-note' }, icon('chart'),
        h('span', {}, h('b', { text: 'Berisi data contoh. ' }), 'Data asli tetap tercatat terpisah.'),
        btn('Hapus data contoh', async () => {
          if (!(await confirmBox('Hapus semua data contoh? Data kunjungan asli tidak terhapus.', { ok: 'Hapus', danger: true }))) return;
          if (await run(() => api('DELETE', '/admin/api/reports/sample'), 'Data contoh dihapus.')) load();
        }, 'btn-sm btn-danger', 'trash')) : null;
      const mapBox = h('div', {}, h('div', { class: 'skeleton', style: 'aspect-ratio:2.6' }));
      indoMap(r.regions).then((m) => mapBox.replaceChildren(m));
      body.replaceChildren(...[
        sampleBox,
        h('div', { class: 'kpis' },
          kpi({ ic: 'users', label: 'Pengunjung', value: nf(r.totals.visitors), delta: vDelta, spark: sparkline(r.series.map((s) => s.visitors), vDelta == null || vDelta >= 0) }),
          kpi({ ic: 'eye', tone: 'info', label: 'Page view', value: nf(r.totals.views), delta: pDelta, spark: sparkline(r.series.map((s) => s.views), pDelta == null || pDelta >= 0) }),
          kpi({ ic: 'wa', tone: 'ok', label: 'Klik WhatsApp', value: nf(r.totals.waClicks), foot: h('span', { class: 'delta' }, h('small', { text: `Konversi ${String(r.totals.conversion).replace('.', ',')}% · ${perVisit} halaman/pengunjung` })) }),
          kpi({ ic: 'share', tone: 'ok', label: 'Kunjungan langsung', value: nf(r.totals.direct),
            foot: h('span', { class: 'delta' }, h('small', { text: r.totals.landings ? `${Math.round((r.totals.direct / r.totals.landings) * 100)}% tanpa rujukan` : '-' })) })),
        h('div', { class: 'dash-grid' },
          card('Pengunjung', h('div', {}, h('div', { class: 'legend' }, h('span', {}, h('i'), period), h('span', {}, h('i', { class: 'd2' }), `${dLabel(r.prevFrom)} – ${dLabel(r.prevTo)}`)),
            lineChart({ labels: r.series.map((s) => s.d), series: [r.series.map((s) => s.visitors), r.prevSeries.map((s) => s.visitors)], names: ['Pengunjung', 'Periode lalu'] })), { cls: 's-6', sub: 'Pengunjung unik per hari' }),
          card('Page view', h('div', {}, h('div', { class: 'legend' }, h('span', {}, h('i'), period), h('span', {}, h('i', { class: 'd2' }), 'Periode sebelumnya')),
            lineChart({ labels: r.series.map((s) => s.d), series: [r.series.map((s) => s.views), r.prevSeries.map((s) => s.views)], names: ['Page view', 'Periode lalu'] })), { cls: 's-6', sub: 'Total halaman dibuka per hari' }),
          card('Geografi pengunjung', h('div', { class: 'map-wrap' }, mapBox,
            h('div', {}, rankList(r.regions, { key: (x) => x.name, limit: 8, empty: 'Belum ada data lokasi.' }),
              h('p', { class: 'note2', text: r.regionCoverage < 100 ? `Lokasi diketahui untuk ${r.regionCoverage}% pengunjung. Lokasi diisi dari jaringan hosting setelah situs online.` : '' }))), { cls: 's-12' }),
          card('Halaman terpopuler', rankList(r.pages, { key: pageKey }), { cls: 's-6', sub: 'Berdasarkan page view' }),
          card('Halaman landasan', rankList(r.landings, { key: pageKey }), { cls: 's-6', sub: 'Halaman pertama yang dibuka pengunjung' }),
          card('Sumber domain', rankList(r.domains, { empty: 'Belum ada rujukan.' }), { cls: 's-6' }),
          card('Sumber URL', rankList(r.urls, { empty: 'Belum ada rujukan.' }), { cls: 's-6' }),
          card('Pencarian Google', rankList(r.google, { key: pageKey, empty: 'Belum ada kunjungan dari Google.' }), { cls: 's-6', sub: 'Halaman yang dibuka dari hasil pencarian Google' }),
          card('Perangkat', h('div', {}, typeParts.length ? h('div', { class: 'donut-wrap', style: 'margin-bottom:14px' }, donut(typeParts, typeParts[0].label),
            h('ul', { class: 'dlist' }, typeParts.map((p, i) => h('li', {}, h('span', { class: `sw c${i + 1}` }), p.label, h('b', { text: `${p.pct}%` }))))) : null,
          rankList(r.devices, { limit: 6 })), { cls: 's-6' }),
          card('Browser', rankList(r.browsers), { cls: 's-6' }),
          card('Sistem operasi', rankList(r.os), { cls: 's-6' })),
      ].filter(Boolean));
    }

    // ---------------------------------------------------------------- Per Bagian (section engagement + heatmap)
    async function loadSections() {
      body.replaceChildren(h('div', { class: 'kpis' }, [0, 1, 2, 3].map(() => h('div', { class: 'card2 skeleton', style: 'height:118px' }))));
      const r = await run(() => api('GET', `/admin/api/reports/sections?slug=${st.slug}&from=${st.from}&to=${st.to}`));
      if (!r) return;
      const secs = r.sections;
      const live = secs.filter((x) => !x.removed);
      const avgDepth = r.visitors ? Math.round((r.depthSum / r.visitors) * 10) / 10 : 0;
      const longest = [...live].sort((a, b) => b.avgSec - a.avgSec)[0];
      const KIND = { wa: 'WhatsApp', video: 'Video', slider: 'Slider', faq: 'FAQ', link: 'Link', copy: 'Salin teks', other: 'Lainnya' };
      const sec1 = (v) => `${String(v).replace('.', ',')} dtk`;
      let mode = 'perhatian';
      const frame = h('iframe', { class: 'hm-frame', title: 'Heatmap halaman', src: `/admin/live/${st.slug}`, loading: 'lazy' });
      const phone = h('div', { class: 'hm-phone' }, frame);
      const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Mode heatmap' },
        [['perhatian', 'Perhatian'], ['klik', 'Klik']].map(([v, t]) => h('label', {}, h('input', { type: 'radio', name: 'hm', value: v, checked: v === mode, onchange: () => { mode = v; paint(); } }), t)));
      const maxReach = Math.max(1, ...live.map((x) => x.reachPct));
      const heat = (p) => `hsl(${Math.round(220 - (p / 100) * 220)} 85% 55%)`; // blue (cold) -> red (hot)
      function paint() {
        const doc = frame.contentDocument;
        if (!doc || !doc.body) return;
        doc.querySelectorAll('.hm-layer').forEach((x) => x.remove());
        for (const x of secs) {
          const el = doc.getElementById(x.id);
          if (!el) continue;
          const layer = doc.createElement('div');
          layer.className = 'hm-layer';
          if (mode === 'perhatian') {
            layer.style.background = heat((x.reachPct / maxReach) * 100);
            layer.dataset.label = `${String(x.reachPct).replace('.', ',')}% · ${sec1(x.avgSec)}`;
          } else {
            const u = el.getBoundingClientRect().width / 320;
            for (const [px, py, kind] of x.pts) {
              const d = doc.createElement('i');
              d.className = `hm-dot k-${kind}`;
              d.style.left = `${px * u}px`;
              d.style.top = `${py * u}px`;
              layer.append(d);
            }
          }
          el.append(layer);
        }
      }
      frame.addEventListener('load', () => {
        const doc = frame.contentDocument;
        const css = doc.createElement('style');
        css.textContent = `.lp-sec{position:relative}.hm-layer{position:absolute;inset:0;z-index:40;pointer-events:none;mix-blend-mode:multiply;opacity:.55}
.hm-layer[data-label]::after{content:attr(data-label);position:absolute;top:6px;right:6px;padding:2px 8px;border-radius:99px;background:rgba(20,16,18,.82);color:#fff;font:600 11px/1.6 Arial,sans-serif;mix-blend-mode:normal}
.hm-layer:has(.hm-dot){background:none;opacity:1;mix-blend-mode:normal}
.hm-dot{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:radial-gradient(circle,rgba(255,60,40,.55),rgba(255,60,40,0) 70%)}
.hm-dot.k-wa{background:radial-gradient(circle,rgba(37,180,90,.6),rgba(37,180,90,0) 70%)}
.hm-dot.k-video{background:radial-gradient(circle,rgba(220,30,60,.6),rgba(220,30,60,0) 70%)}
.hm-dot.k-faq,.hm-dot.k-slider{background:radial-gradient(circle,rgba(40,110,240,.55),rgba(40,110,240,0) 70%)}
.hm-sel{outline:3px solid #ff8c00;outline-offset:-3px}`;
        doc.head.append(css);
        doc.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
        setTimeout(paint, 300);
      });
      const fit = () => { const w = phone.clientWidth; frame.style.transform = `scale(${Math.min(1.2, w / 414)})`; phone.style.height = `${Math.round(720 * Math.min(1.2, w / 414))}px`; };
      new ResizeObserver(fit).observe(phone);
      const focusSec = (id) => {
        const doc = frame.contentDocument;
        const el = doc && doc.getElementById(id);
        if (!el) return;
        doc.querySelectorAll('.hm-sel').forEach((x) => x.classList.remove('hm-sel'));
        el.classList.add('hm-sel');
        frame.contentWindow.scrollTo(0, el.getBoundingClientRect().top + frame.contentWindow.scrollY - 20);
      };
      const rows = h('ol', { class: 'funnel' }, secs.map((x, i) => {
        const clicks = Object.entries(x.clicks).sort((a, b) => b[1] - a[1]);
        return h('li', { class: x.removed ? 'removed' : '', tabindex: '0', onclick: () => focusSec(x.id), onkeydown: (e) => { if (e.key === 'Enter') focusSec(x.id); } },
          h('span', { class: 'fn-num', text: String(i + 1) }),
          h('div', { class: 'fn-main' },
            h('div', { class: 'fn-top' }, h('span', { class: 'fn-name', text: x.name }), h('span', { class: 'fn-pct', text: `${String(x.reachPct).replace('.', ',')}%` })),
            h('span', { class: 'fn-bar' }, h('span', { style: `width:${x.reachPct}%;background:${heat((x.reachPct / maxReach) * 100)}` })),
            h('div', { class: 'fn-meta' }, h('span', {}, icon('clock'), sec1(x.avgSec)),
              clicks.map(([k, n]) => h('span', { class: `fn-click k-${k}` }, `${KIND[k] || k} ${nf(n)}`)))));
      }));
      body.replaceChildren(...[
        r.sample ? h('div', { class: 'sample-note' }, icon('chart'), h('span', {}, h('b', { text: 'Berisi data contoh. ' }), 'Hapus data contoh di tab Page View.')) : null,
        h('div', { class: 'kpis' },
          kpi({ ic: 'users', label: 'Pengunjung halaman', value: nf(r.visitors), foot: h('span', { class: 'delta' }, h('small', { text: `${dLabel(r.from)} – ${dLabel(r.to)}` })) }),
          kpi({ ic: 'wa', tone: 'ok', label: 'Klik WhatsApp', value: nf(r.waClicks), foot: h('span', { class: 'delta up' }, `Konversi ${String(r.conversion).replace('.', ',')}%`) }),
          kpi({ ic: 'down', tone: 'info', label: 'Rata-rata section dilihat', value: h('span', {}, String(avgDepth).replace('.', ','), h('small', { text: ` / ${live.length}` })), foot: h('span', { class: 'delta' }, h('small', { text: 'Makin besar, makin jauh pengunjung menggulir' })) }),
          kpi({ ic: 'clock', tone: 'warn', label: 'Paling lama dilihat', value: h('span', { style: 'font-size:17px' }, longest ? longest.name : '-'), foot: h('span', { class: 'delta' }, h('small', { text: longest ? `rata-rata ${sec1(longest.avgSec)}` : '' })) })),
        h('div', { class: 'dash-grid' },
          card('Perjalanan pengunjung', h('div', {}, h('p', { class: 'fine', style: 'margin:-6px 0 12px', text: 'Urutan sesuai halaman. Persentase = pengunjung yang sampai ke bagian itu. Klik baris untuk melihatnya di heatmap.' }), rows), { cls: 's-7' }),
          card('Heatmap', h('div', {}, seg, h('div', { class: 'hm-legend' }, mode === 'perhatian' ? '' : '', h('span', { class: 'hm-scale' }), h('span', { text: 'Sedikit → banyak pengunjung' })), phone,
            h('p', { class: 'note2', text: 'Mode Klik: hijau = WhatsApp, merah = video, biru = FAQ/slider, oranye = lainnya.' })), { cls: 's-5 hm-card' })),
      ].filter(Boolean));
      fit();
    }

    load();
  }

  async function renderLog(body) {
    const data = await run(() => api('GET', '/admin/api/audit?limit=300'));
    if (!data) return;
    const detail = (e) => [e.slug && `/${e.slug}`, e.name && `"${e.name}"`, e.from && `dari: ${e.from}`,
      e.changed && e.changed.length && `ubah: ${e.changed.map((f) => FIELD_LABELS[f] || f).join(', ')}`, e.fields && e.fields.length && `ubah: ${e.fields.map((f) => FIELD_LABELS[f] || f).join(', ')}`]
      .filter(Boolean).join(' · ');
    body.append(h('p', { class: 'fine', style: 'margin:0 0 12px', text: '300 catatan terakhir. Disimpan 90 hari, lalu dihapus otomatis (UU PDP).' }),
      data.entries.length
        ? h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Waktu', 'Aktivitas', 'Admin', 'Detail', 'IP'].map((t) => h('th', { scope: 'col', text: t })))),
          h('tbody', {}, data.entries.map((e) => h('tr', {},
            h('td', { class: 'nowrap', text: fmtDate(e.ts) }),
            h('td', { class: /fail|locked|blocked/.test(e.event) ? 'ev-fail' : '', text: `${EVENT_LABELS[e.event] || e.event}${e.draft ? ' (draft)' : ''}` }),
            h('td', { text: e.actor || '-' }),
            h('td', { text: detail(e) || '-' }),
            h('td', { class: 'nowrap', text: e.ip || '-' }))))))
        : h('p', { class: 'empty', text: 'Belum ada aktivitas.' }));
  }

  // ============================================================ PAGES LIST
  async function viewPages() {
    const { content } = layout({ active: 'halaman', title: 'Halaman', subtitle: 'Page = landing page dengan link sendiri, disusun dari Template dan Section.',
      tools: [btn('Page baru', () => pageDialog(), 'btn-primary', 'plus')] });
    content.append(halamanTabs('pages'));
    const main = h('div');
    content.append(main);
    main.append(h('div', { class: 'cards' }, [0, 1, 2].map(() => h('div', { class: 'card skeleton', style: 'height:330px' }))));
    let filter = sessionStorage.getItem('cat') || '';
    let query = '';
    let pages = [];
    const search = h('label', { class: 'search' }, icon('search'),
      h('input', { type: 'search', placeholder: 'Cari nama atau link halaman…', 'aria-label': 'Cari halaman', oninput: (e) => { query = e.target.value.trim().toLowerCase(); renderCards(); } }));
    const cardsBox = h('div');
    async function load() {
      const data = await run(() => api('GET', '/admin/api/pages'));
      if (!data) return;
      pages = data.pages.filter((p) => p.slug !== 'home'); // the homepage has its own tab
      const cats = data.categories.filter((c) => pages.some((p) => p.category === c));
      if (filter && !cats.includes(filter)) filter = '';
      main.replaceChildren(...[
        h('div', { class: 'list-tools' }, search,
          cats.length ? h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter kategori' },
            ['', ...cats].map((c) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(c === filter), text: c || 'Semua Halaman',
              onclick: () => { filter = c; sessionStorage.setItem('cat', c); load(); } }))) : null),
        cardsBox,
        data.archived.length ? h('section', { class: 'archived' },
          h('h2', { text: 'Arsip' }),
          h('p', { class: 'fine', text: 'Halaman yang diarsipkan tidak tampil di publik, tapi bisa dipulihkan.' }),
          h('ul', {}, data.archived.map((a) => h('li', {},
            h('div', {}, h('strong', { text: a.title }), h('div', { class: 'fine', text: `/${a.slug} · diarsipkan ${fmtDate(a.archivedAt)}` })),
            btn('Pulihkan', async () => { if (await run(() => api('POST', `/admin/api/archived/${a.slug}/restore`), 'Halaman dipulihkan.')) load(); }, 'btn-sm'))))) : null,
      ].filter(Boolean));
      renderCards();
    }
    function renderCards() {
      const shown = pages.filter((p) => (!filter || p.category === filter) && (!query || `${p.name} ${p.slug}`.toLowerCase().includes(query)));
      cardsBox.replaceChildren(shown.length ? h('div', { class: 'cards' }, shown.map(card))
        : pages.length ? h('div', { class: 'empty' }, icon('search'), h('strong', { text: 'Tidak ada yang cocok' }), h('span', { text: 'Coba kata lain atau hapus filter kategori.' }))
          : h('div', { class: 'empty' }, icon('file'), h('strong', { text: 'Belum ada halaman' }), h('span', { text: 'Buat halaman baru, atau duplikat halaman yang sudah ada sebagai template.' }), btn('Halaman baru', () => pageDialog(), 'btn-primary btn-sm', 'plus')));
    }
    const coverOf = (p) => p.thumbnail || p.cover;
    function card(p) {
      return h('article', { class: 'card' },
        h('a', { class: 'card-thumb', href: `/admin/pages/${p.slug}`, tabindex: '-1', 'aria-hidden': 'true' },
          coverOf(p) ? h('img', { src: coverOf(p), alt: '', loading: 'lazy' }) : icon('image')),
        h('div', {}, h('h2', { text: p.name }), h('a', { class: 'slug', href: `/${p.slug}`, target: '_blank', rel: 'noopener', text: `${location.host}/${p.slug}` })),
        h('div', { class: 'meta' },
          h('span', { text: `${p.templates ? `${p.templates} template · ` : ''}${p.sections} section${p.category ? ` · ${p.category}` : ''}` }),
          h('span', { text: `Disimpan ${fmtDate(p.updatedAt)}${p.updatedBy ? ` oleh ${p.updatedBy}` : ''}` }),
          h('span', { class: 'badges' },
            p.unsaved ? h('span', { class: 'badge warn', text: 'Ada draft belum dipublikasikan' }) : null,
            p.duplicatedFrom ? h('span', { class: 'badge', text: `Duplikat dari /${p.duplicatedFrom}` }) : null)),
        h('div', { class: 'actions' },
          h('a', { class: 'btn btn-primary btn-sm', href: `/admin/pages/${p.slug}` }, icon('edit'), 'Edit'),
          h('a', { class: 'btn btn-sm', href: `/admin/reports?slug=${p.slug}` }, icon('chart'), 'Statistik'),
          h('a', { class: 'btn btn-sm', href: `/${p.slug}`, target: '_blank', rel: 'noopener' }, icon('external'), 'Lihat'),
          btn('Duplikat', () => pageDialog(p), 'btn-sm', 'copy'),
          btn('Arsipkan', async () => {
            if (!(await confirmBox(`Arsipkan "${p.name}"? Halaman /${p.slug} tidak akan bisa dibuka publik sampai dipulihkan.`, { ok: 'Arsipkan', danger: true }))) return;
            if (await run(() => api('POST', `/admin/api/pages/${p.slug}/archive`), 'Halaman diarsipkan.')) load();
          }, 'btn-sm btn-danger', 'archive')));
    }
    /** New page: pick "Kosong" or any existing page as template. `from` preselects a template (Duplikat). */
    function pageDialog(from) {
      if (anyDialogOpen()) return;
      let tpl = from ? from.slug : '';
      const title = h('input', { type: 'text', required: true, maxlength: 160, value: from ? `${from.name} (salinan)` : '' });
      const slug = h('input', { type: 'text', required: true, maxlength: 80, value: from ? `${from.slug}-2` : '', autocapitalize: 'off', spellcheck: false });
      const url = h('span', { class: 'hint' });
      let touched = Boolean(from);
      const sync = () => { url.textContent = `Alamat: ${location.host}/${slug.value || '…'}`; };
      title.addEventListener('input', () => { if (!touched) { slug.value = slugify(title.value); sync(); } });
      slug.addEventListener('input', () => { touched = true; slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); sync(); });
      sync();
      const option = (value, label, img, sub) => h('label', { class: 'tpl' },
        h('input', { type: 'radio', name: 'tpl', value, checked: value === tpl, onchange: () => { tpl = value; } }),
        h('span', { class: 'tpl-img' }, img ? h('img', { src: img, alt: '', loading: 'lazy' }) : icon(value ? 'image' : 'plus')),
        h('span', { class: 'tpl-name', text: label }), sub ? h('span', { class: 'tpl-sub', text: sub }) : null);
      const submit = async () => {
        if (!slug.value || !title.value.trim()) return toast('Nama dan link wajib diisi.', 'error');
        const out = await run(() => api('POST', '/admin/api/pages', { slug: slug.value, title: title.value, from: tpl || undefined }), tpl ? 'Halaman dibuat dari template.' : 'Halaman dibuat.');
        if (out) { d.close(); location.href = `/admin/pages/${out.slug}`; }
      };
      const d = dialog({
        title: from ? `Duplikat "${from.name}"` : 'Halaman baru',
        body: h('form', { onsubmit: (e) => { e.preventDefault(); submit(); } },
          h('div', { class: 'field' }, h('span', { text: 'Mulai dari' }),
            h('div', { class: 'tpl-grid', role: 'radiogroup', 'aria-label': 'Template' },
              option('', 'Halaman kosong', null, 'Tambah section sendiri'),
              pages.map((p) => option(p.slug, p.name, coverOf(p), `${p.sections} section`)))),
          h('div', { class: 'row' }, field('Nama halaman', title), h('label', { class: 'field' }, h('span', { text: 'Link (slug)' }), slug, url)),
          h('p', { class: 'fine', text: 'Isi halaman disalin persis (section, desain, SEO). Template yang dipakai tetap tersambung: mengubah template mengubah semua halaman yang memakainya.' }),
          h('button', { type: 'submit', hidden: true })),
        foot: [btn('Batal', () => d.close()), btn('Buat halaman', submit, 'btn-primary')],
      });
      title.focus();
    }
    load();
  }

  // ============================================================ TEMPLATES LIST
  const halamanTabs = (current) => subtabs([['homepage', '/admin/homepage', 'home', 'Homepage'], ['pages', '/admin/pages', 'file', 'Page'], ['templates', '/admin/templates', 'layers', 'Template']], current);

  // ============================================================ DISTRIBUTOR (one list for every "Daftar Distributor" element)
  async function viewDistributors() {
    const { content } = layout({ active: 'distributor', title: 'Distributor', subtitle: 'Distributor resmi per kota. Tampil di website lewat elemen "Daftar Distributor" (mis. di Homepage). Perubahan langsung live.',
      tools: [btn('Tambah distributor', () => form(null), 'btn-primary', 'plus')] });
    const main = h('div', {}, h('div', { class: 'card skeleton', style: 'height:300px' }));
    content.append(main);
    let data = { items: [], provinces: [], kinds: {} };
    let q = '';
    let prov = sessionStorage.getItem('dist-prov') || '';
    const coll = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });
    const fold = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    const guess = (url) => (/shopee|shp\.ee/i.test(url) ? 'shopee' : /tokopedia/i.test(url) ? 'tokopedia' : /tiktok/i.test(url) ? 'tiktok'
      : /lazada/i.test(url) ? 'lazada' : /wa\.me|whatsapp/i.test(url) ? 'wa' : /maps\.app|goo\.gl\/maps|google\.[a-z.]+\/maps/i.test(url) ? 'maps' : 'web');
    const SHORT = { shopee: 'Shopee', tokopedia: 'Tokopedia', tiktok: 'TikTok', lazada: 'Lazada', wa: 'WhatsApp', maps: 'Maps', web: 'Web' };

    async function load() {
      const d = await run(() => api('GET', '/admin/api/distributors'));
      if (!d) return;
      data = d;
      draw();
    }
    const listBox = h('div', { class: 'dist-list' });
    const countEl = h('span', { class: 'fine' });
    const search = h('input', { type: 'search', placeholder: 'Cari kota, area atau provinsi…', 'aria-label': 'Cari distributor', oninput: (e) => { q = fold(e.target.value.trim()); drawList(); } });
    const provSel = h('select', { 'aria-label': 'Filter provinsi', onchange: (e) => { prov = e.target.value; sessionStorage.setItem('dist-prov', prov); drawList(); } });
    function draw() {
      const used = [...new Set(data.items.map((d) => d.province))].sort(coll.compare);
      if (prov && !used.includes(prov)) prov = '';
      provSel.replaceChildren(h('option', { value: '', text: 'Semua provinsi' }), used.map((p) => h('option', { value: p, text: p, selected: p === prov })));
      main.replaceChildren(
        h('div', { class: 'list-tools' }, h('label', { class: 'search' }, icon('search'), search), provSel, countEl),
        listBox);
      drawList();
    }
    function drawList() {
      const shown = data.items.filter((d) => (!prov || d.province === prov) && (!q || fold(`${d.province} ${d.city} ${d.name}`).includes(q)));
      countEl.textContent = `${shown.length} dari ${data.items.length} distributor`;
      if (!data.items.length) {
        listBox.replaceChildren(h('div', { class: 'empty' }, icon('pin'), h('strong', { text: 'Belum ada distributor' }), h('span', { text: 'Tambahkan distributor pertama. Daftarnya otomatis tampil di elemen "Daftar Distributor".' }),
          btn('Tambah distributor', () => form(null), 'btn-primary btn-sm', 'plus')));
        return;
      }
      if (!shown.length) {
        listBox.replaceChildren(h('div', { class: 'empty' }, icon('search'), h('strong', { text: 'Tidak ada yang cocok' }), h('span', { text: 'Coba nama kota lain, atau pilih "Semua provinsi".' })));
        return;
      }
      const byProv = new Map();
      for (const d of shown) {
        if (!byProv.has(d.province)) byProv.set(d.province, new Map());
        const c = byProv.get(d.province);
        if (!c.has(d.city)) c.set(d.city, []);
        c.get(d.city).push(d);
      }
      listBox.replaceChildren(...[...byProv].sort((a, b) => coll.compare(a[0], b[0])).map(([p, cities]) => h('section', { class: 'dist-prov' },
        h('h2', {}, p || 'Tanpa provinsi', h('span', { class: 'badge', text: String([...cities.values()].reduce((n, l) => n + l.length, 0)) })),
        [...cities].sort((a, b) => coll.compare(a[0], b[0])).map(([city, list]) => h('div', { class: 'dist-city' },
          h('h3', { text: city }),
          h('ul', {}, list.sort((a, b) => b.top - a.top).map((d) => h('li', { class: 'dist-row' },
            h('div', { class: 'dist-main' },
              h('b', { text: d.name }), d.top ? h('span', { class: 'badge warn', text: 'TOP SELLER' }) : null,
              h('div', { class: 'dist-links' }, d.links.map((l) => h('a', { class: `dist-chip k-${l.type}`, href: l.url, target: '_blank', rel: 'noopener', title: l.url, text: SHORT[l.type] || l.label })))),
            h('div', { class: 'dist-act' },
              iconBtn('edit', `Edit ${d.name}`, () => form(d)),
              iconBtn('trash', `Hapus ${d.name}`, async () => {
                if (!(await confirmBox(`Hapus "${d.name}" (${d.city})? Langsung hilang dari website.`, { ok: 'Hapus', danger: true }))) return;
                if (await run(() => api('DELETE', `/admin/api/distributors/${d.id}`), 'Distributor dihapus.')) load();
              }, { class: 'danger' }))))))))));
    }

    function form(d) {
      if (anyDialogOpen()) return;
      const cur = d ? structuredClone(d) : { province: prov || '', city: '', name: '', top: false, links: [{ type: 'shopee', url: '' }] };
      const cities = (p) => [...new Set(data.items.filter((x) => x.province === p).map((x) => x.city))].sort(coll.compare);
      const dl = h('datalist', { id: 'dist-cities' });
      const fillCities = () => dl.replaceChildren(...cities(provIn.value).map((c) => h('option', { value: c })));
      const provIn = h('select', { required: true, onchange: fillCities },
        h('option', { value: '', text: 'Pilih provinsi…', disabled: true, selected: !cur.province }),
        [...new Set([...data.provinces, cur.province].filter(Boolean))].map((p) => h('option', { value: p, text: p, selected: p === cur.province })));
      const cityIn = h('input', { type: 'text', required: true, maxlength: 60, value: cur.city, list: 'dist-cities', placeholder: 'mis. Jakarta Barat, Surabaya' });
      const nameIn = h('input', { type: 'text', required: true, maxlength: 160, value: cur.name, placeholder: 'mis. Area Jakarta Barat 2, DKI Jakarta' });
      const topIn = h('input', { type: 'checkbox', checked: cur.top });
      fillCities();
      const linksBox = h('div', { class: 'dist-form-links' });
      const drawLinks = () => linksBox.replaceChildren(
        ...cur.links.map((l, i) => h('div', { class: 'dist-link-row' },
          h('select', { 'aria-label': `Jenis link ${i + 1}`, onchange: (e) => { l.type = e.target.value; l.label = ''; } },
            Object.entries(data.kinds).map(([k, label]) => h('option', { value: k, text: label, selected: l.type === k }))),
          h('input', { type: 'url', value: l.url, placeholder: 'https://…', 'aria-label': `Alamat link ${i + 1}`,
            oninput: (e) => { l.url = e.target.value.trim(); },
            onchange: (e) => { const g = guess(e.target.value); if (g !== 'web' && g !== l.type) { l.type = g; l.label = ''; drawLinks(); } } }),
          iconBtn('trash', `Hapus link ${i + 1}`, () => { cur.links.splice(i, 1); drawLinks(); }, { class: 'danger', attrs: { disabled: cur.links.length === 1 } }))),
        cur.links.length < 8 ? btn('Tambah link', () => { cur.links.push({ type: 'tokopedia', url: '' }); drawLinks(); linksBox.querySelector('.dist-link-row:last-of-type input')?.focus(); }, 'btn-sm', 'plus') : null);
      drawLinks();
      const save = async () => {
        const body = { province: provIn.value, city: cityIn.value, name: nameIn.value, top: topIn.checked,
          links: cur.links.filter((l) => l.url).map((l) => ({ type: l.type, url: /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}`, label: l.label || '' })) };
        if (!body.province) return toast('Pilih provinsi.', 'error');
        const out = await run(() => api(d ? 'PUT' : 'POST', d ? `/admin/api/distributors/${d.id}` : '/admin/api/distributors', body),
          d ? 'Distributor diperbarui. Sudah tampil di website.' : 'Distributor ditambahkan. Sudah tampil di website.');
        if (out) { dlg.close(); if (!d && prov && prov !== body.province) { prov = ''; sessionStorage.removeItem('dist-prov'); } load(); }
      };
      const dlg = dialog({
        title: d ? 'Edit distributor' : 'Tambah distributor',
        body: h('form', { class: 'dist-form', onsubmit: (e) => { e.preventDefault(); save(); } },
          h('div', { class: 'row' }, field('Provinsi', provIn), field('Kota / kabupaten', cityIn)), dl,
          field('Nama area', nameIn, '(tampil tebal di website)'),
          h('label', { class: 'check' }, topIn, h('span', { text: 'Tandai TOP SELLER (tampil paling atas di kotanya)' })),
          h('div', { class: 'field' }, h('span', {}, 'Link order', h('span', { class: 'hint', text: ' (jenis terdeteksi otomatis dari link)' })), linksBox)),
        foot: [btn('Batal', () => dlg.close()), btn(d ? 'Simpan perubahan' : 'Tambah', save, 'btn-primary')],
      });
      (d ? nameIn : provIn).focus();
    }
    load();
  }

  // ============================================================ HOMEPAGE (page "home", served at "/")
  async function viewHomepage() {
    const { content } = layout({ active: 'halaman', title: 'Halaman', subtitle: 'Homepage = halaman utama yang terbuka di alamat domain (/).' });
    content.append(halamanTabs('homepage'));
    const main = h('div', {}, h('div', { class: 'card skeleton', style: 'height:300px;max-width:820px' }));
    content.append(main);
    const data = await run(() => api('GET', '/admin/api/pages'));
    if (!data) return;
    const p = data.pages.find((x) => x.slug === 'home');
    if (!p) {
      main.replaceChildren(h('div', { class: 'empty' }, icon('home'), h('strong', { text: 'Homepage belum ada' }),
        h('span', { text: 'Pengunjung yang membuka alamat utama sementara diarahkan ke landing page MealBlend Women.' })));
      return;
    }
    const cover = p.thumbnail || p.cover;
    main.replaceChildren(h('article', { class: 'home-card' },
      h('a', { class: 'home-thumb', href: '/admin/pages/home', tabindex: '-1', 'aria-hidden': 'true' }, cover ? h('img', { src: cover, alt: '', loading: 'lazy' }) : icon('image')),
      h('div', { class: 'home-main' },
        h('span', { class: 'kind-chip' }, icon('home'), 'Homepage'),
        h('h2', { text: p.name }),
        h('a', { class: 'slug', href: '/', target: '_blank', rel: 'noopener', text: `${location.host}/` }),
        h('p', { class: 'fine', text: `${p.templates ? `${p.templates} template · ` : ''}${p.sections} section · Disimpan ${fmtDate(p.updatedAt)}${p.updatedBy ? ` oleh ${p.updatedBy}` : ''}` }),
        p.unsaved ? h('span', { class: 'badge warn', text: 'Ada draft belum dipublikasikan' }) : null,
        h('div', { class: 'actions' },
          h('a', { class: 'btn btn-primary', href: '/admin/pages/home' }, icon('edit'), 'Edit Homepage'),
          h('a', { class: 'btn', href: '/admin/reports?slug=home' }, icon('chart'), 'Statistik'),
          h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, icon('external'), 'Lihat')))));
  }

  /** Shows an export code with copy + download. */
  function exportCodeDialog(title, out, note) {
    const ta = h('textarea', { readonly: true, class: 'code-out', 'aria-label': 'Kode ekspor', spellcheck: false });
    ta.value = out.code;
    const copy = async () => { try { await navigator.clipboard.writeText(out.code); toast('Kode disalin.'); } catch { ta.select(); document.execCommand('copy'); toast('Kode disalin.'); } };
    const download = () => {
      const a = h('a', { href: URL.createObjectURL(new Blob([out.code], { type: 'text/plain' })), download: out.filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    dialog({ title, body: [h('p', { class: 'fine', text: note }), ta], foot: [btn('Unduh file', download, '', 'download'), btn('Salin kode', copy, 'btn-primary', 'copy')] });
  }

  async function viewTemplates() {
    const { content } = layout({ active: 'halaman', title: 'Halaman', subtitle: 'Template = kumpulan section yang bisa dipakai di banyak Page. Ubah sekali, semua Page ikut.',
      tools: [btn('Impor', () => importDialog(), '', 'upload'), btn('Template baru', () => newDialog(), 'btn-primary', 'plus')] });
    content.append(halamanTabs('templates'));
    const main = h('div');
    content.append(main);
    main.append(h('div', { class: 'tpl-list' }, [0, 1, 2].map(() => h('div', { class: 'tpl-row skeleton', style: 'height:88px' }))));
    let list = [];
    let query = '';
    const box = h('div');
    const search = h('label', { class: 'search' }, icon('search'),
      h('input', { type: 'search', placeholder: 'Cari nama template…', 'aria-label': 'Cari template', oninput: (e) => { query = e.target.value.trim().toLowerCase(); render(); } }));
    const count = h('span', { class: 'fine' });

    async function load() {
      const data = await run(() => api('GET', '/admin/api/templates'));
      if (!data) return;
      list = data.templates;
      main.replaceChildren(h('div', { class: 'list-tools' }, search, count), box);
      render();
    }
    function render() {
      const shown = list.filter((t) => !query || t.name.toLowerCase().includes(query));
      count.textContent = `${shown.length} dari ${list.length} template`;
      if (!list.length) {
        box.replaceChildren(h('div', { class: 'empty' }, icon('layers'), h('strong', { text: 'Belum ada template' }),
          h('span', { text: 'Template berisi section yang bisa dipakai di banyak Page sekaligus.' }), btn('Template baru', () => newDialog(), 'btn-primary btn-sm', 'plus')));
        return;
      }
      box.replaceChildren(shown.length ? h('ul', { class: 'tpl-list', 'aria-label': 'Daftar template' }, shown.map(row))
        : h('div', { class: 'empty' }, icon('search'), h('strong', { text: 'Tidak ada yang cocok' }), h('span', { text: 'Coba kata lain.' })));
    }
    function row(t) {
      const edit = `/admin/templates/${t.id}`;
      return h('li', { class: 'tpl-row' },
        h('a', { class: 'tpl-thumb', href: edit, tabindex: '-1', 'aria-hidden': 'true' }, t.cover ? h('img', { src: t.cover, alt: '', loading: 'lazy' }) : icon('layers')),
        h('div', { class: 'tpl-main' },
          h('a', { class: 'tpl-title', href: edit, text: t.name }),
          h('div', { class: 'fine', text: `${t.sections} section · disimpan ${fmtDate(t.updatedAt)}${t.updatedBy ? ` oleh ${t.updatedBy}` : ''}` }),
          t.unsaved ? h('div', { class: 'badges' }, h('span', { class: 'badge warn', text: 'Ada draft belum dipublikasikan' })) : null),
        h('div', { class: 'tpl-actions' },
          h('a', { class: 'btn btn-primary btn-sm', href: edit }, icon('edit'), 'Edit'),
          btn('Duplikat', () => duplicate(t), 'btn-sm', 'copy'),
          btn('Ekspor', () => exportOne(t), 'btn-sm', 'download'),
          btn('Hapus', () => remove(t), 'btn-sm btn-danger', 'trash')));
    }
    async function newDialog() {
      const name = await promptBox('Template baru', 'Nama template', '', { ok: 'Buat & edit', maxlength: 160 });
      if (!name) return;
      const out = await run(() => api('POST', '/admin/api/templates', { name }), 'Template dibuat.');
      if (out) location.href = `/admin/templates/${out.id}`;
    }
    async function duplicate(t) {
      const name = await promptBox(`Duplikat "${t.name}"`, 'Nama template baru', `${t.name} (salinan)`, { ok: 'Duplikat', maxlength: 160 });
      if (!name) return;
      if (await run(() => api('POST', '/admin/api/templates', { name, from: t.id }), 'Template diduplikat. Salinan ini tidak tersambung ke yang asli.')) load();
    }
    async function exportOne(t) {
      const out = await run(() => api('GET', `/admin/api/templates/${t.id}/export`));
      if (out) exportCodeDialog(`Ekspor "${t.name}"`, out, `${t.sections} section. Tempel di Impor (daftar Template) atau di Desain → Impor sebuah Page.`);
    }
    async function remove(t) {
      if (t.usedIn.length) return toast(`Masih dipakai di ${t.usedIn.map((p) => p.name).join(', ')}. Hapus dari Page itu dulu (atau "Lepas jadi section").`, 'error');
      if (!(await confirmBox(`Hapus template "${t.name}"? Versi terakhirnya tetap dicadangkan di riwayat server.`, { ok: 'Hapus', danger: true, title: 'Hapus template?' }))) return;
      if (await run(() => api('DELETE', `/admin/api/templates/${t.id}`), 'Template dihapus.')) load();
    }
    function importDialog() {
      const name = h('input', { type: 'text', maxlength: 160, placeholder: 'Kosongkan untuk memakai nama dari kode' });
      const ta = h('textarea', { class: 'code-out', placeholder: 'Tempel kode MBP1.… di sini', 'aria-label': 'Kode impor', spellcheck: false });
      const fileIn = h('input', { type: 'file', accept: '.mbpage,.txt', hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (f) ta.value = await f.text(); } });
      const go = async () => {
        if (!ta.value.trim()) return toast('Tempel kode atau pilih file.', 'error');
        const out = await run(() => api('POST', '/admin/api/templates/import', { code: ta.value, name: name.value }), 'Template diimpor.');
        if (out) { d.close(); location.href = `/admin/templates/${out.id}`; }
      };
      const d = dialog({
        title: 'Impor template',
        body: [h('p', { class: 'fine', text: 'Kode dari tombol Ekspor (template atau halaman) di sistem ini. Section-nya menjadi template baru.' }), field('Nama template', name), ta, fileIn],
        foot: [btn('Pilih file .mbpage', () => fileIn.click(), '', 'upload'), btn('Impor', go, 'btn-primary')],
      });
    }
    load();
  }

  // ============================================================ EDITOR (pages and templates)
  async function viewEditor() {
    let page = null; // draft summary
    let global = null; // draft global settings
    let draft = { canUndo: false, canRedo: false, dirty: false };
    let published = {};
    let clipboard = null;
    let options = { fonts: {}, widths: [] };
    let images = [];
    let livePromo;
    const IS_TPL = KIND === 'template';
    const IS_HOME = !IS_TPL && SLUG === 'home';
    const DOC = IS_TPL
      ? { api: `/admin/api/templates/${SLUG}`, preview: `/admin/preview-template/${SLUG}`, back: '/admin/templates', label: 'Template' }
      : { api: `/admin/api/pages/${SLUG}`, preview: `/admin/preview/${SLUG}`, back: IS_HOME ? '/admin/homepage' : '/admin/pages', label: IS_HOME ? 'Homepage' : 'Halaman' };
    let templates = {}; // templates used by this page: id -> { name, sections, badges, updatedAt }
    let usedIn = []; // template editor: pages that use this template
    const SK = `${KIND}:${SLUG}`;
    const expanded = new Set(); // template rows opened in the list
    let selected = sessionStorage.getItem(`sel:${SK}`) || null;
    let tab = sessionStorage.getItem(`tab:${SK}`) || 'konten';
    let device = 'mobile';
    try { device = localStorage.getItem('mb-device') || 'mobile'; } catch { /* ignore */ }

    // ---- header bar
    const nameEl = h('h1');
    const statusEl = h('span', { class: 'status', role: 'status' });
    const undoBtn = iconBtn('undo', 'Undo (Ctrl+Z)', () => undoRedo('undo'));
    const redoBtn = iconBtn('redo', 'Redo (Ctrl+Shift+Z)', () => undoRedo('redo'));
    const saveBtn = btn('Publikasikan', () => publish(), 'btn-primary', 'check');
    saveBtn.title = 'Publikasikan draft ke halaman live (Ctrl+S)';
    const liveLink = IS_TPL ? null : h('a', { class: 'btn', href: IS_HOME ? '/' : `/${SLUG}`, target: '_blank', rel: 'noopener', title: 'Buka halaman live' }, icon('external'), h('span', { class: 'hide-sm', text: 'Lihat live' }));
    const DEVICES = [['desktop', 'monitor', 'Desktop'], ['tablet', 'tablet', 'Tablet'], ['mobile', 'phone', 'HP']];
    const devBtns = DEVICES.map(([id, ic, label]) => h('button', { type: 'button', class: 'dev-btn', dataset: { dev: id }, title: `Preview ${label}`, 'aria-label': `Preview ${label}`, onclick: () => setDevice(id) }, icon(ic), h('span', { text: label })));
    const devToggle = h('div', { class: 'dev-toggle', role: 'group', 'aria-label': 'Ukuran preview' }, devBtns);
    const bar = h('header', { class: 'edit-bar' },
      h('button', { type: 'button', class: 'icon-btn nav-toggle', 'aria-label': 'Buka menu', onclick: () => document.getElementById('app').classList.add('nav-open') }, icon('menu')),
      btn('Kembali', () => goBack(), '', 'back'),
      h('div', { class: 'edit-title' }, IS_TPL ? h('span', { class: 'kind-chip' }, icon('layers'), 'Template') : IS_HOME ? h('span', { class: 'kind-chip' }, icon('home'), 'Homepage') : null, nameEl, statusEl),
      devToggle,
      h('div', { class: 'edit-tools' },
        h('div', { class: 'undo-group', role: 'group', 'aria-label': 'Undo dan redo' }, undoBtn, redoBtn),
        btn('Preview', () => { previewWrap.classList.add('open'); fitPhone(); }, 'only-narrow', 'phone'),
        IS_TPL ? null : btn('Coba di HP', () => phoneDialog(), 'hide-sm', 'phone'), liveLink, themeToggle(), saveBtn));

    // ---- tabs
    const TABS = IS_TPL ? [['konten', 'Konten'], ['riwayat', 'Riwayat']] : [['konten', 'Konten'], ['desain', 'Desain'], ['seo', 'SEO'], ['global', 'Global'], ['riwayat', 'Riwayat']];
    if (!TABS.some(([id]) => id === tab)) tab = 'konten';
    const tabBtns = TABS.map(([id, label]) => h('button', { type: 'button', role: 'tab', class: 'etab', id: `tab-${id}`, 'aria-controls': 'tabpanel', text: label, onclick: () => setTab(id) }));
    const tabList = h('div', { class: 'etabs', role: 'tablist', 'aria-label': 'Bagian editor',
      onkeydown: (e) => {
        const i = TABS.findIndex(([id]) => id === tab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0]; setTab(n); document.getElementById(`tab-${n}`).focus(); }
      } }, tabBtns);
    const panel = h('div', { class: 'epanel', role: 'tabpanel', id: 'tabpanel' });
    function setTab(id) {
      tab = id;
      sessionStorage.setItem(`tab:${SK}`, id);
      for (const b of tabBtns) { const on = b.id === `tab-${id}`; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
      panel.setAttribute('aria-labelledby', `tab-${id}`);
      renderTab();
    }

    // ---- iPhone 11 preview (414 × 896 pt screen)
    const iframe = h('iframe', { title: `Preview ${DOC.label.toLowerCase()}`, src: DOC.preview });
    const phone = h('div', { class: 'iphone' },
      h('span', { class: 'ib ib-silent' }), h('span', { class: 'ib ib-volup' }), h('span', { class: 'ib ib-voldown' }), h('span', { class: 'ib ib-power' }),
      h('div', { class: 'iphone-screen' },
        h('div', { class: 'iphone-status', 'aria-hidden': 'true' },
          h('span', { class: 'time', text: '9:41' }), h('span', { class: 'notch' }),
          h('span', { class: 'sicons' }, h('i', { class: 'sig' }, h('b'), h('b'), h('b'), h('b')), h('i', { class: 'wifi' }), h('i', { class: 'batt' }))),
        iframe,
        h('span', { class: 'home-ind', 'aria-hidden': 'true' })));
    const phoneBox = h('div', { class: 'phone-box' }, phone);
    const devCaption = h('p', { class: 'fine dev-caption' });
    const previewWrap = h('aside', { class: 'preview', 'aria-label': 'Preview' },
      phoneBox,
      devCaption,
      h('div', { class: 'only-narrow center' }, btn('Tutup preview', () => previewWrap.classList.remove('open'))));
    // Frame sizes (outer, incl. bezel). Desktop has no frame and fills the preview area.
    const FRAMES = { mobile: [466, 948, 'iPhone 11 · 414 × 896'], tablet: [868, 1228, 'iPad Air · 820 × 1180'], desktop: [0, 0, 'Desktop · lebar penuh'] };
    function fitPhone() {
      const dev = innerWidth <= 1180 ? 'mobile' : device; // narrow admin screens: full-screen phone preview
      previewWrap.dataset.dev = dev;
      const [fw, fh, label] = FRAMES[dev] || FRAMES.mobile;
      devCaption.textContent = `${label} · klik section di preview untuk memilihnya, klik kanan untuk menu.`;
      if (!fw) { phoneBox.style.removeProperty('--s'); return; }
      const r = previewWrap.getBoundingClientRect();
      const availW = Math.max(240, (previewWrap.classList.contains('open') ? innerWidth : r.width) - 48);
      const availH = Math.max(320, (previewWrap.classList.contains('open') ? innerHeight - 90 : r.height) - 72);
      const s = Math.min(1, availW / fw, availH / fh);
      phoneBox.style.setProperty('--s', s.toFixed(4));
    }
    function setDevice(id) {
      device = FRAMES[id] ? id : 'mobile';
      try { localStorage.setItem('mb-device', device); } catch { /* ignore */ }
      previewWrap.dataset.dev = device;
      for (const b of devBtns) b.setAttribute('aria-pressed', String(b.dataset.dev === device));
      fitPhone();
      requestAnimationFrame(() => markPreview(false));
    }
    addEventListener('resize', fitPhone);

    const { content: edContent, root: edRoot } = layout({ active: 'halaman', collapsed: true, bare: true });
    edRoot.querySelector('.main').prepend(bar);
    edRoot.querySelector('.sidebar').addEventListener('click', async (e) => {
      const target = e.target.closest('a[href], button.side-link');
      if (!target || !draft.dirty) return;
      e.preventDefault();
      e.stopPropagation();
      const go = () => (target.tagName === 'A' ? (location.href = target.href) : logout());
      const c = await choiceBox('Belum dipublikasikan', 'Perubahanmu aman tersimpan sebagai draft, tapi belum tampil di halaman live. Publikasikan sekarang?', [
        { label: 'Batal', value: null },
        { label: 'Nanti saja', value: 'leave', cls: 'btn-ghost' },
        { label: 'Publikasikan & pindah', value: 'save', cls: 'btn-primary' },
      ]);
      if (c === 'leave') go();
      if (c === 'save' && (await publish())) go();
    }, true);
    edContent.classList.add('editor-wrap', 'editor-v3');
    edRoot.classList.add('is-editor');
    edContent.append(h('div', { class: 'editor-inner' },
      h('div', { class: 'editor' },
        h('section', { class: 'panel' }, tabList, panel),
        previewWrap)));

    // ---- preview <-> list anchoring
    let restoreY = 0;
    let pulseNext = false;
    const pdoc = () => { try { return iframe.contentDocument; } catch { return null; } };
    function markPreview(pulse, scroll = true) {
      const doc = pdoc();
      if (!doc || !doc.body) return;
      for (const el of doc.querySelectorAll('.lp-sec.mb-sel')) el.classList.remove('mb-sel', 'mb-pulse', 'mb-grp', 'mb-grp-first', 'mb-grp-last');
      for (const el of doc.querySelectorAll('.mb-tag')) el.remove();
      // A template block is shown as one selection around all of its sections.
      const group = selected ? [...doc.querySelectorAll(`.lp-sec[data-ref="${CSS.escape(selected)}"]`)] : [];
      const el = group[0] || (selected && doc.getElementById(selected));
      if (!el) return;
      for (const g of group.length ? group : [el]) g.classList.add('mb-sel');
      if (group.length > 1) { group.forEach((g) => g.classList.add('mb-grp')); group[0].classList.add('mb-grp-first'); group.at(-1).classList.add('mb-grp-last'); }
      if (group.length) {
        const ref = page && page.sections.find((x) => x.id === selected);
        const tag = doc.createElement('div');
        tag.className = 'mb-tag';
        tag.textContent = `Template · ${(ref && templates[ref.template]?.name) || 'tanpa nama'}`;
        group[0].append(tag);
      }
      if (pulse && scroll) {
        const win = iframe.contentWindow;
        const top = el.getBoundingClientRect().top + win.scrollY;
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        win.scrollTo({ top: Math.max(0, top - 12), behavior: reduce ? 'auto' : 'smooth' });
      }
      if (pulse) {
        el.classList.remove('mb-pulse');
        void el.offsetWidth; // restart the animation
        el.classList.add('mb-pulse');
      }
    }
    iframe.addEventListener('load', () => {
      const doc = pdoc();
      if (!doc) return;
      const css = doc.createElement('link');
      css.rel = 'stylesheet';
      css.href = '/admin/static/preview.css';
      doc.head.append(css);
      iframe.contentWindow.scrollTo(0, restoreY);
      markPreview(pulseNext);
      pulseNext = false;
      // Clicks inside the preview select a section (links/videos/sliders are not triggered while editing).
      doc.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (suppressClick) return;
        const sec = e.target.closest('.lp-sec');
        if (sec) select(sec.dataset.ref || sec.id, { from: 'preview', inner: sec.id });
      }, true);
      doc.addEventListener('contextmenu', (e) => {
        const sec = e.target.closest('.lp-sec');
        if (!sec) return;
        e.preventDefault();
        const id = sec.dataset.ref || sec.id;
        select(id, { from: 'preview' });
        const r = iframe.getBoundingClientRect();
        const s = r.width / iframe.offsetWidth;
        sectionMenu(id, r.left + e.clientX * s, r.top + e.clientY * s);
      }, true);
      doc.addEventListener('keydown', (e) => handleKeys(e), true);
      setupBadgeDrag(doc);
      setupDrop(doc);
    });
    // Promo badges: drag to move, drag the corner dot to resize (centre stays put). Saved as a draft step.
    let suppressClick = false;
    function setupBadgeDrag(doc) {
      const win = iframe.contentWindow;
      for (const el of doc.querySelectorAll('.lp-badge')) {
        el.append(Object.assign(doc.createElement('span'), { className: 'mb-h', title: 'Tarik untuk mengubah ukuran' }));
        el.title = 'Badge promo — geser untuk memindah';
      }
      doc.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('.lp-badge');
        if (!el || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (el.closest('.lp-sec[data-ref]')) { // badge of a template: edited in that template
          const ref = el.closest('.lp-sec').dataset.ref;
          const t = page.sections.find((x) => x.id === ref);
          toast('Badge ini milik template. Atur posisinya di editor template.', 'ok', t ? { label: 'Buka template', onclick: () => window.open(`/admin/templates/${t.template}`, '_blank') } : undefined);
          return;
        }
        const unit = doc.querySelector('.lp').getBoundingClientRect().width / 320;
        const css = win.getComputedStyle(el);
        const start = { x: e.clientX, y: e.clientY, cx: +css.getPropertyValue('--cx'), cy: +css.getPropertyValue('--cy'), w: +css.getPropertyValue('--bw') };
        const resize = e.target.classList.contains('mb-h');
        let cur = { cx: start.cx, cy: start.cy, w: start.w };
        el.classList.add('mb-drag');
        el.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const dx = (ev.clientX - start.x) / unit;
          const dy = (ev.clientY - start.y) / unit;
          cur = resize ? { ...cur, w: Math.max(20, Math.min(320, start.w + dx * 2)) } : { ...cur, cx: start.cx + dx, cy: start.cy + dy };
          el.style.setProperty('--cx', cur.cx.toFixed(1));
          el.style.setProperty('--cy', cur.cy.toFixed(1));
          el.style.setProperty('--bw', cur.w.toFixed(1));
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          el.classList.remove('mb-drag');
          const moved = Math.abs(cur.cx - start.cx) + Math.abs(cur.cy - start.cy) + Math.abs(cur.w - start.w) > 0.4;
          if (!moved) return;
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 300);
          edit('PATCH', P(`/badges/${el.dataset.badge}`), { cx: +cur.cx.toFixed(1), cy: +cur.cy.toFixed(1), w: +cur.w.toFixed(1) },
            resize ? 'Ukuran badge disimpan ke draft.' : 'Posisi badge disimpan ke draft.', { reload: false });
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      }, true);
    }

    function focusInPreview(id) {
      const doc = pdoc();
      const el = doc && doc.getElementById(id);
      if (!el) return;
      iframe.contentWindow.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + iframe.contentWindow.scrollY - 12), behavior: 'auto' });
      el.classList.remove('mb-pulse'); void el.offsetWidth; el.classList.add('mb-pulse');
    }
    function reloadPreview(pulse = false) {
      try { restoreY = iframe.contentWindow.scrollY; } catch { restoreY = 0; }
      pulseNext = pulse;
      try { iframe.contentWindow.location.reload(); } catch { iframe.src = iframe.src; }
    }

    function select(id, { from = 'list', inner } = {}) {
      const s = page && page.sections.find((x) => x.id === id);
      if (from === 'preview' && s && s.type === 'template') { openTpl(id, inner); return; }
      if (from === 'preview' && s && ['block', 'image', 'html'].includes(s.type)) { openEditor(s, { scroll: false }); return; }
      if (mode && from === 'preview') { flushProps(); mode = null; if (tab === 'konten') renderTab(); }
      selected = id;
      sessionStorage.setItem(`sel:${SK}`, id);
      if (from === 'preview' && tab !== 'konten') setTab('konten');
      if (list) {
        for (const li of list.children) li.classList.toggle('selected', li.dataset.id === id);
        const row = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (row && from === 'preview') row.scrollIntoView({ block: 'center' }); // instant: Chrome cancels parallel smooth scrolls
      }
      markPreview(true, from !== 'preview'); // a section clicked in the preview is already in view
    }

    // ---- state
    function setState(out, { reload = true, pulse = false, render = true } = {}) {
      if (out.page) page = out.page;
      if (out.global) global = out.global;
      if (out.draft) draft = out.draft;
      if (out.published) published = out.published;
      if (out.clipboard !== undefined && out.clipboard !== null) clipboard = out.clipboard;
      if (out.images) images = out.images;
      if (out.options) options = out.options;
      if (out.promo !== undefined) livePromo = out.promo;
      if (out.templates) templates = out.templates;
      if (out.usedIn) usedIn = out.usedIn;
      if (selected && !page.sections.some((s) => s.id === selected)) selected = null;
      document.title = `${page.name} · Spencer's Indonesia`;
      nameEl.textContent = page.name;
      statusEl.textContent = draft.dirty ? 'Draft tersimpan · belum live' : `Live · ${fmtDate(published.updatedAt)}`;
      statusEl.title = draft.dirty ? 'Semua perubahan otomatis tersimpan sebagai draft. Klik Publikasikan agar tampil di halaman live.' : 'Halaman live sama dengan draft.';
      statusEl.className = `status ${draft.dirty ? 'dirty' : 'saved'}`;
      undoBtn.disabled = !draft.canUndo;
      redoBtn.disabled = !draft.canRedo;
      saveBtn.disabled = !draft.dirty;
      if (render) renderTab();
      if (reload) reloadPreview(pulse);
    }
    async function edit(method, url, body, msg, opts) {
      await flushProps();
      const out = await run(() => api(method, url, body), msg);
      if (out) {
        setState(out, opts);
        if (out.notes && out.notes.length) toast(`Catatan: ${out.notes.join(', ')}`);
      }
      return out;
    }
    const P = (p = '') => `${DOC.api}${p}`;

    async function undoRedo(which) {
      if ((which === 'undo' && !draft.canUndo) || (which === 'redo' && !draft.canRedo)) return;
      await edit('POST', P(`/${which}`), undefined, null);
    }

    async function publish(force = false) {
      await flushProps();
      const dirtyTpl = IS_TPL ? [] : [...new Set(page.sections.filter((x) => x.type === 'template').map((x) => x.template))].filter((id) => templates[id] && templates[id].dirty);
      if (dirtyTpl.length && !force) {
        const names = dirtyTpl.map((id) => `"${templates[id].name}"`).join(', ');
        const c = await choiceBox('Template juga diubah', `Template ${names} punya perubahan yang belum live. Template dipakai juga di halaman lain — mempublikasikannya mengubah semua halaman itu.`, [
          { label: 'Batal', value: null },
          { label: 'Halaman saja', value: 'page', cls: 'btn-ghost' },
          { label: 'Halaman + template', value: 'all', cls: 'btn-primary' },
        ]);
        if (!c) return false;
        if (c === 'all') {
          for (const id of dirtyTpl) {
            await loadTpl(id);
            const out = await run(() => api('POST', `/admin/api/templates/${id}/publish`, { force: false }, { rev: tplDocs[id]?.draft?.rev ?? null }));
            if (!out) return false;
            tplDocs[id] = { ...tplDocs[id], ...out };
            templates[id] = { ...templates[id], dirty: false };
          }
        }
      }
      try {
        const out = await run(() => api('POST', P('/publish'), { force }), IS_TPL ? null : 'Dipublikasikan. Halaman live sudah diperbarui.');
        if (out && IS_TPL) toast(out.usedIn && out.usedIn.length ? `Template dipublikasikan. ${out.usedIn.length} halaman yang memakainya ikut berubah.` : 'Template dipublikasikan.');
        if (!out) return false;
        if (out.slug && out.slug !== SLUG) { location.replace(`/admin/pages/${out.slug}`); return true; }
        setState(out, { reload: false });
        return true;
      } catch (e) {
        if (e.code === 'LIVE_CHANGED' && (await confirmBox(`${e.message} Timpa dengan draft ini?`, { ok: 'Timpa & publikasikan', danger: true }))) return publish(true);
        return false;
      }
    }

    async function phoneDialog() {
      const out = await run(() => api('POST', P('/phone-link')));
      if (!out) return;
      const svg = new DOMParser().parseFromString(out.svg, 'image/svg+xml').documentElement;
      svg.setAttribute('class', 'qr');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Kode QR link preview');
      const copy = async () => { try { await navigator.clipboard.writeText(out.url); toast('Link disalin.'); } catch { toast(out.url); } };
      dialog({
        title: 'Coba di HP', size: 'sm',
        body: h('div', { class: 'qr-box' }, document.importNode(svg, true),
          h('p', { text: 'Pindai dengan kamera HP untuk melihat draft halaman ini sebelum dipublikasikan. Perubahan berikutnya ikut tampil setelah halaman di HP dimuat ulang.' }),
          h('code', { class: 'qr-url', text: out.url }),
          h('p', { class: 'fine', text: `Berlaku sampai ${fmtDate(out.expiresAt)}. Link ini tidak diindeks Google dan tidak dihitung di Laporan.` }),
          out.local ? h('p', { class: 'note', text: 'Mode lokal: HP harus terhubung ke Wi-Fi yang sama dengan komputer ini. Jika tidak terbuka, izinkan Node.js di Windows Firewall.' }) : null),
        foot: [btn('Salin link', copy, 'btn-primary', 'copy')],
      });
    }

    async function goBack() {
      await flushProps();
      if (!draft.dirty) { location.href = DOC.back; return; }
      const c = await choiceBox('Belum dipublikasikan', 'Perubahanmu tersimpan sebagai draft tapi belum live. Apa yang ingin dilakukan?', [
        { label: 'Batal', value: null },
        { label: 'Buang perubahan', value: 'discard', cls: 'btn-danger' },
        { label: 'Publikasikan & keluar', value: 'save', cls: 'btn-primary' },
        { label: 'Keluar, simpan sebagai draft', value: 'leave', cls: 'btn-ghost' },
      ]);
      if (c === 'save' && (await publish())) location.href = DOC.back;
      if (c === 'discard' && (await run(() => api('POST', P('/discard'))))) location.href = DOC.back;
      if (c === 'leave') location.href = DOC.back;
    }

    // ---- keyboard shortcuts
    function handleKeys(e) {
      if (anyDialogOpen() || openMenu) return;
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target && e.target.ownerDocument === document ? e.target : null;
      if (isTyping(target)) return;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') { e.preventDefault(); undoRedo(e.shiftKey ? 'redo' : 'undo'); }
      else if (mod && k === 'y') { e.preventDefault(); undoRedo('redo'); }
      else if (mod && k === 's') { e.preventDefault(); if (draft.dirty) publish(); }
      else if (selected && mod && k === 'c') { e.preventDefault(); clip('copy', selected); }
      else if (selected && mod && k === 'x') { e.preventDefault(); clip('cut', selected); }
      else if (mod && k === 'v') { e.preventDefault(); paste(1); }
      else if (selected && (e.key === 'Delete')) { e.preventDefault(); const s = page.sections.find((x) => x.id === selected); if (s) remove(s); }
      else if (selected && e.key === 'F2') { e.preventDefault(); startRename(selected); }
    }
    document.addEventListener('keydown', handleKeys);
    if (!IS_TPL) {
      const stamp = (t) => JSON.stringify(Object.entries(t || {}).map(([k, v]) => [k, v.updatedAt]).sort());
      addEventListener('focus', async () => {
        if (!page || !page.sections.some((x) => x.type === 'template')) return;
        const out = await api('GET', P()).catch(() => null);
        if (out && stamp(out.templates) !== stamp(templates)) { setState(out); toast('Template diperbarui. Preview dimuat ulang.'); }
      });
    }

    // ============================================================ tab: Konten
    let list = null;
    const TYPE_LABEL = { image: 'Gambar', html: 'HTML', promo: '[PROMO]', template: 'Template', block: 'Elemen' };
    const promoLocked = () => toast('Isi section [PROMO] mengikuti promo yang aktif. Ubah di menu Promo.', 'ok', { label: 'Buka Promo', onclick: () => window.open('/admin/promo', '_blank') });
    const openSection = (s) => (s.type === 'template' ? openTpl(s.id) : s.type === 'promo' ? promoLocked() : openEditor(s));
    function renderKonten() {
      if (mode) {
        const t = targetOf(mode);
        if (mode.view === 'picker') return renderPicker(t);
        if (mode.view === 'tpl') return renderTplPanel(mode.ref);
        if (mode.view === 'new') return renderNewPanel(mode.type, t);
        const sec = t.sections().find((x) => x.id === mode.id);
        if (sec && sec.type === 'block' && blockDefs && blockDefs.blocks[sec.kind]) return renderBlockPanel(sec, t);
        if (sec && sec.type === 'image') return renderImagePanel(sec, t);
        if (sec && sec.type === 'html') return renderHtmlPanel(sec, t);
        mode = mode.tpl ? { view: 'tpl', ref: mode.tpl } : null;
        if (mode) return renderTplPanel(mode.ref);
      }
      list = h('ol', { class: 'sections', 'aria-label': IS_TPL ? 'Section template' : 'Isi halaman' });
      renderList();
      return [
        ...(IS_TPL ? templateFields() : pageFields()),
        promoWarnBox(),
        h('div', { class: 'sec-head' }, h('h2', {}, IS_TPL ? 'Section ' : 'Isi halaman ', h('span', { class: 'badge', text: String(page.sections.length) })),
          clipboard ? btn('Tempel', () => paste(1), 'btn-sm', 'paste') : null),
        h('p', { class: 'fine', text: IS_TPL
          ? 'Geser lewat pegangan atau pakai tombol naik/turun. Klik kanan untuk menu.'
          : 'Susun dari Template dan Section. Template tersambung: ubah di editor template, semua halaman yang memakainya ikut berubah.' }),
        list,
        addButton(),
      ];
    }

    function pageFields() {
      const name = h('input', { type: 'text', maxlength: 160, value: page.name, onchange: (e) => patch({ name: e.target.value }, 'Nama halaman diubah.') });
      const slugIn = h('input', { type: 'text', maxlength: 80, value: page.slug, autocapitalize: 'off', spellcheck: false,
        oninput: (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); },
        onchange: (e) => patch({ slug: e.target.value }, 'URL diubah. Berlaku setelah Publikasikan.') });
      const cat = h('select', { onchange: async (e) => {
        if (e.target.value === '__new') {
          const n = await promptBox('Kategori baru', 'Nama kategori', '', { ok: 'Tambah', maxlength: 60 });
          if (!n) { e.target.value = page.category; return; }
          const out = await edit('PATCH', P('/global'), { categories: [...global.categories, n] }, null, { reload: false });
          if (out) patch({ category: n }, `Kategori "${n}" dipakai.`);
          return;
        }
        patch({ category: e.target.value }, 'Kategori diubah.');
      } },
      h('option', { value: '', text: 'Semua Halaman' }),
      [...new Set([...global.categories, page.category].filter(Boolean))].map((c) => h('option', { value: c, text: c, selected: c === page.category })),
      h('option', { value: '__new', text: '+ Kategori baru…' }));
      return [
        field('Nama Halaman', name, '(hanya terlihat di admin)'),
        IS_HOME ? h('div', { class: 'field' }, h('span', {}, 'URL Path', h('span', { class: 'hint', text: ' (Homepage selalu di alamat utama)' })), h('div', { class: 'prefix' }, h('span', { text: `${location.host}/` }), h('input', { type: 'text', value: '', disabled: true, 'aria-label': 'URL Homepage' })))
          : h('label', { class: 'field' }, h('span', {}, 'URL Path', h('span', { class: 'hint', text: ' (Domain Utama)' })), h('div', { class: 'prefix' }, h('span', { text: '/' }), slugIn)),
        page.slug !== SLUG ? h('p', { class: 'note', text: `Setelah Publikasikan, halaman pindah ke /${page.slug}. Link lama /${SLUG} otomatis diarahkan ke link baru.` }) : null,
        field('Kategori', cat),
      ];
    }

    function templateFields() {
      const name = h('input', { type: 'text', maxlength: 160, value: page.name, onchange: (e) => patch({ name: e.target.value }, 'Nama template diubah.') });
      return [
        field('Nama Template', name, '(hanya terlihat di admin)'),
        usedIn.length
          ? h('details', { class: 'used-in' },
            h('summary', {}, icon('file'), `Dipakai di ${usedIn.length} halaman`, h('span', { class: 'fine', text: ' · Publikasikan = semuanya ikut berubah' })),
            h('ul', {}, usedIn.map((p) => h('li', {}, h('a', { href: `/admin/pages/${p.slug}`, target: '_blank', rel: 'noopener', text: p.name })))))
          : h('p', { class: 'fine', text: 'Belum dipakai di Page mana pun.' }),
      ];
    }

    /** Warnings when the live promo cannot fill the [PROMO] parts / badges this page (incl. its templates) uses. */
    function promoWarnBox() {
      const flat = page.sections.flatMap((s) => (s.type === 'template' ? (templates[s.template]?.sections || []).map((x) => ({ ...x, visible: x.visible && s.visible })) : [s]));
      const badgeCount = (page.badges || []).length + page.sections.filter((s) => s.type === 'template').reduce((n, s) => n + (templates[s.template]?.badges || 0), 0);
      const parts = new Set(flat.filter((x) => x.type === 'promo' && x.visible).map((x) => x.part));
      const warns = [];
      if ((badgeCount || parts.size) && !livePromo) warns.push('Tidak ada promo yang berjalan, jadi section [PROMO] dan badge promo tidak tampil di halaman live.');
      else if (livePromo) {
        if (badgeCount && !livePromo.badge) warns.push(`Promo "${livePromo.name}" belum punya badge, jadi badge promo tidak tampil.`);
        if (parts.has('banner') && !livePromo.banner) warns.push(`Promo "${livePromo.name}" belum punya banner, jadi [PROMO] Banner tidak tampil.`);
        if (parts.has('bar') && !livePromo.bar) warns.push(`Promo "${livePromo.name}" belum punya teks bar, jadi [PROMO] Bar tidak tampil.`);
      }
      return warns.length ? h('div', { class: 'warn-box' }, icon('megaphone'), h('div', {}, ...warns.map((w) => h('p', { text: w })), h('a', { href: '/admin/promo', text: 'Atur di menu Promo →' }))) : null;
    }

    function addButton() {
      return h('button', { type: 'button', class: 'add-block', onclick: () => openPicker() },
      icon('plus'), h('span', { class: 'add-label' }, h('b', { text: 'Tambah' }), h('small', { text: IS_TPL ? 'Gambar, HTML, Teks, Tombol, FAQ…' : 'Template, Gambar, HTML, Teks, Tombol, FAQ…' })));
    }

    async function templatePicker() {
      if (anyDialogOpen()) return;
      const data = await run(() => api('GET', '/admin/api/templates'));
      if (!data) return;
      let q = '';
      const box = h('ul', { class: 'pick-list', role: 'list' });
      const at = (() => { const i = page.sections.findIndex((s) => s.id === selected); return i < 0 ? page.sections.length : i + 1; })();
      const use = async (t) => {
        d.close();
        const before = new Set(page.sections.map((s) => s.id));
        const out = await edit('POST', P('/sections'), { type: 'template', template: t.id, position: at }, `Template "${t.name}" dimuat.`);
        const added = out && out.page.sections.find((s) => !before.has(s.id));
        if (added) { selected = added.id; renderList(); pulseNext = true; }
      };
      const render = () => {
        const shown = data.templates.filter((t) => !q || t.name.toLowerCase().includes(q));
        box.replaceChildren(...(shown.length ? shown.map((t) => h('li', {},
          h('button', { type: 'button', class: 'pick-row', onclick: () => use(t) },
            h('span', { class: 'tpl-thumb sm' }, t.cover ? h('img', { src: t.cover, alt: '', loading: 'lazy' }) : icon('layers')),
            h('span', { class: 'pick-main' }, h('b', { text: t.name }), h('small', { text: `${t.sections} section${t.usedIn.length ? ` · dipakai di ${t.usedIn.length} halaman` : ''}` })),
            h('span', { class: 'btn btn-sm btn-primary', 'aria-hidden': 'true' }, 'Pakai'))))
          : [h('li', { class: 'empty', text: data.templates.length ? 'Tidak ada yang cocok.' : 'Belum ada template. Buat di Halaman → Template.' })]));
      };
      const search = h('input', { type: 'search', placeholder: 'Cari template…', 'aria-label': 'Cari template', oninput: (e) => { q = e.target.value.trim().toLowerCase(); render(); } });
      render();
      const d = dialog({
        title: 'Muat Template',
        body: [h('p', { class: 'fine', text: `Dimasukkan ${at >= page.sections.length ? 'di paling bawah' : `setelah "${page.sections[at - 1]?.name}"`}. Template tetap tersambung: perubahan di template ikut tampil di halaman ini.` }),
          h('label', { class: 'search block' }, icon('search'), search), box],
        foot: [h('a', { class: 'btn', href: '/admin/templates', target: '_blank', rel: 'noopener' }, icon('layers'), 'Kelola template'), btn('Batal', () => d.close())],
      });
      search.focus();
    }

    const tplOf = (s) => templates[s.template];
    const openTemplate = (s) => window.open(`/admin/templates/${s.template}`, '_blank', 'noopener');
    async function detach(s) {
      const t = tplOf(s);
      if (!(await confirmBox(`Lepas "${t ? t.name : s.name}" dari halaman ini? Section-nya disalin ke halaman ini dan tidak lagi ikut berubah saat template diubah. Bisa dibatalkan dengan Undo.`, { ok: 'Lepas jadi section', title: 'Lepas template?' }))) return;
      edit('POST', P(`/sections/${s.id}/detach`), undefined, 'Template dilepas menjadi section biasa.');
    }

    function renderList() {
      if (!list) return;
      list.replaceChildren(...page.sections.map((s, i) => {
        const last = i === page.sections.length - 1;
        const isTpl = s.type === 'template';
        const t = isTpl ? tplOf(s) : null;
        const open = isTpl && expanded.has(s.id);
        const name = isTpl && t ? t.name : s.name;
        const sub = isTpl
          ? (t ? `Template · ${t.sections.length} section${t.dirty ? ' · draft belum live' : ''}` : 'Template tidak ditemukan')
          : s.type === 'promo' ? `Promo ${s.part === 'bar' ? 'bar merah' : 'banner'} · otomatis`
            : s.type === 'image' ? `${TYPE_LABEL.image}${s.layout === 'slider' ? ' · slider' : ''} · ${s.items.length} file`
              : s.type === 'block' ? `Elemen · ${blockDefs?.blocks[s.kind]?.label || s.kind}` : TYPE_LABEL.html;
        return h('li', {
          class: `sec${isTpl ? ' sec-tpl' : ''}${s.id === selected ? ' selected' : ''}${s.visible ? '' : ' is-hidden'}${open ? ' open' : ''}`, tabindex: '0',
          dataset: { id: s.id }, 'aria-label': `${i + 1}. ${name}${isTpl ? ' (template)' : ''}`,
          onclick: (e) => { if (!e.target.closest('button, input, .sub-secs')) select(s.id); },
          ondblclick: (e) => { if (!e.target.closest('button, input, .sub-secs')) openSection(s); },
          oncontextmenu: (e) => { if (e.target.closest('.sub-secs')) return; e.preventDefault(); select(s.id); sectionMenu(s.id, e.clientX, e.clientY); },
          onkeydown: (e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter') { select(s.id); }
            if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); select(s.id); sectionMenu(s.id, r.left + 40, r.bottom); }
          },
        },
        h('div', { class: 'sec-line' },
          h('button', { type: 'button', class: 'icon-btn grip', title: 'Geser untuk memindahkan', 'aria-label': `Pindahkan ${name}`, tabindex: '-1' }, icon('grip')),
          h('span', { class: 'sec-num', text: String(i + 1) }),
          h('span', { class: `sec-type ${s.type}`, title: TYPE_LABEL[s.type] }, icon(isTpl ? 'layers' : s.type === 'promo' ? 'lock' : s.type === 'html' ? 'code' : s.type === 'block' ? (blockDefs?.blocks[s.kind]?.icon || 'type') : s.layout === 'slider' ? 'slider' : 'image')),
          h('span', { class: 'sec-body' },
            h('span', { class: 'sec-name', text: name }),
            h('span', { class: 'sec-sub' },
              h('span', { text: sub }),
              s.visible ? null : h('span', { class: 'badge warn', text: 'Disembunyikan' }),
              (page.badges || []).filter((b) => b.section === s.id).map((b) => h('span', { class: 'badge-chip', title: 'Badge promo — geser di preview untuk mengatur posisi' },
                icon('tag'), 'Badge Promo', h('button', { type: 'button', 'aria-label': 'Hapus badge promo', onclick: (e) => { e.stopPropagation(); removeBadge(b); } }, icon('x')))))),
          h('span', { class: 'sec-actions' },
            iconBtn('up', 'Naikkan', () => move(i, -1), { attrs: { disabled: i === 0 } }),
            iconBtn('down', 'Turunkan', () => move(i, 1), { attrs: { disabled: last } }),
            iconBtn(s.visible ? 'eye' : 'eyeOff', s.visible ? 'Sembunyikan' : 'Tampilkan', () => setVisible(s, !s.visible), { attrs: { 'aria-pressed': String(!s.visible) } }),
            isTpl ? iconBtn('edit', 'Edit template di sini', () => openTpl(s.id), { attrs: { disabled: !t } })
              : iconBtn(s.type === 'promo' ? 'lock' : 'edit', s.type === 'promo' ? 'Isi diatur di menu Promo' : 'Edit isi', () => openSection(s))),
          isTpl && t ? iconBtn(open ? 'chevD' : 'chevR', open ? 'Tutup daftar section' : 'Lihat section di template ini', () => {
            if (open) expanded.delete(s.id); else expanded.add(s.id);
            renderList();
          }, { class: 'expander', attrs: { 'aria-expanded': String(open) } }) : null),
        open ? h('ol', { class: 'sub-secs', 'aria-label': `Section di ${name}` }, t.sections.map((x, k) => h('li', {},
          h('button', { type: 'button', class: `sub-sec${x.visible ? '' : ' is-hidden'}`, title: 'Edit bagian ini (template)', onclick: () => openTpl(s.id, x.id), onmouseenter: () => focusInPreview(x.id) },
            h('span', { class: 'sub-num', text: `${i + 1}.${k + 1}` }),
            icon(x.type === 'promo' ? 'lock' : x.type === 'html' ? 'code' : x.type === 'block' ? (blockDefs?.blocks[x.kind]?.icon || 'type') : 'image'),
            h('span', { text: x.name }),
            x.visible ? null : h('small', { text: 'disembunyikan' }))))) : null);
      }));
      if (!page.sections.length) list.append(h('li', { class: 'empty', text: IS_TPL ? 'Belum ada section. Klik "Tambah" di bawah.' : 'Belum ada isi. Klik "Tambah" untuk memuat Template atau menambah Section.' }));
    }

    function sectionMenu(id, x, y) {
      const s = page.sections.find((v) => v.id === id);
      if (!s) return;
      const i = page.sections.indexOf(s);
      if (s.type === 'template') {
        const t = tplOf(s);
        contextMenu(x, y, [
          { icon: 'edit', label: 'Edit template di sini', disabled: !t, action: () => openTpl(s.id) },
          { icon: 'external', label: 'Buka editor template penuh (tab baru)', disabled: !t, action: () => openTemplate(s) },
          { icon: 'unlink', label: 'Lepas jadi section biasa', disabled: !t, action: () => detach(s) },
          '-',
          { icon: 'cut', label: 'Cut', kbd: 'Ctrl+X', action: () => clip('cut', id) },
          { icon: 'copy', label: 'Copy', kbd: 'Ctrl+C', action: () => clip('copy', id) },
          { icon: 'paste', label: 'Tempel di bawah', kbd: 'Ctrl+V', disabled: !clipboard, action: () => paste(1, i) },
          '-',
          { icon: 'eyeOff', label: 'Sembunyikan', disabled: !s.visible, action: () => setVisible(s, false) },
          { icon: 'eye', label: 'Perlihatkan', disabled: s.visible, action: () => setVisible(s, true) },
          { icon: 'copy', label: 'Pakai lagi di bawahnya', action: () => edit('POST', P(`/sections/${id}/duplicate`), undefined, 'Template dipakai sekali lagi.') },
          '-',
          { icon: 'trash', label: 'Hapus dari halaman', kbd: 'Del', danger: true, action: () => remove(s) },
        ]);
        return;
      }
      contextMenu(x, y, [
        { icon: 'cut', label: 'Cut', kbd: 'Ctrl+X', action: () => clip('cut', id) },
        { icon: 'copy', label: 'Copy', kbd: 'Ctrl+C', action: () => clip('copy', id) },
        { icon: 'paste', label: clipboard ? `Tempel di atas` : 'Tempel di atas (kosong)', disabled: !clipboard, action: () => paste(0, i) },
        { icon: 'paste', label: clipboard ? `Tempel di bawah` : 'Tempel di bawah (kosong)', kbd: 'Ctrl+V', disabled: !clipboard, action: () => paste(1, i) },
        '-',
        { icon: 'eyeOff', label: 'Sembunyikan', disabled: !s.visible, action: () => setVisible(s, false) },
        { icon: 'eye', label: 'Perlihatkan', disabled: s.visible, action: () => setVisible(s, true) },
        { icon: 'rename', label: 'Rename', kbd: 'F2', action: () => startRename(id) },
        s.type === 'promo' ? { icon: 'lock', label: 'Isi diatur di menu Promo', action: promoLocked } : { icon: 'edit', label: s.type === 'block' ? 'Atur elemen' : 'Edit isi…', action: () => openSection(s) },
        { icon: 'tag', label: 'Tambah badge promo di sini', action: () => addBadge(s) },
        { icon: 'copy', label: 'Duplikat', action: () => edit('POST', P(`/sections/${id}/duplicate`), undefined, 'Section diduplikat.') },
        '-',
        { icon: 'trash', label: 'Hapus', kbd: 'Del', danger: true, action: () => remove(s) },
      ]);
    }

    async function clip(mode, id) {
      const s = page.sections.find((v) => v.id === id);
      if (!s) return;
      await edit('POST', P('/clipboard'), { id, mode }, mode === 'cut' ? `"${s.name}" di-cut. Tempel dengan Ctrl+V.` : `"${s.name}" di-copy. Tempel dengan Ctrl+V (bisa di halaman lain).`, { reload: mode === 'cut' });
    }
    async function paste(after, index) {
      if (!clipboard) return toast('Belum ada section yang di-copy atau di-cut.', 'error');
      const i = index ?? page.sections.findIndex((s) => s.id === selected);
      const position = i < 0 ? page.sections.length : i + after;
      const before = new Set(page.sections.map((s) => s.id));
      const out = await edit('POST', P('/sections/paste'), { position }, 'Section ditempel.', { pulse: false });
      const added = out && out.page.sections.find((s) => !before.has(s.id));
      if (added) { selected = added.id; renderList(); pulseNext = true; }
    }
    function setVisible(s, visible) {
      edit('PATCH', P(`/sections/${s.id}`), { visible }, visible ? 'Section diperlihatkan.' : 'Section disembunyikan.');
    }
    async function remove(s) {
      const tpl = s.type === 'template';
      const label = tpl ? (templates[s.template]?.name || s.name) : s.name;
      if (!(await confirmBox(tpl ? `Hapus template "${label}" dari halaman ini? Template-nya sendiri tidak terhapus. Bisa dibatalkan dengan Undo.` : `Hapus section "${label}"? Bisa dibatalkan dengan Undo sebelum dipublikasikan.`,
        { ok: 'Hapus', danger: true, title: tpl ? 'Hapus dari halaman?' : 'Hapus section?' }))) return;
      edit('DELETE', P(`/sections/${s.id}`), undefined, tpl ? 'Template dihapus dari halaman.' : 'Section dihapus.');
    }
    async function addPromoSection(part) {
      const i = page.sections.findIndex((s) => s.id === selected);
      const before = new Set(page.sections.map((s) => s.id));
      const out = await edit('POST', P('/sections'), { type: 'promo', part, position: i < 0 ? page.sections.length : i + 1 }, `[PROMO] ${part === 'bar' ? 'Bar' : 'Banner'} ditambahkan.`);
      const added = out && out.page.sections.find((s) => !before.has(s.id));
      if (added) { selected = added.id; renderList(); pulseNext = true; }
    }
    function addBadge(s) {
      selected = s.id;
      edit('POST', P('/badges'), { section: s.id }, 'Badge promo ditambahkan. Geser di preview untuk mengatur posisi, tarik titik sudut untuk ukuran.');
    }
    async function removeBadge(b) {
      if (!(await confirmBox('Hapus badge promo dari section ini?', { ok: 'Hapus', danger: true }))) return;
      edit('DELETE', P(`/badges/${b.id}`), undefined, 'Badge promo dihapus.');
    }

    function startRename(id) {
      if (tab !== 'konten') setTab('konten');
      const row = list && list.querySelector(`[data-id="${CSS.escape(id)}"]`);
      const s = page.sections.find((v) => v.id === id);
      if (!row || !s) return;
      const nameSpan = row.querySelector('.sec-name');
      const input = h('input', { class: 'input rename', type: 'text', value: s.name, maxlength: 120, 'aria-label': 'Nama section' });
      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        const v = input.value.trim();
        if (save && v && v !== s.name) edit('PATCH', P(`/sections/${id}`), { name: v }, 'Nama section diubah.', { reload: false });
        else renderList();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } if (e.key === 'Escape') { e.preventDefault(); finish(false); } e.stopPropagation(); });
      input.addEventListener('blur', () => finish(true));
      nameSpan.replaceWith(input);
      input.select();
    }

    function move(i, dir) {
      const ids = page.sections.map((s) => s.id);
      const [id] = ids.splice(i, 1);
      ids.splice(i + dir, 0, id);
      selected = id;
      edit('PUT', P('/order'), { ids }, null).then(() => {
        const b = list && list.querySelector(`[data-id="${CSS.escape(id)}"] [aria-label="${dir < 0 ? 'Naikkan' : 'Turunkan'}"]`);
        if (b && !b.disabled) b.focus();
      });
    }

    // drag & drop (HTML5 DnD, started only from the grip handle)
    let dragEl = null;
    panel.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('.grip');
      if (grip) grip.closest('.sec').draggable = true;
    });
    panel.addEventListener('dragstart', (e) => {
      dragEl = e.target.closest && e.target.closest('.sec');
      if (!dragEl) return;
      dragEl.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragEl.dataset.id);
    });
    panel.addEventListener('dragover', (e) => {
      if (!dragEl) return;
      e.preventDefault();
      const over = e.target.closest('.sec');
      if (!over || over === dragEl || over.parentNode !== list) return;
      const r = over.getBoundingClientRect();
      list.insertBefore(dragEl, e.clientY > r.top + r.height / 2 ? over.nextSibling : over);
    });
    panel.addEventListener('drop', (e) => { if (dragEl) e.preventDefault(); });
    panel.addEventListener('dragend', () => {
      if (!dragEl) return;
      dragEl.classList.remove('dragging');
      dragEl.draggable = false;
      const id = dragEl.dataset.id;
      dragEl = null;
      const ids = [...list.children].map((li) => li.dataset.id);
      if (ids.join() !== page.sections.map((s) => s.id).join()) { selected = id; edit('PUT', P('/order'), { ids }, null); } else renderList();
    });

    const patch = (body, msg) => edit('PATCH', P(), body, msg);

    // ============================================================ elements: picker + settings panel (left panel, live preview)
    let blockDefs = null; // { blocks, meta, pages, rotators } from /admin/api/blocks
    // null = section list | { view: 'picker' | 'block' | 'section' | 'new' | 'tpl', id?, type?, ref?, tpl? }
    // tpl = id of a template block on this page: the panel then edits that template in place.
    let mode = null;
    const openGroups = new Set();
    const tplDocs = {}; // template id -> latest template editor payload (its own draft + revision)
    const insertPos = () => { const i = page.sections.findIndex((s) => s.id === selected); return i < 0 ? page.sections.length : i + 1; };
    const insertWhere = () => { const i = page.sections.findIndex((s) => s.id === selected); return i < 0 ? 'di paling bawah' : `setelah "${page.sections[i].type === 'template' ? templates[page.sections[i].template]?.name || page.sections[i].name : page.sections[i].name}"`; };

    // ---- edit target: this document, or a template used by this page (edited in place; the preview shows its draft)
    const pageTarget = { kind: 'page', api: DOC.api, sections: () => page.sections, apply: (out, o) => setState(out, o) };
    function tplTarget(refId) {
      const ref = page && page.sections.find((s) => s.id === refId && s.type === 'template');
      if (!ref) return null;
      const id = ref.template;
      return {
        kind: 'template', id, ref: refId, api: `/admin/api/templates/${id}`,
        name: () => tplDocs[id]?.page.name || templates[id]?.name || ref.name,
        sections: () => (tplDocs[id] ? tplDocs[id].page.sections : templates[id]?.sections || []),
        apply(out, { reload = true, render = true } = {}) {
          tplDocs[id] = { ...(tplDocs[id] || {}), ...out };
          if (templates[id]) templates[id] = { ...templates[id], name: out.page.name, dirty: Boolean(out.draft && out.draft.dirty) };
          if (render) renderTab();
          if (reload) reloadPreview();
        },
      };
    }
    const targetOf = (m) => (m && m.tpl && tplTarget(m.tpl)) || pageTarget;
    async function loadTpl(id) {
      if (!tplDocs[id]) {
        const out = await run(() => api('GET', `/admin/api/templates/${id}`, undefined, { rev: null }));
        if (out) tplDocs[id] = out;
      }
      return tplDocs[id];
    }
    /** Edit through a target: the page uses edit(); a template sends its own draft revision. */
    async function tedit(t, method, path, body, msg, opts) {
      if (t.kind === 'page') return edit(method, P(path), body, msg, opts);
      await flushProps();
      const out = await run(() => api(method, `${t.api}${path}`, body, { rev: tplDocs[t.id]?.draft?.rev ?? null }), msg);
      if (out) {
        t.apply(out, opts);
        if (out.notes && out.notes.length) toast(`Catatan: ${out.notes.join(', ')}`);
      }
      return out;
    }

    function go(next, { focus } = {}) {
      flushProps();
      hideExample();
      mode = next;
      if (panel.contains(document.activeElement)) document.activeElement.blur();
      if (tab !== 'konten') setTab('konten'); else renderTab();
      panel.scrollTop = 0;
      if (focus) requestAnimationFrame(() => panel.querySelector(focus)?.focus());
    }
    function openPicker(tpl) { go({ view: 'picker', tpl }, { focus: '.pk-search input' }); }
    /** Opens the settings of a section of this page (s) or of a template block (tpl = template block id). */
    function openEditor(s, { tpl, pulse = true, scroll = true } = {}) {
      if (s.type === 'block' && !blockDefs) { toast('Daftar elemen belum termuat. Muat ulang halaman.', 'error'); return; }
      if (!tpl) { selected = s.id; sessionStorage.setItem(`sel:${SK}`, s.id); }
      go({ view: s.type === 'block' ? 'block' : 'section', id: s.id, tpl });
      if (tpl) focusInPreview(s.id); else markPreview(pulse, scroll);
    }
    async function openTpl(refId, innerId) {
      const ref = page.sections.find((s) => s.id === refId && s.type === 'template');
      if (!ref) return;
      selected = refId;
      sessionStorage.setItem(`sel:${SK}`, refId);
      if (!(await loadTpl(ref.template))) return;
      const inner = innerId && tplTarget(refId).sections().find((s) => s.id === innerId);
      if (inner && inner.type !== 'promo') openEditor(inner, { tpl: refId });
      else { go({ view: 'tpl', ref: refId }); markPreview(true, !innerId); }
    }
    function closeMode() {
      const back = mode && mode.tpl && mode.view !== 'tpl' ? { view: 'tpl', ref: mode.tpl } : null;
      go(back);
      if (back) return;
      const row = list && selected && list.querySelector(`[data-id="${CSS.escape(selected)}"]`);
      if (row) { row.scrollIntoView({ block: 'center' }); row.focus({ preventScroll: true }); }
    }
    panel.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !mode || anyDialogOpen() || openMenu) return;
      if (e.target.isContentEditable || e.target.tagName === 'TEXTAREA') { e.target.blur(); return; }
      e.preventDefault();
      closeMode();
    });

    async function addBlock(kind, position) {
      const t = targetOf(mode);
      const before = new Set(t.sections().map((s) => s.id));
      const tpl = mode && mode.tpl;
      if (position == null) position = t.kind === 'page' ? insertPos() : t.sections().length;
      hideExample();
      const out = await tedit(t, 'POST', '/sections', { type: 'block', kind, position }, null);
      const added = out && t.sections().find((s) => !before.has(s.id));
      if (added) { pulseNext = true; openEditor(added, { tpl, pulse: false }); }
    }

    // ---- picker: example popover (real element with default settings) + drag into the preview
    let dragKind = null;
    let exTimer = null;
    const exFrames = new Map();
    const exBox = h('div', { class: 'pk-example', role: 'tooltip', hidden: true }, h('div', { class: 'pk-example-label', text: 'Contoh' }));
    document.body.append(exBox);
    function showExample(kind, anchor, delay) {
      clearTimeout(exTimer);
      exTimer = setTimeout(() => {
        if (!anchor.isConnected || dragKind) return;
        let f = exFrames.get(kind);
        if (!f) {
          f = h('iframe', { src: `/admin/block-preview/${kind}`, title: 'Contoh elemen', tabindex: '-1', loading: 'eager' });
          f.addEventListener('load', () => { try { const d = f.contentDocument; f.style.height = `${Math.min(360, Math.max(60, d.documentElement.scrollHeight))}px`; } catch { /* ignore */ } });
          exFrames.set(kind, f);
        }
        exBox.replaceChildren(exBox.firstChild, f);
        exBox.firstChild.textContent = `Contoh · ${blockDefs.blocks[kind].label}`;
        const r = anchor.getBoundingClientRect();
        const pr = panel.getBoundingClientRect();
        exBox.hidden = false;
        exBox.style.left = `${pr.right + 14}px`;
        exBox.style.top = `${Math.max(70, Math.min(r.top - 10, innerHeight - 420))}px`;
      }, delay);
    }
    function hideExample() { clearTimeout(exTimer); exBox.hidden = true; }
    panel.addEventListener('scroll', hideExample, { passive: true });

    // drop target inside the preview iframe: a line before/after the section under the pointer
    let dropAt = null;
    function clearDrop() { const d = pdoc(); d && d.querySelector('.mb-drop')?.remove(); dropAt = null; }
    function dropTarget(doc, e) {
      const el = e.target.closest && e.target.closest('.lp-sec');
      if (!el) return page.sections.length ? null : { index: 0, y: 0 };
      const id = el.dataset.ref || el.id;
      const i = page.sections.findIndex((s) => s.id === id);
      if (i < 0) return null;
      const group = el.dataset.ref ? [...doc.querySelectorAll(`.lp-sec[data-ref="${CSS.escape(id)}"]`)] : [el];
      const top = group[0].getBoundingClientRect().top;
      const bottom = group.at(-1).getBoundingClientRect().bottom;
      const after = e.clientY > (top + bottom) / 2;
      return { index: after ? i + 1 : i, y: (after ? bottom : top) + doc.defaultView.scrollY };
    }
    function setupDrop(doc) {
      doc.addEventListener('dragover', (e) => {
        if (!dragKind) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const t = dropTarget(doc, e);
        if (!t) return;
        dropAt = t.index;
        let line = doc.querySelector('.mb-drop');
        if (!line) { line = doc.createElement('div'); line.className = 'mb-drop'; const tag = doc.createElement('span'); tag.textContent = `Lepas di sini: ${blockDefs.blocks[dragKind].label}`; line.append(tag); doc.body.append(line); }
        line.style.top = `${t.y}px`;
      });
      doc.addEventListener('dragleave', (e) => { if (!e.relatedTarget) { const l = doc.querySelector('.mb-drop'); if (l) l.remove(); } });
      doc.addEventListener('drop', (e) => {
        if (!dragKind) return;
        e.preventDefault();
        const kind = dragKind;
        const at = dropAt;
        dragKind = null;
        clearDrop();
        if (at != null) addBlock(kind, at);
      });
    }

    function renderPicker(t = pageTarget) {
      let q = '';
      const body = h('div', { class: 'pk-body' });
      const inTpl = t.kind === 'template';
      const leave = (fn) => () => { mode = null; renderTab(); fn(); };
      const BASIC = [
        { label: 'Gambar', icon: 'image', desc: 'Foto/banner, bisa jadi slider.', run: () => go({ view: 'new', type: 'image', tpl: t.ref }) },
        { label: 'HTML', icon: 'code', desc: 'Kode atau file HTML sendiri.', run: () => go({ view: 'new', type: 'html', tpl: t.ref }, { focus: '.code-edit' }) },
        IS_TPL || inTpl ? null : { label: 'Template', icon: 'layers', desc: 'Grup section yang tersambung.', run: leave(() => templatePicker()) },
      ].filter(Boolean);
      const EXTRA = inTpl ? [] : [
        { label: '[PROMO] Banner', icon: 'lock', desc: 'Banner dari promo yang aktif.', run: leave(() => addPromoSection('banner')) },
        { label: '[PROMO] Bar merah', icon: 'megaphone', desc: 'Bar teks dari promo yang aktif.', run: leave(() => addPromoSection('bar')) },
        clipboard && !(IS_TPL && clipboard.template) ? { label: `Tempel "${clipboard.name}"`, icon: 'paste', desc: 'Section yang terakhir di-copy.', run: leave(() => paste(1)) } : null,
      ].filter(Boolean);
      const blocks = Object.entries(blockDefs ? blockDefs.blocks : {}).map(([kind, b]) => ({ kind, label: b.label, icon: b.icon, desc: b.desc, cat: b.cat, run: () => addBlock(kind) }));
      const CATS = [['Konten', 'Teks & tata letak'], ['Media', 'Media'], ['Jualan', 'Jualan & kepercayaan'], ['Konversi', 'Konversi']];
      const card = (it, main) => h('button', { type: 'button', class: `pk-card${main ? ' pk-main' : ''}`, onclick: it.run,
        draggable: it.kind && !inTpl ? 'true' : null, dataset: it.kind ? { kind: it.kind } : undefined,
        onmouseenter: it.kind ? (e) => showExample(it.kind, e.currentTarget, 350) : null, onmouseleave: it.kind ? hideExample : null,
        onfocus: it.kind ? (e) => showExample(it.kind, e.currentTarget, 0) : null, onblur: it.kind ? hideExample : null,
        ondragstart: it.kind ? (e) => { hideExample(); dragKind = it.kind; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', it.kind); } : null,
        ondragend: it.kind ? () => { dragKind = null; clearDrop(); } : null },
        h('span', { class: 'pk-ic' }, icon(it.icon)), h('span', { class: 'pk-txt' }, h('b', { text: it.label }), h('small', { text: it.desc })));
      const group = (title, items, main) => (items.length ? [h('h3', { class: 'pk-cat', text: title }), h('div', { class: 'pk-grid' }, items.map((it) => card(it, main)))] : []);
      const draw = () => {
        const m = (it) => !q || `${it.label} ${it.desc}`.toLowerCase().includes(q);
        const parts = [
          ...group('Utama', BASIC.filter(m), true),
          ...CATS.flatMap(([c, title]) => group(title, blocks.filter((b) => b.cat === c && m(b)))),
          ...group('Lainnya', EXTRA.filter(m)),
        ];
        body.replaceChildren(...(parts.length ? parts : [h('p', { class: 'empty', text: `Tidak ada elemen "${q}".` })]));
      };
      draw();
      const search = h('input', { type: 'search', placeholder: 'Cari: tombol, FAQ, video…', 'aria-label': 'Cari elemen',
        oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); },
        onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); body.querySelector('.pk-card')?.click(); } } });
      return [
        h('div', { class: 'bp-head' },
          iconBtn('back', inTpl ? 'Kembali ke template (Esc)' : 'Kembali ke daftar isi (Esc)', closeMode),
          h('div', { class: 'bp-title' }, h('b', { text: inTpl ? `Tambah ke template ${t.name()}` : 'Tambah' }), h('small', { text: inTpl ? 'Masuk di paling bawah template' : `Klik: masuk ${insertWhere()} · atau seret elemen ke preview` }))),
        inTpl ? tplWarn(t) : null,
        h('label', { class: 'search block pk-search' }, icon('search'), search),
        body,
      ];
    }

    // ---- settings panels: changes are queued, sent as one PATCH and the section is re-rendered in the preview
    let pending = null; // { t, id, body: () => JSON | FormData }
    let propsTimer = null;
    let propsChain = Promise.resolve();
    function queuePatch(t, id, body, delay = 350) {
      if (pending && (pending.id !== id || pending.t.api !== t.api)) flushProps();
      pending = { t, id, body };
      clearTimeout(propsTimer);
      propsTimer = setTimeout(flushProps, delay);
      statusEl.textContent = 'Menyimpan…';
      statusEl.className = 'status dirty';
    }
    function flushProps() {
      clearTimeout(propsTimer);
      if (pending) {
        const { t, id, body } = pending;
        pending = null;
        const payload = body();
        propsChain = propsChain.then(async () => {
          try {
            const url = `${t.api}/sections/${encodeURIComponent(id)}?render=${encodeURIComponent(id)}`;
            const out = t.kind === 'page' ? await api('PATCH', url, payload) : await api('PATCH', url, payload, { rev: tplDocs[t.id]?.draft?.rev ?? null });
            if (t.kind === 'page') setState(out, { reload: false, render: false });
            else { t.apply(out, { reload: false, render: false }); setState({}, { reload: false, render: false }); }
            showNotes(id, out.notes);
            if (out.html) swapPreview(id, out.html); else reloadPreview();
          } catch (e) {
            toast(e.message, 'error', e.status === 409 ? { label: 'Muat ulang', onclick: () => location.reload() } : null);
          }
        });
      }
      return propsChain;
    }
    function showNotes(id, notes) {
      const box = panel.querySelector(`[data-notes="${CSS.escape(id)}"]`);
      if (box) box.replaceChildren(...(notes || []).map((n) => h('li', { text: n })));
    }
    function swapPreview(id, html) {
      const doc = pdoc();
      const el = doc && doc.getElementById(id);
      if (!el) { reloadPreview(); return; }
      const t = doc.createElement('template');
      t.innerHTML = html; // server-rendered + sanitised section, same markup as a preview reload
      const next = t.content.firstElementChild;
      if (!next) { reloadPreview(); return; }
      if (el.dataset.ref) next.dataset.ref = el.dataset.ref; // section of a template block
      el.replaceWith(next);
      try { iframe.contentWindow.LP?.init(next); } catch { /* preview script not ready */ }
      markPreview(false, false);
    }

    /** Header shared by every settings panel: back, type icon, editable name, context line, menu. */
    function panelHead(s, t, ic, kindLabel) {
      const name = h('input', { class: 'bp-name', type: 'text', maxlength: 120, value: s.name, 'aria-label': 'Nama (hanya terlihat di admin)',
        onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
        onchange: (e) => { const v = e.target.value.trim(); if (v && v !== s.name) tedit(t, 'PATCH', `/sections/${s.id}`, { name: v }, null, { reload: false }); } });
      const more = iconBtn('more', 'Menu', (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (t.kind === 'page') sectionMenu(s.id, r.left, r.bottom + 4); else tplSectionMenu(t, s, r.left, r.bottom + 4);
      });
      return h('div', { class: 'bp-head' },
        iconBtn('back', t.kind === 'page' ? 'Kembali ke daftar isi (Esc)' : 'Kembali ke template (Esc)', closeMode),
        h('span', { class: 'bp-ic' }, icon(ic)),
        h('div', { class: 'bp-title' }, name, h('small', { text: `${t.kind === 'page' ? '' : `Template ${t.name()} · `}${kindLabel}${s.visible ? '' : ' · disembunyikan'}` })),
        more);
    }
    const tplWarn = (t) => (t.kind === 'page' ? null : h('div', { class: 'tpl-warn' }, icon('layers'),
      h('span', {}, 'Mengubah template ', h('b', { text: t.name() }), ` — ikut berubah di ${(tplDocs[t.id]?.usedIn || []).length || 'semua'} halaman yang memakainya setelah template dipublikasikan.`)));
    const FOOT = 'Perubahan langsung tampil di preview dan otomatis tersimpan sebagai draft. Klik Publikasikan agar tampil di halaman live.';
    const footFor = (t) => h('p', { class: 'fine bp-foot', text: t.kind === 'page' ? FOOT : 'Tersimpan sebagai draft template. Kembali ke template untuk mempublikasikannya.' });

    function renderBlockPanel(s, t = pageTarget) {
      const def = blockDefs.blocks[s.kind];
      const bp = structuredClone(s.props || {});
      const changed = () => queuePatch(t, s.id, () => ({ props: structuredClone(bp) }));
      const groups = {};
      for (const f of def.fields) (groups[f.group || ''] ||= []).push(f);
      const GROUP_LABEL = { Tampilan: 'Jarak & warna latar', Tracking: 'Iklan & tracking', Posisi: 'Posisi teks & tombol' };
      return [
        panelHead(s, t, def.icon, def.label),
        tplWarn(t),
        h('div', { class: 'bp-form' }, fieldsForm(groups[''] || [], bp, changed)),
        ...Object.entries(groups).filter(([g]) => g).map(([g, fs]) => {
          const key = `${s.kind}:${g}`;
          return h('details', { class: 'bp-sec', open: openGroups.has(key), ontoggle: (e) => { if (e.target.open) openGroups.add(key); else openGroups.delete(key); } },
            h('summary', {}, icon('chevR'), h('span', { text: GROUP_LABEL[g] || g })),
            h('div', { class: 'bp-form' }, fieldsForm(fs, bp, changed)));
        }),
        footFor(t),
      ];
    }

    // spacing above a section (design units, same hint as element sizes)
    function spacingField(s, t) {
      const obj = { mt: s.mt || 0 };
      return h('div', { class: 'bp-form' }, fieldsForm([{ k: 'mt', t: 'number', label: 'Jarak dari bagian di atasnya', min: -200, max: 400, d: 0, unit: 'px', full: true }], obj,
        () => queuePatch(t, s.id, () => ({ mt: obj.mt }), 500)));
    }

    // ---- Gambar: images stacked or as a slider; alt text + link per image
    function imageForm(rows, layout, files = []) {
      const fd = new FormData();
      fd.append('layout', layout);
      fd.append('items', JSON.stringify(rows.map((r) => (r.file != null ? { file: r.file, alt: r.alt || '', href: r.href || '', ...(r.replaces != null ? { replaces: r.replaces } : {}) } : { keep: r.keep, alt: r.alt || '', href: r.href || '' }))));
      for (const f of files) fd.append('images', f, f.name);
      return fd;
    }
    const okImage = (f) => {
      if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(f.type)) { toast(`"${f.name}" bukan JPG/PNG/WebP/GIF/AVIF.`, 'error'); return false; }
      if (f.size > 15 * 1024 * 1024) { toast(`"${f.name}" lebih dari 15 MB.`, 'error'); return false; }
      return true;
    };
    function renderImagePanel(s, t = pageTarget) {
      const rows = s.items.map((it, i) => ({ keep: i, alt: it.alt, href: it.href, thumb: `${it.src}.${it.ext || 'webp'}` }));
      let layout = s.layout === 'slider' ? 'slider' : 'stack';
      const path = `/sections/${s.id}?render=${encodeURIComponent(s.id)}`;
      // structural change: send now, then rebuild the panel from the saved section
      const commit = async (files = [], msg = null) => {
        await flushProps();
        const out = await tedit(t, 'PATCH', path, imageForm(rows, layout, files), msg, { reload: false });
        if (out && out.html) swapPreview(s.id, out.html);
      };
      const typed = () => queuePatch(t, s.id, () => imageForm(rows, layout), 600);
      const replaceIn = (row) => h('input', { type: 'file', accept: IMG_ACCEPT, hidden: true, onchange: (e) => {
        const f = e.target.files[0];
        if (!f || !okImage(f)) return;
        const i = rows.indexOf(row);
        rows[i] = { file: 0, replaces: row.keep, alt: row.alt, href: row.href };
        commit([f], 'Gambar diganti.');
      } });
      const addIn = h('input', { type: 'file', multiple: true, accept: IMG_ACCEPT, hidden: true, onchange: (e) => {
        const files = [...e.target.files].filter(okImage).slice(0, 40 - rows.length);
        e.target.value = '';
        if (!files.length) return;
        files.forEach((f, k) => rows.push({ file: k, alt: '', href: '' }));
        commit(files, files.length > 1 ? `${files.length} gambar ditambahkan.` : 'Gambar ditambahkan.');
      } });
      const seg = h('div', { class: 'seg-btns', role: 'radiogroup', 'aria-label': 'Tata letak' },
        [['stack', 'Tumpuk ke bawah'], ['slider', 'Slider']].map(([v, label]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(layout === v), text: label,
          onclick: () => { if (layout === v) return; layout = v; commit([], v === 'slider' ? 'Jadi slider.' : 'Jadi tumpuk.'); } })));
      const list = h('ul', { class: 'img-rows' }, rows.map((row, i) => {
        const rep = replaceIn(row);
        return h('li', { class: 'img-row' },
          h('img', { class: 'img-thumb sm', src: row.thumb, alt: '' }),
          h('div', { class: 'img-row-fields' },
            h('input', { class: 'input', type: 'text', maxlength: 300, value: row.alt || '', placeholder: 'Deskripsi gambar (alt)', 'aria-label': `Deskripsi gambar ${i + 1}`, oninput: (e) => { row.alt = e.target.value; typed(); } }),
            h('input', { class: 'input', type: 'text', maxlength: 1000, value: row.href || '', placeholder: 'Link saat diklik (opsional)', 'aria-label': `Link gambar ${i + 1}`, oninput: (e) => { row.href = e.target.value.trim(); typed(); } })),
          h('div', { class: 'img-row-ctl' },
            iconBtn('up', 'Naikkan', () => { rows.splice(i - 1, 0, rows.splice(i, 1)[0]); commit(); }, { class: 'sm', attrs: { disabled: i === 0 } }),
            iconBtn('down', 'Turunkan', () => { rows.splice(i + 1, 0, rows.splice(i, 1)[0]); commit(); }, { class: 'sm', attrs: { disabled: i === rows.length - 1 } }),
            iconBtn('swap', 'Ganti gambar', () => rep.click(), { class: 'sm' }),
            iconBtn('trash', 'Hapus gambar', () => { if (rows.length === 1) { toast('Section gambar minimal berisi 1 gambar. Hapus section-nya lewat menu ⋮.', 'error'); return; } rows.splice(i, 1); commit([], 'Gambar dihapus.'); }, { class: 'sm danger' }),
            rep));
      }));
      return [
        panelHead(s, t, layout === 'slider' ? 'slider' : 'image', `Gambar${layout === 'slider' ? ' · slider' : ''} · ${rows.length} file`),
        tplWarn(t),
        h('div', { class: 'bp-row' }, h('span', { class: 'bp-label', text: 'Tata letak' }), seg),
        h('div', { class: 'bp-row' }, h('span', { class: 'bp-label', text: 'Gambar' }), list,
          dropZone(addIn, (fl) => { addIn.files = fl; addIn.dispatchEvent(new Event('change')); }, 'Tambah gambar', 'JPG, PNG, WebP, GIF, AVIF · maks 15 MB · otomatis dikompres & EXIF dihapus')),
        spacingField(s, t),
        footFor(t),
      ];
    }

    // ---- HTML: code with live preview, .html upload, supporting images
    function renderHtmlPanel(s, t = pageTarget) {
      const path = `/sections/${s.id}?render=${encodeURIComponent(s.id)}`;
      const code = h('textarea', { class: 'code-edit', spellcheck: false, 'aria-label': 'Kode HTML',
        oninput: () => queuePatch(t, s.id, () => ({ code: code.value }), 1200),
        onkeydown: (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); queuePatch(t, s.id, () => ({ code: code.value }), 0); } } });
      code.value = s.source || '';
      const send = async (fd, msg) => {
        await flushProps();
        const out = await tedit(t, 'PATCH', path, fd, msg, { reload: false });
        if (out && out.html) swapPreview(s.id, out.html);
      };
      const htmlIn = h('input', { type: 'file', accept: '.html,.htm,text/html', hidden: true, onchange: (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        if (!/\.html?$/i.test(f.name)) return toast('Pilih file .html', 'error');
        if (f.size > 1024 * 1024) return toast('File HTML maksimal 1 MB.', 'error');
        const fd = new FormData();
        fd.append('htmlFile', f, f.name);
        send(fd, `"${f.name}" dipakai.`);
      } });
      const assetIn = h('input', { type: 'file', multiple: true, accept: IMG_ACCEPT, hidden: true, onchange: (e) => {
        const files = [...e.target.files].filter(okImage);
        e.target.value = '';
        if (!files.length) return;
        const fd = new FormData();
        fd.append('code', code.value);
        for (const f of files) fd.append('assets', f, f.name);
        send(fd, 'Gambar pendukung diunggah. Nama file yang sama di kode HTML otomatis memakai gambar ini.');
      } });
      return [
        panelHead(s, t, 'code', 'HTML'),
        tplWarn(t),
        h('div', { class: 'bp-row' },
          h('div', { class: 'code-head' }, h('span', { class: 'bp-label', text: 'Kode HTML' }), h('span', { class: 'fine', text: 'Preview ikut berubah saat berhenti mengetik · Ctrl+Enter = sekarang' })),
          code,
          h('ul', { class: 'html-notes', 'data-notes': s.id })),
        h('div', { class: 'row-buttons' }, btn('Upload file .html', () => htmlIn.click(), 'btn-sm', 'upload'), btn('Gambar pendukung', () => assetIn.click(), 'btn-sm', 'image'), htmlIn, assetIn),
        h('details', { class: 'bp-sec' }, h('summary', {}, icon('chevR'), h('span', { text: 'Diamankan otomatis' })),
          h('ul', { class: 'fine html-rules' },
            h('li', { text: 'Hanya isi <body> yang dipakai; <style> tetap dan hanya berlaku di section ini.' }),
            h('li', { text: 'Script, iframe, form dan atribut on* dihapus. Video YouTube diubah jadi pemutar halaman.' }),
            h('li', { text: 'Lebar konten dibatasi selebar halaman.' }))),
        spacingField(s, t),
        footFor(t),
      ];
    }

    // ---- new Gambar / HTML: nothing is created until there is content
    function renderNewPanel(type, t) {
      const tpl = mode && mode.tpl;
      const create = async (fd, msg) => {
        const before = new Set(t.sections().map((x) => x.id));
        fd.append('type', type);
        fd.append('position', String(t.kind === 'page' ? insertPos() : t.sections().length));
        const out = await tedit(t, 'POST', '/sections', fd, msg);
        const added = out && t.sections().find((x) => !before.has(x.id));
        if (added) { pulseNext = true; openEditor(added, { tpl, pulse: false }); }
      };
      const head = h('div', { class: 'bp-head' }, iconBtn('back', 'Batal (Esc)', closeMode), h('span', { class: 'bp-ic' }, icon(type === 'html' ? 'code' : 'image')),
        h('div', { class: 'bp-title' }, h('b', { text: type === 'html' ? 'HTML baru' : 'Gambar baru' }), h('small', { text: t.kind === 'page' ? `Masuk ${insertWhere()}` : `Masuk ke template ${t.name()} (paling bawah)` })));
      if (type === 'image') {
        let layout = 'stack';
        const addIn = h('input', { type: 'file', multiple: true, accept: IMG_ACCEPT, hidden: true, onchange: (e) => {
          const files = [...e.target.files].filter(okImage).slice(0, 40);
          e.target.value = '';
          if (!files.length) return;
          const fd = imageForm(files.map((f, k) => ({ file: k, alt: '', href: '' })), layout, files);
          fd.append('name', files.length > 1 ? 'Section Gambar' : files[0].name.replace(/\.[a-z0-9]+$/i, '').slice(0, 60) || 'Section Gambar');
          create(fd, 'Gambar ditambahkan.');
        } });
        const seg = h('div', { class: 'seg-btns', role: 'radiogroup', 'aria-label': 'Tata letak' },
          [['stack', 'Tumpuk ke bawah'], ['slider', 'Slider']].map(([v, label]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(layout === v), text: label,
            onclick: () => { layout = v; for (const b of seg.children) b.setAttribute('aria-checked', String(b.textContent === label)); } })));
        return [head, tplWarn(t), h('div', { class: 'bp-row' }, h('span', { class: 'bp-label', text: 'Tata letak' }), seg),
          dropZone(addIn, (fl) => { addIn.files = fl; addIn.dispatchEvent(new Event('change')); }, 'Pilih gambar', 'Bisa beberapa sekaligus · JPG, PNG, WebP, GIF, AVIF · maks 15 MB')];
      }
      const code = h('textarea', { class: 'code-edit', spellcheck: false, 'aria-label': 'Kode HTML', placeholder: '<div class="promo">…</div>\n<style>.promo{…}</style>' });
      const htmlIn = h('input', { type: 'file', accept: '.html,.htm,text/html', hidden: true, onchange: (e) => {
        const f = e.target.files[0];
        if (f) f.text().then((txt) => { code.value = txt; });
      } });
      return [head, tplWarn(t),
        h('div', { class: 'bp-row' }, h('span', { class: 'bp-label', text: 'Tempel kode HTML' }), code),
        h('div', { class: 'row-buttons' }, btn('Atau upload file .html', () => htmlIn.click(), 'btn-sm', 'upload'), htmlIn),
        h('div', { class: 'row-buttons' }, btn('Tambahkan', () => {
          if (!code.value.trim()) return toast('Tempel kode HTML atau upload file .html.', 'error');
          const fd = new FormData();
          fd.append('name', 'Section HTML');
          fd.append('code', code.value);
          create(fd, 'Section HTML ditambahkan.');
        }, 'btn-primary', 'plus'))];
    }

    // ---- a template block edited in place: its sections, publish / discard, with a clear "shared" warning
    function tplSectionMenu(t, s, x, y) {
      const secs = t.sections();
      const i = secs.findIndex((v) => v.id === s.id);
      contextMenu(x, y, [
        { icon: s.visible ? 'eyeOff' : 'eye', label: s.visible ? 'Sembunyikan' : 'Perlihatkan', action: () => tedit(t, 'PATCH', `/sections/${s.id}`, { visible: !s.visible }, null) },
        { icon: 'copy', label: 'Duplikat', action: () => tedit(t, 'POST', `/sections/${s.id}/duplicate`, undefined, 'Section diduplikat.') },
        { icon: 'up', label: 'Naikkan', disabled: i <= 0, action: () => tplMove(t, i, -1) },
        { icon: 'down', label: 'Turunkan', disabled: i < 0 || i >= secs.length - 1, action: () => tplMove(t, i, 1) },
        '-',
        { icon: 'trash', label: 'Hapus dari template', danger: true, action: async () => {
          if (!(await confirmBox(`Hapus "${s.name}" dari template ${t.name()}? Semua halaman yang memakai template ini ikut kehilangan bagian ini setelah template dipublikasikan.`, { ok: 'Hapus', danger: true }))) return;
          const out = await tedit(t, 'DELETE', `/sections/${s.id}`, undefined, 'Dihapus dari draft template.');
          if (out && mode && mode.id === s.id) go({ view: 'tpl', ref: t.ref });
        } },
      ]);
    }
    function tplMove(t, i, dir) {
      const ids = t.sections().map((s) => s.id);
      const [id] = ids.splice(i, 1);
      ids.splice(i + dir, 0, id);
      return tedit(t, 'PUT', '/order', { ids }, null);
    }
    function renderTplPanel(refId) {
      const t = tplTarget(refId);
      if (!t) { mode = null; return renderKonten(); }
      const doc = tplDocs[t.id];
      if (!doc) { loadTpl(t.id).then((d) => { if (d && mode && mode.ref === refId) renderTab(); }); return [h('p', { class: 'fine', text: 'Memuat template…' })]; }
      const dirty = Boolean(doc.draft && doc.draft.dirty);
      const usedIn = doc.usedIn || [];
      const name = h('input', { class: 'bp-name', type: 'text', maxlength: 160, value: doc.page.name, 'aria-label': 'Nama template',
        onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
        onchange: (e) => { const v = e.target.value.trim(); if (v && v !== doc.page.name) tedit(t, 'PATCH', '', { name: v }, null, { reload: false }); } });
      const publishTpl = async () => {
        const out = await run(() => api('POST', `${t.api}/publish`, { force: false }, { rev: doc.draft?.rev ?? null }));
        if (!out) return;
        t.apply(out, { reload: true });
        if (templates[t.id]) templates[t.id] = { ...templates[t.id], dirty: false, sections: out.page.sections, updatedAt: out.published?.updatedAt };
        toast(usedIn.length > 1 ? `Template dipublikasikan. ${usedIn.length} halaman ikut berubah.` : 'Template dipublikasikan.');
      };
      const discardTpl = async () => {
        if (!(await confirmBox(`Buang semua perubahan draft template "${doc.page.name}"? Template kembali ke versi live.`, { ok: 'Buang', danger: true }))) return;
        if (!(await run(() => api('POST', `${t.api}/discard`, undefined, { rev: doc.draft?.rev ?? null }), 'Perubahan template dibuang.'))) return;
        delete tplDocs[t.id];
        if (templates[t.id]) templates[t.id].dirty = false;
        await loadTpl(t.id);
        renderTab();
        reloadPreview();
      };
      const secs = t.sections();
      return [
        h('div', { class: 'bp-head' },
          iconBtn('back', 'Kembali ke daftar isi (Esc)', closeMode),
          h('span', { class: 'bp-ic tpl' }, icon('layers')),
          h('div', { class: 'bp-title' }, name, h('small', { text: `Template · ${secs.length} section` })),
          h('a', { class: 'icon-btn', href: `/admin/templates/${t.id}`, target: '_blank', rel: 'noopener', title: 'Buka editor template penuh (tab baru)', 'aria-label': 'Buka editor template penuh' }, icon('external'))),
        h('div', { class: 'tpl-warn strong' }, icon('layers'), h('div', {},
          h('p', {}, 'Template ini tersambung ke ', h('b', { text: `${usedIn.length} halaman` }), '. Perubahan di sini tersimpan sebagai draft template dan tampil di preview ini; halaman live baru berubah setelah ', h('b', { text: 'Publikasikan template' }), '.'),
          usedIn.length ? h('details', {}, h('summary', { text: 'Lihat halaman yang memakai' }), h('ul', {}, usedIn.map((p) => h('li', {}, h('a', { href: `/admin/pages/${p.slug}`, target: '_blank', rel: 'noopener', text: p.name }))))) : null)),
        h('div', { class: `tpl-status${dirty ? ' dirty' : ''}`, role: 'status' }, h('span', { text: dirty ? 'Draft template belum live' : 'Template sama dengan versi live' }),
          dirty ? btn('Buang', discardTpl, 'btn-sm btn-ghost') : null,
          btn('Publikasikan template', publishTpl, 'btn-sm btn-primary', 'check')),
        h('ol', { class: 'tpl-secs' }, secs.map((x, i) => h('li', { class: `tpl-sec${x.visible ? '' : ' is-hidden'}` },
          h('button', { type: 'button', class: 'tpl-sec-main', disabled: x.type === 'promo', title: x.type === 'promo' ? 'Isi [PROMO] diatur di menu Promo' : 'Edit di panel ini',
            onclick: () => openEditor(x, { tpl: refId }), onmouseenter: () => focusInPreview(x.id) },
          h('span', { class: 'sub-num', text: String(i + 1) }),
          icon(x.type === 'promo' ? 'lock' : x.type === 'html' ? 'code' : x.type === 'block' ? (blockDefs?.blocks[x.kind]?.icon || 'type') : x.layout === 'slider' ? 'slider' : 'image'),
          h('span', { class: 'tpl-sec-name', text: x.name }), x.visible ? null : h('small', { text: 'disembunyikan' })),
          iconBtn('more', `Menu ${x.name}`, (e) => { const r = e.currentTarget.getBoundingClientRect(); tplSectionMenu(t, x, r.left, r.bottom + 4); }, { class: 'sm' })))),
        h('button', { type: 'button', class: 'add-block', onclick: () => openPicker(refId) },
          icon('plus'), h('span', { class: 'add-label' }, h('b', { text: 'Tambah ke template' }), h('small', { text: 'Gambar, HTML, Teks, Tombol, FAQ…' }))),
      ];
    }

    // One form row per schema field; showIf rows hide/show as the controlling value changes.
    let uid = 0;
    const HALF = new Set(['number', 'color', 'font', 'datetime']);
    function fieldsForm(fields, obj, changed) {
      const conds = [];
      const sync = () => { for (const [row, [k, v]] of conds) row.hidden = obj[k] !== v; };
      const onChange = () => { sync(); changed(); };
      const rows = fields.map((f) => {
        const id = `bp-${++uid}`;
        const ctl = control(f, obj, onChange, id);
        const half = !f.full && (HALF.has(f.t) || (f.t === 'select' && f.options.length > 3));
        const row = f.t === 'toggle' ? h('div', { class: 'bp-row' }, ctl)
          : f.t === 'group' ? h('div', { class: 'bp-row' }, ctl)
            : h('div', { class: `bp-row${half ? ' half' : ''}` }, h('label', { class: 'bp-label', for: id, text: f.label }), ctl, f.hint ? h('small', { class: 'bp-hint', text: f.hint }) : null);
        if (f.showIf) conds.push([row, f.showIf]);
        return row;
      });
      sync();
      return rows;
    }

    function control(f, obj, changed, id) {
      const v = obj[f.k];
      switch (f.t) {
        case 'text': return h('input', { id, class: 'input', type: 'text', maxlength: f.max || 200, value: v ?? '', oninput: (e) => { obj[f.k] = e.target.value; changed(); } });
        case 'textarea': {
          const ta = h('textarea', { id, class: 'input', rows: 3, maxlength: f.max || 2000, oninput: (e) => { obj[f.k] = e.target.value; changed(); } });
          ta.value = v ?? '';
          return ta;
        }
        case 'rich': return richEditor(v, (html) => { obj[f.k] = html; changed(); }, f.label, id);
        case 'number': {
          // Sizes are relative to the page width (1/320): show what they become on a phone and on desktop.
          const rel = f.unit === 'px';
          const unit = rel ? h('span', { class: 'px-hint' }) : f.unit ? h('span', { text: f.unit }) : null;
          const show = (n) => {
            if (!rel) return;
            const w = (page.settings && page.settings.maxWidth) || (global && global.maxWidth) || 480;
            unit.textContent = `≈${Math.round((n * 375) / 320)}px HP`;
            unit.title = `Ukuran ikut lebar layar: ≈${Math.round((n * 375) / 320)}px di HP (375px), ≈${Math.round((n * w) / 320)}px di desktop (${w}px).`;
          };
          show(Number(v ?? f.d ?? 0));
          return h('div', { class: 'num-unit' },
            h('input', { id, class: 'input', type: 'number', inputmode: 'decimal', min: f.min ?? 0, max: f.max ?? 1000, step: f.step || 1, value: v ?? f.d ?? 0,
              oninput: (e) => { if (e.target.value === '' || !e.target.checkValidity()) return; obj[f.k] = Number(e.target.value); show(obj[f.k]); changed(); } }),
            unit);
        }
        case 'color': {
          const code = h('code', { text: v || (f.optional ? 'tidak ada' : '') });
          const inp = h('input', { id, type: 'color', value: v || f.d || '#ffffff', 'aria-label': f.label,
            oninput: (e) => { obj[f.k] = e.target.value; code.textContent = e.target.value; wrap.classList.remove('none'); changed(); } });
          const wrap = h('div', { class: `bp-color${v ? '' : ' none'}` }, inp, code,
            f.optional ? iconBtn('x', `Hapus ${f.label.toLowerCase()}`, () => { obj[f.k] = ''; code.textContent = 'tidak ada'; wrap.classList.add('none'); changed(); }, { class: 'sm' }) : null);
          return wrap;
        }
        case 'select': {
          if (f.options.length <= 3) {
            const seg = h('div', { id, class: 'seg-btns', role: 'radiogroup', 'aria-label': f.label },
              f.options.map(([val, label]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(String(v) === val), text: label,
                onclick: () => { obj[f.k] = val; for (const b of seg.children) b.setAttribute('aria-checked', String(b.textContent === label)); changed(); } })));
            return seg;
          }
          return h('select', { id, class: 'input', onchange: (e) => { obj[f.k] = e.target.value; changed(); } },
            f.options.map(([val, label]) => h('option', { value: val, text: label, selected: String(v) === val })));
        }
        case 'toggle': {
          const sw = h('button', { id, type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(Boolean(v)), 'aria-label': f.label,
            onclick: () => { obj[f.k] = !obj[f.k]; sw.setAttribute('aria-checked', String(obj[f.k])); changed(); } }, h('span'));
          return h('div', { class: 'switch-wrap bp-toggle' }, sw, h('label', { for: id, text: f.label }));
        }
        case 'font': return h('select', { id, class: 'input', onchange: (e) => { obj[f.k] = e.target.value; changed(); } },
          h('option', { value: '', text: 'Ikuti halaman', selected: !v }),
          Object.entries(blockDefs.meta.fonts).map(([val, label]) => h('option', { value: val, text: label, selected: v === val })));
        case 'icon': return iconPicker(f, obj, changed, id);
        case 'datetime': return h('input', { id, class: 'input', type: 'datetime-local', value: (v || '').slice(0, 16), onchange: (e) => { obj[f.k] = e.target.value; changed(); } });
        case 'link': return linkEditor(f, obj, changed, id);
        case 'image': return imageEditor(f, obj, changed, id);
        case 'images': return imagesEditor(f, obj, changed, id);
        case 'items': return itemsEditor(f, obj, changed, id);
        case 'group': {
          obj[f.k] = obj[f.k] && typeof obj[f.k] === 'object' ? obj[f.k] : {};
          return h('fieldset', { class: 'bp-fieldset' }, h('legend', { text: f.label }), fieldsForm(f.fields, obj[f.k], changed));
        }
        default: return h('span', { class: 'fine', text: '—' });
      }
    }

    const NSVG = 'http://www.w3.org/2000/svg';
    function pathIcon(d) {
      const svg = document.createElementNS(NSVG, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('class', 'i');
      svg.setAttribute('aria-hidden', 'true');
      const p = document.createElementNS(NSVG, 'path');
      p.setAttribute('d', d || '');
      svg.append(p);
      return svg;
    }
    const ICON_NAMES = { check: 'Centang', star: 'Bintang', heart: 'Hati', leaf: 'Daun', shield: 'Perisai', truck: 'Truk', clock: 'Jam', gift: 'Hadiah', phone: 'Telepon', chat: 'Chat', fire: 'Api', bolt: 'Petir', smile: 'Senyum', award: 'Penghargaan', cart: 'Keranjang', wa: 'WhatsApp', arrow: 'Panah' };
    function iconPicker(f, obj, changed, id) {
      const opts = [...(f.none ? ['none'] : []), ...blockDefs.meta.icons];
      const cur = () => obj[f.k] || (f.none ? 'none' : 'check');
      const grid = h('div', { id, class: 'icon-grid', role: 'radiogroup', 'aria-label': f.label },
        opts.map((name) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(cur() === name), title: name === 'none' ? 'Tanpa ikon' : ICON_NAMES[name] || name, 'aria-label': name === 'none' ? 'Tanpa ikon' : ICON_NAMES[name] || name, dataset: { v: name },
          onclick: () => { obj[f.k] = name; for (const b of grid.children) b.setAttribute('aria-checked', String(b.dataset.v === name)); changed(); } },
        name === 'none' ? h('span', { class: 'none', text: 'Tanpa' }) : pathIcon(blockDefs.meta.paths[name]))));
      return grid;
    }

    // ---- smart link (WhatsApp / CS Rotator / page / section / URL / phone / email / PDF)
    const LINK_TYPES = [['none', 'Tidak ada'], ['wa', 'WhatsApp'], ['rotator', 'CS Rotator (bergiliran)'], ['page', 'Halaman lain'], ['section', 'Bagian di halaman ini'], ['url', 'Link / URL'], ['tel', 'Telepon'], ['email', 'Email'], ['file', 'File PDF']];
    function linkEditor(f, obj, changed, id) {
      if (!obj[f.k] || typeof obj[f.k] !== 'object') obj[f.k] = { type: 'none' };
      const L = () => obj[f.k];
      const box = h('div', { class: 'lk-fields' });
      const sel = h('select', { id, class: 'input', onchange: (e) => { const old = L(); obj[f.k] = { type: e.target.value, ...(old.message ? { message: old.message } : {}) }; draw(); changed(); } },
        LINK_TYPES.filter(([t]) => !f.only || f.only.includes(t)).map(([t, label]) => h('option', { value: t, text: label, selected: L().type === t })));
      const sub = (label, ctl, hint) => h('label', { class: 'bp-sub' }, h('span', { text: label }), ctl, hint ? h('small', { class: 'bp-hint', text: hint }) : null);
      const inp = (k, attrs = {}) => h('input', { class: 'input', type: 'text', value: L()[k] || '', oninput: (e) => { L()[k] = e.target.value; changed(); }, ...attrs });
      const msg = (hint) => {
        const ta = h('textarea', { class: 'input', rows: 2, maxlength: 500, placeholder: 'Halo kak, saya mau tanya…', oninput: (e) => { L().message = e.target.value; changed(); } });
        ta.value = L().message || '';
        return sub('Pesan otomatis', ta, hint);
      };
      const choose = (k, items, empty) => h('select', { class: 'input', onchange: (e) => { L()[k] = e.target.value; changed(); } },
        h('option', { value: '', text: empty, selected: !L()[k] }), items.map(([val, label]) => h('option', { value: val, text: label, selected: L()[k] === val })));
      function draw() {
        const t = L().type;
        const rotators = (global && global.rotators) || blockDefs.rotators || [];
        const secs = page.sections.flatMap((s) => (s.type === 'template' ? (templates[s.template]?.sections || []) : [s])).filter((s) => s.visible !== false);
        const parts = {
          wa: () => [sub('Nomor WhatsApp', inp('phone', { inputmode: 'tel', placeholder: '0812xxxxxxx', maxlength: 30 }), 'Boleh 08…, 628… atau +62…'), msg()],
          rotator: () => [
            rotators.length ? sub('Grup CS', choose('rotator', rotators.map((r) => [r.id, r.name]), 'Pilih grup…'))
              : h('p', { class: 'note', text: IS_TPL ? 'Belum ada CS Rotator. Buat di editor Page → tab Global.' : 'Belum ada CS Rotator. Buat dulu di tab Global → CS Rotator.' }),
            msg('Kosongkan untuk memakai pesan default grup.')],
          page: () => [sub('Halaman', choose('page', blockDefs.pages.map((p) => [p.slug, `${p.name} (/${p.slug})`]), 'Pilih halaman…'))],
          section: () => [sub('Scroll ke', choose('section', secs.map((s) => [s.id, s.name]), 'Pilih bagian…'), 'Pengunjung di-scroll ke bagian itu.')],
          url: () => [sub('Alamat link', inp('url', { type: 'url', placeholder: 'https://…', maxlength: 1000 }), 'Dibuka di tab baru bila ke situs lain.')],
          tel: () => [sub('Nomor telepon', inp('phone', { inputmode: 'tel', placeholder: '0812xxxxxxx', maxlength: 30 }))],
          email: () => [sub('Email', inp('email', { type: 'email', maxlength: 200, placeholder: 'nama@domain.com' })), sub('Subjek (opsional)', inp('subject', { maxlength: 200 }))],
          file: () => {
            const fileIn = h('input', { type: 'file', accept: 'application/pdf,.pdf', hidden: true, onchange: async (e) => {
              const file = e.target.files[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > 10 * 1024 * 1024) { toast('PDF maksimal 10 MB.', 'error'); return; }
              const fd = new FormData();
              fd.append('pdfFile', file, file.name);
              const out = await run(() => api('POST', P('/files'), fd), 'PDF diunggah.');
              if (out) { L().file = out.file; draw(); changed(); }
            } });
            return [L().file ? h('div', { class: 'lk-file' }, icon('file'), h('a', { href: L().file, target: '_blank', rel: 'noopener', text: L().file.split('/').pop() })) : null,
              h('div', { class: 'row-buttons' }, btn(L().file ? 'Ganti PDF' : 'Upload PDF', () => fileIn.click(), 'btn-sm', 'upload'), fileIn),
              h('small', { class: 'bp-hint', text: 'Maks 10 MB. Dibuka di tab baru.' })];
          },
        };
        box.replaceChildren(...(parts[t] ? parts[t]() : []).filter(Boolean));
      }
      draw();
      return h('div', { class: 'lk' }, sel, box);
    }

    // ---- images
    const IMG_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif';
    const thumbOf = (img) => `${img.src}.${img.ext || 'webp'}`;
    async function uploadImages(files) {
      const fd = new FormData();
      let n = 0;
      for (const f of files) {
        if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(f.type)) { toast(`"${f.name}" bukan JPG/PNG/WebP/GIF/AVIF.`, 'error'); continue; }
        if (f.size > 15 * 1024 * 1024) { toast(`"${f.name}" lebih dari 15 MB.`, 'error'); continue; }
        fd.append('images', f, f.name);
        n++;
      }
      if (!n) return null;
      const out = await run(() => api('POST', P('/assets'), fd));
      return out ? out.images : null;
    }
    function imageEditor(f, obj, changed, id) {
      const box = h('div', { class: 'img-pick' });
      const fileIn = h('input', { id, type: 'file', accept: IMG_ACCEPT, hidden: true, onchange: async (e) => {
        const imgs = await uploadImages([...e.target.files]);
        e.target.value = '';
        if (imgs && imgs[0]) { obj[f.k] = { ...imgs[0], alt: obj[f.k]?.alt || '' }; draw(); changed(); }
      } });
      function draw() {
        const img = obj[f.k];
        box.replaceChildren(
          img ? h('img', { class: 'img-thumb', src: thumbOf(img), alt: '' }) : h('button', { type: 'button', class: 'img-empty', onclick: () => fileIn.click() }, icon('upload'), h('span', { text: 'Upload gambar' })),
          h('div', { class: 'img-side' },
            img ? h('input', { class: 'input', type: 'text', maxlength: 300, value: img.alt || '', placeholder: 'Deskripsi gambar (alt)', 'aria-label': 'Deskripsi gambar', oninput: (e) => { img.alt = e.target.value; changed(); } }) : null,
            h('div', { class: 'row-buttons' },
              img ? btn('Ganti', () => fileIn.click(), 'btn-sm', 'swap') : null,
              img ? btn('Hapus', () => { obj[f.k] = null; draw(); changed(); }, 'btn-sm btn-ghost', 'trash') : null)),
          fileIn);
      }
      draw();
      return box;
    }
    function imagesEditor(f, obj, changed, id) {
      if (!Array.isArray(obj[f.k])) obj[f.k] = [];
      const arr = obj[f.k];
      const box = h('div', { class: 'imgs' });
      const fileIn = h('input', { id, type: 'file', accept: IMG_ACCEPT, multiple: true, hidden: true, onchange: async (e) => {
        const room = (f.max || 30) - arr.length;
        const imgs = await uploadImages([...e.target.files].slice(0, room));
        e.target.value = '';
        if (imgs && imgs.length) { arr.push(...imgs); draw(); changed(); }
      } });
      const mv = (i, d) => { arr.splice(i + d, 0, arr.splice(i, 1)[0]); draw(); changed(); };
      function draw() {
        box.replaceChildren(
          h('ul', { class: 'imgs-grid' }, arr.map((img, i) => h('li', {},
            h('img', { src: thumbOf(img), alt: '' }),
            h('div', { class: 'imgs-ctl' },
              iconBtn('chevL', 'Geser ke kiri', () => mv(i, -1), { class: 'sm', attrs: { disabled: i === 0 } }),
              iconBtn('chevR', 'Geser ke kanan', () => mv(i, 1), { class: 'sm', attrs: { disabled: i === arr.length - 1 } }),
              iconBtn('trash', 'Hapus gambar', () => { arr.splice(i, 1); draw(); changed(); }, { class: 'sm danger' })),
            h('input', { class: 'input', type: 'text', maxlength: 300, value: img.alt || '', placeholder: 'Deskripsi (alt)', 'aria-label': `Deskripsi gambar ${i + 1}`, oninput: (e) => { img.alt = e.target.value; changed(); } }))),
          arr.length < (f.max || 30) ? h('li', {}, h('button', { type: 'button', class: 'img-empty', onclick: () => fileIn.click() }, icon('plus'), h('span', { text: 'Tambah' }))) : null),
          fileIn);
      }
      draw();
      return box;
    }

    // ---- repeatable items (FAQ, testimoni, poin, rekening)
    function itemsEditor(f, obj, changed, id) {
      if (!Array.isArray(obj[f.k])) obj[f.k] = [];
      const arr = obj[f.k];
      let openIdx = arr.length === 1 ? 0 : -1;
      const box = h('div', { id, class: 'it-list' });
      const titleOf = (it, i) => String(it.q || it.name || it.title || it.bank || '').replace(/<[^>]*>/g, '').trim() || `${f.label} ${i + 1}`;
      const blank = () => Object.fromEntries(f.fields.map((x) => [x.k, x.d !== undefined ? structuredClone(x.d) : x.t === 'number' ? 0 : x.t === 'image' ? null : '']));
      function draw() {
        box.replaceChildren(
          ...arr.map((it, i) => {
            const title = h('span', { class: 'it-t', text: titleOf(it, i) });
            const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
            return h('details', { class: 'it-card', open: openIdx === i, ontoggle: (e) => { if (e.target.open) openIdx = i; } },
              h('summary', {},
                icon('chevR'), h('span', { class: 'it-n', text: String(i + 1) }), title,
                h('span', { class: 'it-ctl' },
                  iconBtn('up', 'Naikkan', stop(() => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); openIdx = i - 1; draw(); changed(); }), { class: 'sm', attrs: { disabled: i === 0 } }),
                  iconBtn('down', 'Turunkan', stop(() => { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); openIdx = i + 1; draw(); changed(); }), { class: 'sm', attrs: { disabled: i === arr.length - 1 } }),
                  iconBtn('trash', 'Hapus', stop(() => { arr.splice(i, 1); openIdx = -1; draw(); changed(); }), { class: 'sm danger' }))),
              h('div', { class: 'bp-form it-body' }, fieldsForm(f.fields, it, () => { title.textContent = titleOf(it, i); changed(); })));
          }),
          arr.length < (f.max || 30) ? h('button', { type: 'button', class: 'btn btn-sm it-add', onclick: () => { arr.push(blank()); openIdx = arr.length - 1; draw(); changed(); box.lastElementChild?.previousElementSibling?.querySelector('input, textarea, [contenteditable]')?.focus(); } }, icon('plus'), f.add || 'Tambah') : null);
      }
      draw();
      return box;
    }

    // ---- rich text: a small toolbar over a contenteditable; output is cleaned here and sanitised again on the server
    const RT_TAGS = new Set(['P', 'BR', 'H2', 'H3', 'H4', 'STRONG', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'A', 'SPAN', 'DIV', 'MARK', 'SMALL']);
    const RT_RENAME = { B: 'strong', I: 'em', STRIKE: 's', DEL: 's', FONT: 'span' };
    const FONT_EM = { 1: '0.75em', 2: '0.85em', 3: '1em', 4: '1.25em', 5: '1.5em', 6: '2em', 7: '2.5em' };
    function safeCopy(src, doc) {
      const out = doc.createDocumentFragment();
      for (const n of src.childNodes) {
        if (n.nodeType === 3) { out.append(doc.createTextNode(n.nodeValue)); continue; }
        if (n.nodeType !== 1) continue;
        const tag = RT_RENAME[n.tagName] ? RT_RENAME[n.tagName].toUpperCase() : n.tagName;
        if (!RT_TAGS.has(tag)) { out.append(safeCopy(n, doc)); continue; }
        const el = doc.createElement(tag.toLowerCase());
        const style = [];
        if (n.getAttribute('style')) for (const part of n.getAttribute('style').split(';')) {
          const [k, ...rest] = part.split(':');
          const prop = (k || '').trim().toLowerCase();
          const val = rest.join(':').trim();
          if (['color', 'background-color', 'font-size', 'text-align', 'font-weight'].includes(prop) && val && !/[<>"]|url\(|expression/i.test(val)) style.push(`${prop}: ${val}`);
        }
        if (n.tagName === 'FONT') {
          if (n.getAttribute('color')) style.push(`color: ${n.getAttribute('color')}`);
          if (FONT_EM[n.getAttribute('size')]) style.push(`font-size: ${FONT_EM[n.getAttribute('size')]}`);
        }
        if (style.length) el.setAttribute('style', style.join('; '));
        if (tag === 'A') {
          const href = n.getAttribute('href') || '';
          if (/^(https?:|mailto:|tel:|#)/i.test(href)) el.setAttribute('href', href);
        }
        el.append(safeCopy(n, doc));
        out.append(el);
      }
      return out;
    }
    function richEditor(value, onChange, label, id) {
      const area = h('div', { id, class: 'rte-area', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label, spellcheck: 'true' });
      area.append(safeCopy(new DOMParser().parseFromString(`<body>${value || ''}</body>`, 'text/html').body, document));
      const emit = () => {
        // execCommand writes <font size=7> for our size picker: turn those into em sizes first.
        for (const fnt of area.querySelectorAll('font[size="7"]')) { fnt.removeAttribute('size'); fnt.style.fontSize = area.dataset.size || '1em'; }
        const tmp = document.createElement('div');
        tmp.append(safeCopy(area, document));
        onChange(tmp.innerHTML);
      };
      let saved = null;
      const keep = () => { const sel = getSelection(); if (sel.rangeCount && area.contains(sel.anchorNode)) saved = sel.getRangeAt(0).cloneRange(); };
      const restore = () => { area.focus(); if (saved) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(saved); } };
      const cmd = (c, v = null, css = false) => { restore(); document.execCommand('styleWithCSS', false, css); document.execCommand(c, false, v); emit(); keep(); };
      const tb = (ic, label2, fn) => h('button', { type: 'button', class: 'rte-b', title: label2, 'aria-label': label2, onmousedown: (e) => e.preventDefault(), onclick: fn }, icon(ic));
      const block = h('select', { class: 'rte-sel', 'aria-label': 'Jenis teks', onmousedown: keep,
        onchange: (e) => { cmd('formatBlock', e.target.value); e.target.value = ''; } },
      h('option', { value: '', text: 'Gaya', disabled: true, selected: true }), h('option', { value: 'p', text: 'Paragraf' }), h('option', { value: 'h2', text: 'Judul besar' }), h('option', { value: 'h3', text: 'Judul' }), h('option', { value: 'h4', text: 'Sub judul' }));
      const size = h('select', { class: 'rte-sel', 'aria-label': 'Ukuran teks terpilih', onmousedown: keep,
        onchange: (e) => { area.dataset.size = e.target.value; cmd('fontSize', '7'); e.target.value = ''; } },
      h('option', { value: '', text: 'Ukuran', disabled: true, selected: true }), [['0.8em', 'Kecil'], ['1em', 'Normal'], ['1.25em', 'Besar'], ['1.6em', 'Lebih besar'], ['2.2em', 'Sangat besar']].map(([v, l]) => h('option', { value: v, text: l })));
      const colorIn = h('input', { type: 'color', value: '#e3262f', 'aria-label': 'Warna teks terpilih', onpointerdown: keep, onchange: (e) => cmd('foreColor', e.target.value) });
      const markIn = h('input', { type: 'color', value: '#fff3b0', 'aria-label': 'Stabilo teks terpilih', onpointerdown: keep, onchange: (e) => cmd('hiliteColor', e.target.value, true) });
      const bar = h('div', { class: 'rte-bar', role: 'toolbar', 'aria-label': `Format ${label}` },
        block, size,
        tb('bold', 'Tebal (Ctrl+B)', () => cmd('bold')), tb('italic', 'Miring (Ctrl+I)', () => cmd('italic')), tb('underline', 'Garis bawah (Ctrl+U)', () => cmd('underline')),
        h('label', { class: 'rte-color', title: 'Warna teks', onpointerdown: keep }, icon('textColor'), colorIn),
        h('label', { class: 'rte-color', title: 'Stabilo', onpointerdown: keep }, icon('marker'), markIn),
        h('span', { class: 'rte-sep' }),
        tb('alignL', 'Rata kiri', () => cmd('justifyLeft', null, true)), tb('alignC', 'Rata tengah', () => cmd('justifyCenter', null, true)), tb('alignR', 'Rata kanan', () => cmd('justifyRight', null, true)),
        tb('list', 'Daftar titik', () => cmd('insertUnorderedList')), tb('listOl', 'Daftar nomor', () => cmd('insertOrderedList')),
        tb('link', 'Tambah link', async () => {
          keep();
          const url = await promptBox('Tambah link', 'Alamat (https://…, wa.me/…, #bagian)', 'https://', { ok: 'Pasang', maxlength: 1000 });
          if (!url || url === 'https://') return;
          const href = /^(https?:|mailto:|tel:|#)/i.test(url) ? url : `https://${url.replace(/^\/+/, '')}`;
          cmd('createLink', href);
        }),
        tb('eraser', 'Hapus format', () => { cmd('removeFormat'); cmd('unlink'); }));
      area.addEventListener('input', emit);
      area.addEventListener('keyup', keep);
      area.addEventListener('mouseup', keep);
      area.addEventListener('blur', keep);
      area.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); });
      area.addEventListener('drop', (e) => e.preventDefault());
      area.addEventListener('focus', () => document.execCommand('defaultParagraphSeparator', false, 'p'), { once: true });
      return h('div', { class: 'rte' }, bar, area);
    }

    // ============================================================ tab: Desain
    function renderDesain() {
      const st = page.settings;
      const width = h('select', { onchange: (e) => patch({ settings: { maxWidth: e.target.value ? Number(e.target.value) : null } }, 'Lebar halaman diubah.') },
        h('option', { value: '', text: `Ikuti Global (${global.maxWidth}px)`, selected: st.maxWidth == null }),
        options.widths.map((w) => h('option', { value: String(w), text: `${w}px`, selected: st.maxWidth === w })));
      const color = h('input', { type: 'color', value: st.background || '#ffffff', 'aria-label': 'Warna background',
        onchange: (e) => patch({ settings: { background: e.target.value } }, 'Warna background diubah.') });
      const font = h('select', { onchange: (e) => patch({ settings: { font: e.target.value === '__global' ? null : e.target.value } }, 'Font diubah.') },
        h('option', { value: '__global', text: `Ikuti Global (${options.fonts[global.font] || 'Default'})`, selected: st.font == null }),
        Object.entries(options.fonts).map(([v, label]) => h('option', { value: v, text: label, selected: st.font === v })));
      const thumbIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif', hidden: true,
        onchange: async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          const fd = new FormData();
          fd.append('images', f, f.name);
          await edit('POST', P('/thumbnail'), fd, 'Thumbnail diunggah.', { reload: false });
        } });
      return [
        h('div', { class: 'row' },
          field('Lebar Halaman', width),
          h('label', { class: 'field color-field' }, h('span', { text: 'Warna Background' }), h('span', { class: 'color' }, color, h('code', { text: st.background || '#ffffff' })))),
        field('Jenis Font', font, '(untuk teks yang tidak punya font sendiri)'),
        h('h2', { class: 'sub', text: 'Thumbnail Halaman' }),
        h('p', { class: 'fine', text: 'Gambar yang muncul saat link dibagikan (WhatsApp, Facebook) dan di daftar halaman admin.' }),
        h('div', { class: 'thumb-box' }, page.thumbnail ? h('img', { src: page.thumbnail, alt: 'Thumbnail halaman' }) : h('span', { class: 'fine', text: 'Belum ada thumbnail' })),
        h('div', { class: 'row-buttons' },
          btn('Upload', () => thumbIn.click(), '', 'upload'),
          btn('Cari', () => pickThumbnail(), '', 'search'),
          page.thumbnail ? btn('Hapus', () => patch({ thumbnail: '' }, 'Thumbnail dihapus.'), 'btn-danger', 'trash') : null, thumbIn),
        h('h2', { class: 'sub', text: 'Export / Import' }),
        h('p', { class: 'fine', text: 'Ekspor halaman ini menjadi kode, lalu impor di halaman lain. Semua section, atribut dan pengaturan ikut persis sama. Kode hanya bisa dibaca sistem ini.' }),
        h('div', { class: 'row-buttons' }, btn('Ekspor', exportDialog, '', 'download'), btn('Impor', importDialog, '', 'upload')),
      ];
    }
    function pickThumbnail() {
      if (!images.length) return toast('Belum ada gambar di halaman ini. Gunakan Upload.', 'error');
      const d = dialog({
        title: 'Pilih thumbnail dari halaman ini',
        body: h('div', { class: 'pick-grid' }, images.map((src) => h('button', { type: 'button', class: 'pick', 'aria-label': 'Pilih gambar ini',
          onclick: async () => { d.close(); await patch({ thumbnail: src }, 'Thumbnail dipilih.'); } }, h('img', { src, alt: '', loading: 'lazy' })))),
      });
    }
    async function exportDialog() {
      const out = await run(() => api('GET', P('/export')));
      if (!out) return;
      const ta = h('textarea', { readonly: true, class: 'code-out', 'aria-label': 'Kode ekspor', spellcheck: false });
      ta.value = out.code;
      const copy = async () => { try { await navigator.clipboard.writeText(out.code); toast('Kode disalin.'); } catch { ta.select(); document.execCommand('copy'); toast('Kode disalin.'); } };
      const download = () => {
        const a = h('a', { href: URL.createObjectURL(new Blob([out.code], { type: 'text/plain' })), download: out.filename });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      };
      dialog({
        title: 'Ekspor halaman',
        body: [h('p', { class: 'fine', text: `Kode berisi draft saat ini (${page.sections.length} section, ${Math.round(out.code.length / 1024)} KB). Tempel di menu Impor halaman lain.` }), ta],
        foot: [btn('Unduh file', download, '', 'download'), btn('Salin kode', copy, 'btn-primary', 'copy')],
      });
    }
    function importDialog() {
      const ta = h('textarea', { class: 'code-out', placeholder: 'Tempel kode MBP1.… di sini', 'aria-label': 'Kode impor', spellcheck: false });
      const fileIn = h('input', { type: 'file', accept: '.mbpage,.txt', hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (f) ta.value = await f.text(); } });
      const go = async () => {
        if (!ta.value.trim()) return toast('Tempel kode atau pilih file.', 'error');
        if (!(await confirmBox('Isi halaman ini (section, desain, SEO) akan diganti dengan hasil impor. URL halaman tetap. Bisa dibatalkan dengan Undo. Lanjutkan?', { ok: 'Impor' }))) return;
        const out = await edit('POST', P('/import'), { code: ta.value }, 'Impor berhasil. Periksa lalu Publikasikan.');
        if (out) d.close();
      };
      const d = dialog({
        title: 'Impor halaman',
        body: [h('p', { class: 'fine', text: 'Hanya kode dari tombol Ekspor sistem ini yang diterima.' }), ta, fileIn],
        foot: [btn('Pilih file .mbpage', () => fileIn.click(), '', 'upload'), btn('Impor', go, 'btn-primary')],
      });
    }

    // ============================================================ tab: SEO
    function renderSeo() {
      // Any robots value containing "noindex" hides the page (imported pages may carry just "noindex").
      const hide = h('input', { type: 'checkbox', checked: /noindex/i.test(page.robots || ''), onchange: (e) => patch({ robots: e.target.checked ? 'noindex, nofollow' : '' }, e.target.checked ? 'Halaman disembunyikan dari mesin pencari.' : 'Halaman boleh diindeks.') });
      const title = h('input', { type: 'text', maxlength: 160, value: page.title, onchange: (e) => patch({ title: e.target.value }, 'Judul halaman diubah.') });
      const count = h('span', { class: 'hint' });
      const desc = h('textarea', { maxlength: 500, rows: 4, class: 'input', onchange: (e) => patch({ description: e.target.value }, 'Meta deskripsi diubah.') });
      desc.value = page.description;
      const upd = () => { count.textContent = ` ${desc.value.length}/160 disarankan`; };
      desc.addEventListener('input', upd);
      upd();
      const tags = h('div', { class: 'tags' });
      const tagIn = h('input', { type: 'text', placeholder: page.keywords.length ? '' : 'Masukkan tag di sini…', 'aria-label': 'Tambah keyword', maxlength: 60 });
      const save = (kw) => patch({ keywords: kw }, 'Keywords diubah.');
      const add = () => {
        const v = tagIn.value.replace(/,/g, ' ').trim();
        tagIn.value = '';
        if (v && !page.keywords.includes(v)) save([...page.keywords, v]);
      };
      tagIn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
        if (e.key === 'Backspace' && !tagIn.value && page.keywords.length) save(page.keywords.slice(0, -1));
      });
      tagIn.addEventListener('blur', add);
      tags.append(...page.keywords.map((k) => h('span', { class: 'tag' }, k, h('button', { type: 'button', 'aria-label': `Hapus ${k}`, onclick: () => save(page.keywords.filter((x) => x !== k)) }, icon('x')))), tagIn);
      tags.addEventListener('click', (e) => { if (e.target === tags) tagIn.focus(); });
      return [
        h('label', { class: 'check' }, hide, h('span', { text: 'Sembunyikan dari Mesin Pencarian' })),
        field('Judul Halaman', title, '(tampil di Google & tab browser)'),
        h('label', { class: 'field' }, h('span', {}, 'Meta Deskripsi', count), desc),
        h('div', { class: 'field' }, h('span', { text: 'Meta Tags / Keywords' }), tags, h('span', { class: 'hint', text: 'Tekan Enter atau koma untuk menambah.' })),
      ];
    }

    // ============================================================ tab: Global
    function renderGlobal() {
      const setG = (body, msg) => edit('PATCH', P('/global'), body, msg);
      const width = h('select', { onchange: (e) => setG({ maxWidth: Number(e.target.value) }, 'Lebar default diubah.') },
        options.widths.map((w) => h('option', { value: String(w), text: `${w}px`, selected: global.maxWidth === w })));
      const font = h('select', { onchange: (e) => setG({ font: e.target.value }, 'Font default diubah.') },
        Object.entries(options.fonts).map(([v, label]) => h('option', { value: v, text: label, selected: global.font === v })));
      const favIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif', hidden: true,
        onchange: async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          const fd = new FormData();
          fd.append('images', f, f.name);
          await edit('POST', P('/favicon'), fd, 'Favicon diunggah.', { reload: false });
        } });
      // CS Rotator: each group gets its own /go/wa/<id> link; visitors are sent to the numbers in turn.
      const rs = structuredClone(global.rotators || []);
      const saveRot = (msg) => setG({ rotators: rs }, msg);
      const rotList = h('div', { class: 'rot-list' }, rs.map((r, i) => {
        const nums = h('textarea', { class: 'input', rows: 3, 'aria-label': `Nomor WhatsApp ${r.name}`, placeholder: '0812xxxxxxx\n0813xxxxxxx',
          onchange: (e) => { r.numbers = e.target.value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean); saveRot('Nomor CS diperbarui.'); } });
        nums.value = r.numbers.join('\n');
        const msg = h('textarea', { class: 'input', rows: 2, maxlength: 500, 'aria-label': `Pesan default ${r.name}`, placeholder: 'Halo kak, saya mau pesan…',
          onchange: (e) => { r.message = e.target.value; saveRot('Pesan default diperbarui.'); } });
        msg.value = r.message || '';
        return h('div', { class: 'rot-card' },
          h('div', { class: 'rot-head' },
            h('input', { class: 'input', type: 'text', maxlength: 60, value: r.name, 'aria-label': 'Nama grup', onchange: (e) => { r.name = e.target.value.trim() || r.name; saveRot('Nama grup diubah.'); } }),
            iconBtn('trash', `Hapus ${r.name}`, async () => {
              if (!(await confirmBox(`Hapus grup "${r.name}"? Tombol yang memakai grup ini akan berhenti berfungsi sampai diganti.`, { ok: 'Hapus', danger: true }))) return;
              rs.splice(i, 1);
              saveRot('Grup CS dihapus.');
            }, { class: 'danger' })),
          h('label', { class: 'bp-sub' }, h('span', {}, 'Nomor WhatsApp ', h('span', { class: 'hint', text: `(${r.numbers.length} nomor, satu per baris)` })), nums),
          h('label', { class: 'bp-sub' }, h('span', { text: 'Pesan default' }), msg),
          h('small', { class: 'bp-hint', text: `Link: ${location.origin}/go/wa/${r.id}` }));
      }));
      const pix = (key, label, ph, re, help) => h('label', { class: 'field' }, h('span', {}, label, h('span', { class: 'hint', text: ` ${help}` })),
        h('input', { type: 'text', maxlength: 40, value: global[key] || '', placeholder: ph, spellcheck: false, autocapitalize: 'off',
          onchange: (e) => {
            const v = e.target.value.trim();
            if (v && !re.test(v)) { toast(`Format ${label} tidak valid (contoh: ${ph}).`, 'error'); e.target.value = global[key] || ''; return; }
            setG({ [key]: v }, v ? `${label} diisi (berlaku setelah Publikasikan).` : `${label} dimatikan.`);
          } }));
      return [
        h('p', { class: 'note', text: 'Pengaturan global adalah default untuk semua halaman. Berlaku setelah Publikasikan.' }),
        h('div', { class: 'row' }, field('Lebar Halaman (Default)', width), field('Jenis Font', font)),
        h('label', { class: 'field' }, h('span', {}, 'Google Analytics 4', h('span', { class: 'hint', text: ' (Measurement ID, contoh G-AB12CD34EF; kosongkan untuk mematikan)' })),
          h('input', { type: 'text', maxlength: 20, value: global.ga4Id || '', placeholder: 'G-XXXXXXXXXX', autocapitalize: 'characters', spellcheck: false,
            onchange: (e) => { const v = e.target.value.trim().toUpperCase(); if (v && !/^G-[A-Z0-9]{4,15}$/.test(v)) { toast('Format ID harus G-XXXXXXXX.', 'error'); return; } setG({ ga4Id: v }, v ? 'GA4 diaktifkan (berlaku setelah Publikasikan).' : 'GA4 dimatikan.'); } })),
        h('h2', { class: 'sub', text: 'Favicon' }),
        h('div', { class: 'thumb-box fav' }, global.favicon ? h('img', { src: global.favicon, alt: 'Favicon' }) : h('span', { class: 'fine', text: 'Tidak ada favicon' })),
        h('div', { class: 'row-buttons' },
          btn('Upload', () => favIn.click(), '', 'upload'),
          global.favicon ? btn('Hapus', () => setG({ favicon: '' }, 'Favicon dihapus.'), 'btn-danger', 'trash') : null, favIn),
        h('h2', { class: 'sub', text: 'CS Rotator' }),
        h('p', { class: 'fine', text: 'Bagi chat WhatsApp ke beberapa admin secara bergiliran: pengunjung pertama ke nomor 1, berikutnya ke nomor 2, dan seterusnya. Pakai di Tombol → Tujuan: CS Rotator.' }),
        rotList,
        rs.length ? h('p', { class: 'fine' }, h('a', { href: '/admin/reports?tab=cs', target: '_blank', rel: 'noopener', text: 'Lihat jumlah chat per nomor di Laporan →' })) : null,
        rs.length < 20 ? btn('Tambah grup CS', () => { rs.push({ id: '', name: `CS ${rs.length + 1}`, numbers: [], message: '' }); saveRot('Grup CS ditambahkan. Isi nomornya.'); }, 'btn-sm', 'plus') : null,
        h('h2', { class: 'sub', text: 'Pixel iklan' }),
        h('p', { class: 'fine', text: 'Untuk mengukur iklan Meta, TikTok dan Google. Pixel baru aktif setelah pengunjung menekan "Setuju" pada pemberitahuan cookie (sesuai UU PDP). Tombol dengan "Event iklan" mengirim event saat diklik.' }),
        pix('fbPixelId', 'Meta (Facebook) Pixel ID', '123456789012345', /^d{8,20}$/, '(angka saja)'),
        pix('tiktokPixelId', 'TikTok Pixel ID', 'C1ABCDEF2GHIJ3KLMNO', /^[A-Z0-9]{10,30}$/i, ''),
        h('div', { class: 'row' },
          pix('gadsId', 'Google Ads ID', 'AW-123456789', /^AW-d{6,15}$/i, ''),
          pix('gadsLabel', 'Label konversi', 'AbCdEfGh123', /^[w-]{4,40}$/, '(opsional)')),
      ];
    }

    // ============================================================ tab: Riwayat
    let historyData = null;
    function renderRiwayat() {
      const box = h('div', {}, h('p', { class: 'fine', text: 'Memuat riwayat…' }));
      (async () => {
        historyData = await run(() => api('GET', P('/history')));
        if (!historyData || tab !== 'riwayat') return;
        const detail = (e) => [
          e.name && `"${e.name}"`, e.fields && e.fields.length && e.fields.map((f) => FIELD_LABELS[f] || f).join(', '),
          e.changed && e.changed.length && e.changed.map((f) => FIELD_LABELS[f] || f).join(', '), e.from && `dari /${e.from}`,
          e.version && `versi ${fmtDate(new Date(Number(e.version)).toISOString())}`,
        ].filter(Boolean).join(' · ');
        box.replaceChildren(
          h('h2', { class: 'sub', text: 'Versi tersimpan' }),
          h('p', { class: 'fine', text: 'Setiap kali Publikasikan, versi sebelumnya dicadangkan (50 terakhir). "Muat" memasukkan versi itu ke draft; klik Publikasikan untuk menayangkannya lagi.' }),
          historyData.versions.length
            ? h('ul', { class: 'history' }, historyData.versions.map((v) => h('li', {},
              h('div', {}, h('strong', { text: fmtDate(v.savedAt || new Date(v.ts).toISOString()) }), h('br'),
                h('small', { text: `${v.sections} section${v.by ? ` · oleh ${v.by}` : ''}` })),
              btn('Muat ke draft', async () => {
                if (!(await confirmBox('Muat versi ini ke draft? Bisa dibatalkan dengan Undo.'))) return;
                edit('POST', P(`/history/${v.ts}/restore`), undefined, 'Versi dimuat ke draft. Klik Publikasikan untuk menayangkannya.');
              }, 'btn-sm'))))
            : h('p', { class: 'empty', text: 'Belum ada versi tersimpan.' }),
          h('h2', { class: 'sub', text: 'Aktivitas halaman ini' }),
          historyData.activity.length
            ? h('ul', { class: 'activity' }, historyData.activity.map((e) => h('li', {},
              h('span', { class: 'when', text: fmtDate(e.ts) }),
              h('span', { class: 'what' }, h('strong', { text: EVENT_LABELS[e.event] || e.event }), e.draft ? h('span', { class: 'badge', text: 'draft' }) : null,
                detail(e) ? h('span', { class: 'fine', text: ` ${detail(e)}` }) : null),
              h('span', { class: 'who fine', text: e.actor || '-' }))))
            : h('p', { class: 'empty', text: 'Belum ada aktivitas.' }));
      })();
      return [box];
    }

    function renderTab() {
      if (!page) return;
      if (tab !== 'konten') list = null;
      const views = { konten: renderKonten, desain: renderDesain, seo: renderSeo, global: renderGlobal, riwayat: renderRiwayat };
      // Re-render, but keep keyboard focus on the same control (e.g. after tabbing from a field that just saved).
      const sel = 'input, select, textarea, button';
      const active = document.activeElement;
      const idx = active && panel.contains(active) ? [...panel.querySelectorAll(sel)].indexOf(active) : -1;
      panel.replaceChildren(...(views[tab] || renderKonten)().filter(Boolean));
      if (idx >= 0) panel.querySelectorAll(sel)[idx]?.focus({ preventScroll: true });
    }

    function dropZone(input, onFiles, label, hint) {
      const z = h('label', { class: 'file-drop' }, icon('upload'), h('span', {}, h('strong', { text: label }), ' atau tarik file ke sini'), h('span', { class: 'fine', text: hint }), input);
      z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('drag'); });
      z.addEventListener('dragleave', () => z.classList.remove('drag'));
      z.addEventListener('drop', (e) => { e.preventDefault(); z.classList.remove('drag'); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); });
      return z;
    }

    // ---- boot
    const [data, defs] = await Promise.all([run(() => api('GET', P())), api('GET', '/admin/api/blocks').catch(() => null)]);
    if (!data) return;
    blockDefs = defs;
    setState(data, { reload: false });
    setTab(tab);
    requestAnimationFrame(() => setDevice(device));
  }

  // ============================================================ PROMO
  async function viewPromo() {
    const { content, appbar } = layout({ active: 'promo', title: 'Promo', subtitle: 'Satu promo berjalan di semua halaman: banner, badge dan bar promo.' });
    const main = h('div');
    content.append(main);
    const barTools = appbar.querySelector('.tools');
    let data = null;
    const STATUS = { aktif: 'Aktif', terjadwal: 'Terjadwal', berakhir: 'Berakhir', tertimpa: 'Tertimpa promo lain', nonaktif: 'Nonaktif' };
    const wib = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
    const range = (p) => (p.start || p.end ? `${wib(p.start) || '…'} – ${wib(p.end) || 'seterusnya'} WIB` : 'Belum dijadwalkan');
    const imgUrl = (im) => (im ? `${im.src}.${im.ext || 'webp'}` : '');
    const why = (a) => (a ? `${a.name}${a.reason === 'manual' ? ' (toggle manual)' : a.end ? ` (jadwal, sampai ${wib(a.end)} WIB)` : ' (jadwal)'}` : 'Tidak ada promo aktif');

    async function publishNow() {
      if (!(await confirmBox(`Publish sekarang? Semua halaman live akan memakai: ${why(data.active.draft)}.`, { ok: 'Publish' }))) return;
      call('POST', '/admin/api/promos/publish', undefined, 'Promo dipublish. Semua halaman sudah diperbarui.');
    }
    async function call(method, url, body, msg) {
      const out = await run(() => api(method, url, body));
      if (out) {
        data = out;
        render();
        // remind to publish: every draft change offers "Publish sekarang"
        if (msg) toast(msg, 'ok', out.dirty && /draft/i.test(msg) ? { label: 'Publish sekarang', onclick: publishNow } : undefined);
        const promoLink = document.querySelector('.side-link[href="/admin/promo"]');
        if (out.dirty && promoLink && !promoLink.querySelector('.ndot')) promoLink.append(h('span', { class: 'ndot', title: 'Draft promo belum dipublish' }));
        if (!out.dirty) promoLink?.querySelector('.ndot')?.remove();
      }
      return out;
    }

    // Timeline: which promo runs on each day (same rules as the server), and days without any promo.
    const DAY = 864e5;
    const wibNoon = (t) => Date.parse(`${new Date(t + 7 * 3600e3).toISOString().slice(0, 10)}T12:00:00+07:00`);
    function effective(list, t) {
      const ins = list.filter((p) => p.kind === 'insidentil');
      const inR = (p) => (p.start || p.end) && (!p.start || Date.parse(p.start) <= t) && (!p.end || t <= Date.parse(p.end));
      return ins.find((p) => p.manual) || ins.find(inR) || list.find((p) => p.kind === 'regular' && inR(p)) || null;
    }
    function timeline() {
      const start = wibNoon(Date.now() - 3 * DAY);
      const days = 100;
      const cells = Array.from({ length: days }, (_, i) => start + i * DAY);
      const eff = cells.map((t) => effective(data.promos, t));
      const segs = [];
      eff.forEach((p, i) => { const last = segs[segs.length - 1]; if (last && (last.p && last.p.id) === (p && p.id)) last.n++; else segs.push({ p, i, n: 1 }); });
      const pct = (i) => `${(i / days) * 100}%`;
      const todayIdx = 3;
      const months = cells.map((t, i) => [i, new Date(t)]).filter(([i, d]) => i === 0 || d.getDate() === 1);
      const gaps = segs.filter((x) => !x.p);
      const COLORS = ['var(--chart-1)', 'var(--info)', 'var(--warn)', 'var(--ok)'];
      const color = new Map(data.promos.map((p, i) => [p.id, COLORS[i % COLORS.length]]));
      const bar = (from, n, label, c, extra = '') => h('span', { class: `tl-seg ${extra}`, style: `left:${pct(from)};width:${pct(n)};--c:${c}`, title: label }, n >= 4 ? label : '');
      return h('section', { class: 'card2 tl' },
        h('div', { class: 'card-head' }, h('div', {}, h('h2', { text: 'Timeline promo' }), h('div', { class: 'sub2', text: '3 bulan ke depan (sesuai draft yang akan dipublish)' }))),
        h('div', { class: 'tl-grid' },
          h('div', { class: 'tl-row tl-axis' }, h('span', { class: 'tl-label' }),
            h('div', { class: 'tl-track' }, months.map(([i, d]) => h('span', { class: 'tl-month', style: `left:${pct(i)}`, text: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) })),
              h('span', { class: 'tl-today', style: `left:${pct(todayIdx + 0.5)}`, title: 'Hari ini' }))),
          h('div', { class: 'tl-row tl-eff' }, h('span', { class: 'tl-label', text: 'Berjalan' }),
            h('div', { class: 'tl-track' }, segs.map((x) => (x.p ? bar(x.i, x.n, x.p.name, color.get(x.p.id)) : bar(x.i, x.n, 'Tidak ada promo', 'var(--danger)', 'gap'))))),
          data.promos.map((p) => {
            const on = cells.map((t) => (p.kind === 'insidentil' && p.manual) || ((p.start || p.end) && (!p.start || Date.parse(p.start) <= t) && (!p.end || t <= Date.parse(p.end))));
            const runs = [];
            on.forEach((v, i) => { if (!v) return; const last = runs[runs.length - 1]; if (last && last.i + last.n === i) last.n++; else runs.push({ i, n: 1 }); });
            return h('div', { class: 'tl-row' }, h('span', { class: 'tl-label', text: p.name, title: p.kind === 'insidentil' ? 'Insidentil' : 'Regular' }),
              h('div', { class: 'tl-track' }, runs.map((r) => bar(r.i, r.n, `${p.name}${p.manual ? ' (toggle)' : ''}`, color.get(p.id), 'muted'))));
          })),
        gaps.length ? h('p', { class: 'warn-line' }, icon('calendar'), `Tidak ada promo pada: ${gaps.map((g) => `${fmtDay(cells[g.i])} – ${fmtDay(cells[g.i + g.n - 1])}`).join(', ')}. Banner, badge dan bar promo tidak tampil di tanggal itu.`) : null);
    }
    const fmtDay = (t) => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
    const barPreview = (bar) => h('div', { class: 'mini-bar', style: `--pb:${(bar && bar.color) || '#ff0000'}` },
      h('b', { text: (bar && bar.title) || '' }), h('span', { text: [bar && bar.left, bar && bar.right].filter(Boolean).join('  |  ') }));

    function card(p) {
      const sw = p.kind === 'insidentil' ? h('button', {
        type: 'button', role: 'switch', class: 'switch', 'aria-checked': String(Boolean(p.manual)), 'aria-label': `Aktifkan ${p.name} sekarang`,
        onclick: () => call('PATCH', `/admin/api/promos/${p.id}`, { manual: !p.manual }, p.manual ? 'Toggle dimatikan (draft).' : 'Toggle dinyalakan (draft).'),
      }, h('span', {})) : null;
      return h('article', { class: `promo-card st-${p.status}` },
        h('div', { class: 'promo-head' },
          h('div', {}, h('h3', { text: p.name }), h('span', { class: `chip-st ${p.status}`, text: STATUS[p.status] || p.status })),
          sw ? h('label', { class: 'switch-wrap' }, h('span', { class: 'fine', text: 'Toggle' }), sw) : null),
        h('p', { class: 'fine promo-range' }, icon('calendar'), range(p)),
        h('div', { class: 'promo-media' },
          h('div', { class: 'pm-banner' }, p.banner ? h('img', { src: imgUrl(p.banner), alt: 'Banner' }) : h('span', { text: 'Belum ada banner' })),
          h('div', { class: 'pm-badge' }, p.badge ? h('img', { src: imgUrl(p.badge), alt: 'Badge' }) : h('span', { text: 'Belum ada badge' }))),
        barPreview(p.bar),
        h('div', { class: 'actions' },
          btn('Edit', () => editDialog(p), 'btn-sm btn-primary', 'edit'),
          btn('Hapus', async () => {
            if (!(await confirmBox(`Hapus promo "${p.name}"? Berlaku setelah Publish.`, { ok: 'Hapus', danger: true }))) return;
            call('DELETE', `/admin/api/promos/${p.id}`, undefined, 'Promo dihapus (draft).');
          }, 'btn-sm btn-danger', 'trash')));
    }

    function render() {
      const group = (kind, title, help) => {
        const list = data.promos.filter((p) => p.kind === kind);
        return h('section', { class: 'promo-group' },
          h('div', { class: 'promo-group-head' },
            h('div', {}, h('h2', { text: title }), h('p', { class: 'fine', text: help })),
            btn(`Promo ${kind === 'insidentil' ? 'insidentil' : 'regular'}`, () => createDialog(kind), 'btn-sm', 'plus')),
          list.length ? h('div', { class: 'promo-grid' }, list.map(card)) : h('div', { class: 'empty' }, icon('megaphone'), h('strong', { text: 'Belum ada promo' }), h('span', { text: kind === 'insidentil' ? 'Contoh: 11.11, 12.12, Natal, Idul Fitri.' : 'Contoh: 14 Day Promo, PayDay.' })));
      };
      // Publish / discard live in the app bar, next to the theme toggle.
      barTools.querySelectorAll('[data-promo-action]').forEach((el) => el.remove());
      barTools.prepend(...[
        data.dirty ? h('button', { type: 'button', class: 'btn btn-danger', dataset: { promoAction: '1' }, onclick: async () => {
          if (await confirmBox('Buang semua perubahan promo yang belum dipublish?', { ok: 'Buang', danger: true })) call('POST', '/admin/api/promos/discard', undefined, 'Draft promo dibuang.');
        } }, icon('trash'), h('span', { class: 'hide-sm', text: 'Buang draft' })) : null,
        h('button', { type: 'button', class: 'btn btn-primary', dataset: { promoAction: '1' }, disabled: !data.dirty, title: data.dirty ? '' : 'Tidak ada perubahan untuk dipublish', onclick: async () => {
          if (!(await confirmBox(`Publish sekarang? Semua halaman live akan memakai: ${why(data.active.draft)}.`, { ok: 'Publish' }))) return;
          call('POST', '/admin/api/promos/publish', undefined, 'Promo dipublish. Semua halaman sudah diperbarui.');
        } }, icon('check'), 'Publish'),
      ].filter(Boolean));
      main.replaceChildren(
        h('div', { class: 'promo-status' },
          h('div', { class: 'ps live' }, h('span', { class: 'fine', text: 'Live sekarang' }), h('strong', { text: why(data.active.live) }),
            h('span', { class: 'fine', text: data.published.at ? `Dipublish ${fmtDate(data.published.at)}${data.published.by ? ` oleh ${data.published.by}` : ''}` : '' })),
          data.dirty ? h('div', { class: 'ps draft' }, h('span', { class: 'fine', text: 'Setelah Publish' }), h('strong', { text: why(data.active.draft) }),
            h('span', { class: 'fine', text: 'Ada perubahan yang belum dipublish.' })) : null),
        timeline(),
        group('insidentil', 'Promo Insidentil', 'Aktif lewat toggle atau jadwal. Kalau ada yang aktif, promo Regular otomatis tidak berjalan.'),
        group('regular', 'Promo Regular', 'Berjalan mengikuti jadwal tanggal (tanpa toggle), selama tidak ada promo Insidentil yang aktif.'));
    }

    async function createDialog(kind) {
      const name = await promptBox(`Promo ${kind} baru`, 'Nama promo (mis. 11.11, Natal, PayDay)', '', { ok: 'Buat', maxlength: 60 });
      if (!name) return;
      const out = await call('POST', '/admin/api/promos', { kind, name }, 'Promo dibuat (draft).');
      const p = out && out.promos[out.promos.length - 1];
      if (p) editDialog(p);
    }

    function editDialog(p) {
      if (anyDialogOpen()) return;
      const cur = () => data.promos.find((x) => x.id === p.id) || p;
      const name = h('input', { type: 'text', maxlength: 60, value: p.name });
      const start = h('input', { type: 'datetime-local', value: p.start ? p.start.slice(0, 16) : '' });
      const end = h('input', { type: 'datetime-local', value: p.end ? p.end.slice(0, 16) : '' });
      const bar = { ...(p.bar || {}) };
      const title = h('input', { type: 'text', maxlength: 80, value: bar.title || '' });
      const left = h('input', { type: 'text', maxlength: 40, value: bar.left || '' });
      const right = h('input', { type: 'text', maxlength: 40, value: bar.right || '' });
      const color = h('input', { type: 'color', value: bar.color || '#ff0000', 'aria-label': 'Warna bar' });
      const prev = h('div');
      const syncBar = () => prev.replaceChildren(barPreview({ title: title.value, left: left.value, right: right.value, color: color.value }));
      for (const el of [title, left, right, color]) el.addEventListener('input', syncBar);
      syncBar();
      const media = (part, label, hint) => {
        const box = h('div', { class: `pm-${part} big` });
        const show = () => { const im = cur()[part]; box.replaceChildren(im ? h('img', { src: imgUrl(im), alt: label }) : h('span', { text: `Belum ada ${label.toLowerCase()}` })); };
        show();
        const input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif', hidden: true, onchange: async (e) => {
          const f = e.target.files[0];
          if (!f) return;
          const fd = new FormData();
          fd.append('images', f, f.name);
          await call('POST', `/admin/api/promos/${p.id}/image?part=${part}`, fd, `${label} diunggah (draft).`);
          show();
        } });
        return h('div', { class: 'field' }, h('span', {}, label, h('span', { class: 'hint', text: ` ${hint}` })), box,
          h('div', { class: 'row-buttons' }, btn(cur()[part] ? 'Ganti' : 'Upload', () => input.click(), '', 'upload'),
            btn('Hapus', async () => { await call('DELETE', `/admin/api/promos/${p.id}/image?part=${part}`, undefined, `${label} dihapus (draft).`); show(); }, 'btn-danger', 'trash'), input));
      };
      const save = async () => {
        const out = await call('PATCH', `/admin/api/promos/${p.id}`, {
          name: name.value, start: start.value, end: end.value,
          bar: { title: title.value, left: left.value, right: right.value, color: color.value },
        }, 'Promo disimpan ke draft. Klik Publish agar live.');
        if (out) d.close();
      };
      const d = dialog({
        title: `Edit promo: ${p.name}`,
        body: h('form', { onsubmit: (e) => { e.preventDefault(); save(); } },
          h('div', { class: 'row' }, field('Nama promo', name), h('div', { class: 'field' }, h('span', { text: 'Jenis' }), h('span', { class: 'badge', text: p.kind === 'insidentil' ? 'Insidentil' : 'Regular' }))),
          h('h3', { class: 'sub', text: 'Durasi promo (WIB)' }),
          h('p', { class: 'fine', text: p.kind === 'insidentil' ? 'Promo aktif otomatis selama jadwal ini, atau kapan saja lewat toggle.' : 'Promo regular hanya berjalan selama jadwal ini.' }),
          h('div', { class: 'row' }, field('Mulai', start), field('Selesai', end)),
          h('h3', { class: 'sub', text: 'Gambar' }),
          media('banner', 'Banner', '(lebar penuh, otomatis menyesuaikan halaman)'),
          media('badge', 'Badge', '(PNG transparan disarankan, posisi diatur per halaman)'),
          h('h3', { class: 'sub', text: 'Bar merah (paling atas)' }),
          prev,
          field('Baris 1', title),
          h('div', { class: 'row' }, field('Baris 2 kiri', left), field('Baris 2 kanan', right),
            h('label', { class: 'field color-field' }, h('span', { text: 'Warna' }), h('span', { class: 'color' }, color)))),
        foot: [btn('Batal', () => d.close()), btn('Simpan ke draft', save, 'btn-primary')],
      });
    }

    main.append(h('div', { class: 'promo-grid' }, [0, 1].map(() => h('div', { class: 'promo-card skeleton', style: 'height:300px' }))));
    data = await run(() => api('GET', '/admin/api/promos'));
    if (data) render();
  }

  // Shared helpers for the Produk views (public/admin/shop.js, loaded after this file).
  window.MBA = { h, icon, ICONS, iconBtn, btn, field, api, run, toast, busy, dialog, confirmBox, choiceBox, promptBox, contextMenu, closeMenu,
    layout, subtabs, nf, fmtDate, dLabel, lineChart, slugify, isTyping, EMAIL };

  ({ dashboard: viewDashboard, reports: viewReports, pages: viewPages, homepage: viewHomepage, distributors: viewDistributors, templates: viewTemplates, editor: viewEditor, promo: viewPromo })[VIEW]?.();
})();
