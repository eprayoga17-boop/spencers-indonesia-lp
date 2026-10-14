// MealBlend Admin — vanilla JS, no build step. All user data is inserted as text (never innerHTML).
(() => {
  'use strict';

  const CSRF = document.querySelector('meta[name="csrf-token"]').content;
  const VIEW = document.body.dataset.view;
  const SLUG = document.body.dataset.slug;
  const EMAIL = document.body.dataset.email;
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
    'section.create': 'Tambah section', 'section.update': 'Ubah section', 'section.delete': 'Hapus section', 'section.duplicate': 'Duplikat section',
    'section.reorder': 'Ubah urutan section', 'section.cut': 'Cut section', 'section.paste': 'Tempel section',
    'badge.create': 'Tambah badge promo', 'badge.move': 'Geser badge promo', 'badge.delete': 'Hapus badge promo',
    'promo.create': 'Buat promo', 'promo.update': 'Ubah promo', 'promo.delete': 'Hapus promo', 'promo.publish': 'Publish promo', 'promo.discard': 'Buang draft promo',
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
  async function api(method, url, body) {
    const opts = { method, headers: { 'x-csrf-token': CSRF, accept: 'application/json' }, credentials: 'same-origin' };
    if (draftRev && method !== 'GET') opts.headers['x-draft-rev'] = String(draftRev);
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
    if (data.draft) draftRev = data.draft.rev;
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
        link('promo', '/admin/promo', 'megaphone', 'Promo')),
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
      if (st.unsavedPages) dot(root.querySelector('.subtab[href="/admin/pages"]'), 'Ada draft halaman belum disimpan');
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
  async function viewReports() {
    const params = new URLSearchParams(location.search);
    const tab = ['log', 'bagian'].includes(params.get('tab')) ? params.get('tab') : 'ringkasan';
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
    const { content } = layout({ active: 'laporan', title: 'Laporan', subtitle: tab === 'log' ? 'Catatan login dan setiap perubahan.' : tab === 'bagian' ? 'Bagian mana yang dilihat dan diklik pengunjung.' : 'Statistik kunjungan landing page.' });
    content.append(h('div', { class: 'tabbar' }, subtabs([['ringkasan', '/admin/reports', 'chart', 'Page View'], ['bagian', '/admin/reports?tab=bagian', 'grid', 'Per Bagian'], ['log', '/admin/reports?tab=log', 'clock', 'Log Aktivitas']], tab), tab === 'log' ? null : filters));
    const body = h('div');
    content.append(body);
    if (tab === 'log') return renderLog(body);

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
      const KIND = { wa: 'WhatsApp', video: 'Video', slider: 'Slider', faq: 'FAQ', link: 'Link', other: 'Lainnya' };
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
    const { content } = layout({ active: 'halaman', title: 'Halaman', subtitle: 'Semua landing page. Duplikat untuk dijadikan template.',
      tools: [btn('Halaman baru', () => pageDialog(), 'btn-primary', 'plus')] });
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
      pages = data.pages;
      const cats = data.categories.filter((c) => data.pages.some((p) => p.category === c));
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
          h('span', { text: `${p.sections} section${p.category ? ` · ${p.category}` : ''}` }),
          h('span', { text: `Disimpan ${fmtDate(p.updatedAt)}${p.updatedBy ? ` oleh ${p.updatedBy}` : ''}` }),
          h('span', { class: 'badges' },
            p.unsaved ? h('span', { class: 'badge warn', text: 'Ada draft belum disimpan' }) : null,
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
          h('p', { class: 'fine', text: 'Template disalin persis (section, desain, SEO). Halaman baru bisa diubah tanpa memengaruhi halaman asal.' }),
          h('button', { type: 'submit', hidden: true })),
        foot: [btn('Batal', () => d.close()), btn('Buat halaman', submit, 'btn-primary')],
      });
      title.focus();
    }
    load();
  }

  // ============================================================ EDITOR
  async function viewEditor() {
    let page = null; // draft summary
    let global = null; // draft global settings
    let draft = { canUndo: false, canRedo: false, dirty: false };
    let published = {};
    let clipboard = null;
    let options = { fonts: {}, widths: [] };
    let images = [];
    let livePromo;
    let selected = sessionStorage.getItem(`sel:${SLUG}`) || null;
    let tab = sessionStorage.getItem(`tab:${SLUG}`) || 'konten';

    // ---- header bar
    const nameEl = h('h1');
    const statusEl = h('span', { class: 'status' });
    const undoBtn = iconBtn('undo', 'Undo (Ctrl+Z)', () => undoRedo('undo'));
    const redoBtn = iconBtn('redo', 'Redo (Ctrl+Shift+Z)', () => undoRedo('redo'));
    const saveBtn = btn('Simpan', () => publish(), 'btn-primary', 'check');
    const liveLink = h('a', { class: 'btn', href: `/${SLUG}`, target: '_blank', rel: 'noopener', title: 'Buka halaman live' }, icon('external'), h('span', { class: 'hide-sm', text: 'Lihat live' }));
    const bar = h('header', { class: 'edit-bar' },
      h('button', { type: 'button', class: 'icon-btn nav-toggle', 'aria-label': 'Buka menu', onclick: () => document.getElementById('app').classList.add('nav-open') }, icon('menu')),
      btn('Kembali', () => goBack(), '', 'back'),
      h('div', { class: 'edit-title' }, nameEl, statusEl),
      h('div', { class: 'edit-tools' },
        h('div', { class: 'undo-group', role: 'group', 'aria-label': 'Undo dan redo' }, undoBtn, redoBtn),
        btn('Preview', () => { previewWrap.classList.add('open'); fitPhone(); }, 'only-narrow', 'phone'),
        btn('Coba di HP', () => phoneDialog(), 'hide-sm', 'phone'), liveLink, themeToggle(), saveBtn));

    // ---- tabs
    const TABS = [['konten', 'Konten'], ['desain', 'Desain'], ['seo', 'SEO'], ['global', 'Global'], ['riwayat', 'Riwayat']];
    const tabBtns = TABS.map(([id, label]) => h('button', { type: 'button', role: 'tab', class: 'etab', id: `tab-${id}`, 'aria-controls': 'tabpanel', text: label, onclick: () => setTab(id) }));
    const tabList = h('div', { class: 'etabs', role: 'tablist', 'aria-label': 'Bagian editor',
      onkeydown: (e) => {
        const i = TABS.findIndex(([id]) => id === tab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0]; setTab(n); document.getElementById(`tab-${n}`).focus(); }
      } }, tabBtns);
    const panel = h('div', { class: 'epanel', role: 'tabpanel', id: 'tabpanel' });
    function setTab(id) {
      tab = id;
      sessionStorage.setItem(`tab:${SLUG}`, id);
      for (const b of tabBtns) { const on = b.id === `tab-${id}`; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
      panel.setAttribute('aria-labelledby', `tab-${id}`);
      renderTab();
    }

    // ---- iPhone 11 preview (414 × 896 pt screen)
    const iframe = h('iframe', { title: 'Preview halaman di iPhone 11', src: `/admin/preview/${SLUG}` });
    const phone = h('div', { class: 'iphone' },
      h('span', { class: 'ib ib-silent' }), h('span', { class: 'ib ib-volup' }), h('span', { class: 'ib ib-voldown' }), h('span', { class: 'ib ib-power' }),
      h('div', { class: 'iphone-screen' },
        h('div', { class: 'iphone-status', 'aria-hidden': 'true' },
          h('span', { class: 'time', text: '9:41' }), h('span', { class: 'notch' }),
          h('span', { class: 'sicons' }, h('i', { class: 'sig' }, h('b'), h('b'), h('b'), h('b')), h('i', { class: 'wifi' }), h('i', { class: 'batt' }))),
        iframe,
        h('span', { class: 'home-ind', 'aria-hidden': 'true' })));
    const phoneBox = h('div', { class: 'phone-box' }, phone);
    const previewWrap = h('aside', { class: 'preview', 'aria-label': 'Preview iPhone 11' },
      phoneBox,
      h('p', { class: 'fine', text: 'iPhone 11 · 414 × 896. Klik section di preview untuk memilihnya; klik kanan untuk menu.' }),
      h('div', { class: 'only-narrow center' }, btn('Tutup preview', () => previewWrap.classList.remove('open'))));
    function fitPhone() {
      const top = Math.max(phoneBox.getBoundingClientRect().top, 132);
      const avail = Math.max(320, innerHeight - (previewWrap.classList.contains('open') ? 90 : top) - 44);
      const s = Math.min(1, avail / 948);
      phoneBox.style.setProperty('--s', s.toFixed(4));
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
      const c = await choiceBox('Perubahan belum disimpan', 'Draft halaman ini belum dipublikasikan. Simpan dulu sebelum pindah?', [
        { label: 'Batal', value: null },
        { label: 'Pindah tanpa simpan', value: 'leave', cls: 'btn-ghost' },
        { label: 'Simpan & pindah', value: 'save', cls: 'btn-primary' },
      ]);
      if (c === 'leave') go();
      if (c === 'save' && (await publish())) go();
    }, true);
    edContent.classList.add('editor-wrap');
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
      for (const el of doc.querySelectorAll('.lp-sec.mb-sel')) el.classList.remove('mb-sel', 'mb-pulse');
      const el = selected && doc.getElementById(selected);
      if (!el) return;
      el.classList.add('mb-sel');
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
        if (sec) select(sec.id, { from: 'preview' });
      }, true);
      doc.addEventListener('contextmenu', (e) => {
        const sec = e.target.closest('.lp-sec');
        if (!sec) return;
        e.preventDefault();
        select(sec.id, { from: 'preview' });
        const r = iframe.getBoundingClientRect();
        const s = r.width / iframe.offsetWidth;
        sectionMenu(sec.id, r.left + e.clientX * s, r.top + e.clientY * s);
      }, true);
      doc.addEventListener('keydown', (e) => handleKeys(e), true);
      setupBadgeDrag(doc);
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

    function reloadPreview(pulse = false) {
      try { restoreY = iframe.contentWindow.scrollY; } catch { restoreY = 0; }
      pulseNext = pulse;
      try { iframe.contentWindow.location.reload(); } catch { iframe.src = iframe.src; }
    }

    function select(id, { from = 'list' } = {}) {
      selected = id;
      sessionStorage.setItem(`sel:${SLUG}`, id);
      if (from === 'preview' && tab !== 'konten') setTab('konten');
      if (list) {
        for (const li of list.children) li.classList.toggle('selected', li.dataset.id === id);
        const row = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (row && from === 'preview') row.scrollIntoView({ block: 'center' }); // instant: Chrome cancels parallel smooth scrolls
      }
      markPreview(true, from !== 'preview'); // a section clicked in the preview is already in view
    }

    // ---- state
    function setState(out, { reload = true, pulse = false } = {}) {
      if (out.page) page = out.page;
      if (out.global) global = out.global;
      if (out.draft) draft = out.draft;
      if (out.published) published = out.published;
      if (out.clipboard !== undefined && out.clipboard !== null) clipboard = out.clipboard;
      if (out.images) images = out.images;
      if (out.options) options = out.options;
      if (out.promo !== undefined) livePromo = out.promo;
      if (selected && !page.sections.some((s) => s.id === selected)) selected = null;
      document.title = `${page.name} · Spencer's Indonesia`;
      nameEl.textContent = page.name;
      statusEl.textContent = draft.dirty ? 'Belum disimpan' : `Tersimpan ${fmtDate(published.updatedAt)}`;
      statusEl.className = `status ${draft.dirty ? 'dirty' : 'saved'}`;
      undoBtn.disabled = !draft.canUndo;
      redoBtn.disabled = !draft.canRedo;
      saveBtn.disabled = !draft.dirty;
      renderTab();
      if (reload) reloadPreview(pulse);
    }
    async function edit(method, url, body, msg, opts) {
      const out = await run(() => api(method, url, body), msg);
      if (out) {
        setState(out, opts);
        if (out.notes && out.notes.length) toast(`Catatan: ${out.notes.join(', ')}`);
      }
      return out;
    }
    const P = (p = '') => `/admin/api/pages/${SLUG}${p}`;

    async function undoRedo(which) {
      if ((which === 'undo' && !draft.canUndo) || (which === 'redo' && !draft.canRedo)) return;
      await edit('POST', P(`/${which}`), undefined, null);
    }

    async function publish(force = false) {
      try {
        const out = await run(() => api('POST', P('/publish'), { force }), 'Tersimpan. Halaman live sudah diperbarui.');
        if (!out) return false;
        if (out.slug && out.slug !== SLUG) { location.replace(`/admin/pages/${out.slug}`); return true; }
        setState(out, { reload: false });
        return true;
      } catch (e) {
        if (e.code === 'LIVE_CHANGED' && (await confirmBox(`${e.message} Timpa dengan draft ini?`, { ok: 'Timpa & simpan', danger: true }))) return publish(true);
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
          h('p', { text: 'Pindai dengan kamera HP untuk melihat draft halaman ini sebelum disimpan. Perubahan berikutnya ikut tampil setelah halaman di HP dimuat ulang.' }),
          h('code', { class: 'qr-url', text: out.url }),
          h('p', { class: 'fine', text: `Berlaku sampai ${fmtDate(out.expiresAt)}. Link ini tidak diindeks Google dan tidak dihitung di Laporan.` }),
          out.local ? h('p', { class: 'note', text: 'Mode lokal: HP harus terhubung ke Wi-Fi yang sama dengan komputer ini. Jika tidak terbuka, izinkan Node.js di Windows Firewall.' }) : null),
        foot: [btn('Salin link', copy, 'btn-primary', 'copy')],
      });
    }

    async function goBack() {
      if (!draft.dirty) { location.href = '/admin'; return; }
      const c = await choiceBox('Perubahan belum disimpan', 'Draft ini belum dipublikasikan. Apa yang ingin dilakukan?', [
        { label: 'Batal', value: null },
        { label: 'Buang perubahan', value: 'discard', cls: 'btn-danger' },
        { label: 'Simpan & keluar', value: 'save', cls: 'btn-primary' },
      ]);
      if (c === 'save' && (await publish())) location.href = '/admin';
      if (c === 'discard' && (await run(() => api('POST', P('/discard'))))) location.href = '/admin';
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

    // ============================================================ tab: Konten
    let list = null;
    const TYPE_LABEL = { image: 'Gambar', html: 'HTML', promo: '[PROMO]' };
    const promoLocked = () => toast('Isi section [PROMO] mengikuti promo yang aktif. Ubah di menu Promo.', 'ok', { label: 'Buka Promo', onclick: () => window.open('/admin/promo', '_blank') });
    const openSection = (s) => (s.type === 'promo' ? promoLocked() : sectionDialog(s));
    function renderKonten() {
      const name = h('input', { type: 'text', maxlength: 160, value: page.name, onchange: (e) => patch({ name: e.target.value }, 'Nama halaman diubah.') });
      const slugIn = h('input', { type: 'text', maxlength: 80, value: page.slug, autocapitalize: 'off', spellcheck: false,
        oninput: (e) => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'); },
        onchange: (e) => patch({ slug: e.target.value }, 'URL diubah. Berlaku setelah Simpan.') });
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
      list = h('ol', { class: 'sections', 'aria-label': 'Daftar section' });
      const hasBadges = (page.badges || []).length > 0;
      const parts = new Set(page.sections.filter((x) => x.type === 'promo' && x.visible).map((x) => x.part));
      const warns = [];
      if ((hasBadges || parts.size) && !livePromo) warns.push('Tidak ada promo yang berjalan, jadi section [PROMO] dan badge promo tidak tampil di halaman live.');
      else if (livePromo) {
        if (hasBadges && !livePromo.badge) warns.push(`Promo "${livePromo.name}" belum punya badge, jadi badge promo tidak tampil.`);
        if (parts.has('banner') && !livePromo.banner) warns.push(`Promo "${livePromo.name}" belum punya banner, jadi [PROMO] Banner tidak tampil.`);
        if (parts.has('bar') && !livePromo.bar) warns.push(`Promo "${livePromo.name}" belum punya teks bar, jadi [PROMO] Bar tidak tampil.`);
      }
      const promoWarn = warns.length ? h('div', { class: 'warn-box' }, icon('megaphone'), h('div', {}, ...warns.map((w) => h('p', { text: w })), h('a', { href: '/admin/promo', text: 'Atur di menu Promo →' }))) : null;
      renderList();
      return [
        field('Nama Halaman', name, '(hanya terlihat di admin)'),
        h('div', { class: 'row' },
          h('label', { class: 'field' }, h('span', { text: 'Domain' }), h('select', { disabled: true }, h('option', { text: 'Domain Utama' }))),
          h('label', { class: 'field grow2' }, h('span', { text: 'URL Path' }), h('div', { class: 'prefix' }, h('span', { text: '/' }), slugIn))),
        page.slug !== SLUG ? h('p', { class: 'note', text: `Setelah Simpan, halaman pindah ke /${page.slug}. Link lama /${SLUG} otomatis diarahkan ke link baru.` }) : null,
        field('Kategori', cat),
        promoWarn,
        h('div', { class: 'sec-head' }, h('h2', {}, 'Section ', h('span', { class: 'badge', text: String(page.sections.length) })),
          h('div', { class: 'row-tight' },
            clipboard ? btn('Tempel', () => paste(1), 'btn-sm', 'paste') : null,
            btn('[PROMO]', (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              contextMenu(r.left, r.bottom + 4, [
                { icon: 'image', label: 'Tambah [PROMO] Banner', action: () => addPromoSection('banner') },
                { icon: 'rename', label: 'Tambah [PROMO] Bar merah', action: () => addPromoSection('bar') },
              ]);
            }, 'btn-sm', 'lock'),
            btn('Tambah section', () => sectionDialog(null), 'btn-primary btn-sm', 'plus'))),
        h('p', { class: 'fine', text: 'Geser lewat pegangan di kiri untuk mengurutkan. Klik kanan untuk Cut, Copy, Sembunyikan, Rename, Hapus.' }),
        list,
      ];
    }

    function renderList() {
      if (!list) return;
      list.replaceChildren(...page.sections.map((s, i) => {
        const last = i === page.sections.length - 1;
        return h('li', {
          class: `sec${s.id === selected ? ' selected' : ''}${s.visible ? '' : ' is-hidden'}`, tabindex: '0',
          dataset: { id: s.id }, 'aria-label': `${i + 1}. ${s.name}`,
          onclick: (e) => { if (!e.target.closest('button, input')) select(s.id); },
          ondblclick: (e) => { if (!e.target.closest('button, input')) openSection(s); },
          oncontextmenu: (e) => { e.preventDefault(); select(s.id); sectionMenu(s.id, e.clientX, e.clientY); },
          onkeydown: (e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter') { select(s.id); }
            if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); select(s.id); sectionMenu(s.id, r.left + 40, r.bottom); }
          },
        },
        h('button', { type: 'button', class: 'icon-btn grip', title: 'Geser untuk memindahkan', 'aria-label': `Pindahkan ${s.name}`, tabindex: '-1' }, icon('grip')),
        h('span', { class: 'sec-num', text: String(i + 1) }),
        h('span', { class: `sec-type ${s.type}`, title: TYPE_LABEL[s.type] }, icon(s.type === 'promo' ? 'lock' : s.type === 'html' ? 'code' : s.layout === 'slider' ? 'slider' : 'image')),
        h('span', { class: 'sec-body' },
          h('span', { class: 'sec-name', text: s.name }),
          h('span', { class: 'sec-sub' },
            h('span', { text: s.type === 'promo' ? `Promo ${s.part === 'bar' ? 'bar merah' : 'banner'} · otomatis` : s.type === 'image' ? `${TYPE_LABEL.image}${s.layout === 'slider' ? ' · slider' : ''} · ${s.items.length} file` : TYPE_LABEL.html }),
            s.visible ? null : h('span', { class: 'badge warn', text: 'Disembunyikan' }),
            (page.badges || []).filter((b) => b.section === s.id).map((b) => h('span', { class: 'badge-chip', title: 'Badge promo — geser di preview untuk mengatur posisi' },
              icon('tag'), 'Badge Promo', h('button', { type: 'button', 'aria-label': 'Hapus badge promo', onclick: (e) => { e.stopPropagation(); removeBadge(b); } }, icon('x')))))),
        h('span', { class: 'sec-actions' },
          iconBtn('up', 'Naikkan', () => move(i, -1), { attrs: { disabled: i === 0 } }),
          iconBtn('down', 'Turunkan', () => move(i, 1), { attrs: { disabled: last } }),
          iconBtn(s.visible ? 'eye' : 'eyeOff', s.visible ? 'Sembunyikan' : 'Tampilkan', () => setVisible(s, !s.visible), { attrs: { 'aria-pressed': String(!s.visible) } }),
          iconBtn(s.type === 'promo' ? 'lock' : 'edit', s.type === 'promo' ? 'Isi diatur di menu Promo' : 'Edit isi', () => openSection(s))));
      }));
      if (!page.sections.length) list.append(h('li', { class: 'empty', text: 'Belum ada section. Klik "Tambah section".' }));
    }

    function sectionMenu(id, x, y) {
      const s = page.sections.find((v) => v.id === id);
      if (!s) return;
      const i = page.sections.indexOf(s);
      contextMenu(x, y, [
        { icon: 'cut', label: 'Cut', kbd: 'Ctrl+X', action: () => clip('cut', id) },
        { icon: 'copy', label: 'Copy', kbd: 'Ctrl+C', action: () => clip('copy', id) },
        { icon: 'paste', label: clipboard ? `Tempel di atas` : 'Tempel di atas (kosong)', disabled: !clipboard, action: () => paste(0, i) },
        { icon: 'paste', label: clipboard ? `Tempel di bawah` : 'Tempel di bawah (kosong)', kbd: 'Ctrl+V', disabled: !clipboard, action: () => paste(1, i) },
        '-',
        { icon: 'eyeOff', label: 'Sembunyikan', disabled: !s.visible, action: () => setVisible(s, false) },
        { icon: 'eye', label: 'Perlihatkan', disabled: s.visible, action: () => setVisible(s, true) },
        { icon: 'rename', label: 'Rename', kbd: 'F2', action: () => startRename(id) },
        s.type === 'promo' ? { icon: 'lock', label: 'Isi diatur di menu Promo', action: promoLocked } : { icon: 'edit', label: 'Edit isi…', action: () => sectionDialog(s) },
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
      if (!(await confirmBox(`Hapus section "${s.name}"? Bisa dibatalkan dengan Undo sebelum disimpan.`, { ok: 'Hapus', danger: true, title: 'Hapus section?' }))) return;
      edit('DELETE', P(`/sections/${s.id}`), undefined, 'Section dihapus.');
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
        const out = await edit('POST', P('/import'), { code: ta.value }, 'Impor berhasil. Periksa lalu Simpan.');
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
      const hide = h('input', { type: 'checkbox', checked: page.robots === 'noindex, nofollow', onchange: (e) => patch({ robots: e.target.checked ? 'noindex, nofollow' : '' }, e.target.checked ? 'Halaman disembunyikan dari mesin pencari.' : 'Halaman boleh diindeks.') });
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
      return [
        h('p', { class: 'note', text: 'Pengaturan global adalah default untuk semua halaman. Berlaku setelah Simpan.' }),
        h('div', { class: 'row' }, field('Lebar Halaman (Default)', width), field('Jenis Font', font)),
        h('label', { class: 'field' }, h('span', {}, 'Google Analytics 4', h('span', { class: 'hint', text: ' (Measurement ID, contoh G-AB12CD34EF; kosongkan untuk mematikan)' })),
          h('input', { type: 'text', maxlength: 20, value: global.ga4Id || '', placeholder: 'G-XXXXXXXXXX', autocapitalize: 'characters', spellcheck: false,
            onchange: (e) => { const v = e.target.value.trim().toUpperCase(); if (v && !/^G-[A-Z0-9]{4,15}$/.test(v)) { toast('Format ID harus G-XXXXXXXX.', 'error'); return; } setG({ ga4Id: v }, v ? 'GA4 diaktifkan (berlaku setelah Simpan).' : 'GA4 dimatikan.'); } })),
        h('h2', { class: 'sub', text: 'Favicon' }),
        h('div', { class: 'thumb-box fav' }, global.favicon ? h('img', { src: global.favicon, alt: 'Favicon' }) : h('span', { class: 'fine', text: 'Tidak ada favicon' })),
        h('div', { class: 'row-buttons' },
          btn('Upload', () => favIn.click(), '', 'upload'),
          global.favicon ? btn('Hapus', () => setG({ favicon: '' }, 'Favicon dihapus.'), 'btn-danger', 'trash') : null, favIn),
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
          h('p', { class: 'fine', text: 'Setiap kali Simpan, versi sebelumnya dicadangkan (50 terakhir). "Muat" memasukkan versi itu ke draft; klik Simpan untuk mempublikasikannya.' }),
          historyData.versions.length
            ? h('ul', { class: 'history' }, historyData.versions.map((v) => h('li', {},
              h('div', {}, h('strong', { text: fmtDate(v.savedAt || new Date(v.ts).toISOString()) }), h('br'),
                h('small', { text: `${v.sections} section${v.by ? ` · oleh ${v.by}` : ''}` })),
              btn('Muat ke draft', async () => {
                if (!(await confirmBox('Muat versi ini ke draft? Bisa dibatalkan dengan Undo.'))) return;
                edit('POST', P(`/history/${v.ts}/restore`), undefined, 'Versi dimuat ke draft. Klik Simpan untuk mempublikasikan.');
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

    // ============================================================ section dialog (create / edit)
    function sectionDialog(sec) {
      if (anyDialogOpen()) return;
      const isNew = !sec;
      let type = sec ? sec.type : 'image';
      const name = h('input', { type: 'text', maxlength: 120, value: sec ? sec.name : '', placeholder: 'mis. Slider Event, Testimoni' });
      const mt = h('input', { type: 'number', min: -200, max: 400, step: 1, value: sec ? sec.mt : 0 });
      const selIndex = page.sections.findIndex((s) => s.id === selected);
      const position = h('select', {},
        h('option', { value: String(page.sections.length), text: 'Di paling bawah' }),
        h('option', { value: '0', text: 'Di paling atas' }),
        selIndex >= 0 ? h('option', { value: String(selIndex + 1), text: `Setelah "${page.sections[selIndex].name}"`, selected: true }) : null);

      // -- image tab
      const files = [];
      const rows = sec && sec.type === 'image' ? sec.items.map((it, i) => ({ keep: i, alt: it.alt, href: it.href, thumb: `${it.src}.${it.ext || 'webp'}` })) : [];
      const layoutStack = h('input', { type: 'radio', name: 'layout', value: 'stack', checked: !sec || sec.layout !== 'slider' });
      const layoutSlider = h('input', { type: 'radio', name: 'layout', value: 'slider', checked: Boolean(sec && sec.layout === 'slider') });
      const itemList = h('ul', { class: 'items' });
      const readThumb = (file, row) => {
        const fr = new FileReader();
        fr.onload = () => { row.thumb = fr.result; renderItems(); };
        fr.readAsDataURL(file);
      };
      function addFiles(fileList, replaceRow) {
        for (const f of fileList) {
          if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(f.type)) { toast(`"${f.name}" bukan JPG/PNG/WebP/GIF/AVIF.`, 'error'); continue; }
          if (f.size > 15 * 1024 * 1024) { toast(`"${f.name}" lebih dari 15 MB.`, 'error'); continue; }
          files.push(f);
          if (replaceRow) {
            replaceRow.replaces = replaceRow.keep ?? replaceRow.replaces;
            delete replaceRow.keep;
            replaceRow.file = files.length - 1;
            replaceRow.isNew = true;
            readThumb(f, replaceRow);
            break;
          }
          const row = { file: files.length - 1, alt: '', href: '', thumb: '', isNew: true };
          rows.push(row);
          readThumb(f, row);
        }
        renderItems();
      }
      function renderItems() {
        itemList.replaceChildren(...rows.map((row, i) => {
          const alt = h('input', { class: 'input', type: 'text', maxlength: 300, value: row.alt || '', placeholder: 'Teks alternatif (deskripsi gambar)', 'aria-label': `Teks alternatif gambar ${i + 1}`, oninput: (e) => { row.alt = e.target.value; } });
          const href = h('input', { class: 'input', type: 'url', maxlength: 1000, value: row.href || '', placeholder: 'Link saat diklik (opsional), mis. https://wa.me/62…', 'aria-label': `Link gambar ${i + 1}`, oninput: (e) => { row.href = e.target.value; } });
          const replaceInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif', hidden: true, onchange: (e) => addFiles(e.target.files, row) });
          return h('li', { class: 'item' },
            h('img', { class: 'thumb', src: row.thumb || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: '' }),
            h('div', { class: 'fields' }, row.isNew ? h('span', { class: 'new', text: 'BARU — akan diproses saat disimpan' }) : null, alt, href),
            h('div', { class: 'ctl' },
              iconBtn('up', 'Naikkan gambar', () => { rows.splice(i - 1, 0, rows.splice(i, 1)[0]); renderItems(); }, { attrs: { disabled: i === 0 } }),
              iconBtn('down', 'Turunkan gambar', () => { rows.splice(i + 1, 0, rows.splice(i, 1)[0]); renderItems(); }, { attrs: { disabled: i === rows.length - 1 } }),
              iconBtn('swap', 'Ganti gambar', () => replaceInput.click()),
              iconBtn('trash', 'Hapus gambar', () => { rows.splice(i, 1); renderItems(); }, { class: 'danger' }),
              replaceInput));
        }));
      }
      renderItems();
      const imgInput = h('input', { type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif', onchange: (e) => { addFiles(e.target.files); e.target.value = ''; } });
      const imagePanel = h('div', { role: 'tabpanel', id: 'tp-image' },
        h('div', { class: 'field' }, h('span', { text: 'Tata letak' }),
          h('div', { class: 'seg' }, h('label', {}, layoutStack, 'Tumpuk ke bawah'), h('label', {}, layoutSlider, 'Slider'))),
        itemList, dropZone(imgInput, (fl) => addFiles(fl), 'Tambah gambar', 'JPG, PNG, WebP, GIF, AVIF · maks 15 MB per file'),
        h('p', { class: 'fine', text: 'Gambar otomatis disesuaikan dengan lebar halaman (berapa pun lebar aslinya), dikonversi ke WebP/AVIF, dan metadata lokasi/EXIF dihapus.' }));

      // -- html tab
      const original = sec && sec.type === 'html' ? sec.source || '' : '';
      const code = h('textarea', { spellcheck: false, 'aria-label': 'Kode HTML', placeholder: '<div class="promo">…</div>\n<style>.promo{…}</style>' });
      code.value = original;
      let htmlFile = null;
      const assetFiles = [];
      const htmlName = h('span', { class: 'fine' });
      const assetNames = h('span', { class: 'fine' });
      const htmlInput = h('input', { type: 'file', accept: '.html,.htm,text/html', onchange: (e) => setHtml(e.target.files[0]) });
      function setHtml(f) {
        if (!f) return;
        if (!/\.html?$/i.test(f.name)) return toast('Pilih file .html', 'error');
        if (f.size > 1024 * 1024) return toast('File HTML maksimal 1 MB.', 'error');
        htmlFile = f;
        htmlName.textContent = `Dipilih: ${f.name} (menggantikan kode di bawah)`;
        f.text().then((t) => { code.value = t; });
      }
      const assetInput = h('input', { type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif', onchange: (e) => setAssets(e.target.files) });
      function setAssets(fl) {
        for (const f of fl) if (/^image\//.test(f.type) && f.type !== 'image/svg+xml') assetFiles.push(f);
        assetNames.textContent = assetFiles.length ? `Gambar pendukung: ${assetFiles.map((f) => f.name).join(', ')}` : '';
      }
      const htmlPanel = h('div', { role: 'tabpanel', id: 'tp-html', hidden: true },
        h('div', { class: 'row' },
          h('div', { class: 'field' }, h('span', { text: 'File HTML' }), dropZone(htmlInput, (fl) => setHtml(fl[0]), 'Upload file .html', 'maks 1 MB'), htmlName),
          h('div', { class: 'field' }, h('span', { text: 'Gambar pendukung (opsional)' }), dropZone(assetInput, setAssets, 'Upload gambar', 'nama file sama dengan di HTML'), assetNames)),
        h('label', { class: 'field' }, h('span', { text: 'Kode HTML' }, h('span', { class: 'hint', text: ' — bisa diedit langsung' })), code),
        h('div', { class: 'note' }, 'Otomatis diamankan saat disimpan:',
          h('ul', {},
            h('li', { text: 'Hanya isi <body> yang dipakai; <html>, <head>, <body> dibuang. <style> dipertahankan dan hanya berlaku di section ini.' }),
            h('li', { text: 'Script, iframe, form dan atribut on* dihapus. Video YouTube diubah jadi pemutar halaman.' }),
            h('li', { text: 'Lebar konten dibatasi selebar halaman.' }))));

      const tabImage = h('button', { type: 'button', role: 'tab', class: 'tab', id: 't-image', 'aria-controls': 'tp-image' }, icon('image'), 'Gambar');
      const tabHtml = h('button', { type: 'button', role: 'tab', class: 'tab', id: 't-html', 'aria-controls': 'tp-html' }, icon('code'), 'HTML');
      const typeWarn = h('p', { class: 'alert', hidden: true, text: 'Mengganti tipe akan mengganti seluruh isi section ini saat disimpan.' });
      function setType(t) {
        type = t;
        tabImage.setAttribute('aria-selected', String(t === 'image'));
        tabHtml.setAttribute('aria-selected', String(t === 'html'));
        tabImage.tabIndex = t === 'image' ? 0 : -1;
        tabHtml.tabIndex = t === 'html' ? 0 : -1;
        imagePanel.hidden = t !== 'image';
        htmlPanel.hidden = t !== 'html';
        typeWarn.hidden = isNew || t === sec.type;
      }
      tabImage.addEventListener('click', () => setType('image'));
      tabHtml.addEventListener('click', () => setType('html'));
      const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Jenis konten',
        onkeydown: (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { setType(type === 'image' ? 'html' : 'image'); (type === 'image' ? tabImage : tabHtml).focus(); } } }, tabImage, tabHtml);
      setType(type);

      const prevIds = new Set(page.sections.map((s) => s.id));
      async function save() {
        const fd = new FormData();
        fd.append('name', name.value);
        fd.append('mt', mt.value || '0');
        if (isNew) fd.append('position', position.value);
        fd.append('type', type);
        if (type === 'image') {
          if (!rows.length) return toast('Tambahkan minimal satu gambar.', 'error');
          fd.append('layout', layoutSlider.checked ? 'slider' : 'stack');
          const used = [];
          const entries = rows.map((r) => {
            const e = { alt: r.alt || '', href: r.href || '' };
            if (r.file != null) { e.file = used.length; used.push(files[r.file]); if (r.replaces != null) e.replaces = r.replaces; } else e.keep = r.keep;
            return e;
          });
          fd.append('items', JSON.stringify(entries));
          for (const f of used) fd.append('images', f, f.name);
        } else {
          const changed = htmlFile || code.value !== original || isNew || sec.type !== 'html';
          if (changed) {
            if (!code.value.trim() && !htmlFile) return toast('Upload file .html atau tempel kode HTML.', 'error');
            if (htmlFile) fd.append('htmlFile', htmlFile, htmlFile.name);
            else fd.append('code', code.value);
            for (const f of assetFiles) fd.append('assets', f, f.name);
          }
        }
        const out = await edit(isNew ? 'POST' : 'PATCH', isNew ? P('/sections') : P(`/sections/${sec.id}`), fd, isNew ? 'Section ditambahkan.' : 'Section disimpan.', { pulse: true });
        if (out) {
          d.close();
          const id = isNew ? (out.page.sections.find((s) => !prevIds.has(s.id)) || {}).id : sec.id;
          if (id) { selected = id; sessionStorage.setItem(`sel:${SLUG}`, id); renderList(); }
        }
      }

      const d = dialog({
        title: isNew ? 'Tambah section' : `Edit: ${sec.name}`,
        body: h('form', { onsubmit: (e) => { e.preventDefault(); save(); } },
          h('div', { class: 'row' },
            field('Nama section', name),
            h('label', { class: 'field' }, h('span', {}, 'Jarak atas', h('span', { class: 'hint', text: ' (lebar halaman = 320)' })), mt),
            isNew ? field('Posisi', position) : null),
          tablist, typeWarn, imagePanel, htmlPanel),
        foot: [btn('Batal', () => d.close()), btn(isNew ? 'Tambah' : 'Simpan', save, 'btn-primary')],
      });
      name.focus();
    }

    function dropZone(input, onFiles, label, hint) {
      const z = h('label', { class: 'file-drop' }, icon('upload'), h('span', {}, h('strong', { text: label }), ' atau tarik file ke sini'), h('span', { class: 'fine', text: hint }), input);
      z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('drag'); });
      z.addEventListener('dragleave', () => z.classList.remove('drag'));
      z.addEventListener('drop', (e) => { e.preventDefault(); z.classList.remove('drag'); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); });
      return z;
    }

    // ---- boot
    const data = await run(() => api('GET', P()));
    if (!data) return;
    setState(data, { reload: false });
    setTab(tab);
    requestAnimationFrame(fitPhone);
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

  ({ dashboard: viewDashboard, reports: viewReports, pages: viewPages, editor: viewEditor, promo: viewPromo })[VIEW]?.();
})();
