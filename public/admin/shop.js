// Spencer's Admin — menu "Produk" (Berdu-style): products, stock, categories, catalogs, bundles.
// Uses the helpers that admin.js exposes on window.MBA. All user data is inserted as text (never innerHTML).
(() => {
  'use strict';
  const M = window.MBA;
  if (!M) return;
  const { h, icon, ICONS, iconBtn, btn, field, api, run, toast, dialog, confirmBox, promptBox, layout, subtabs, nf, fmtDate } = M;
  const VIEW = document.body.dataset.view;
  const ID = document.body.dataset.slug;
  Object.assign(ICONS, {
    box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
    layers: 'M12 2l10 5-10 5L2 7zM2 17l10 5 10-5M2 12l10 5 10-5',
    folder: 'M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z',
    minus: 'M5 12h14',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
    cart: 'M3 3h2l2.4 12.2a2 2 0 0 0 2 1.8h8.2a2 2 0 0 0 2-1.6L21 8H6M9 21h.01M18 21h.01',
    truck: 'M1 4h14v12H1zM15 9h4l3 3v4h-7M5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    importIc: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  });

  const rp = (n) => `Rp ${nf(n)}`;
  /** replaceChildren that skips null/false (conditional children). */
  const put = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
  const imgUrl = (im) => (!im ? '' : typeof im === 'string' ? im : `${im.src}.${im.ext || 'webp'}`);
  const thumb = (src, alt = '') => (src ? h('img', { class: 'sp-thumb', src, alt, loading: 'lazy', width: 48, height: 48 }) : h('span', { class: 'sp-thumb sp-thumb-empty', 'aria-hidden': 'true' }, icon('image')));
  const qs = new URLSearchParams(location.search);
  const VIS = { public: 'Publik', hidden: 'Tersembunyi', scheduled: 'Dijadwalkan', link: 'Link Akses' };
  const wib = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  /** Page frame with the Produk sub-menu. */
  function frame({ sub, title, subtitle, tools = [] }) {
    const out = layout({ active: 'produk', title, subtitle, tools });
    out.content.append(subtabs([
      ['products', '/admin/products', 'tag', 'Produk'],
      ['stock', '/admin/stock', 'box', 'Kelola Stok'],
      ['categories', '/admin/categories', 'folder', 'Kategori'],
      ['catalogs', '/admin/catalogs', 'layers', 'Katalog'],
      ['bundles', '/admin/bundles', 'gift', 'Bundle'],
    ], sub));
    return out;
  }
  const actionLinks = (items) => h('div', { class: 'sp-actions' }, items.filter(Boolean).map(([label, onclick, cls, href]) => (href
    ? h('a', { href, class: cls || '', text: label })
    : h('button', { type: 'button', class: cls || '', text: label, onclick }))));
  const searchBox = (value, oninput, placeholder = 'Cari') => {
    const input = h('input', { type: 'search', class: 'input', placeholder, value, 'aria-label': placeholder });
    let t;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => oninput(input.value.trim()), 150); });
    return h('label', { class: 'sp-search' }, icon('search'), input);
  };
  function setQuery(params) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(params)) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); }
    history.replaceState(null, '', u);
  }

  /** Tag input (Enter or comma adds). Returns { el, get }. */
  function tagInput(values = [], placeholder = 'Ketik lalu Enter') {
    let list = [...values];
    const box = h('div', { class: 'tags' });
    const input = h('input', { type: 'text', placeholder, maxlength: 40, 'aria-label': 'Tambah tag' });
    const draw = () => put(box, ...list.map((t, i) => h('span', { class: 'tag' }, t, h('button', { type: 'button', 'aria-label': `Hapus ${t}`, onclick: () => { list.splice(i, 1); draw(); input.focus(); } }, icon('x')))), input);
    const add = () => { const v = input.value.replace(/,/g, '').trim(); if (v && !list.includes(v)) list.push(v); input.value = ''; draw(); input.focus(); };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
      if (e.key === 'Backspace' && !input.value && list.length) { list.pop(); draw(); input.focus(); }
    });
    input.addEventListener('blur', () => { if (input.value.trim()) add(); });
    box.addEventListener('click', (e) => { if (e.target === box) input.focus(); });
    draw();
    return { el: box, get: () => { if (input.value.trim()) add(); return list; } };
  }

  /** Number stepper ( − [n] + ). */
  function stepper(value = 0, { min = -1e9, onchange } = {}) {
    const input = h('input', { type: 'number', class: 'input sp-num', value, step: 1, 'aria-label': 'Jumlah' });
    const set = (v) => { input.value = Math.max(min, v); onchange && onchange(Number(input.value)); };
    input.addEventListener('input', () => onchange && onchange(Number(input.value || 0)));
    const el = h('div', { class: 'sp-stepper' },
      h('button', { type: 'button', 'aria-label': 'Kurangi', onclick: () => set(Number(input.value || 0) - 1) }, icon('minus')),
      input,
      h('button', { type: 'button', 'aria-label': 'Tambah', onclick: () => set(Number(input.value || 0) + 1) }, icon('plus')));
    return { el, input, get: () => Number(input.value || 0), set };
  }

  /** Product picker dialog -> Promise<array of product summaries> */
  async function pickProducts({ title = 'Pilih produk', exclude = [], multiple = true } = {}) {
    const data = await run(() => api('GET', '/admin/api/shop/products'));
    if (!data) return [];
    return new Promise((resolve) => {
      const chosen = new Map();
      let result = [];
      const skip = new Set(exclude);
      const listEl = h('div', { class: 'sp-pick-list' });
      const draw = (q = '') => {
        const s = q.toLowerCase();
        const rows = data.products.filter((p) => !skip.has(p.id) && (!s || p.name.toLowerCase().includes(s) || p.skus.some((k) => k.toLowerCase().includes(s)))).slice(0, 100);
        put(listEl, ...rows.map((p) => {
          const cb = h('input', { type: multiple ? 'checkbox' : 'radio', name: 'pick', checked: chosen.has(p.id), onchange: () => { if (!multiple) chosen.clear(); if (cb.checked) chosen.set(p.id, p); else chosen.delete(p.id); } });
          return h('label', { class: 'sp-pick-row' }, cb, thumb(imgUrl(p.image)), h('span', {}, h('b', { text: p.name }), h('small', { text: `${p.sku}${p.variants ? ` · ${p.variants} variasi` : ''} · ${rp(p.priceMin)}` })));
        }), rows.length ? null : h('p', { class: 'muted', text: 'Tidak ada produk.' }));
      };
      draw();
      const d = dialog({
        title, size: 'lg',
        body: h('div', {}, searchBox('', draw, 'Cari nama atau SKU'), listEl),
        foot: [btn('Batal', () => d.close()), btn('Pilih', () => { result = [...chosen.values()]; d.close(); }, 'btn-primary')],
        onclose: () => resolve(result),
      });
    });
  }

  // ================================================================ Import (Berdu export)
  function importDialog(onDone) {
    const file = h('input', { type: 'file', accept: '.json,application/json' });
    const mode = h('select', { class: 'input' }, h('option', { value: 'skip', text: 'Lewati (jangan ubah yang sudah ada)' }), h('option', { value: 'update', text: 'Perbarui dengan data Berdu' }));
    const withImages = h('input', { type: 'checkbox', checked: true });
    const status = h('div', { class: 'sp-import-status' });
    const bar = h('div', { class: 'sp-progress', hidden: true }, h('span'));
    let running = false;
    const startBtn = btn('Mulai import', start, 'btn-primary', 'importIc');
    const d = dialog({
      title: 'Import produk dari Berdu', size: 'lg',
      body: h('div', {},
        h('p', { class: 'fine', text: 'Pilih file export produk Berdu (.json). Kategori yang belum ada akan dibuat, gambar diunduh dan dikompres ulang. Proses berjalan bertahap, jangan tutup jendela ini sampai selesai.' }),
        field('File export', file),
        field('Produk yang sudah pernah di-import', mode),
        h('label', { class: 'check' }, withImages, 'Unduh gambar produk'),
        bar, status),
      foot: [btn('Tutup', () => { if (!running) d.close(); else toast('Import masih berjalan…', 'error'); }), startBtn],
      onclose: () => onDone && onDone(),
    });
    async function start() {
      if (!file.files[0]) { toast('Pilih file dulu.', 'error'); return; }
      const fd = new FormData();
      fd.append('file', file.files[0]);
      const job = await run(() => api('POST', '/admin/api/shop/import', fd));
      if (!job) return;
      if (!(await confirmBox(`File dari ${job.store || 'Berdu'}: ${nf(job.total)} produk, ${job.categories.length} kategori${job.existing ? `, ${nf(job.existing)} sudah pernah di-import` : ''}. Lanjutkan?`, { ok: 'Import sekarang' }))) return;
      running = true;
      startBtn.disabled = true;
      bar.hidden = false;
      const total = { created: 0, updated: 0, skipped: 0, errors: [], warnings: [] };
      let offset = 0;
      try {
        while (offset !== null) {
          status.textContent = `Memproses ${nf(offset)} / ${nf(job.total)} produk…`;
          let out;
          for (let attempt = 0; attempt < 3 && !out; attempt++) {
            try { out = await api('POST', `/admin/api/shop/import/${job.job}/run`, { offset, mode: mode.value, images: withImages.checked }); } catch (e) { if (attempt === 2) throw e; }
          }
          for (const k of ['created', 'updated', 'skipped']) total[k] += out[k];
          total.errors.push(...out.errors);
          total.warnings.push(...out.warnings);
          offset = out.next;
          bar.firstChild.style.width = `${Math.round(((offset ?? job.total) / job.total) * 100)}%`;
        }
        put(status, h('p', {}, h('b', { text: 'Selesai. ' }), `${nf(total.created)} produk baru, ${nf(total.updated)} diperbarui, ${nf(total.skipped)} dilewati.`),
          total.errors.length ? h('details', { class: 'sp-import-log', open: true }, h('summary', { text: `${total.errors.length} gagal` }), h('ul', {}, total.errors.slice(0, 100).map((e) => h('li', { text: e })))) : null,
          total.warnings.length ? h('details', { class: 'sp-import-log' }, h('summary', { text: `${total.warnings.length} catatan` }), h('ul', {}, total.warnings.slice(0, 200).map((e) => h('li', { text: e })))) : null);
      } catch (e) {
        status.textContent = `Import berhenti di produk ke-${nf(offset)}: ${e.message}. Jalankan lagi dengan pilihan "Lewati" untuk melanjutkan.`;
      } finally {
        running = false;
        startBtn.disabled = false;
      }
    }
  }

  // ================================================================ Produk list
  async function viewProducts() {
    const state = { tab: qs.get('tab') || 'all', q: qs.get('q') || '', cat: qs.get('cat') || '', sort: qs.get('sort') || 'new', shown: 50 };
    const selected = new Set();
    const { content } = frame({ sub: 'products', title: 'Produk', tools: [btn('Import', () => importDialog(reload), '', 'importIc'), btn('Produk', () => { location.href = '/admin/products/new'; }, 'btn-primary', 'plus')] });
    const main = h('div', { class: 'sp-wrap' }, h('div', { class: 'skeleton', style: 'height:420px;border-radius:12px' }));
    content.append(main);
    let data = await run(() => api('GET', '/admin/api/shop/products'));
    if (!data) return;
    const catName = new Map(data.categories.map((c) => [c.id, c.name]));

    const SORTS = { new: 'Terbaru', old: 'Terlama', az: 'Nama A–Z', za: 'Nama Z–A', cheap: 'Harga terendah', pricey: 'Harga tertinggi', stockLow: 'Stok terendah', stockHigh: 'Stok terbanyak' };
    const sorters = {
      new: (a, b) => b.createdAt.localeCompare(a.createdAt), old: (a, b) => a.createdAt.localeCompare(b.createdAt),
      az: (a, b) => a.name.localeCompare(b.name, 'id'), za: (a, b) => b.name.localeCompare(a.name, 'id'),
      cheap: (a, b) => a.priceMin - b.priceMin, pricey: (a, b) => b.priceMax - a.priceMax,
      stockLow: (a, b) => (a.stock ?? 1e15) - (b.stock ?? 1e15), stockHigh: (a, b) => (b.stock ?? -1e15) - (a.stock ?? -1e15),
    };
    const matches = (p) => {
      if (state.cat && !p.categories.includes(state.cat)) return false;
      if (!state.q) return true;
      const s = state.q.toLowerCase();
      return p.name.toLowerCase().includes(s) || p.skus.some((k) => k.toLowerCase().includes(s)) || p.tags.some((t) => t.toLowerCase().includes(s));
    };

    const tabsEl = h('div', { class: 'sp-tabs', role: 'tablist' });
    const totalEl = h('span', { class: 'sp-total' });
    const catSel = h('select', { class: 'input', 'aria-label': 'Filter kategori', onchange: () => { state.cat = catSel.value; state.shown = 50; setQuery({ cat: state.cat }); draw(); } },
      h('option', { value: '', text: 'Semua kategori' }), data.categories.map((c) => h('option', { value: c.id, text: c.name, selected: c.id === state.cat })));
    const sortSel = h('select', { class: 'input', 'aria-label': 'Urutkan', onchange: () => { state.sort = sortSel.value; setQuery({ sort: state.sort === 'new' ? '' : state.sort }); draw(); } },
      Object.entries(SORTS).map(([k, v]) => h('option', { value: k, text: v, selected: k === state.sort })));
    const bulkBar = h('div', { class: 'sp-bulk', hidden: true });
    const listEl = h('div', { class: 'sp-list' });
    put(main, 
      h('div', { class: 'sp-toolbar' }, searchBox(state.q, (v) => { state.q = v; state.shown = 50; setQuery({ q: v }); draw(); }, 'Cari nama, SKU atau tag'), catSel, sortSel, totalEl),
      tabsEl, bulkBar, listEl);

    async function reload() {
      const fresh = await run(() => api('GET', '/admin/api/shop/products'));
      if (fresh) { data = fresh; selected.clear(); draw(); }
    }
    async function bulk(action, extra = {}) {
      const ids = [...selected];
      const out = await run(() => api('POST', '/admin/api/shop/products/bulk', { ids, action, ...extra }), `${ids.length} produk diperbarui.`);
      if (out) reload();
    }
    function drawBulk() {
      bulkBar.hidden = !selected.size;
      if (!selected.size) return;
      const catPick = h('select', { class: 'input', 'aria-label': 'Kategori' }, h('option', { value: '', text: 'Kategori…' }), data.categories.map((c) => h('option', { value: c.id, text: c.name })));
      put(bulkBar, 
        h('b', { text: `${selected.size} dipilih` }),
        btn('Publikasikan', () => bulk('public'), 'btn-sm'),
        btn('Sembunyikan', () => bulk('hidden'), 'btn-sm'),
        btn('Jadikan link akses', () => bulk('link'), 'btn-sm'),
        catPick,
        btn('Tambah ke kategori', () => catPick.value ? bulk('addCategory', { category: catPick.value }) : toast('Pilih kategori dulu.', 'error'), 'btn-sm'),
        btn('Lepas kategori', () => catPick.value ? bulk('removeCategory', { category: catPick.value }) : toast('Pilih kategori dulu.', 'error'), 'btn-sm'),
        btn('Hapus', async () => { if (await confirmBox(`Hapus ${selected.size} produk? Data disimpan di arsip hapus server, tapi tidak tampil lagi di admin.`, { ok: 'Hapus', danger: true })) bulk('delete'); }, 'btn-sm btn-danger', 'trash'),
        btn('Batal pilih', () => { selected.clear(); draw(); }, 'btn-sm btn-ghost'));
    }
    function stockText(p) {
      if (p.stock == null) return '-';
      return nf(p.stock);
    }
    function row(p) {
      const cb = h('input', { type: 'checkbox', 'aria-label': `Pilih ${p.name}`, checked: selected.has(p.id), onchange: () => { if (cb.checked) selected.add(p.id); else selected.delete(p.id); drawBulk(); } });
      const cats = p.categories.map((c) => catName.get(c)).filter(Boolean);
      const status = p.tab === 'public' ? null : h('span', { class: `sp-vis sp-vis-${p.tab}`, title: p.tab === 'scheduled' ? `Tayang ${wib(p.publishAt)} WIB` : VIS[p.tab] }, icon(p.tab === 'link' ? 'link' : p.tab === 'scheduled' ? 'clock' : 'eyeOff'), VIS[p.tab]);
      return h('div', { class: 'sp-row' },
        h('label', { class: 'sp-cb' }, cb),
        h('a', { href: `/admin/products/${p.id}/edit`, class: 'sp-img' }, thumb(imgUrl(p.image), '')),
        h('div', { class: 'sp-main' },
          h('a', { class: 'sp-name', href: `/admin/products/${p.id}/edit`, text: p.name }), status,
          actionLinks([
            ['Edit', null, '', `/admin/products/${p.id}/edit`],
            ['Laporan', null, '', `/admin/products/${p.id}`],
            ['Duplikat', async () => { const out = await run(() => api('POST', `/admin/api/shop/products/${p.id}/duplicate`), 'Produk diduplikat (tersembunyi).'); if (out) reload(); }],
            ['Hapus', async () => {
              if (!(await confirmBox(`Hapus produk "${p.name}"?`, { ok: 'Hapus', danger: true }))) return;
              const out = await run(() => api('DELETE', `/admin/api/shop/products/${p.id}`), 'Produk dihapus.');
              if (out) reload();
            }, 'danger'],
          ])),
        h('div', { class: 'sp-col' }, h('small', { text: 'SKU' }), h('span', { text: p.variants ? `${p.variants} variasi` : p.sku || '-' })),
        h('div', { class: 'sp-col sp-col-num' }, h('small', { text: 'Stok' }), h('span', { class: p.stock != null && p.stock < 0 ? 'sp-neg' : p.stock === 0 ? 'muted' : '', text: stockText(p) })),
        h('div', { class: 'sp-col' }, h('small', { text: 'Kategori' }), h('span', { text: cats.join(', ') || '-' })),
        h('div', { class: 'sp-col sp-col-num' }, h('small', { text: 'Harga' }), h('span', { text: p.priceMin === p.priceMax ? rp(p.priceMin) : `${rp(p.priceMin)} – ${rp(p.priceMax)}` })));
    }
    function draw() {
      const base = data.products.filter(matches);
      const count = (t) => (t === 'all' ? base.length : base.filter((p) => p.tab === t).length);
      put(tabsEl, ...[['all', 'Semua'], ['public', 'Publik'], ['hidden', 'Tersembunyi'], ['scheduled', 'Dijadwalkan'], ['link', 'Link Akses']].map(([t, label]) => h('button', {
        type: 'button', role: 'tab', class: 'sp-tab', 'aria-selected': String(state.tab === t),
        onclick: () => { state.tab = t; state.shown = 50; setQuery({ tab: t === 'all' ? '' : t }); draw(); },
      }, label, h('span', { class: 'sp-count', text: nf(count(t)) }))));
      const rows = base.filter((p) => state.tab === 'all' || p.tab === state.tab).sort(sorters[state.sort] || sorters.new);
      put(totalEl, h('b', { text: nf(rows.length) }), ' produk');
      if (!data.products.length) {
        put(listEl, h('div', { class: 'empty' }, h('p', { text: 'Belum ada produk.' }), btn('Tambah produk pertama', () => { location.href = '/admin/products/new'; }, 'btn-primary', 'plus')));
      } else if (!rows.length) {
        put(listEl, h('div', { class: 'empty', text: 'Tidak ada produk yang cocok.' }));
      } else {
        const allCb = h('input', { type: 'checkbox', 'aria-label': 'Pilih semua yang tampil', checked: rows.slice(0, state.shown).every((p) => selected.has(p.id)),
          onchange: () => { for (const p of rows.slice(0, state.shown)) { if (allCb.checked) selected.add(p.id); else selected.delete(p.id); } draw(); } });
        put(listEl, 
          h('div', { class: 'sp-row sp-head' }, h('label', { class: 'sp-cb' }, allCb), h('span', { class: 'muted', text: 'Pilih semua yang tampil' })),
          ...rows.slice(0, state.shown).map(row),
          rows.length > state.shown ? h('div', { class: 'sp-more' }, btn(`Tampilkan lebih banyak (${nf(rows.length - state.shown)} lagi)`, () => { state.shown += 100; draw(); })) : null);
      }
      drawBulk();
    }
    draw();
  }

  // ================================================================ Produk edit / baru
  /** Small rich-text editor (contenteditable + toolbar). Returns { el, get }. Output is sanitized again on the server. */
  function richEditor(html, onchange) {
    const area = h('div', { class: 'sp-rte-area', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Deskripsi', 'data-placeholder': 'Tulis deskripsi produk kamu di sini' });
    area.innerHTML = html || ''; // admin's own stored description, already sanitized by the server
    const exec = (cmd, val) => { area.focus(); document.execCommand(cmd, false, val); onchange(); };
    const tb = (ic, label, fn) => h('button', { type: 'button', class: 'sp-rte-btn', title: label, 'aria-label': label, onmousedown: (e) => e.preventDefault(), onclick: fn }, typeof ic === 'string' && ICONS[ic] ? icon(ic) : h('span', { text: ic }));
    const block = h('select', { class: 'sp-rte-block', 'aria-label': 'Format paragraf', onchange: () => { exec('formatBlock', block.value); block.value = 'p'; } },
      h('option', { value: 'p', text: 'Paragraf' }), h('option', { value: 'h2', text: 'Judul besar' }), h('option', { value: 'h3', text: 'Judul kecil' }));
    const imgIn = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async () => {
      const fd = new FormData();
      fd.append('images', imgIn.files[0]);
      imgIn.value = '';
      const out = await run(() => api('POST', '/admin/api/shop/images', fd));
      if (out) exec('insertImage', imgUrl(out.images[0]));
    } });
    const bar = h('div', { class: 'sp-rte-bar' }, block,
      tb('B', 'Tebal', () => exec('bold')), tb('I', 'Miring', () => exec('italic')), tb('U', 'Garis bawah', () => exec('underline')), tb('S', 'Coret', () => exec('strikeThrough')),
      tb('•', 'Daftar', () => exec('insertUnorderedList')), tb('1.', 'Daftar bernomor', () => exec('insertOrderedList')),
      tb('link', 'Tautan', async () => {
        const sel = document.getSelection();
        const range = sel.rangeCount ? sel.getRangeAt(0) : null;
        const url = await promptBox('Tambah tautan', 'Alamat (https://…)', 'https://', { ok: 'Pasang', maxlength: 500 });
        if (!url) return;
        if (range) { sel.removeAllRanges(); sel.addRange(range); }
        exec('createLink', url);
      }),
      tb('image', 'Gambar', () => imgIn.click()), tb('x', 'Hapus format', () => exec('removeFormat')), imgIn);
    area.addEventListener('input', onchange);
    return { el: h('div', { class: 'sp-rte' }, bar, area), get: () => (area.textContent.trim() || area.querySelector('img') ? area.innerHTML : '') };
  }

  async function viewProductEdit() {
    const isNew = !ID;
    const { content, appbar } = frame({ sub: 'products', title: isNew ? 'Produk / Baru' : 'Produk / Edit' });
    const data = await run(() => api('GET', isNew ? '/admin/api/shop/categories' : `/admin/api/shop/products/${ID}`));
    if (!data) return;
    const cats = data.categories;
    const p = data.product || {
      name: '', type: 'physical', description: '', images: [], categories: qs.get('cat') ? [qs.get('cat')] : [], price: 0, comparePrice: 0, capitalPrice: 0,
      wholesale: [], paymentMethods: [], minOrder: 1, maxOrder: 0, sku: '', trackStock: true, stock: 0, backorder: false, weight: 0, dims: { l: 0, w: 0, h: 0 },
      shippingMethods: [], seo: { title: '', description: '', noindex: false }, visibility: 'public', publishAt: '', tags: [], note: '', variants: null, slug: '',
    };
    p.dims ||= { l: 0, w: 0, h: 0 };
    p.seo ||= { title: '', description: '', noindex: false };
    if (!isNew) appbar.querySelector('h1').textContent = `Produk / ${p.name} / Edit`;
    let dirty = false;
    const markDirty = () => { dirty = true; };
    addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    const val = (input) => input.value.replace(/[^\d-]/g, '');
    const num = (v, attrs = {}) => h('input', { type: 'text', inputmode: 'numeric', class: 'input', value: v == null || v === 0 ? '' : String(v), placeholder: '0', oninput: markDirty, ...attrs });
    const money = (v, attrs = {}) => h('div', { class: 'sp-money' }, h('span', { text: 'Rp' }), h('input', {
      type: 'text', inputmode: 'numeric', class: 'input', value: v ? nf(v) : '', placeholder: attrs.placeholder || '0', 'aria-label': attrs.label || 'Harga',
      oninput: (e) => { const d = e.target.value.replace(/\D/g, ''); e.target.value = d ? nf(Number(d)) : ''; markDirty(); attrs.oninput && attrs.oninput(); } }));
    const moneyVal = (box) => { const d = box.querySelector('input').value.replace(/\D/g, ''); return d === '' ? null : Number(d); };
    const card = (title, ic, ...kids) => h('details', { class: 'panel sp-card', open: true }, h('summary', { class: 'panel-head' }, h('h2', {}, ic ? icon(ic) : null, title)), h('div', { class: 'sp-card-body' }, ...kids));

    // ---------------- General tab
    const name = h('input', { type: 'text', class: 'input', value: p.name, maxlength: 160, required: true, oninput: markDirty });
    let images = [...p.images];
    const imgGrid = h('div', { class: 'sp-imgs' });
    const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async () => {
      const fd = new FormData();
      for (const f of fileIn.files) fd.append('images', f);
      fileIn.value = '';
      const out = await run(() => api('POST', '/admin/api/shop/images', fd), 'Gambar diunggah.');
      if (out) { images.push(...out.images); markDirty(); drawImgs(); }
    } });
    function drawImgs() {
      put(imgGrid, ...images.map((im, i) => h('div', { class: 'sp-imgbox' },
        h('img', { src: imgUrl(im), alt: '' }), i === 0 ? h('span', { class: 'badge brand', text: 'Utama' }) : null,
        h('div', { class: 'sp-imgtools' },
          iconBtn('chevL', 'Geser ke kiri', () => { if (i) { [images[i - 1], images[i]] = [images[i], images[i - 1]]; markDirty(); drawImgs(); } }),
          iconBtn('trash', 'Hapus gambar', () => { images.splice(i, 1); markDirty(); drawImgs(); })))),
      h('button', { type: 'button', class: 'sp-imgadd', onclick: () => fileIn.click() }, icon('upload'), h('span', { text: 'Gambar Baru' })), fileIn);
    }
    drawImgs();
    const desc = richEditor(p.description, markDirty);

    // ---------------- Variasi tab
    const groups = p.variants ? structuredClone(p.variants.options) : [];
    let stockAxis = p.variants ? p.variants.stockAxis : null;
    const varBox = h('div', { class: 'sp-vars' });
    const newGroupId = () => { let n = 1; while (groups.some((g) => g.id === `g${n}`)) n++; return `g${n}`; };
    function drawVar() {
      const groupEls = groups.map((g, gi) => {
        const gName = h('input', { type: 'text', class: 'input', value: g.name, maxlength: 60, placeholder: 'Nama variasi (mis. Rasa, Ukuran)', oninput: () => { g.name = gName.value; markDirty(); } });
        const isStock = stockAxis === g.id;
        const stockToggle = h('label', { class: 'check sp-check-sm' }, h('input', { type: 'checkbox', checked: isStock, onchange: (e) => { stockAxis = e.target.checked ? g.id : null; markDirty(); drawVar(); drawStock(); } }), 'Stok & SKU dihitung per pilihan ini');
        const addIn = h('input', { type: 'text', class: 'input', maxlength: 400, placeholder: 'Tambah pilihan lalu Enter (pisahkan dengan koma untuk banyak sekaligus)' });
        const addVals = () => {
          const names = addIn.value.split(',').map((s) => s.trim()).filter(Boolean);
          for (const n of names) if (!g.values.some((v) => v.name.toLowerCase() === n.toLowerCase())) g.values.push({ name: n, price: null, comparePrice: null, weight: null, sku: '', stock: isStock ? 0 : null });
          addIn.value = '';
          markDirty();
          drawVar();
          varBox.querySelectorAll('.sp-addval')[gi]?.focus();
        };
        addIn.classList.add('sp-addval');
        addIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addVals(); } });
        const optCell = (v, k, isMoney) => {
          const input = h('input', { type: 'text', class: 'input', inputmode: 'numeric', value: v[k] == null ? '' : isMoney ? nf(v[k]) : String(v[k]), placeholder: k === 'stock' ? '0' : 'ikut produk',
            oninput: () => { const d = input.value.replace(isMoney ? /\D/g : /[^\d-]/g, ''); if (isMoney) input.value = d ? nf(Number(d)) : ''; v[k] = d === '' ? null : Number(d); markDirty(); } });
          return h('td', {}, input);
        };
        return h('section', { class: 'sp-vgroup' },
          h('div', { class: 'sp-vgroup-head' }, gName,
            iconBtn('up', 'Naikkan', () => { if (gi) { [groups[gi - 1], groups[gi]] = [groups[gi], groups[gi - 1]]; markDirty(); drawVar(); } }, { attrs: { disabled: gi === 0 } }),
            iconBtn('trash', 'Hapus variasi', async () => { if (await confirmBox(`Hapus variasi "${g.name || 'tanpa nama'}" beserta ${g.values.length} pilihannya?`, { ok: 'Hapus', danger: true })) { groups.splice(gi, 1); if (stockAxis === g.id) stockAxis = null; markDirty(); drawVar(); drawStock(); } }, { class: 'danger' })),
          stockToggle,
          h('div', { class: 'table-wrap' }, h('table', { class: 'sp-vtable' },
            h('thead', {}, h('tr', {}, h('th', { text: 'Pilihan' }), h('th', { text: 'Harga' }), h('th', { text: 'Harga coret' }), h('th', { text: 'Berat (g)' }),
              isStock ? h('th', { text: 'SKU' }) : null, isStock ? h('th', { text: 'Stok' }) : null, h('th', { text: '' }))),
            h('tbody', {}, g.values.map((v, vi) => {
              const vName = h('input', { type: 'text', class: 'input', value: v.name, maxlength: 80, oninput: () => { v.name = vName.value; markDirty(); } });
              return h('tr', {}, h('td', {}, vName), optCell(v, 'price', true), optCell(v, 'comparePrice', true), optCell(v, 'weight', false),
                isStock ? h('td', {}, h('input', { type: 'text', class: 'input', value: v.sku || '', placeholder: 'Otomatis', maxlength: 40, oninput: (e) => { v.sku = e.target.value.trim(); markDirty(); } })) : null,
                isStock ? optCell(v, 'stock', false) : null,
                h('td', { class: 'sp-vrow-tools' },
                  iconBtn('up', 'Naikkan', () => { if (vi) { [g.values[vi - 1], g.values[vi]] = [g.values[vi], g.values[vi - 1]]; markDirty(); drawVar(); } }, { attrs: { disabled: vi === 0 } }),
                  iconBtn('x', 'Hapus pilihan', () => { g.values.splice(vi, 1); markDirty(); drawVar(); })));
            })))),
          addIn);
      });
      put(varBox, 
        h('p', { class: 'fine', text: 'Pembeli memilih satu pilihan dari tiap variasi. Harga/berat pilihan boleh dikosongkan (ikut harga produk). Stok dihitung bersama untuk produk, kecuali satu variasi diberi "Stok & SKU per pilihan".' }),
        ...groupEls,
        groups.length < 3 ? btn('Tambah Variasi', () => { groups.push({ id: newGroupId(), name: '', values: [] }); markDirty(); drawVar(); }, '', 'plus') : null);
    }
    drawVar();

    const tabMain = h('div', { class: 'sp-edit-main' },
      h('section', { class: 'panel sp-card-flat' }, field('Nama', name),
        h('div', { class: 'sp-label-row' }, h('h3', { text: 'Gambar' }), h('span', { class: 'fine', text: 'Gambar pertama jadi foto utama.' })), imgGrid,
        h('h3', { class: 'sp-h3', text: 'Deskripsi' }), desc.el));
    const tabVar = h('div', { class: 'sp-edit-main', hidden: true }, h('section', { class: 'panel sp-card-flat' }, varBox));
    const tabs = h('div', { class: 'sp-tabs', role: 'tablist' }, [['general', 'General', tabMain], ['variasi', 'Variasi', tabVar]].map(([k, label, el], i) =>
      h('button', { type: 'button', role: 'tab', class: 'sp-tab', 'aria-selected': String(i === 0), text: label, onclick: (e) => {
        tabs.querySelectorAll('.sp-tab').forEach((t) => t.setAttribute('aria-selected', String(t === e.currentTarget)));
        tabMain.hidden = k !== 'general';
        tabVar.hidden = k !== 'variasi';
      } })));

    // ---------------- side panels
    const hiddenCb = h('input', { type: 'checkbox', checked: p.visibility === 'hidden', onchange: () => { markDirty(); drawVis(); } });
    const linkCb = h('input', { type: 'checkbox', checked: p.visibility === 'link', onchange: () => { markDirty(); drawVis(); } });
    const schedCb = h('input', { type: 'checkbox', checked: p.visibility === 'scheduled', onchange: () => { markDirty(); drawVis(); } });
    const toLocal = (iso) => (iso ? new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 16) : '');
    const publishAt = h('input', { type: 'datetime-local', class: 'input', value: toLocal(p.publishAt), onchange: markDirty });
    const visNote = h('div');
    const visibility = () => (hiddenCb.checked ? 'hidden' : linkCb.checked ? 'link' : schedCb.checked ? 'scheduled' : 'public');
    function drawVis() {
      const v = visibility();
      linkCb.disabled = hiddenCb.checked;
      schedCb.disabled = hiddenCb.checked || linkCb.checked;
      put(visNote, 
        v === 'scheduled' ? field('Tayang mulai (WIB)', publishAt) : null,
        v === 'link' ? h('p', { class: 'fine', text: isNew ? 'Link akses dibuat setelah produk disimpan.' : `Link akses: ${location.origin}/produk/${p.slug}?k=${p.accessToken}` }) : null);
    }
    drawVis();

    const catChecks = cats.map((c) => h('input', { type: 'checkbox', value: c.id, checked: p.categories.includes(c.id), onchange: markDirty }));
    const type = h('select', { class: 'input', onchange: markDirty }, h('option', { value: 'physical', text: 'Produk Fisik', selected: p.type !== 'digital' }), h('option', { value: 'digital', text: 'Produk Digital / Program', selected: p.type === 'digital' }));
    const tags = tagInput(p.tags, 'Klasik, katun, musiman');
    const note = h('textarea', { class: 'input sp-note', rows: 3, maxlength: 5000, placeholder: 'Catatan internal (tidak tampil ke pembeli)', oninput: markDirty });
    note.value = p.note || '';

    const price = money(p.price);
    const compare = money(p.comparePrice, { label: 'Harga coret' });
    const capital = money(p.capitalPrice, { label: 'Harga modal' });
    let tiers = (p.wholesale || []).map((t) => ({ ...t }));
    const tierBox = h('div', { class: 'sp-tiers' });
    const hasTier = h('input', { type: 'checkbox', checked: tiers.length > 0, onchange: () => { if (hasTier.checked && !tiers.length) tiers.push({ min: 2, price: 0 }); markDirty(); drawTiers(); } });
    function drawTiers() {
      put(tierBox, ...(hasTier.checked ? [
        ...tiers.map((t, i) => h('div', { class: 'sp-tier' },
          h('label', { class: 'sp-mini' }, h('span', { text: 'Min. beli' }), h('input', { type: 'number', class: 'input', min: 2, value: t.min, oninput: (e) => { t.min = Number(e.target.value || 0); markDirty(); } })),
          h('label', { class: 'sp-mini' }, h('span', { text: 'Harga / pcs' }), h('input', { type: 'text', inputmode: 'numeric', class: 'input', value: t.price ? nf(t.price) : '', oninput: (e) => { const d = e.target.value.replace(/\D/g, ''); e.target.value = d ? nf(Number(d)) : ''; t.price = Number(d || 0); markDirty(); } })),
          iconBtn('x', 'Hapus', () => { tiers.splice(i, 1); markDirty(); drawTiers(); }))),
        btn('Tambah tingkat', () => { tiers.push({ min: (tiers.at(-1)?.min || 1) + 1, price: 0 }); markDirty(); drawTiers(); }, 'btn-sm', 'plus')] : []));
    }
    drawTiers();
    const payment = h('select', { class: 'input', onchange: markDirty }, h('option', { value: '', text: 'Semua Pembayaran' }));
    const minOrder = num(p.minOrder > 1 ? p.minOrder : '');
    const maxOrder = num(p.maxOrder || '');

    const sku = h('input', { type: 'text', class: 'input', value: p.sku || '', maxlength: 40, placeholder: 'Otomatis bila kosong', oninput: markDirty });
    const track = h('input', { type: 'checkbox', checked: p.trackStock, onchange: () => { markDirty(); drawStock(); } });
    const stock = num(p.stock ?? 0, { placeholder: '0' });
    const backorder = h('input', { type: 'checkbox', checked: Boolean(p.backorder), onchange: markDirty });
    const stockBox = h('div');
    function drawStock() {
      const perValue = Boolean(stockAxis && groups.some((g) => g.id === stockAxis));
      put(stockBox, 
        perValue ? h('p', { class: 'fine', text: 'SKU dan stok diatur per pilihan di tab Variasi.' }) : field('Kode Stok (SKU)', sku),
        h('label', { class: 'check sp-check-sm' }, track, 'Lacak stok'),
        track.checked && !perValue ? field('Stok Saat Ini', stock, isNew ? '' : '(perubahan dicatat di Riwayat Stok)') : null,
        track.checked ? h('label', { class: 'check sp-check-sm' }, backorder, 'Tetap bisa dibeli walau stok habis') : null);
    }
    drawStock();

    const kg = (p.weight || 0) >= 1000 && p.weight % 100 === 0;
    const weight = h('input', { type: 'text', inputmode: 'decimal', class: 'input', value: p.weight ? String(kg ? p.weight / 1000 : p.weight) : '', placeholder: '0', oninput: () => { markDirty(); drawVol(); } });
    const wUnit = h('select', { class: 'input sp-unit', 'aria-label': 'Satuan berat', onchange: markDirty }, h('option', { value: 'g', text: 'g', selected: !kg }), h('option', { value: 'kg', text: 'kg', selected: kg }));
    const dim = (k) => num(p.dims[k] || '', { oninput: () => { markDirty(); drawVol(); } });
    const dl = dim('l'); const dw = dim('w'); const dh = dim('h');
    const vol = h('input', { type: 'text', class: 'input', readOnly: true, tabindex: -1 });
    function drawVol() { vol.value = `${((Number(val(dl) || 0) * Number(val(dw) || 0) * Number(val(dh) || 0)) / 6000).toFixed(2)} kg`; }
    drawVol();
    const withUnit = (input, unit) => h('div', { class: 'sp-withunit' }, input, typeof unit === 'string' ? h('span', { text: unit }) : unit);
    const shipping = h('select', { class: 'input', onchange: markDirty }, h('option', { value: '', text: 'Semua Pengiriman' }));

    const slug = h('input', { type: 'text', class: 'input', value: p.slug || '', maxlength: 80, placeholder: 'otomatis dari nama', oninput: markDirty });
    const noindex = h('input', { type: 'checkbox', checked: p.seo.noindex, onchange: markDirty });
    const seoTitle = h('input', { type: 'text', class: 'input', value: p.seo.title || '', maxlength: 120, placeholder: 'Halaman Keren', oninput: markDirty });
    const seoDesc = h('textarea', { class: 'input sp-note', rows: 3, maxlength: 300, placeholder: 'Halaman ini adalah tentang …', oninput: markDirty });
    seoDesc.value = p.seo.description || '';

    async function save() {
      if (!name.value.trim()) { toast('Nama produk wajib diisi.', 'error'); name.focus(); return; }
      const g2 = groups.map((g) => ({ ...g, values: g.values.filter((v) => v.name.trim()) })).filter((g) => g.values.length);
      if (groups.some((g) => g.values.length && !g.name.trim())) { toast('Beri nama untuk setiap variasi.', 'error'); return; }
      const grams = Math.round(Number(String(weight.value).replace(',', '.')) * (wUnit.value === 'kg' ? 1000 : 1)) || 0;
      const body = {
        name: name.value, slug: slug.value, type: type.value, description: desc.get(), images,
        price: moneyVal(price) || 0, comparePrice: moneyVal(compare) || 0, capitalPrice: moneyVal(capital) || 0,
        wholesale: hasTier.checked ? tiers : [], paymentMethods: [], minOrder: Number(val(minOrder) || 1), maxOrder: Number(val(maxOrder) || 0),
        visibility: visibility(), publishAt: visibility() === 'scheduled' && publishAt.value ? `${publishAt.value}:00+07:00` : '',
        categories: catChecks.filter((c) => c.checked).map((c) => c.value), tags: tags.get(), note: note.value,
        sku: sku.value, trackStock: track.checked, stock: Number(val(stock) || 0), backorder: backorder.checked,
        weight: grams, dims: { l: Number(val(dl) || 0), w: Number(val(dw) || 0), h: Number(val(dh) || 0) }, shippingMethods: [],
        seo: { title: seoTitle.value, description: seoDesc.value, noindex: noindex.checked },
        variants: g2.length ? { options: g2, stockAxis: g2.some((g) => g.id === stockAxis) ? stockAxis : null } : null,
      };
      const out = await run(() => api(isNew ? 'POST' : 'PUT', isNew ? '/admin/api/shop/products' : `/admin/api/shop/products/${ID}`, body));
      if (!out) return;
      dirty = false;
      toast('Produk disimpan.');
      if (isNew) location.href = `/admin/products/${out.product.id}/edit`;
      else setTimeout(() => location.reload(), 400);
    }
    appbar.querySelector('.tools').prepend(
      !isNew ? h('a', { class: 'btn', href: `/admin/products/${ID}` }, icon('chart'), 'Laporan') : null,
      btn('Batal', () => { location.href = '/admin/products'; }),
      btn('Simpan', save, 'btn-primary', 'check'));
    document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });

    const two = (...kids) => h('div', { class: 'sp-two' }, ...kids);
    content.append(tabs, h('form', { class: 'sp-edit', onsubmit: (e) => { e.preventDefault(); save(); } },
      h('div', {}, tabMain, tabVar),
      h('aside', { class: 'sp-edit-side' },
        card('Visibilitas', 'eye', h('label', { class: 'check sp-check-sm' }, hiddenCb, 'Tersembunyi'), h('label', { class: 'check sp-check-sm' }, linkCb, 'Hanya bisa diakses dengan link'),
          h('label', { class: 'check sp-check-sm' }, schedCb, 'Jadwalkan tayang'), visNote),
        card('Penyusunan', 'folder',
          h('div', { class: 'field' }, h('span', { text: 'Kategori' }), cats.length ? h('div', { class: 'sp-catlist' }, cats.map((c, i) => h('label', { class: 'check sp-check-sm' }, catChecks[i], c.name)))
            : h('p', { class: 'fine' }, 'Belum ada kategori. ', h('a', { href: '/admin/categories', text: 'Buat kategori' }))),
          field('Tipe Produk', type), field('Tags', tags.el), field('Catatan', note)),
        card('Harga', 'tag', two(field('Harga', price), field('Harga Coret', compare)), two(field('Harga Modal', capital), h('div')),
          h('label', { class: 'check sp-check-sm' }, hasTier, 'Memiliki harga grosir'), tierBox,
          field('Metode Pembayaran', payment), two(field('Jumlah Pembelian Min', minOrder), field('Jumlah Pembelian Max', maxOrder, '(0 = bebas)'))),
        card('Stok', 'box', stockBox),
        card('Pengiriman', 'truck', field('Berat', withUnit(weight, wUnit)), two(field('Lebar', withUnit(dw, 'cm')), field('Panjang', withUnit(dl, 'cm'))),
          two(field('Tinggi', withUnit(dh, 'cm')), field('Berat Volume', vol)), field('Metode Pengiriman', shipping)),
        card('SEO', 'search', field('Slug', h('div', { class: 'sp-withunit sp-pre' }, h('span', { text: '/produk/' }), slug)), h('label', { class: 'check sp-check-sm' }, noindex, 'Sembunyikan dari Mesin Pencarian'),
          field('Judul Halaman', seoTitle), field('Meta Deskripsi', seoDesc)))));
  }

  // ================================================================ Produk detail (Laporan / Riwayat Stok / Order)
  const STATUS_TONE = { unpaid: 'warn', paid: 'ok', processing: 'info', shipped: 'info', done: 'ok', cancelled: 'danger' };
  const statusBadge = (st, statuses) => h('span', { class: `sp-st sp-st-${STATUS_TONE[st] || 'muted'}`, text: statuses[st] || st });
  const wibDay = (d) => new Date(Date.parse(d) + 7 * 3600e3).toISOString().slice(0, 10);

  async function viewProduct() {
    const tab = qs.get('tab') || 'laporan';
    const { content, appbar } = frame({ sub: 'products', title: 'Produk' });
    const data = await run(() => api('GET', `/admin/api/shop/products/${ID}`));
    if (!data) return;
    const p = data.product;
    appbar.querySelector('h1').textContent = `Produk / ${p.name}`;
    appbar.querySelector('.tools').prepend(
      p.visibility !== 'hidden' ? h('a', { class: 'btn', href: `/produk/${p.slug}${p.visibility === 'link' ? `?k=${p.accessToken}` : ''}`, target: '_blank', rel: 'noopener' }, icon('external'), 'Lihat') : null,
      h('a', { class: 'btn', href: `/admin/products/${ID}/edit` }, icon('edit'), 'Edit'));
    const tabs = h('div', { class: 'sp-tabs', role: 'tablist' }, [['laporan', 'Laporan'], ['stok', 'Riwayat Stok'], ['order', 'Order']].map(([k, label]) =>
      h('a', { class: 'sp-tab', role: 'tab', href: `?tab=${k}`, 'aria-selected': String(tab === k), text: label })));
    const body = h('div');
    content.append(tabs, body);
    if (tab === 'stok') {
      body.append(await stockLogTable({ pid: ID }));
    } else if (tab === 'order') {
      const out = await run(() => api('GET', `/admin/api/shop/products/${ID}/orders`));
      if (out) body.append(orderList(out.orders, out.statuses));
    } else {
      body.append(await productReport(ID));
    }
  }

  async function productReport(pid) {
    const today = wibDay(new Date().toISOString());
    const st = { from: wibDay(new Date(Date.now() - 6 * 864e5).toISOString()), to: today, pay: 'paid', metric: 'sales' };
    const box = h('div');
    const sel = (opts, key) => h('select', { class: 'input', onchange: (e) => { st[key] = e.target.value; load(); } }, opts.map(([v, t]) => h('option', { value: v, text: t, selected: st[key] === v })));
    const date = (key) => h('input', { type: 'date', class: 'input', value: st[key], max: today, onchange: (e) => { st[key] = e.target.value; load(); } });
    const filters = h('div', { class: 'sp-filters' },
      field('Data', sel([['sales', 'Total Penjualan'], ['qty', 'Jumlah Terjual']], 'metric')),
      field('Status Pembayaran', sel([['paid', 'Terbayar'], ['unpaid', 'Belum Bayar'], ['all', 'Semua']], 'pay')),
      field('Dari', date('from')), field('Sampai', date('to')));
    async function load() {
      const r = await run(() => api('GET', `/admin/api/shop/products/${pid}/report?${new URLSearchParams(st)}`));
      if (!r) return;
      const fmt = (v) => (r.metric === 'qty' ? `${nf(v)} pcs` : rp(v));
      const rank = (title, list) => h('section', { class: 'panel sp-rcard' }, h('h3', { text: title }),
        list.length ? h('ol', { class: 'sp-rank' }, list.map(([k, v]) => h('li', {}, h('span', { text: k }), h('b', { text: fmt(v) })))) : h('p', { class: 'muted', text: 'Tidak ada data' }));
      const G = r.groups;
      put(box,
        h('p', { class: 'fine', text: 'Laporan produk tidak menghitung harga diskon. Order dibatalkan tidak dihitung.' }),
        h('section', { class: 'panel sp-rcard sp-rbig' },
          h('div', { class: 'sp-rhead' }, h('h3', { text: r.metric === 'qty' ? 'Jumlah Terjual' : 'Penjualan' }), h('div', {}, h('b', { text: fmt(r.total) }), h('small', { text: `${nf(r.orders)} order` }))),
          M.lineChart({ labels: r.series.map((s) => s.d), series: [r.series.map((s) => s.v)], names: [r.metric === 'qty' ? 'Terjual' : 'Penjualan'] })),
        rank('Variasi', G.variasi),
        h('div', { class: 'sp-rgrid' }, [['Pelanggan', G.pelanggan], ['Sumber Domain', G.domain], ['Halaman Landasan', G.halaman], ['Provinsi', G.provinsi], ['Kota/Kabupaten', G.kota],
          ['Kecamatan', G.kecamatan], ['Metode Pengiriman', G.pengiriman], ['Sistem Operasi', G.os], ['Utm Medium', G.utm_medium], ['Utm Source', G.utm_source], ['Utm Campaign', G.utm_campaign]].map(([t, l]) => rank(t, l))));
    }
    await load();
    return h('div', {}, filters, box);
  }

  /** Order rows (used by the Order menu and the product's Order tab). */
  function orderList(list, statuses, { onAction } = {}) {
    if (!list.length) return h('div', { class: 'empty' }, icon('cart'), h('p', { text: 'Belum ada order.' }));
    return h('div', { class: 'sp-list' }, list.map((o) => h('div', { class: 'sp-row sp-orow' },
      h('div', { class: 'sp-main' },
        h('a', { class: 'sp-name', href: `/admin/orders/${o.no}`, text: o.no }), statusBadge(o.status, statuses),
        h('small', { class: 'muted sp-full', text: fmtDate(o.createdAt) }),
        actionLinks([
          ['Detail', null, '', `/admin/orders/${o.no}`],
          o.phone ? ['WhatsApp', null, '', `https://wa.me/${o.phone}`] : null,
          onAction && o.status === 'unpaid' ? ['Tandai Terbayar', () => onAction(o, 'paid')] : null,
        ])),
      h('div', { class: 'sp-col' }, h('small', { text: 'Pembeli' }), h('span', { text: o.name }), h('small', { text: [o.kab, o.prov].filter(Boolean).join(', ') })),
      h('div', { class: 'sp-col' }, h('small', { text: 'Produk' }), h('span', { text: o.items.map((it) => `${it.name} ×${it.qty}`).join(', ') })),
      h('div', { class: 'sp-col sp-col-num' }, h('small', { text: 'Total' }), h('span', { text: rp(o.total) }), o.resi ? h('small', { text: `Resi ${o.resi}` }) : null))));
  }

  // ================================================================ Order (menu)
  function orderFrame(sub, title) {
    const out = layout({ active: 'order', title });
    out.content.append(subtabs([['orders', '/admin/orders', 'cart', 'Order'], ['settings', '/admin/shop-settings', 'tag', 'Pengaturan Toko']], sub));
    return out;
  }

  async function viewOrders() {
    const state = { tab: qs.get('status') || 'all', q: '' };
    const { content } = orderFrame('orders', 'Order');
    let data = await run(() => api('GET', '/admin/api/shop/orders'));
    if (!data) return;
    const tabsEl = h('div', { class: 'sp-tabs', role: 'tablist' });
    const listEl = h('div');
    const totalEl = h('span', { class: 'sp-total' });
    content.append(h('div', { class: 'sp-toolbar' }, searchBox('', (v) => { state.q = v; draw(); }, 'Cari no. order, nama, nomor HP atau produk'), totalEl), tabsEl, listEl);
    async function quick(o, to) {
      const out = await run(() => api('POST', `/admin/api/shop/orders/${o.no}/status`, { to }), `Order ${o.no}: ${data.statuses[to]}.`);
      if (out) { data = await run(() => api('GET', '/admin/api/shop/orders')) || data; draw(); }
    }
    function draw() {
      const s = state.q.toLowerCase();
      const base = data.orders.filter((o) => !s || o.no.toLowerCase().includes(s) || o.name.toLowerCase().includes(s) || o.phone.includes(s.replace(/\D/g, '') || '§') || o.items.some((it) => it.name.toLowerCase().includes(s)));
      const count = (t) => (t === 'all' ? base.length : base.filter((o) => o.status === t).length);
      put(tabsEl, [['all', 'Semua'], ...Object.entries(data.statuses)].map(([t, label]) => h('button', { type: 'button', role: 'tab', class: 'sp-tab', 'aria-selected': String(state.tab === t),
        onclick: () => { state.tab = t; setQuery({ status: t === 'all' ? '' : t }); draw(); } }, label, h('span', { class: 'sp-count', text: nf(count(t)) }))));
      const rows = base.filter((o) => state.tab === 'all' || o.status === state.tab);
      put(totalEl, h('b', { text: nf(rows.length) }), ' order · ', h('b', { text: rp(rows.filter((o) => o.status !== 'cancelled').reduce((a, o) => a + o.total, 0)) }));
      put(listEl, orderList(rows.slice(0, 300), data.statuses, { onAction: quick }));
    }
    draw();
  }

  async function viewOrder() {
    const NO = ID;
    const { content, appbar } = orderFrame('orders', `Order / ${NO}`);
    let data = await run(() => api('GET', `/admin/api/shop/orders/${NO}`));
    if (!data) return;
    const tools = appbar.querySelector('.tools');
    const card = (title, ...kids) => h('section', { class: 'panel sp-card' }, h('div', { class: 'panel-head' }, h('h2', { text: title })), h('div', { class: 'sp-card-body' }, ...kids));
    const main = h('div', { class: 'sp-edit' });
    content.append(main);
    async function move(to) {
      let extra = {};
      if (to === 'shipped' && data.order.shipping) {
        const resi = await promptBox('Tandai dikirim', 'Nomor resi (opsional)', data.order.shipping.resi || '', { ok: 'Kirim', maxlength: 60 });
        if (resi === null && !(await confirmBox('Tandai dikirim tanpa nomor resi?'))) return;
        extra = { resi: resi || '' };
      }
      if (to === 'cancelled' && !(await confirmBox(`Batalkan order ${NO}? Stok produk dikembalikan.`, { ok: 'Batalkan order', danger: true }))) return;
      const out = await run(() => api('POST', `/admin/api/shop/orders/${NO}/status`, { to, ...extra }), `Status: ${data.statuses[to]}.`);
      if (out) { data.order = out.order; draw(); }
    }
    const NEXT_LABEL = { paid: 'Tandai Terbayar', processing: 'Proses', shipped: 'Tandai Dikirim', done: 'Selesai', cancelled: 'Batalkan', unpaid: 'Kembalikan ke Belum Bayar' };
    const NEXT = { unpaid: ['paid', 'cancelled'], paid: ['processing', 'shipped', 'unpaid', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['done'], done: [], cancelled: [] };
    function draw() {
      const o = data.order;
      const wa = (text) => `https://wa.me/${o.customer.phone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
      const buyerUrl = `${location.origin}${data.publicUrl}`;
      put(tools, h('a', { class: 'btn', href: data.publicUrl, target: '_blank', rel: 'noopener' }, icon('external'), 'Halaman pembeli'),
        h('a', { class: 'btn', href: wa(`Halo ${o.customer.name}, pesanan ${o.no} kamu bisa dicek di ${buyerUrl}`), target: '_blank', rel: 'noopener' }, icon('wa'), 'WhatsApp pembeli'),
        tools.querySelector('.theme-toggle'));
      const note = h('textarea', { class: 'input sp-note', rows: 3, maxlength: 2000, placeholder: 'Catatan internal' });
      note.value = o.adminNote || '';
      const resi = h('input', { type: 'text', class: 'input', value: (o.shipping && o.shipping.resi) || '', maxlength: 60, placeholder: 'Nomor resi' });
      const addr = o.address ? `${o.address.detail}, ${o.address.kecName}, ${o.address.kabName}, ${o.address.provName}${o.address.postal ? ` ${o.address.postal}` : ''}` : '';
      const copyBtn = (text, label = 'Salin') => btn(label, () => navigator.clipboard.writeText(text).then(() => toast('Disalin.')), 'btn-sm');
      put(main,
        h('div', { class: 'sp-edit-main' },
          card('Status', h('p', {}, statusBadge(o.status, data.statuses), ' ', h('span', { class: 'muted', text: `dibuat ${fmtDate(o.createdAt)}${o.paidAt ? ` · dibayar ${fmtDate(o.paidAt)}` : ''}` })),
            h('div', { class: 'row-tight sp-wrap-row' }, (NEXT[o.status] || []).map((to) => btn(NEXT_LABEL[to], () => move(to), to === 'cancelled' ? 'btn-danger' : to === 'unpaid' ? 'btn-ghost' : 'btn-primary')))),
          card('Produk',
            ...o.items.map((it) => h('div', { class: 'sp-cell sp-oitem' }, it.image ? h('img', { class: 'sp-thumb', src: it.image, alt: '' }) : thumb(''), h('span', {}, h('a', { href: `/admin/products/${it.pid}`, text: it.name }), it.gift ? h('span', { class: 'sp-st sp-st-ok', text: 'Hadiah' }) : null, h('small', { text: [it.label, it.sku && `SKU ${it.sku}`].filter(Boolean).join(' · ') }), h('small', { text: `${it.qty} × ${it.gift ? 'Gratis' : rp(it.price)}` })))),
            h('div', { class: 'sp-sum' },
              h('p', {}, h('span', { text: 'Subtotal' }), h('span', { text: rp(o.subtotal) })),
              o.discount && o.discount.amount ? h('p', { class: 'sp-pos' }, h('span', { text: `Diskon ${o.discount.code || o.discount.name}` }), h('span', { text: `−${rp(o.discount.amount)}` })) : null,
              o.shipping ? h('p', {}, h('span', { text: `Ongkir ${o.shipping.name} (${nf(o.shipping.weight)} g)` }), h('span', { text: rp(o.shipping.cost) })) : null,
              o.discount && o.discount.shippingOff ? h('p', { class: 'sp-pos' }, h('span', { text: `Potongan ongkir ${o.discount.code || o.discount.name}` }), h('span', { text: `−${rp(o.discount.shippingOff)}` })) : null,
              h('p', { class: 'sp-sum-total' }, h('span', { text: 'Total' }), h('span', { text: rp(o.total) }))),
            o.discount ? h('p', { class: 'fine' }, 'Diskon: ', h('a', { href: `/admin/discounts/${o.discount.id}`, text: o.discount.name })) : null),
          card('Penerima',
            h('p', {}, h('b', { text: o.customer.name }), ' · ', h('a', { href: wa(''), target: '_blank', rel: 'noopener', text: o.customer.phone }), o.customer.email ? ` · ${o.customer.email}` : ''),
            addr ? h('p', { class: 'sp-addr' }, h('span', { text: addr }), copyBtn(`${o.customer.name}\n${o.customer.phone}\n${addr}`, 'Salin alamat')) : h('p', { class: 'muted', text: 'Produk digital: tanpa alamat.' }),
            o.note ? h('p', { class: 'note', text: `Catatan pembeli: ${o.note}` }) : null),
          card('Riwayat', h('ul', { class: 'sp-hist' }, o.history.slice().reverse().map((e) => h('li', {}, h('span', { class: 'muted', text: fmtDate(e.ts) }), ' ',
            e.action === 'create' ? 'Order dibuat oleh pembeli' : e.action === 'edit' ? `Diubah oleh ${e.by}` : `${data.statuses[e.from] || e.from} → ${data.statuses[e.to] || e.to} oleh ${e.by}${e.resi ? ` (resi ${e.resi})` : ''}`))))),
        h('aside', { class: 'sp-edit-side' },
          o.shipping ? card('Pengiriman', h('p', { text: `${o.shipping.name}${o.shipping.eta ? ` · ${o.shipping.eta}` : ''}` }), field('No. resi', resi)) : null,
          card('Pembayaran', h('p', { text: 'Transfer bank' }), ...(o.payment.banks || []).map((b) => h('p', { class: 'fine', text: `${b.bank} ${b.number} a.n. ${b.holder}` }))),
          card('Sumber', ...[['Halaman', o.source.page], ['Domain', o.source.ref], ['UTM source', o.source.utm_source], ['UTM medium', o.source.utm_medium], ['UTM campaign', o.source.utm_campaign], ['Perangkat', o.source.os]]
            .filter(([, v]) => v).map(([k, v]) => h('p', { class: 'fine' }, `${k}: `, h('b', { text: v }))), o.source.page || o.source.ref || o.source.utm_source ? null : h('p', { class: 'fine', text: 'Langsung (tanpa sumber).' })),
          card('Catatan admin', note, btn('Simpan catatan', async () => {
            const out = await run(() => api('PATCH', `/admin/api/shop/orders/${NO}`, { adminNote: note.value, resi: resi.value }), 'Disimpan.');
            if (out) { data.order = out.order; draw(); }
          }, 'btn-sm'))));
    }
    draw();
  }

  // ================================================================ Pengaturan Toko
  async function viewSettings() {
    const { content, appbar } = orderFrame('settings', 'Pengaturan Toko');
    const data = await run(() => api('GET', '/admin/api/shop/settings'));
    if (!data) return;
    const s = structuredClone(data.settings);
    const provinces = await fetch('/assets/wilayah/provinsi.json').then((r) => r.json()).catch(() => []);
    const regionCache = {};
    const kabOf = async (prov) => (regionCache[prov] ||= await fetch(`/assets/wilayah/${prov}.json`).then((r) => r.json()).then((d) => d.kab).catch(() => []));
    let dirty = false;
    const markDirty = () => { dirty = true; };
    addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    const card = (title, ...kids) => h('section', { class: 'panel sp-card' }, h('div', { class: 'panel-head' }, h('h2', { text: title })), h('div', { class: 'sp-card-body' }, ...kids));
    const text = (obj, key, attrs = {}) => {
      const el = h(attrs.rows ? 'textarea' : 'input', { class: `input${attrs.rows ? ' sp-note' : ''}`, ...(attrs.rows ? {} : { type: 'text' }), maxlength: attrs.max || 200, placeholder: attrs.ph || '', rows: attrs.rows || null,
        oninput: (e) => { obj[key] = attrs.num ? Number(e.target.value.replace(/\D/g, '') || 0) : e.target.value; markDirty(); } });
      el.value = obj[key] ?? ''; // a textarea ignores the value attribute
      return el;
    };

    const banksEl = h('div', { class: 'sp-banks' });
    function drawBanks() {
      put(banksEl, s.banks.map((b, i) => h('div', { class: 'sp-bankrow' }, text(b, 'bank', { ph: 'Bank (mis. BCA)', max: 40 }), text(b, 'number', { ph: 'No. rekening', max: 40 }), text(b, 'holder', { ph: 'Atas nama', max: 80 }),
        iconBtn('x', 'Hapus rekening', () => { s.banks.splice(i, 1); markDirty(); drawBanks(); }))),
      btn('Tambah rekening', () => { s.banks.push({ bank: '', number: '', holder: '' }); markDirty(); drawBanks(); }, 'btn-sm', 'plus'));
    }
    drawBanks();

    const methodsEl = h('div', { class: 'sp-methods' });
    async function rateRow(m, r, i) {
      const provSel = h('select', { class: 'input', 'aria-label': 'Provinsi' }, h('option', { value: '*', text: 'Semua wilayah (default)', selected: r.prov === '*' }), provinces.map(([k, n]) => h('option', { value: k, text: n, selected: r.prov === k })));
      const kabSel = h('select', { class: 'input', 'aria-label': 'Kota/Kabupaten', disabled: r.prov === '*' }, h('option', { value: '', text: 'Semua kota di provinsi ini' }));
      const fillKab = async () => {
        const list = r.prov === '*' ? [] : await kabOf(r.prov);
        put(kabSel, h('option', { value: '', text: 'Semua kota di provinsi ini' }), list.map(([k, n]) => h('option', { value: k, text: n, selected: r.kab === k })));
        kabSel.disabled = r.prov === '*';
      };
      provSel.addEventListener('change', () => { r.prov = provSel.value; r.kab = ''; markDirty(); fillKab(); });
      kabSel.addEventListener('change', () => { r.kab = kabSel.value; markDirty(); });
      await fillKab();
      const price = h('input', { type: 'text', inputmode: 'numeric', class: 'input', value: r.price ? nf(r.price) : '', placeholder: '0 = gratis',
        oninput: (e) => { const d = e.target.value.replace(/\D/g, ''); e.target.value = d ? nf(Number(d)) : ''; r.price = Number(d || 0); markDirty(); } });
      return h('tr', {}, h('td', {}, provSel), h('td', {}, kabSel), h('td', {}, price),
        h('td', {}, h('label', { class: 'check sp-check-sm' }, h('input', { type: 'checkbox', checked: r.perKg, onchange: (e) => { r.perKg = e.target.checked; markDirty(); } }), 'per kg')),
        h('td', {}, text(r, 'eta', { ph: '2-3 hari', max: 40 })),
        h('td', {}, iconBtn('x', 'Hapus tarif', () => { m.rates.splice(i, 1); markDirty(); drawMethods(); })));
    }
    async function drawMethods() {
      const els = [];
      for (const [mi, m] of s.shipping.methods.entries()) {
        const rows = [];
        for (const [i, r] of m.rates.entries()) rows.push(await rateRow(m, r, i));
        els.push(h('section', { class: 'sp-vgroup' },
          h('div', { class: 'sp-vgroup-head' }, text(m, 'name', { ph: 'Nama metode (mis. Reguler, Instant)', max: 60 }),
            h('label', { class: 'check sp-check-sm' }, h('input', { type: 'checkbox', checked: m.enabled, onchange: (e) => { m.enabled = e.target.checked; markDirty(); } }), 'Aktif'),
            iconBtn('trash', 'Hapus metode', async () => { if (await confirmBox(`Hapus metode "${m.name}"?`, { ok: 'Hapus', danger: true })) { s.shipping.methods.splice(mi, 1); markDirty(); drawMethods(); } }, { class: 'danger' })),
          text(m, 'note', { ph: 'Keterangan untuk pembeli (opsional)', max: 160 }),
          h('div', { class: 'table-wrap' }, h('table', { class: 'sp-vtable' },
            h('thead', {}, h('tr', {}, h('th', { text: 'Provinsi' }), h('th', { text: 'Kota/Kab' }), h('th', { text: 'Tarif (Rp)' }), h('th', { text: 'Hitung' }), h('th', { text: 'Estimasi' }), h('th', { text: '' }))),
            h('tbody', {}, rows.length ? rows : h('tr', {}, h('td', { colspan: 6, class: 'muted', text: 'Belum ada tarif: metode ini tidak muncul di checkout.' }))))),
          btn('Tambah tarif', () => { m.rates.push({ prov: '*', kab: '', price: 0, perKg: true, eta: '' }); markDirty(); drawMethods(); }, 'btn-sm', 'plus')));
      }
      put(methodsEl, h('p', { class: 'fine', text: 'Tarif paling spesifik yang dipakai: kota/kabupaten → provinsi → "Semua wilayah". Centang "per kg" agar tarif dikali berat (dibulatkan ke atas, minimal 1 kg).' }),
        els, btn('Tambah metode pengiriman', () => { s.shipping.methods.push({ id: '', name: '', note: '', enabled: true, rates: [{ prov: '*', kab: '', price: 0, perKg: true, eta: '' }] }); markDirty(); drawMethods(); }, '', 'plus'));
    }
    await drawMethods();

    async function save() {
      const out = await run(() => api('PUT', '/admin/api/shop/settings', s), 'Pengaturan toko disimpan.');
      if (out) { dirty = false; Object.assign(s, structuredClone(out.settings)); drawBanks(); drawMethods(); }
    }
    appbar.querySelector('.tools').prepend(btn('Simpan', save, 'btn-primary', 'check'));
    content.append(h('div', { class: 'sp-settings' },
      card('Toko', field('Nama toko', text(s, 'storeName', { max: 80 })), field('Nomor WhatsApp admin', text(s, 'whatsapp', { ph: '0812xxxxxxx', max: 20 }), '(tujuan tombol "Konfirmasi via WhatsApp")')),
      card('Rekening transfer', banksEl, field('Catatan pembayaran', text(s, 'paymentNote', { rows: 3, max: 600 })), field('Batas waktu bayar (jam)', text(s, 'expiryHours', { num: true, max: 4 }))),
      card('Pengiriman', methodsEl),
      card('Privasi', field('Teks persetujuan di checkout', text(s, 'privacyNote', { rows: 2, max: 600 }), '(UU PDP: jelaskan untuk apa data dipakai)'))));
  }

  const REASONS = { manual: 'Tambah manual', set: 'Setel manual', edit: 'Edit produk', initial: 'Stok awal', checkout: 'Checkout', cancel: 'Order dibatalkan', import: 'Import' };
  async function stockLogTable({ pid } = {}) {
    const out = await run(() => api('GET', `/admin/api/shop/stock/log${pid ? `?pid=${pid}` : ''}`));
    if (!out) return h('div');
    if (!out.entries.length) return h('div', { class: 'empty', text: 'Belum ada perubahan stok.' });
    return h('div', { class: 'table-wrap' }, h('table', { class: 'sp-table' },
      h('thead', {}, h('tr', {}, h('th', { text: 'Produk' }), h('th', { text: 'Waktu' }), h('th', { text: 'Alasan' }), h('th', { text: 'Perubahan', class: 'num' }), h('th', { text: 'Stok Akhir', class: 'num' }), h('th', { text: 'Oleh' }))),
      h('tbody', {}, out.entries.map((e) => h('tr', {},
        h('td', {}, h('div', { class: 'sp-cell' }, thumb(e.image), h('span', {}, h('b', { text: e.name }), h('small', { text: e.label || 'Tidak Ada Variasi' })))),
        h('td', { class: 'nowrap', text: fmtDate(e.ts) }),
        h('td', { text: `${REASONS[e.reason] || e.reason}${e.ref ? ` (${e.ref})` : ''}` }),
        h('td', { class: `num ${e.delta < 0 ? 'sp-neg' : 'sp-pos'}`, text: `${e.delta > 0 ? '+' : ''}${nf(e.delta)}` }),
        h('td', { class: 'num', text: nf(e.after) }),
        h('td', { class: 'muted', text: e.by || '-' }))))));
  }

  // ================================================================ Kelola Stok
  async function viewStock() {
    const state = { order: qs.get('order') || 'low', q: '', shown: 60 };
    const { content, appbar } = frame({ sub: 'stock', title: 'Kelola Stok' });
    appbar.querySelector('.tools').prepend(btn('Lihat Riwayat', async () => {
      dialog({ title: 'Riwayat stok (semua produk)', size: 'lg', body: await stockLogTable() });
    }, '', 'history'));
    let rows = (await run(() => api('GET', '/admin/api/shop/stock')))?.rows;
    if (!rows) return;
    const pending = new Map(); // key -> { mode, qty }
    const key = (r) => `${r.pid}:${r.vid || ''}`;
    const tabs = h('div', { class: 'sp-tabs', role: 'tablist' });
    const listEl = h('div', { class: 'sp-list' });
    const saveAll = btn('Simpan semua', () => commit([...pending.keys()]), 'btn-primary', 'check');
    saveAll.hidden = true;
    content.append(h('div', { class: 'sp-toolbar' }, searchBox('', (v) => { state.q = v; state.shown = 60; draw(); }, 'Cari produk atau SKU'), saveAll), tabs, listEl);

    async function commit(keys) {
      const changes = keys.map((k) => { const [pid, vid] = k.split(':'); const c = pending.get(k); return { pid, vid: vid || null, mode: c.mode, qty: c.qty }; })
        .filter((c) => c.mode === 'set' || c.qty !== 0);
      if (!changes.length) return;
      const out = await run(() => api('POST', '/admin/api/shop/stock', { changes }), `Stok ${changes.length} item diperbarui.`);
      if (out) { rows = out.rows; for (const k of keys) pending.delete(k); draw(); }
    }
    async function editSku(r) {
      const v = await promptBox('Ubah SKU', `SKU ${r.name}${r.label ? ` (${r.label})` : ''}`, r.sku, { maxlength: 40 });
      if (!v || v === r.sku) return;
      const out = await run(() => api('PATCH', '/admin/api/shop/sku', { pid: r.pid, vid: r.vid, sku: v }), 'SKU diubah.');
      if (out) { r.sku = v; draw(); }
    }
    function row(r) {
      const k = key(r);
      const st = pending.get(k) || { mode: 'add', qty: 0 };
      const seg = h('div', { class: 'seg sp-seg' }, ['add', 'set'].map((m) => h('label', {},
        h('input', { type: 'radio', name: `m-${k}`, value: m, checked: st.mode === m, onchange: () => { st.mode = m; pending.set(k, st); if (m === 'set' && !st.touched) { step.set(r.stock ?? 0); } refresh(); } }),
        m === 'add' ? 'Tambah' : 'Setel')));
      const step = stepper(st.qty, { onchange: (v) => { st.qty = v; st.touched = true; pending.set(k, st); refresh(); } });
      const saveBtn = btn('Simpan', () => commit([k]), 'btn-sm btn-primary');
      const preview = h('small', { class: 'sp-after' });
      const refresh = () => {
        const active = pending.has(k) && (st.mode === 'set' || st.qty !== 0);
        saveBtn.hidden = !active;
        preview.textContent = active ? `→ ${nf(st.mode === 'set' ? st.qty : (r.stock ?? 0) + st.qty)}` : '';
        const n = [...pending.values()].filter((c) => c.mode === 'set' || c.qty !== 0).length;
        saveAll.hidden = n < 2;
        saveAll.lastChild.textContent = `Simpan semua (${n})`;
      };
      step.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit([k]); } });
      refresh();
      return h('div', { class: 'sp-row sp-srow' },
        h('a', { href: `/admin/products/${r.pid}/edit`, class: 'sp-img' }, thumb(r.image)),
        h('div', { class: 'sp-main' }, h('a', { class: 'sp-name', href: `/admin/products/${r.pid}?tab=stok`, text: r.name }), h('small', { class: 'muted', text: r.label || 'Tidak Ada Variasi' })),
        h('div', { class: 'sp-col sp-col-num' }, h('small', { text: 'Stok' }), h('span', { class: r.stock != null && r.stock <= 0 ? 'sp-neg' : '', text: r.stock == null ? '-' : nf(r.stock) })),
        h('div', { class: 'sp-stockctl' }, seg, step.el, preview, saveBtn),
        h('div', { class: 'sp-col' }, h('small', {}, 'SKU (', h('button', { type: 'button', class: 'sp-link', text: 'edit', onclick: () => editSku(r) }), ')'), h('span', { text: r.sku || '-' })));
    }
    function draw() {
      put(tabs, ...[['low', 'Terendah'], ['high', 'Terbanyak']].map(([k, label]) => h('button', { type: 'button', role: 'tab', class: 'sp-tab', 'aria-selected': String(state.order === k), text: label,
        onclick: () => { state.order = k; setQuery({ order: k === 'low' ? '' : k }); draw(); } })));
      const s = state.q.toLowerCase();
      const list = rows.filter((r) => !s || r.name.toLowerCase().includes(s) || (r.sku || '').toLowerCase().includes(s) || r.label.toLowerCase().includes(s))
        .sort((a, b) => (state.order === 'low' ? (a.stock ?? 1e15) - (b.stock ?? 1e15) : (b.stock ?? -1e15) - (a.stock ?? -1e15)));
      put(listEl, ...(list.length ? list.slice(0, state.shown).map(row) : [h('div', { class: 'empty', text: rows.length ? 'Tidak ada yang cocok.' : 'Belum ada produk.' })]),
        list.length > state.shown ? h('div', { class: 'sp-more' }, btn(`Tampilkan lebih banyak (${nf(list.length - state.shown)} lagi)`, () => { state.shown += 100; draw(); })) : null);
    }
    draw();
  }

  // ================================================================ Kategori
  async function viewCategories() {
    const { content, appbar } = frame({ sub: 'categories', title: 'Kategori' });
    let data = await run(() => api('GET', '/admin/api/shop/categories'));
    if (!data) return;
    const listEl = h('div', { class: 'sp-cats' });
    content.append(h('p', { class: 'fine', text: 'Klik kategori untuk melihat produknya. Urutan di sini dipakai di toko.' }), listEl);
    const call = async (method, url, body, msg) => { const out = await run(() => api(method, url, body), msg); if (out) { data = out; draw(); } };
    appbar.querySelector('.tools').prepend(btn('Kategori', async () => {
      const name = await promptBox('Kategori baru', 'Nama kategori', '', { ok: 'Buat', maxlength: 80 });
      if (name) call('POST', '/admin/api/shop/categories', { name }, 'Kategori dibuat.');
    }, 'btn-primary', 'plus'));
    function move(i, d) {
      const ids = data.categories.map((c) => c.id);
      const j = i + d;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      call('POST', '/admin/api/shop/categories/reorder', { ids });
    }
    function draw() {
      put(listEl, 
        h('a', { class: 'sp-catrow sp-catall', href: '/admin/products' }, h('span', { text: 'Semua Produk' }), h('span', { class: 'sp-count', text: nf(data.total) })),
        ...data.categories.map((c, i) => h('div', { class: 'sp-catrow' },
          h('a', { href: `/admin/products?cat=${c.id}` }, h('span', { text: c.name }), h('span', { class: 'sp-count', text: nf(data.counts[c.id] || 0) })),
          h('div', { class: 'sp-catbtns' },
            iconBtn('up', 'Naikkan', () => move(i, -1), { attrs: { disabled: i === 0 } }),
            iconBtn('down', 'Turunkan', () => move(i, 1), { attrs: { disabled: i === data.categories.length - 1 } }),
            iconBtn('rename', 'Ganti nama', async () => {
              const name = await promptBox('Ganti nama kategori', 'Nama kategori', c.name, { maxlength: 80 });
              if (name && name !== c.name) call('PUT', `/admin/api/shop/categories/${c.id}`, { name }, 'Kategori diubah.');
            }),
            iconBtn('trash', 'Hapus', async () => {
              if (await confirmBox(`Hapus kategori "${c.name}"? Produknya tetap ada, hanya dilepas dari kategori ini.`, { ok: 'Hapus', danger: true })) call('DELETE', `/admin/api/shop/categories/${c.id}`, undefined, 'Kategori dihapus.');
            }, { class: 'danger' })))),
        data.categories.length ? null : h('div', { class: 'empty', text: 'Belum ada kategori. Klik "+ Kategori".' }));
    }
    draw();
  }

  // ================================================================ Katalog
  async function editCatalogDialog(k, onsave) {
    const name = h('input', { type: 'text', class: 'input', value: k ? k.name : '', maxlength: 120 });
    const desc = h('textarea', { class: 'input sp-note', rows: 3, maxlength: 2000 });
    desc.value = k ? k.description || '' : '';
    const submit = async () => {
      const body = { name: name.value, description: desc.value, products: k ? k.products : [] };
      const out = await run(() => api(k ? 'PUT' : 'POST', k ? `/admin/api/shop/catalogs/${k.id}` : '/admin/api/shop/catalogs', body), k ? 'Katalog disimpan.' : 'Katalog dibuat.');
      if (out) { d.close(); onsave(out.catalog); }
    };
    const d = dialog({ title: k ? 'Pengaturan katalog' : 'Katalog baru', size: 'sm',
      body: h('form', { onsubmit: (e) => { e.preventDefault(); submit(); } }, field('Nama katalog', name), field('Deskripsi', desc, '(opsional)')),
      foot: [btn('Batal', () => d.close()), btn('Simpan', submit, 'btn-primary')] });
    name.focus();
  }

  async function viewCatalogs() {
    const { content, appbar } = frame({ sub: 'catalogs', title: 'Katalog' });
    let data = await run(() => api('GET', '/admin/api/shop/catalogs'));
    if (!data) return;
    appbar.querySelector('.tools').prepend(btn('Katalog', () => editCatalogDialog(null, (k) => { location.href = `/admin/catalogs/${k.id}`; }), 'btn-primary', 'plus'));
    const listEl = h('div', { class: 'sp-list' });
    content.append(h('p', { class: 'fine', text: 'Katalog = kumpulan produk pilihan (mis. ORDER BURNX MATCHA) yang bisa dipakai di halaman tertentu.' }), listEl);
    const reload = async () => { const out = await run(() => api('GET', '/admin/api/shop/catalogs')); if (out) { data = out; draw(); } };
    function draw() {
      put(listEl, ...data.catalogs.map((k) => h('div', { class: 'sp-row' },
        h('div', { class: 'sp-main' }, h('a', { class: 'sp-name', href: `/admin/catalogs/${k.id}`, text: k.name }),
          actionLinks([
            ['Edit', () => editCatalogDialog(k, reload)],
            ['Detail', null, '', `/admin/catalogs/${k.id}`],
            ['Hapus', async () => { if (await confirmBox(`Hapus katalog "${k.name}"? Produknya tidak ikut terhapus.`, { ok: 'Hapus', danger: true })) { const out = await run(() => api('DELETE', `/admin/api/shop/catalogs/${k.id}`), 'Katalog dihapus.'); if (out) reload(); } }, 'danger'],
          ])),
        h('div', { class: 'sp-col sp-col-num' }, h('small', { text: 'Produk' }), h('span', { text: nf(k.products.length) })))),
      data.catalogs.length ? null : h('div', { class: 'empty', text: 'Belum ada katalog.' }));
    }
    draw();
  }

  async function viewCatalog() {
    const { content, appbar } = frame({ sub: 'catalogs', title: 'Katalog' });
    let data = await run(() => api('GET', `/admin/api/shop/catalogs/${ID}`));
    if (!data) return;
    const catName = new Map(data.categories.map((c) => [c.id, c.name]));
    const title = appbar.querySelector('h1');
    const listEl = h('div', { class: 'sp-list' });
    content.append(listEl);
    const reload = async () => { const out = await run(() => api('GET', `/admin/api/shop/catalogs/${ID}`)); if (out) { data = out; draw(); } };
    const saveProducts = async (ids, msg) => {
      const out = await run(() => api('PUT', `/admin/api/shop/catalogs/${ID}`, { ...data.catalog, products: ids }), msg);
      if (out) reload();
    };
    appbar.querySelector('.tools').prepend(
      btn('Pengaturan', () => editCatalogDialog(data.catalog, reload)),
      btn('Tambah produk', async () => {
        const picked = await pickProducts({ title: 'Tambah produk ke katalog', exclude: data.catalog.products });
        if (picked.length) saveProducts([...data.catalog.products, ...picked.map((p) => p.id)], `${picked.length} produk ditambahkan.`);
      }, 'btn-primary', 'plus'));
    function draw() {
      title.textContent = `Katalog / ${data.catalog.name}`;
      const ids = data.catalog.products;
      put(listEl, ...data.products.map((p, i) => h('div', { class: 'sp-row' },
        h('a', { href: `/admin/products/${p.id}/edit`, class: 'sp-img' }, thumb(imgUrl(p.image))),
        h('div', { class: 'sp-main' },
          h('a', { class: 'sp-name', href: `/admin/products/${p.id}/edit`, text: p.name }),
          p.tab !== 'public' ? h('span', { class: `sp-vis sp-vis-${p.tab}` }, icon('eyeOff'), VIS[p.tab]) : null,
          actionLinks([
            ['Edit', null, '', `/admin/products/${p.id}/edit`],
            ['Laporan', null, '', `/admin/products/${p.id}`],
            ['Naik', () => { if (i) { const n = [...ids]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; saveProducts(n); } }],
            ['Keluarkan', () => saveProducts(ids.filter((x) => x !== p.id), 'Produk dikeluarkan dari katalog.'), 'danger'],
          ])),
        h('div', { class: 'sp-col sp-col-num' }, h('small', { text: 'Stok' }), h('span', { text: p.stock == null ? '-' : nf(p.stock) })),
        h('div', { class: 'sp-col' }, h('small', { text: 'Kategori' }), h('span', { text: p.categories.map((c) => catName.get(c)).filter(Boolean).join(', ') || '-' })),
        h('div', { class: 'sp-col sp-col-num' }, h('small', { text: 'Harga' }), h('span', { text: rp(p.priceMin) })))),
      data.products.length ? null : h('div', { class: 'empty', text: 'Katalog ini belum berisi produk. Klik "Tambah produk".' }));
    }
    draw();
  }

  // ================================================================ Bundle
  async function viewBundles() {
    const { content } = frame({ sub: 'bundles', title: 'Bundle', tools: [btn('Bundle Produk', () => { location.href = '/admin/bundles/new'; }, 'btn-primary', 'plus')] });
    let data = await run(() => api('GET', '/admin/api/shop/bundles'));
    if (!data) return;
    const listEl = h('div', { class: 'sp-list' });
    content.append(h('p', { class: 'fine', text: 'Bundle = paket beberapa produk dengan jumlah tertentu (mis. Endorsement Bundle).' }), listEl);
    const reload = async () => { const out = await run(() => api('GET', '/admin/api/shop/bundles')); if (out) { data = out; draw(); } };
    function draw() {
      put(listEl, ...data.bundles.map((b) => h('div', { class: 'sp-row' },
        h('div', { class: 'sp-main' },
          h('a', { class: 'sp-name', href: `/admin/bundles/${b.id}`, text: b.name }),
          b.hidden ? h('span', { class: 'sp-vis sp-vis-hidden' }, icon('eyeOff'), 'Tersembunyi') : null,
          actionLinks([
            ['Edit', null, '', `/admin/bundles/${b.id}`],
            ['Duplikat', async () => { const out = await run(() => api('POST', `/admin/api/shop/bundles/${b.id}/duplicate`), 'Bundle diduplikat.'); if (out) reload(); }],
            ['Hapus', async () => { if (await confirmBox(`Hapus bundle "${b.name}"?`, { ok: 'Hapus', danger: true })) { const out = await run(() => api('DELETE', `/admin/api/shop/bundles/${b.id}`), 'Bundle dihapus.'); if (out) reload(); } }, 'danger'],
          ])),
        h('div', { class: 'sp-col sp-col-num' }, h('small', { text: 'Isi' }), h('span', { text: `${nf(b.groups.reduce((a, g) => a + g.items.length, 0))} produk` })),
        h('div', { class: 'sp-col sp-col-num' }, h('small', { text: b.priceType === 'fixed' ? 'Harga tetap' : 'Total harga' }), h('span', { text: rp(b.total) })))),
      data.bundles.length ? null : h('div', { class: 'empty', text: 'Belum ada bundle.' }));
    }
    draw();
  }

  async function viewBundleEdit() {
    const isNew = !ID;
    const { content, appbar } = frame({ sub: 'bundles', title: isNew ? 'Bundle / Baru' : 'Bundle / Edit' });
    const data = isNew ? { bundle: { name: '', groups: [{ name: '', optional: false, items: [] }], priceType: 'sum', price: 0, hidden: false, tags: [], note: '' }, products: [] }
      : await run(() => api('GET', `/admin/api/shop/bundles/${ID}`));
    if (!data) return;
    const b = structuredClone(data.bundle);
    const prod = new Map(data.products.map((p) => [p.id, p]));
    let dirty = false;
    const markDirty = () => { dirty = true; drawTotal(); };
    addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    const name = h('input', { type: 'text', class: 'input', value: b.name, maxlength: 120, oninput: () => { b.name = name.value; markDirty(); } });
    const groupsEl = h('div', { class: 'sp-groups' });
    const totalEl = h('p', { class: 'sp-total-line' });
    const priceType = h('select', { class: 'input', onchange: () => { b.priceType = priceType.value; fixedBox.hidden = b.priceType !== 'fixed'; markDirty(); } },
      h('option', { value: 'sum', text: 'Total Jumlah', selected: b.priceType === 'sum' }), h('option', { value: 'fixed', text: 'Harga Tetap', selected: b.priceType === 'fixed' }));
    const fixed = h('input', { type: 'text', class: 'input', inputmode: 'numeric', value: b.price ? nf(b.price) : '', oninput: () => { const d = fixed.value.replace(/\D/g, ''); fixed.value = d ? nf(Number(d)) : ''; b.price = Number(d || 0); markDirty(); } });
    const fixedBox = field('Harga bundle (Rp)', fixed);
    fixedBox.hidden = b.priceType !== 'fixed';
    const hidden = h('input', { type: 'checkbox', checked: b.hidden, onchange: () => { b.hidden = hidden.checked; markDirty(); } });
    const tags = tagInput(b.tags, 'Natal, lebaran, tahun baru');
    const note = h('textarea', { class: 'input sp-note', rows: 5, maxlength: 5000, placeholder: 'Tambahkan catatan kamu di sini', oninput: () => { b.note = note.value; markDirty(); } });
    note.value = b.note || '';

    function unitPrice(it) {
      const p = prod.get(it.pid);
      if (!p) return 0;
      const v = it.vid && p.variantList ? p.variantList.find((x) => x.id === it.vid) : null;
      return v ? v.price : p.priceMin;
    }
    function drawTotal() {
      const sum = b.groups.filter((g) => !g.optional).reduce((a, g) => a + g.items.reduce((s, it) => s + unitPrice(it) * it.qty, 0), 0);
      put(totalEl, 'Total harga isi (grup tidak opsional): ', h('b', { text: rp(sum) }), b.priceType === 'fixed' ? ` · dijual ${rp(b.price)}` : '');
    }
    async function addProducts(g) {
      const picked = await pickProducts({ title: 'Tambah produk ke grup', exclude: g.items.map((it) => it.pid) });
      if (!picked.length) return;
      // variant lists come with the bundle payload; refetch summaries for new picks
      const full = await run(() => api('GET', '/admin/api/shop/products'));
      for (const p of picked) {
        if (!prod.has(p.id)) {
          const detail = await run(() => api('GET', `/admin/api/shop/products/${p.id}`));
          const vl = detail && detail.product.variants ? detail.product.variants.items.map((v) => ({ id: v.id, label: v.values.join(' / '), price: v.price })) : [];
          prod.set(p.id, { ...((full && full.products.find((x) => x.id === p.id)) || p), variantList: vl });
        }
        const vl = prod.get(p.id).variantList || [];
        g.items.push({ pid: p.id, vid: vl[0] ? vl[0].id : null, rename: '', qty: 1 });
      }
      markDirty();
      drawGroups();
    }
    function drawGroups() {
      put(groupsEl, ...b.groups.map((g, gi) => {
        const gName = h('input', { type: 'text', class: 'input', value: g.name, maxlength: 120, placeholder: 'Nama grup', oninput: () => { g.name = gName.value; markDirty(); } });
        const opt = h('select', { class: 'input', onchange: () => { g.optional = opt.value === '1'; markDirty(); } },
          h('option', { value: '0', text: 'Tidak Opsional', selected: !g.optional }), h('option', { value: '1', text: 'Opsional', selected: g.optional }));
        return h('section', { class: 'panel sp-group' },
          h('div', { class: 'sp-group-head' },
            field('Nama Grup', gName), field('Opsional', opt),
            iconBtn('up', 'Naikkan grup', () => { if (gi) { [b.groups[gi - 1], b.groups[gi]] = [b.groups[gi], b.groups[gi - 1]]; markDirty(); drawGroups(); } }, { attrs: { disabled: gi === 0 } }),
            iconBtn('x', 'Hapus grup', async () => { if (!g.items.length || await confirmBox(`Hapus grup "${g.name || 'tanpa nama'}"?`, { ok: 'Hapus', danger: true })) { b.groups.splice(gi, 1); markDirty(); drawGroups(); } })),
          h('div', { class: 'sp-gitems' }, g.items.map((it, ii) => {
            const p = prod.get(it.pid) || { name: '(produk dihapus)', image: null, variantList: [] };
            const rename = h('input', { type: 'text', class: 'input', value: it.rename, maxlength: 120, placeholder: 'Ubah nama (opsional)', oninput: () => { it.rename = rename.value; markDirty(); } });
            const qty = stepper(it.qty, { min: 1, onchange: (v) => { it.qty = Math.max(1, v || 1); markDirty(); } });
            const vsel = p.variantList && p.variantList.length ? h('select', { class: 'input', onchange: () => { it.vid = vsel.value; markDirty(); } },
              p.variantList.map((v) => h('option', { value: v.id, text: v.label, selected: v.id === it.vid }))) : null;
            return h('div', { class: 'sp-gitem' },
              h('div', { class: 'sp-cell' }, thumb(imgUrl(p.image)), h('span', {}, h('b', { text: p.name }), vsel || h('small', { class: 'muted', text: 'Tidak Ada Variasi' }))),
              field('Ubah Nama', rename), field('Jumlah', qty.el),
              iconBtn('x', 'Keluarkan', () => { g.items.splice(ii, 1); markDirty(); drawGroups(); }));
          })),
          btn('Tambah produk', () => addProducts(g), 'btn-sm', 'plus'));
      }), btn('Grup', () => { b.groups.push({ name: '', optional: false, items: [] }); markDirty(); drawGroups(); }, '', 'plus'));
      drawTotal();
    }
    drawGroups();

    async function save() {
      if (!b.name.trim()) { toast('Nama bundle wajib diisi.', 'error'); name.focus(); return; }
      b.tags = tags.get();
      const out = await run(() => api(isNew ? 'POST' : 'PUT', isNew ? '/admin/api/shop/bundles' : `/admin/api/shop/bundles/${ID}`, b));
      if (!out) return;
      dirty = false;
      toast('Bundle disimpan.');
      if (isNew) location.href = `/admin/bundles/${out.bundle.id}`;
    }
    appbar.querySelector('.tools').prepend(btn('Kembali', () => { location.href = '/admin/bundles'; }), btn('Simpan', save, 'btn-primary', 'check'));
    document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });
    const card = (title, ...kids) => h('section', { class: 'panel sp-card' }, h('div', { class: 'panel-head' }, h('h2', { text: title })), h('div', { class: 'sp-card-body' }, ...kids));
    content.append(h('div', { class: 'sp-edit' },
      h('div', { class: 'sp-edit-main' }, card('Bundle', field('Nama Bundle', name), totalEl), groupsEl),
      h('aside', { class: 'sp-edit-side' },
        card('Harga', field('Tipe Harga', priceType), fixedBox),
        card('Visibilitas', h('label', { class: 'check' }, hidden, 'Tersembunyi')),
        card('Penyusunan', field('Tags', tags.el), field('Catatan', note)))));
  }

  // ================================================================ Diskon
  const DISC_STATUS = { active: 'Aktif', scheduled: 'Terjadwal', ended: 'Berakhir', off: 'Nonaktif' };
  const DISC_TONE = { active: 'ok', scheduled: 'info', ended: 'muted', off: 'warn' };
  const discValue = (d) => (d.type === 'product_percent' || d.type === 'shipping_percent' ? `${d.value}%` : d.type === 'free_shipping' || d.type === 'free_product' ? '' : rp(d.value));

  async function viewDiscounts() {
    const state = { tab: qs.get('status') || 'all', q: '', shown: 100 };
    const importDiscounts = () => {
      const file = h('input', { type: 'file', accept: '.json,application/json' });
      const onlyActive = h('input', { type: 'checkbox', checked: true });
      const mode = h('select', { class: 'input' }, h('option', { value: 'skip', text: 'Lewati (jangan ubah yang sudah ada)' }), h('option', { value: 'update', text: 'Perbarui dengan data Berdu' }));
      const result = h('div', { class: 'sp-import-status' });
      const go = async () => {
        if (!file.files[0]) { toast('Pilih file dulu.', 'error'); return; }
        const fd = new FormData();
        fd.append('onlyActive', String(onlyActive.checked));
        fd.append('mode', mode.value);
        fd.append('file', file.files[0]);
        const out = await run(() => api('POST', '/admin/api/shop/discounts/import', fd));
        if (!out) return;
        put(result, h('p', {}, h('b', { text: 'Selesai. ' }), `${nf(out.created)} diskon baru, ${nf(out.updated)} diperbarui, ${nf(out.skipped)} dilewati${out.ended ? `, ${nf(out.ended)} sudah berakhir tidak diimpor` : ''}.`),
          out.warnings.length ? h('details', { class: 'sp-import-log', open: true }, h('summary', { text: `${out.warnings.length} catatan` }), h('ul', {}, out.warnings.map((w) => h('li', { text: w })))) : null);
        reload();
      };
      dialog({ title: 'Import diskon dari Berdu', size: 'lg',
        body: h('div', {}, h('p', { class: 'fine', text: 'Pilih file export diskon Berdu (.json). Produk dicocokkan dengan produk yang sudah diimpor dari Berdu. Pemakaian kupon dihitung ulang dari nol di sistem ini.' }),
          field('File export', file), h('label', { class: 'check' }, onlyActive, 'Hanya diskon yang masih aktif'), field('Diskon yang sudah pernah diimpor', mode), result),
        foot: [btn('Mulai import', go, 'btn-primary', 'importIc')] });
    };
    const { content } = layout({ active: 'diskon', title: 'Diskon', tools: [btn('Import', importDiscounts, '', 'importIc'), btn('Diskon', () => { location.href = '/admin/discounts/new'; }, 'btn-primary', 'plus')] });
    let data = await run(() => api('GET', '/admin/api/shop/discounts'));
    if (!data) return;
    const tabsEl = h('div', { class: 'sp-tabs', role: 'tablist' });
    const listEl = h('div', { class: 'sp-list' });
    const totalEl = h('span', { class: 'sp-total' });
    content.append(h('p', { class: 'fine', text: 'Diskon otomatis (tanpa kode) dipakai sendiri bila syaratnya terpenuhi; diskon berkode dipakai saat pembeli memasukkan kodenya. Satu order memakai satu diskon.' }),
      h('div', { class: 'sp-toolbar' }, searchBox('', (v) => { state.q = v; state.shown = 100; draw(); }, 'Cari nama, kode atau tag'), totalEl), tabsEl, listEl);
    const reload = async () => { const out = await run(() => api('GET', '/admin/api/shop/discounts')); if (out) { data = out; draw(); } };
    function draw() {
      const s = state.q.toLowerCase();
      const base = data.discounts.filter((d) => !s || d.name.toLowerCase().includes(s) || d.code.toLowerCase().includes(s) || d.tags.some((t) => t.toLowerCase().includes(s)));
      const count = (t) => (t === 'all' ? base.length : base.filter((d) => d.status === t).length);
      put(tabsEl, [['all', 'Semua'], ...Object.entries(DISC_STATUS)].map(([t, label]) => h('button', { type: 'button', role: 'tab', class: 'sp-tab', 'aria-selected': String(state.tab === t),
        onclick: () => { state.tab = t; state.shown = 100; setQuery({ status: t === 'all' ? '' : t }); draw(); } }, label, h('span', { class: 'sp-count', text: nf(count(t)) }))));
      const rows = base.filter((d) => state.tab === 'all' || d.status === state.tab);
      put(totalEl, h('b', { text: nf(rows.length) }), ' diskon');
      put(listEl, rows.length ? rows.slice(0, state.shown).map((d) => h('div', { class: 'sp-row sp-drow' },
        h('div', { class: 'sp-main' },
          h('a', { class: 'sp-name', href: `/admin/discounts/${d.id}`, text: d.name }),
          h('span', { class: `sp-st sp-st-${DISC_TONE[d.status]}`, text: DISC_STATUS[d.status] }),
          actionLinks([
            ['Edit', null, '', `/admin/discounts/${d.id}`],
            ['Laporan', null, '', `/admin/discounts/${d.id}?tab=laporan`],
            ['Duplikat', async () => { const out = await run(() => api('POST', `/admin/api/shop/discounts/${d.id}/duplicate`), 'Diskon diduplikat (nonaktif).'); if (out) reload(); }],
            ['Hapus', async () => { if (await confirmBox(`Hapus diskon "${d.name}"?`, { ok: 'Hapus', danger: true })) { const out = await run(() => api('DELETE', `/admin/api/shop/discounts/${d.id}`), 'Diskon dihapus.'); if (out) reload(); } }, 'danger'],
          ])),
        h('div', { class: 'sp-col' }, h('small', { text: 'Kode' }), h('span', { class: 'sp-code', text: d.code || 'Otomatis' })),
        h('div', { class: 'sp-col' }, h('small', { text: 'Tipe' }), h('span', { text: [data.types[d.type], discValue(d)].filter(Boolean).join(' · ') })),
        h('div', { class: 'sp-col' }, h('small', { text: 'Periode' }), h('span', { text: d.start || d.end ? `${d.start ? wib(d.start) : '…'} – ${d.end ? wib(d.end) : 'seterusnya'}` : 'Tanpa batas' })),
        h('div', { class: 'sp-col sp-col-num' }, h('small', { text: 'Dipakai' }), h('span', { text: d.maxUses ? `${nf(d.used)} / ${nf(d.maxUses)}` : nf(d.used) }))))
        : [h('div', { class: 'empty', text: data.discounts.length ? 'Tidak ada diskon yang cocok.' : 'Belum ada diskon. Klik "+ Diskon".' })],
      rows.length > state.shown ? h('div', { class: 'sp-more' }, btn(`Tampilkan lebih banyak (${nf(rows.length - state.shown)} lagi)`, () => { state.shown += 200; draw(); })) : null);
    }
    draw();
  }

  async function viewDiscountEdit() {
    const isNew = !ID;
    const { content, appbar } = layout({ active: 'diskon', title: isNew ? 'Diskon / Baru' : 'Diskon / Edit' });
    const data = isNew ? { ...(await run(() => api('GET', '/admin/api/shop/categories'))), types: null, products: [] } : await run(() => api('GET', `/admin/api/shop/discounts/${ID}`));
    if (!data || !data.categories) return;
    const TYPES = data.types || { order_amount: 'Potongan Harga', product_percent: '% Diskon Produk', product_amount: 'Potongan Harga per Produk', free_product: 'Dapat produk gratis', free_shipping: 'Gratis Ongkir', shipping_amount: 'Potongan Ongkir', shipping_percent: '% Diskon Ongkir' };
    const d = data.discount ? structuredClone(data.discount) : {
      name: '', type: 'order_amount', value: 0, maxShippingOff: 0, gift: null,
      conditions: { total: false, minTotal: 0, maxTotal: 0, customers: false, phones: [], products: false, by: 'product', productIds: [], categoryIds: [], payment: false, methods: [], qty: false, minQty: 0, maxQty: 0 },
      schedule: { start: new Date().toISOString(), end: '', noEnd: true }, coupon: { use: false, code: '' }, limits: { maxUses: 0, perCustomer: 0 }, tags: [], note: '', disabled: false,
    };
    const prod = new Map(data.products.map((p) => [p.id, p]));
    if (!isNew) appbar.querySelector('h1').textContent = `Diskon / ${d.name}`;
    const tab = qs.get('tab') === 'laporan' && !isNew ? 'laporan' : 'edit';
    let dirty = false;
    const markDirty = () => { dirty = true; };
    addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
    const card = (title, ic, ...kids) => h('details', { class: 'panel sp-card', open: true }, h('summary', { class: 'panel-head' }, h('h2', {}, ic ? icon(ic) : null, title)), h('div', { class: 'sp-card-body' }, ...kids));
    const moneyIn = (obj, key, ph = '0') => h('div', { class: 'sp-money' }, h('span', { text: 'Rp' }), h('input', { type: 'text', inputmode: 'numeric', class: 'input', value: obj[key] ? nf(obj[key]) : '', placeholder: ph,
      oninput: (e) => { const v = e.target.value.replace(/\D/g, ''); e.target.value = v ? nf(Number(v)) : ''; obj[key] = Number(v || 0); markDirty(); } }));
    const numIn = (obj, key, ph = '0') => h('input', { type: 'number', min: 0, class: 'input', value: obj[key] || '', placeholder: ph, oninput: (e) => { obj[key] = Number(e.target.value || 0); markDirty(); } });

    if (!isNew) {
      content.append(h('div', { class: 'sp-tabs', role: 'tablist' }, [['edit', 'Pengaturan'], ['laporan', 'Laporan']].map(([k, label]) =>
        h('a', { class: 'sp-tab', role: 'tab', href: k === 'edit' ? `/admin/discounts/${ID}` : `?tab=${k}`, 'aria-selected': String(tab === k), text: label }))));
    }
    if (tab === 'laporan') {
      const r = data.report;
      content.append(h('div', { class: 'sp-kpis' },
        [['Order memakai diskon', nf(r.orders)], ['Order terbayar', nf(r.paid)], ['Total potongan', rp(r.discount)], ['Omzet terbayar', rp(r.revenue)]].map(([k, v]) => h('section', { class: 'panel sp-kpi' }, h('small', { text: k }), h('b', { text: v })))),
      h('h3', { class: 'sp-h3', text: 'Order' }), orderList(r.list, data.statuses));
      return;
    }

    // ---- main
    const name = h('input', { type: 'text', class: 'input', value: d.name, maxlength: 160, oninput: () => { d.name = name.value; markDirty(); } });
    const type = h('select', { class: 'input', onchange: () => { d.type = type.value; markDirty(); drawValue(); } }, Object.entries(TYPES).map(([k, v]) => h('option', { value: k, text: v, selected: d.type === k })));
    const valueBox = h('div');
    function drawValue() {
      const t = d.type;
      if (t === 'product_percent' || t === 'shipping_percent') {
        put(valueBox, field(t === 'product_percent' ? 'Persentase diskon produk' : 'Persentase diskon ongkir', h('div', { class: 'sp-withunit' }, numIn(d, 'value'), h('span', { text: '%' }))));
      } else if (t === 'free_shipping') {
        put(valueBox, field('Potongan ongkir maksimal', moneyIn(d, 'maxShippingOff', 'Kosong = gratis penuh')));
      } else if (t === 'free_product') {
        d.gift ||= { pid: '', vid: null, qty: 1 };
        const gp = prod.get(d.gift.pid);
        const vsel = gp && gp.variantList && gp.variantList.length ? h('select', { class: 'input', onchange: (e) => { d.gift.vid = e.target.value || null; markDirty(); } },
          h('option', { value: '', text: 'Bebas (stok bersama)' }), gp.variantList.map((v) => h('option', { value: v.id, text: v.label, selected: d.gift.vid === v.id }))) : null;
        const same = d.gift.pid === 'same';
        put(valueBox, h('div', { class: 'field' }, h('span', { text: 'Produk hadiah' }),
          h('label', { class: 'check sp-check-sm' }, h('input', { type: 'checkbox', checked: same, onchange: (e) => { d.gift.pid = e.target.checked ? 'same' : ''; d.gift.vid = null; markDirty(); drawValue(); } }), 'Sama dengan produk yang dibeli (beli X gratis N)'),
          same ? null : gp ? h('div', { class: 'sp-cell sp-gift' }, thumb(imgUrl(gp.image)), h('span', {}, h('b', { text: gp.name }), vsel)) : h('p', { class: 'fine', text: 'Belum dipilih.' }),
          h('div', { class: 'row-tight' },
            same ? null : btn(gp ? 'Ganti produk' : 'Pilih produk', async () => {
              const [pick] = await pickProducts({ title: 'Pilih produk hadiah', multiple: false });
              if (!pick) return;
              const detail = await run(() => api('GET', `/admin/api/shop/products/${pick.id}`));
              prod.set(pick.id, { ...pick, variantList: detail && detail.product.variants && detail.product.variants.stockAxis ? detail.product.variants.options.find((g) => g.id === detail.product.variants.stockAxis).values.map((v) => ({ id: `${detail.product.variants.stockAxis}:${v.id}`, label: v.name })) : [] });
              d.gift = { pid: pick.id, vid: null, qty: d.gift.qty || 1 };
              markDirty();
              drawValue();
            }, 'btn-sm', 'plus'),
            h('label', { class: 'sp-mini' }, h('span', { text: 'Jumlah' }), numIn(d.gift, 'qty', '1')))));
      } else {
        put(valueBox, field(t === 'product_amount' ? 'Potongan per produk' : t === 'shipping_amount' ? 'Potongan ongkir' : 'Potongan harga', moneyIn(d, 'value')));
      }
    }
    drawValue();

    const c = d.conditions;
    const condBox = h('div', { class: 'sp-conds' });
    const prodList = h('div', { class: 'sp-gitems' });
    function drawProducts() {
      if (c.by === 'category') {
        put(prodList, h('div', { class: 'sp-catlist' }, data.categories.map((cat) => h('label', { class: 'check sp-check-sm' },
          h('input', { type: 'checkbox', checked: c.categoryIds.includes(cat.id), onchange: (e) => { c.categoryIds = e.target.checked ? [...c.categoryIds, cat.id] : c.categoryIds.filter((x) => x !== cat.id); markDirty(); } }), cat.name))));
        return;
      }
      put(prodList, c.productIds.map((id, i) => {
        const p = prod.get(id) || { name: '(produk dihapus)', image: null };
        return h('div', { class: 'sp-gitem sp-pitem' }, h('div', { class: 'sp-cell' }, thumb(imgUrl(p.image)), h('span', { text: p.name })),
          iconBtn('x', 'Keluarkan', () => { c.productIds.splice(i, 1); markDirty(); drawProducts(); }));
      }), btn('Tambah produk', async () => {
        const picked = await pickProducts({ title: 'Produk yang mendapat diskon', exclude: c.productIds });
        for (const p of picked) { prod.set(p.id, p); c.productIds.push(p.id); }
        if (picked.length) { markDirty(); drawProducts(); }
      }, 'btn-sm', 'plus'));
    }
    c.regions ||= [];
    const regionBox = h('div', { class: 'sp-catlist sp-regions' }, h('p', { class: 'fine', text: 'Memuat provinsi…' }));
    fetch('/assets/wilayah/provinsi.json').then((r) => r.json()).then((list) => {
      const cities = c.regions.filter((x) => x.includes('.'));
      put(regionBox, list.map(([code, nm]) => h('label', { class: 'check sp-check-sm' },
        h('input', { type: 'checkbox', checked: c.regions.includes(code), onchange: (e) => { c.regions = e.target.checked ? [...c.regions, code] : c.regions.filter((x) => x !== code); markDirty(); } }), nm)),
      cities.length ? h('p', { class: 'fine', text: `Juga ${cities.length} kota/kabupaten tertentu.` }) : null);
    }).catch(() => {});
    function drawConds() {
      const toggle =(key, label) => h('label', { class: 'check sp-check-sm' }, h('input', { type: 'checkbox', checked: c[key], onchange: (e) => { c[key] = e.target.checked; markDirty(); drawConds(); } }), label);
      const phones = h('textarea', { class: 'input sp-note', rows: 4, placeholder: 'Satu nomor WhatsApp per baris (08… atau 62…)', oninput: (e) => { c.phones = e.target.value.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean); markDirty(); } });
      phones.value = c.phones.join('\n');
      const by = h('select', { class: 'input', onchange: (e) => { c.by = e.target.value; markDirty(); drawProducts(); } }, h('option', { value: 'product', text: 'Produk', selected: c.by !== 'category' }), h('option', { value: 'category', text: 'Kategori Produk', selected: c.by === 'category' }));
      put(condBox,
        h('div', { class: 'sp-condtoggles' }, toggle('total', 'Total Pembelian'), toggle('customers', 'Pelanggan Terpilih'), toggle('products', 'Produk Terpilih'), toggle('payment', 'Metode Pembayaran'), toggle('qty', 'Kuantitas'), toggle('locations', 'Lokasi Pengiriman')),
        c.locations ? h('div', { class: 'field' }, h('span', {}, 'Provinsi tujuan', h('span', { class: 'hint', text: ` (${(c.regions || []).length} dipilih)` })), regionBox) : null,
        c.total ? h('div', { class: 'sp-two' }, field('Pembelian di atas', moneyIn(c, 'minTotal')), field('Pembelian di bawah', moneyIn(c, 'maxTotal', 'Kosong = tanpa batas'))) : null,
        c.customers ? field('Nomor WhatsApp pelanggan', phones, `(${c.phones.length} nomor)`) : null,
        c.products ? h('div', {}, h('h3', { class: 'sp-h3', text: 'Produk Terpilih' }), field('Seleksi berdasarkan', by), prodList) : null,
        c.payment ? h('div', {}, h('label', { class: 'check sp-check-sm' }, h('input', { type: 'checkbox', checked: c.methods.includes('transfer'), onchange: (e) => { c.methods = e.target.checked ? ['transfer'] : []; markDirty(); } }), 'Transfer bank'),
          h('p', { class: 'fine', text: 'Metode lain muncul setelah payment gateway/COD ditambahkan.' })) : null,
        c.qty ? h('div', { class: 'sp-two' }, field('Min Kuantitas', numIn(c, 'minQty')), field('Max Kuantitas', numIn(c, 'maxQty', 'Kosong = tanpa batas'))) : null);
      if (c.products) drawProducts();
    }
    drawConds();

    // ---- side
    const toLocal = (iso) => (iso ? new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 16) : '');
    const start = h('input', { type: 'datetime-local', class: 'input', value: toLocal(d.schedule.start), onchange: (e) => { d.schedule.start = e.target.value ? `${e.target.value}:00+07:00` : ''; markDirty(); } });
    const end = h('input', { type: 'datetime-local', class: 'input', value: toLocal(d.schedule.end), disabled: d.schedule.noEnd, onchange: (e) => { d.schedule.end = e.target.value ? `${e.target.value}:00+07:00` : ''; markDirty(); } });
    const noEnd = h('input', { type: 'checkbox', checked: d.schedule.noEnd, onchange: (e) => { d.schedule.noEnd = e.target.checked; end.disabled = e.target.checked; markDirty(); } });
    const codeIn = h('input', { type: 'text', class: 'input', value: d.coupon.code, maxlength: 40, placeholder: '#KODEPROMO', disabled: !d.coupon.use, oninput: (e) => { d.coupon.code = e.target.value.toUpperCase(); e.target.value = d.coupon.code; markDirty(); } });
    const useCode = h('input', { type: 'checkbox', checked: d.coupon.use, onchange: (e) => { d.coupon.use = e.target.checked; codeIn.disabled = !e.target.checked; markDirty(); } });
    const tags = tagInput(d.tags, 'Natal, lebaran, tahun baru');
    const note = h('textarea', { class: 'input sp-note', rows: 4, maxlength: 5000, placeholder: 'Tambahkan catatan kamu di sini', oninput: (e) => { d.note = e.target.value; markDirty(); } });
    note.value = d.note || '';
    const disabled = h('input', { type: 'checkbox', checked: d.disabled, onchange: (e) => { d.disabled = e.target.checked; markDirty(); } });

    async function save() {
      d.tags = tags.get();
      const out = await run(() => api(isNew ? 'POST' : 'PUT', isNew ? '/admin/api/shop/discounts' : `/admin/api/shop/discounts/${ID}`, d));
      if (!out) return;
      dirty = false;
      toast('Diskon disimpan.');
      if (isNew) location.href = `/admin/discounts/${out.discount.id}`;
    }
    appbar.querySelector('.tools').prepend(btn('Kembali', () => { location.href = '/admin/discounts'; }), btn('Simpan', save, 'btn-primary', 'check'));
    document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });
    content.append(h('div', { class: 'sp-edit' },
      h('div', { class: 'sp-edit-main' },
        h('section', { class: 'panel sp-card-flat' },
          field('Nama Diskon', name),
          h('div', { class: 'sp-two' }, field('Tipe Diskon', type), valueBox),
          h('h3', { class: 'sp-h3', text: 'Batasi dengan Kondisi' }), condBox)),
      h('aside', { class: 'sp-edit-side' },
        card('Jadwal', 'clock', field('Mulai (WIB)', start), field('Akhir (WIB)', end), h('label', { class: 'check sp-check-sm' }, noEnd, 'Tidak ada batas waktu'),
          h('label', { class: 'check sp-check-sm' }, disabled, 'Nonaktifkan diskon ini')),
        card('Kode Kupon', 'tag', h('label', { class: 'check sp-check-sm' }, useCode, 'Gunakan Kode Kupon'), field('Kode Kupon', codeIn),
          h('p', { class: 'fine', text: 'Tanpa kode: diskon otomatis dipakai bila syarat terpenuhi.' })),
        card('Kuantitas', 'box', field('Penggunaan Maksimal', numIn(d.limits, 'maxUses', 'Kosong = tanpa batas')), field('Maksimal per Pelanggan', numIn(d.limits, 'perCustomer', 'Kosong = tanpa batas'))),
        card('Penyusunan', 'folder', field('Tags', tags.el), field('Catatan', note)))));
  }

  ({
    'shop-products': viewProducts, 'shop-product-edit': viewProductEdit, 'shop-product': viewProduct, 'shop-stock': viewStock,
    'shop-categories': viewCategories, 'shop-catalogs': viewCatalogs, 'shop-catalog': viewCatalog, 'shop-bundles': viewBundles, 'shop-bundle-edit': viewBundleEdit,
    'shop-orders': viewOrders, 'shop-order': viewOrder, 'shop-settings': viewSettings,
    'shop-discounts': viewDiscounts, 'shop-discount-edit': viewDiscountEdit,
  })[VIEW]?.();
})();
