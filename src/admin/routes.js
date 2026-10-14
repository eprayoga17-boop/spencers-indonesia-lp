// Admin area mounted at /admin: login, pages (templates), draft editor API (undo/redo, publish),
// history, export/import and audit log.
import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { fs, saveUpload, uploadExists } from '../storage.js';
import path from 'node:path';
import {
  ROOT, getPage, listPages, listSlugs, savePage, createPage, archivePage, listHistory, readHistory, readHistoryMany, renamePage, getRedirects,
  withPageLock, isValidSlug, newSectionId,
} from '../store.js';
import { getGlobal, saveGlobal, normalizeGlobal, FONTS, WIDTHS } from '../global.js';
import { openDraft, pushState, step, markSaved, moveDraft, discardDraft, readMetas, info } from '../drafts.js';
import {
  authenticate, isLocked, createSession, destroySession, getSession, requireAdmin, requireCsrf, audit, readAudit, pruneAudit,
} from './security.js';
import { sanitizeSection } from './sanitize.js';
import { processImage, UserError } from './media.js';
import { exportCode, importCode } from './transfer.js';
import { renderPage } from '../render.js';
import * as promos from '../promos.js';
import * as analytics from '../analytics.js';
import { createLink, phoneBase } from '../preview-links.js';
import QRCode from 'qrcode';

const MAX_HTML_BYTES = 1024 * 1024;
const ASSET_V = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 10) || Date.now().toString(36); // cache-busting for admin assets per server start
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const httpError = (status, message, extra) => Object.assign(new Error(message), { status, expose: true, ...extra });
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const toNum = (v, min, max, d = 0) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Math.min(max, Math.max(min, Number(v))) : d);
const safeHref = (v) => {
  const h = clip(v, 1000);
  return /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(h) ? h : '';
};
const uploadUrl = (v) => (typeof v === 'string' && /^\/uploads\/[\w./-]+$/.test(v) && !v.includes('..') ? v : '');
const scopeSelector = (key) => `.lp-sec[data-s="${key}"]`;
const newScope = () => crypto.randomBytes(5).toString('hex');
const SLUG_HELP = 'Link hanya boleh huruf kecil, angka dan tanda minus (contoh: promo-ramadan). Beberapa kata dicadangkan.';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 40, fields: 30, fieldSize: MAX_HTML_BYTES + 1024, parts: 80 },
  fileFilter(req, file, cb) {
    const okImage = /^image\//.test(file.mimetype) && file.mimetype !== 'image/svg+xml';
    const okHtml = file.fieldname === 'htmlFile' && /\.html?$/i.test(file.originalname);
    if ((file.fieldname === 'htmlFile' && okHtml) || (file.fieldname !== 'htmlFile' && okImage)) return cb(null, true);
    cb(new UserError(file.fieldname === 'htmlFile' ? 'File HTML harus berekstensi .html' : `File "${file.originalname}" bukan gambar (SVG tidak diizinkan).`));
  },
}).fields([{ name: 'images', maxCount: 30 }, { name: 'htmlFile', maxCount: 1 }, { name: 'assets', maxCount: 30 }]);

const withUpload = (req, res, next) =>
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 15 MB.' : err.code === 'LIMIT_FILE_COUNT' ? 'Terlalu banyak file sekaligus.' : 'Upload tidak valid.';
      return next(httpError(413, msg));
    }
    next(err);
  });

// ---------------------------------------------------------------- section builders
function parseJsonField(v, fallback) {
  if (v == null || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    throw httpError(400, 'Data tidak valid.');
  }
}

/** entries: [{ keep: index } | { file: index }, alt, href] → items */
async function buildImageItems(sectionId, entries, files, oldItems = []) {
  if (!Array.isArray(entries)) throw httpError(400, 'Data gambar tidak valid.');
  const items = [];
  for (const e of entries.slice(0, 40)) {
    let item;
    if (Number.isInteger(e.keep) && oldItems[e.keep]) item = { ...oldItems[e.keep] };
    else if (Number.isInteger(e.file) && files[e.file]) {
      const img = await processImage(files[e.file].buffer, sectionId);
      const prev = Number.isInteger(e.replaces) ? oldItems[e.replaces] : null;
      item = { ...img, ...(prev && prev.mt ? { mt: prev.mt } : {}) };
    } else continue;
    item.alt = clip(e.alt ?? item.alt, 300);
    const href = safeHref(e.href ?? item.href);
    if (href) item.href = href; else delete item.href;
    items.push(item);
  }
  if (!items.length) throw new UserError('Tambahkan minimal satu gambar.');
  return items;
}

function applySliderBox(sec) {
  if (sec.layout !== 'slider') return;
  sec.slider = sec.slider || { transition: 'slide', interval: 5000, dots: 'square-dark', arrows: true };
  if (sec.items.every((it) => it.iw && it.ih)) {
    const h = Math.max(...sec.items.map((it) => (320 * it.ih) / it.iw));
    sec.box = { w: 320, h: Math.round(h), mt: (sec.box && sec.box.mt) || 0 };
    delete sec.slideBox;
  }
}

async function buildHtml(sec, { code, htmlFile, assets }) {
  let input = code;
  if (htmlFile) {
    if (htmlFile.size > MAX_HTML_BYTES) throw new UserError('File HTML maksimal 1 MB.');
    input = htmlFile.buffer.toString('utf8');
  }
  if (typeof input !== 'string' || !input.trim()) throw new UserError('Isi HTML kosong. Upload file .html atau tempel kodenya.');
  if (Buffer.byteLength(input) > MAX_HTML_BYTES) throw new UserError('HTML maksimal 1 MB.');
  const map = new Map();
  for (const f of assets || []) {
    const img = await processImage(f.buffer, sec.id);
    map.set(path.basename(f.originalname).toLowerCase(), { url: `${img.src}.${img.ext || 'webp'}` });
  }
  sec.scope = sec.scope || newScope();
  const out = sanitizeSection(input, { scope: scopeSelector(sec.scope), assets: map });
  if (!out.html.trim()) throw new UserError('Setelah dibersihkan, HTML tidak berisi konten yang bisa ditampilkan.');
  sec.html = out.html;
  sec.source = out.source;
  return out.removed;
}

/** A copy of a section that can live next to the original (own id, own CSS scope). */
function cloneSection(page, sec, nameSuffix = '') {
  const copy = structuredClone(sec);
  copy.id = newSectionId(page, copy.id.replace(/-\d+$/, ''));
  if (nameSuffix) copy.name = `${copy.name}${nameSuffix}`.slice(0, 120);
  if (copy.type === 'html' && copy.scope) {
    copy.scope = newScope();
    copy.html = sanitizeSection(copy.source ?? copy.html, { scope: scopeSelector(copy.scope) }).html;
  }
  return copy;
}

/** Badges belong to a section; copies of a section get copies of its badges. */
function copyBadges(page, list, toSection) {
  page.badges = page.badges || [];
  for (const b of list || []) page.badges.push({ ...b, id: `badge-${crypto.randomBytes(4).toString('hex')}`, section: toSection });
}
const badgesOf = (page, id) => (page.badges || []).filter((b) => b.section === id);
const dropBadges = (page, id) => { if (page.badges) page.badges = page.badges.filter((b) => b.section !== id); };

/** Images used on a page (for "Cari" thumbnail picker). */
function pageImages(page) {
  const out = new Set();
  for (const s of page.sections) {
    if (s.type === 'image') for (const it of s.items) out.add(`${it.src}.${it.ext || 'webp'}`);
    else for (const m of String(s.html || '').matchAll(/<img\b[^>]*\bsrc="(\/uploads\/[^"]+)"/g)) out.add(m[1]);
  }
  return [...out].filter((u) => !/-plate\.(webp|avif)$/.test(u)).slice(0, 200);
}

function summary(page) {
  const st = page.settings || {};
  return {
    slug: page.slug, name: page.name || page.title, title: page.title, description: page.description || '', robots: page.robots || '',
    keywords: page.keywords || [], category: page.category || '', thumbnail: page.thumbnail || '',
    settings: { maxWidth: st.maxWidth ?? null, background: st.background || '#ffffff', font: st.font ?? null },
    sections: page.sections.map((s) => ({
      id: s.id, name: s.name, type: s.type, visible: s.visible !== false, mt: s.mt || 0, layout: s.layout || 'stack',
      wrap: Boolean(s.wrap), part: s.part,
      items: s.type === 'image' ? s.items.map((it) => ({ src: it.src, ext: it.ext || null, alt: it.alt || '', href: it.href || '' })) : undefined,
      source: s.type === 'html' ? s.source ?? s.html : undefined,
    })),
    badges: (page.badges || []).map((b) => ({ id: b.id, section: b.section, cx: b.cx, cy: b.cy, w: b.w })),
  };
}

// ---------------------------------------------------------------- pages (HTML shells)
function shell({ title, body, csrf = '', view = '', slug = '', email = '' }) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="csrf-token" content="${esc(csrf)}">
<title>${esc(title)} · Spencer's Indonesia</title>
<script src="/admin/static/theme.js"></script>
<link rel="stylesheet" href="/admin/static/admin.css?v=${ASSET_V}">
</head>
<body data-view="${esc(view)}" data-slug="${esc(slug)}" data-email="${esc(email)}">
${body}
${view ? `<script src="/admin/static/admin.js?v=${ASSET_V}" defer></script>` : ''}
</body>
</html>`;
}

// Only same-site admin paths are accepted as "return to" targets (no open redirect).
const safeNext = (v) => {
  const n = String(v || '');
  return /^\/admin(\/[\w\-/.?=&%]*)?$/.test(n) && !n.includes('//') && !n.startsWith('/admin/login') ? n : '/admin';
};

function loginPage({ error = '', email = '', next = '' } = {}) {
  return shell({
    title: 'Masuk',
    body: `<main class="login-split">
  <section class="login-brand">
    <img class="lb-hero" src="/admin/static/login-hero.webp" alt="Spencer's: perusahaan premium e-grocery makanan sehat, 100.000.000++ customer" width="1080" height="1083">
  </section>
  <section class="login-side">
    <form class="login-form" method="post" action="/admin/login" novalidate>
      <div class="brand only-sm"><img class="brand-logo" src="/admin/static/logo.png" alt="" width="40" height="40"><span>Spencer's Indonesia</span></div>
      <h1>Masuk</h1>
      <p class="muted">Kelola landing page Spencer's Indonesia.</p>
      ${error ? `<p class="alert" role="alert">${esc(error)}</p>` : ''}
      <input type="hidden" name="next" value="${esc(safeNext(next))}">
      <label class="field"><span>Email</span><input type="email" name="email" value="${esc(email)}" autocomplete="username" required maxlength="254" autofocus></label>
      <label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required maxlength="256"></label>
      <button class="btn btn-primary btn-block" type="submit">Masuk</button>
    </form>
  </section>
</main>`,
  });
}

// ---------------------------------------------------------------- clipboard (per admin, survives restarts)
const CLIP_DIR = path.join(ROOT, 'data', 'clipboard');
const clipFile = (email) => path.join(CLIP_DIR, `${crypto.createHash('sha256').update(email).digest('hex').slice(0, 24)}.json`);
async function readClipboard(email) {
  try {
    return JSON.parse(await fs.readFile(clipFile(email), 'utf8'));
  } catch {
    return null;
  }
}
async function writeClipboard(email, data) {
  await fs.mkdir(CLIP_DIR, { recursive: true });
  await fs.writeFile(clipFile(email), JSON.stringify(data));
}

// ---------------------------------------------------------------- router
export function adminRouter({ assetVersion = '1' } = {}) {
  const r = express.Router();
  r.use((req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  r.use('/static', express.static(path.join(ROOT, 'public', 'admin'), { index: false, dotfiles: 'deny', maxAge: 0 }));

  pruneAudit().catch(console.error);
  setInterval(() => pruneAudit().catch(console.error), 24 * 3600 * 1000).unref();

  // ---- login / logout
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (req, res) => res.status(429).type('html').send(loginPage({ error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' })) });

  r.get('/login', async (req, res) => {
    if (await getSession(req).catch(() => null)) return res.redirect(303, '/admin');
    res.set('Cache-Control', 'no-store').type('html').send(loginPage({ next: req.query.next }));
  });

  r.post('/login', loginLimiter, express.urlencoded({ extended: false, limit: '4kb', parameterLimit: 6 }), async (req, res, next) => {
    try {
      const origin = req.get('origin');
      if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).type('text').send('Origin tidak diizinkan.');
      const email = clip(req.body?.email, 254).toLowerCase();
      res.set('Cache-Control', 'no-store');
      if (await isLocked(email, req.ip)) {
        await audit(req, 'login.blocked', { email });
        return res.status(429).type('html').send(loginPage({ email, next: req.body?.next, error: 'Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.' }));
      }
      const result = await authenticate(email, req.body?.password, req.ip);
      if (!result.ok) {
        await audit(req, result.locked ? 'login.locked' : 'login.fail', { email });
        const error = result.locked ? 'Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.' : 'Email atau password salah.';
        return res.status(401).type('html').send(loginPage({ email, error, next: req.body?.next }));
      }
      await destroySession(req, res);
      await createSession(res, result.email);
      await audit(req, 'login.success', { email: result.email });
      res.redirect(303, safeNext(req.body?.next));
    } catch (e) {
      next(e);
    }
  });

  // Everything below requires a valid session; writes also require the CSRF token.
  r.use(requireAdmin);
  r.use('/api', express.json({ limit: '6mb' }));
  r.use(rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }));
  r.use(requireCsrf);

  r.get('/api/ping', (req, res) => res.json({ ok: true }));

  r.post('/logout', async (req, res) => {
    await audit(req, 'logout');
    await destroySession(req, res);
    res.redirect(303, '/admin/login');
  });

  const view = (v, title) => (req, res) => {
    const slug = req.params.slug || '';
    if (slug && !isValidSlug(slug)) return res.status(404).type('text').send('Halaman tidak ditemukan');
    res.type('html').send(shell({ title, view: v, slug, csrf: req.admin.csrf, email: req.admin.email, body: '<div id="app" class="app" aria-live="polite"></div>' }));
  };
  r.get('/', view('dashboard', 'Dashboard'));
  r.get('/pages', view('pages', 'Halaman'));
  r.get('/reports', view('reports', 'Laporan'));
  r.get('/pages/:slug', view('editor', 'Editor'));
  r.get('/audit', (req, res) => res.redirect(301, '/admin/reports?tab=log'));
  r.get('/promo', view('promo', 'Promo'));

  const initialState = (slug) => async () => {
    const [page, global] = await Promise.all([getPage(slug), getGlobal()]);
    if (!page) throw httpError(404, 'Halaman tidak ditemukan.');
    if (!page.name) page.name = page.title;
    return { page, global };
  };

  // Preview shows the current draft (what "Simpan" would publish).
  r.get('/preview/:slug', async (req, res, next) => {
    try {
      const { slug } = req.params;
      if (!isValidSlug(slug)) return res.status(404).type('text').send('Halaman tidak ditemukan');
      const [live, draft, promo] = await Promise.all([
        getPage(slug),
        withPageLock(slug, () => openDraft(slug, initialState(slug))).catch((e) => e),
        promos.activePromo(),
      ]);
      if (!live) return res.status(404).type('text').send('Halaman tidak ditemukan');
      if (draft instanceof Error) throw draft;
      res.set('Cache-Control', 'no-store');
      res.type('html').send(renderPage({ ...draft.state.page, robots: 'noindex, nofollow' }, { assetVersion, global: draft.state.global, showHidden: true, promo }));
    } catch (e) {
      next(e);
    }
  });

  r.get('/live/:slug', async (req, res, next) => {
    try {
      const [page, global, promo] = await Promise.all([getPage(req.params.slug), getGlobal(), promos.activePromo()]);
      if (!page) return res.status(404).type('text').send('Halaman tidak ditemukan');
      res.set('Cache-Control', 'no-store');
      res.type('html').send(renderPage({ ...page, robots: 'noindex, nofollow' }, { assetVersion, global: { ...global, ga4Id: '' }, promo, fullLayout: true }));
    } catch (e) {
      next(e);
    }
  });

  // ---- API
  const api = express.Router();
  r.use('/api', api);
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  const countUnsaved = async (slugs) => (await readMetas(slugs)).filter((m) => m && m.pos !== m.savedPos).length;

  api.get('/status', wrap(async (req, res) => {
    const [unsavedPages, draft, live] = await Promise.all([listSlugs().then(countUnsaved), promos.getDraft(), promos.getLive()]);
    res.json({ unsavedPages, promoDraft: promos.isDirty(draft, live) });
  }));

  api.get('/pages', wrap(async (req, res) => {
    const pages = await listPages({ withPage: true });
    const slugs = pages.map((p) => p.slug);
    const [metas, archived, global] = await Promise.all([readMetas(slugs), listArchived(new Set(slugs)), getGlobal()]);
    pages.forEach((p, i) => {
      p.unsaved = Boolean(metas[i] && metas[i].pos !== metas[i].savedPos);
      if (!p.thumbnail) p.cover = pageImages(p.page)[0] || null;
      delete p.page;
    });
    res.json({ pages, archived, categories: global.categories });
  }));

  api.post('/pages', wrap(async (req, res) => {
    const slug = clip(req.body?.slug, 80).toLowerCase();
    const title = clip(req.body?.title, 160) || slug;
    const from = clip(req.body?.from, 80);
    if (!isValidSlug(slug)) throw httpError(400, SLUG_HELP);
    let page;
    if (from) {
      const src = await getPage(from);
      if (!src) throw httpError(404, 'Halaman sumber tidak ditemukan.');
      page = structuredClone(src);
      page.duplicatedFrom = from;
    } else {
      page = { title, description: '', settings: { maxWidth: null, designWidth: 320, background: '#ffffff', outerBackground: '#f2f2f2' }, sections: [] };
    }
    page.name = title;
    if (!from) page.title = title;
    delete page.updatedAt;
    delete page.updatedBy;
    try {
      await createPage(slug, page, req.admin.email);
    } catch (e) {
      if (e.code === 'EXISTS') throw httpError(409, 'Link sudah dipakai halaman lain.');
      throw e;
    }
    await audit(req, from ? 'page.duplicate' : 'page.create', { slug, from: from || undefined });
    res.status(201).json({ ok: true, slug });
  }));

  api.post('/pages/:slug/archive', wrap(async (req, res) => {
    const { slug } = req.params;
    await withPageLock(slug, async () => {
      if (!(await getPage(slug))) throw httpError(404, 'Halaman tidak ditemukan.');
      await archivePage(slug);
      await discardDraft(slug);
    });
    await audit(req, 'page.archive', { slug });
    res.json({ ok: true });
  }));

  api.post('/archived/:slug/restore', wrap(async (req, res) => {
    const { slug } = req.params;
    if (!isValidSlug(slug)) throw httpError(400, 'Link tidak valid.');
    const [ts] = await listHistory(slug);
    const page = ts && (await readHistory(slug, ts));
    if (!page) throw httpError(404, 'Arsip tidak ditemukan.');
    try {
      await createPage(slug, page, req.admin.email);
    } catch (e) {
      if (e.code === 'EXISTS') throw httpError(409, 'Halaman dengan link ini sudah aktif.');
      throw e;
    }
    await audit(req, 'page.unarchive', { slug });
    res.json({ ok: true });
  }));

  // ---- editor (draft)
  const payload = (meta, state, extra = {}) => ({ ok: true, page: summary(state.page), global: state.global, draft: info(meta), ...extra });

  api.get('/pages/:slug', wrap(async (req, res) => {
    const { slug } = req.params;
    if (!isValidSlug(slug)) throw httpError(404, 'Halaman tidak ditemukan.');
    const [{ meta, state }, live, clipboard, active] = await Promise.all([
      withPageLock(slug, () => openDraft(slug, initialState(slug))),
      getPage(slug),
      readClipboard(req.admin.email),
      promos.activePromo(),
    ]);
    if (!live) throw httpError(404, 'Halaman tidak ditemukan.');
    res.json(payload(meta, state, {
      published: { updatedAt: live.updatedAt || null, updatedBy: live.updatedBy || null },
      clipboard: clipboard ? { name: clipboard.section.name, from: clipboard.from } : null,
      options: { fonts: FONTS, widths: WIDTHS },
      images: pageImages(state.page),
      promo: active ? { name: active.name, banner: Boolean(active.banner), badge: Boolean(active.badge), bar: Boolean(active.bar && (active.bar.title || active.bar.left || active.bar.right)) } : null,
    }));
  }));

  // Every draft edit: lock, revision check (other tab), apply on a copy, push an undo step, audit.
  const edit = (event, fn) => wrap(async (req, res) => {
    const { slug } = req.params;
    if (!isValidSlug(slug)) throw httpError(404, 'Halaman tidak ditemukan.');
    let detail = {};
    const out = await withPageLock(slug, async () => {
      const { meta, state } = await openDraft(slug, initialState(slug));
      const rev = req.get('x-draft-rev');
      if (rev && Number(rev) !== meta.rev) throw httpError(409, 'Draft ini baru saja diubah di tab atau oleh admin lain. Muat ulang untuk melihat versi terbaru.');
      const next = structuredClone(state);
      detail = (await fn(next.page, req, next)) || {};
      if (detail.noChange) return { meta, state };
      return { meta: await pushState(slug, meta, next), state: next };
    });
    if (event && !detail.noChange) await audit(req, event, { slug, draft: true, ...detail, notes: undefined, noChange: undefined, clipboard: undefined });
    res.json(payload(out.meta, out.state, { notes: detail.notes || [], clipboard: detail.clipboard, images: detail.images }));
  });

  const findSection = (page, id) => {
    const i = page.sections.findIndex((s) => s.id === id);
    if (i < 0) throw httpError(404, 'Section tidak ditemukan.');
    return i;
  };

  // Konten / Desain / SEO fields
  api.patch('/pages/:slug', edit('page.update', async (page, req) => {
    const b = req.body || {};
    const changed = [];
    const set = (k, v) => { if (JSON.stringify(page[k]) !== JSON.stringify(v)) { page[k] = v; changed.push(k); } };
    if (b.name != null) set('name', clip(b.name, 160) || page.name);
    if (b.title != null) set('title', clip(b.title, 160) || page.title);
    if (b.description != null) set('description', clip(b.description, 500));
    if (b.robots != null) set('robots', b.robots === 'noindex, nofollow' ? 'noindex, nofollow' : '');
    if (b.keywords != null) set('keywords', [...new Set((Array.isArray(b.keywords) ? b.keywords : []).map((k) => clip(k, 60)).filter(Boolean))].slice(0, 30));
    if (b.category != null) set('category', clip(b.category, 60));
    if (b.thumbnail != null) set('thumbnail', uploadUrl(b.thumbnail));
    if (b.slug != null) {
      const slug = clip(b.slug, 80).toLowerCase();
      if (!isValidSlug(slug)) throw httpError(400, SLUG_HELP);
      if (slug !== req.params.slug && (await getPage(slug))) throw httpError(409, 'Link sudah dipakai halaman lain.');
      set('slug', slug);
    }
    if (b.settings) {
      const st = { ...(page.settings || {}) };
      if ('maxWidth' in b.settings) st.maxWidth = WIDTHS.includes(Number(b.settings.maxWidth)) ? Number(b.settings.maxWidth) : null;
      if ('font' in b.settings) st.font = b.settings.font == null ? null : Object.hasOwn(FONTS, b.settings.font) ? b.settings.font : null;
      if ('background' in b.settings) st.background = /^#[0-9a-f]{6}$/i.test(b.settings.background) ? b.settings.background.toLowerCase() : '#ffffff';
      set('settings', st);
    }
    return changed.length ? { fields: changed } : { noChange: true };
  }));

  api.patch('/pages/:slug/global', edit('global.update', (page, req, state) => {
    const before = JSON.stringify(state.global);
    state.global = normalizeGlobal({ ...state.global, ...req.body });
    return before === JSON.stringify(state.global) ? { noChange: true } : { fields: Object.keys(req.body || {}) };
  }));

  api.post('/pages/:slug/thumbnail', withUpload, edit('page.update', async (page, req) => {
    const f = req.files?.images?.[0];
    if (!f) throw new UserError('Pilih gambar thumbnail.');
    const img = await processImage(f.buffer, 'thumbnails');
    page.thumbnail = `${img.src}.${img.ext || 'webp'}`;
    return { fields: ['thumbnail'] };
  }));

  api.post('/pages/:slug/favicon', withUpload, edit('global.update', async (page, req, state) => {
    const f = req.files?.images?.[0];
    if (!f) throw new UserError('Pilih gambar favicon.');
    let buf;
    try {
      buf = await sharp(f.buffer, { limitInputPixels: 40e6 }).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    } catch {
      throw new UserError('File bukan gambar yang valid.');
    }
    const name = `favicon-${crypto.randomBytes(6).toString('hex')}.png`;
    await saveUpload(`/uploads/global/${name}`, buf);
    state.global = normalizeGlobal({ ...state.global, favicon: `/uploads/global/${name}` });
    return { fields: ['favicon'] };
  }));

  api.put('/pages/:slug/order', edit('section.reorder', (page, req) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length !== page.sections.length || new Set(ids).size !== ids.length) throw httpError(400, 'Urutan tidak valid. Muat ulang halaman.');
    const byId = new Map(page.sections.map((s) => [s.id, s]));
    if (!ids.every((id) => byId.has(id))) throw httpError(400, 'Urutan tidak valid. Muat ulang halaman.');
    if (ids.join() === page.sections.map((s) => s.id).join()) return { noChange: true };
    page.sections = ids.map((id) => byId.get(id));
    return {};
  }));

  api.post('/pages/:slug/sections', withUpload, edit('section.create', async (page, req) => {
    const b = req.body || {};
    if (b.type === 'promo') {
      const part = b.part === 'bar' ? 'bar' : 'banner';
      const name = part === 'bar' ? '[PROMO] Bar' : '[PROMO] Banner';
      const sec = { id: newSectionId(page, `promo-${part}`), name, type: 'promo', part };
      const pos = toNum(b.position, 0, page.sections.length, page.sections.length);
      page.sections.splice(pos, 0, sec);
      return { section: sec.id, name, type: 'promo' };
    }
    const name = clip(b.name, 120) || (b.type === 'html' ? 'Section HTML' : 'Section Gambar');
    const sec = { id: newSectionId(page, name), name, type: b.type === 'html' ? 'html' : 'image' };
    const mt = toNum(b.mt, -200, 400, 0);
    if (mt) sec.mt = mt;
    let notes = [];
    if (sec.type === 'image') {
      if (b.layout === 'slider') sec.layout = 'slider';
      sec.items = await buildImageItems(sec.id, parseJsonField(b.items, []), req.files?.images || []);
      applySliderBox(sec);
    } else {
      sec.wrap = true;
      notes = await buildHtml(sec, { code: b.code, htmlFile: req.files?.htmlFile?.[0], assets: req.files?.assets });
    }
    const pos = toNum(b.position, 0, page.sections.length, page.sections.length);
    page.sections.splice(pos, 0, sec);
    return { section: sec.id, name: sec.name, type: sec.type, notes };
  }));

  api.patch('/pages/:slug/sections/:id', withUpload, edit('section.update', async (page, req) => {
    const i = findSection(page, req.params.id);
    const sec = page.sections[i];
    const b = req.body || {};
    const changed = [];
    if (b.name != null && clip(b.name, 120) && clip(b.name, 120) !== sec.name) { sec.name = clip(b.name, 120); changed.push('name'); }
    if (b.visible != null) {
      const v = !(b.visible === false || b.visible === 'false');
      if (v !== (sec.visible !== false)) { if (v) delete sec.visible; else sec.visible = false; changed.push('visible'); }
    }
    if (b.mt != null) { const mt = toNum(b.mt, -200, 400, 0); if (mt !== (sec.mt || 0)) { if (mt) sec.mt = mt; else delete sec.mt; changed.push('spacing'); } }
    let notes = [];
    // [PROMO] sections only allow name / visibility / spacing; their content comes from the Promo menu.
    const type = sec.type === 'promo' ? 'promo' : b.type === 'html' || b.type === 'image' ? b.type : sec.type;
    if (type === 'image' && (b.items != null || type !== sec.type)) {
      const oldItems = sec.type === 'image' ? sec.items : [];
      sec.items = await buildImageItems(sec.id, parseJsonField(b.items, []), req.files?.images || [], oldItems);
      if (sec.type !== 'image') { delete sec.html; delete sec.source; delete sec._items; delete sec.scope; delete sec.wrap; }
      sec.type = 'image';
      if (b.layout != null) { if (b.layout === 'slider') sec.layout = 'slider'; else { delete sec.layout; delete sec.box; delete sec.slideBox; delete sec.slider; } }
      applySliderBox(sec);
      changed.push('images');
    } else if (type === 'html' && (b.code != null || req.files?.htmlFile || type !== sec.type)) {
      if (sec.type !== 'html') { delete sec.items; delete sec.layout; delete sec.box; delete sec.slideBox; delete sec.slider; sec.wrap = true; }
      sec.type = 'html';
      notes = await buildHtml(sec, { code: b.code, htmlFile: req.files?.htmlFile?.[0], assets: req.files?.assets });
      changed.push('html');
    }
    if (!changed.length) return { noChange: true };
    return { section: sec.id, name: sec.name, changed, notes };
  }));

  api.post('/pages/:slug/sections/:id/duplicate', edit('section.duplicate', (page, req) => {
    const i = findSection(page, req.params.id);
    const copy = cloneSection(page, page.sections[i], ' (salinan)');
    page.sections.splice(i + 1, 0, copy);
    copyBadges(page, badgesOf(page, req.params.id), copy.id);
    return { section: copy.id, name: copy.name, from: req.params.id };
  }));

  api.delete('/pages/:slug/sections/:id', edit('section.delete', (page, req) => {
    const i = findSection(page, req.params.id);
    const [sec] = page.sections.splice(i, 1);
    dropBadges(page, sec.id);
    return { section: sec.id, name: sec.name };
  }));

  // Copy / cut put the full section on the admin's clipboard; paste works on any page.
  api.post('/pages/:slug/clipboard', edit('section.cut', async (page, req) => {
    const i = findSection(page, clip(req.body?.id, 64));
    const sec = page.sections[i];
    const cut = req.body?.mode === 'cut';
    await writeClipboard(req.admin.email, { section: sec, badges: badgesOf(page, sec.id), from: req.params.slug, at: Date.now() });
    const clipboard = { name: sec.name, from: req.params.slug };
    if (!cut) return { noChange: true, clipboard };
    page.sections.splice(i, 1);
    dropBadges(page, sec.id);
    return { section: sec.id, name: sec.name, clipboard };
  }));

  api.post('/pages/:slug/sections/paste', edit('section.paste', async (page, req) => {
    const cb = await readClipboard(req.admin.email);
    if (!cb) throw new UserError('Belum ada section yang di-copy atau di-cut.');
    const copy = cloneSection(page, cb.section);
    const pos = toNum(req.body?.position, 0, page.sections.length, page.sections.length);
    page.sections.splice(pos, 0, copy);
    copyBadges(page, cb.badges, copy.id);
    return { section: copy.id, name: copy.name, from: cb.from };
  }));

  // ---- promo badges (float over a section; image comes from the active promo)
  const badgeNum = (v, min, max, d) => Math.round(toNum(v, min, max, d) * 10) / 10;
  api.post('/pages/:slug/badges', edit('badge.create', (page, req) => {
    const sec = page.sections[findSection(page, clip(req.body?.section, 64))];
    page.badges = page.badges || [];
    const badge = { id: `badge-${crypto.randomBytes(4).toString('hex')}`, section: sec.id, cx: 240, cy: 50, w: 110 };
    page.badges.push(badge);
    return { section: sec.id, name: sec.name, badge: badge.id };
  }));
  api.patch('/pages/:slug/badges/:id', edit('badge.move', (page, req) => {
    const b = (page.badges || []).find((x) => x.id === req.params.id);
    if (!b) throw httpError(404, 'Badge tidak ditemukan.');
    const next = { cx: badgeNum(req.body?.cx, -160, 480, b.cx), cy: badgeNum(req.body?.cy, -400, 4000, b.cy), w: badgeNum(req.body?.w, 20, 320, b.w) };
    if (next.cx === b.cx && next.cy === b.cy && next.w === b.w) return { noChange: true };
    Object.assign(b, next);
    return { section: b.section, badge: b.id };
  }));
  api.delete('/pages/:slug/badges/:id', edit('badge.delete', (page, req) => {
    const before = (page.badges || []).length;
    page.badges = (page.badges || []).filter((x) => x.id !== req.params.id);
    if (page.badges.length === before) throw httpError(404, 'Badge tidak ditemukan.');
    return { badge: req.params.id };
  }));

  api.post('/pages/:slug/phone-link', wrap(async (req, res) => {
    const { slug } = req.params;
    if (!(await getPage(slug))) throw httpError(404, 'Halaman tidak ditemukan.');
    const { token, expiresAt } = await createLink(slug);
    const url = `${phoneBase(req)}/p/${token}`;
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1d1719', light: '#ffffff' } });
    await audit(req, 'page.phonelink', { slug });
    res.json({ url, expiresAt, svg, local: /^http:\/\/(\d+\.){3}\d+:/.test(url) });
  }));

  // ---- undo / redo / publish / discard
  const stepRoute = (delta) => wrap(async (req, res) => {
    const { slug } = req.params;
    const out = await withPageLock(slug, async () => {
      const { meta, state } = await openDraft(slug, initialState(slug));
      const next = await step(slug, meta, delta);
      return { meta, state: next || state };
    });
    res.json(payload(out.meta, out.state));
  });
  api.post('/pages/:slug/undo', stepRoute(-1));
  api.post('/pages/:slug/redo', stepRoute(1));

  api.post('/pages/:slug/publish', wrap(async (req, res) => {
    const { slug } = req.params;
    let target = slug;
    const out = await withPageLock(slug, async () => {
      const { meta, state } = await openDraft(slug, initialState(slug));
      const live = await getPage(slug);
      if (!live) throw httpError(404, 'Halaman tidak ditemukan.');
      if (!req.body?.force && meta.baseVersion && live.updatedAt && live.updatedAt !== meta.baseVersion) {
        throw httpError(409, 'Halaman live sudah diubah sejak draft ini dibuat (mungkin oleh admin lain).', { code: 'LIVE_CHANGED' });
      }
      const page = structuredClone(state.page);
      target = page.slug && page.slug !== slug ? page.slug : slug;
      if (target !== slug) {
        if (!isValidSlug(target)) throw httpError(400, SLUG_HELP);
        if (await getPage(target)) throw httpError(409, 'Link baru sudah dipakai halaman lain.');
        await renamePage(slug, target, page, req.admin.email);
        await moveDraft(slug, target);
      } else {
        await savePage(slug, page, req.admin.email);
      }
      const globalChanged = JSON.stringify(await getGlobal()) !== JSON.stringify(normalizeGlobal(state.global));
      if (globalChanged) await saveGlobal(state.global);
      return { meta: await markSaved(target, meta, page.updatedAt), state, globalChanged };
    });
    await audit(req, 'page.publish', { slug: target, from: target !== slug ? slug : undefined, global: out.globalChanged || undefined });
    res.json(payload(out.meta, out.state, { slug: target, published: { updatedAt: out.meta.baseVersion, updatedBy: req.admin.email } }));
  }));

  api.post('/pages/:slug/discard', wrap(async (req, res) => {
    const { slug } = req.params;
    if (!isValidSlug(slug)) throw httpError(404, 'Halaman tidak ditemukan.');
    await withPageLock(slug, () => discardDraft(slug));
    await audit(req, 'draft.discard', { slug });
    res.json({ ok: true });
  }));

  // ---- history (published versions) + this page's activity
  api.get('/pages/:slug/history', wrap(async (req, res) => {
    const { slug } = req.params;
    if (!isValidSlug(slug)) throw httpError(404, 'Halaman tidak ditemukan.');
    // Versions, redirects and the audit log are independent; all versions are read in one batch.
    const [list, redirects, entries] = await Promise.all([
      listHistory(slug).then(async (ts) => ({ ts, pages: await readHistoryMany(slug, ts) })),
      getRedirects(),
      readAudit(5000),
    ]);
    const versions = [];
    list.ts.forEach((ts, i) => {
      const p = list.pages[i];
      if (p) versions.push({ ts, savedAt: p.updatedAt || null, by: p.updatedBy || null, sections: p.sections?.length || 0 });
    });
    // include activity recorded under the page's previous links (URL changes)
    const names = new Set([slug, ...Object.keys(redirects).filter((k) => redirects[k] === slug)]);
    const activity = entries.filter((e) => names.has(e.slug)).slice(0, 300)
      .map(({ ts, event, actor, section, name, fields, changed, from, version, draft }) => ({ ts, event, actor, section, name, fields, changed, from, version, draft }));
    res.json({ versions, activity });
  }));

  // Restoring loads the old version into the draft; "Simpan" publishes it.
  api.post('/pages/:slug/history/:ts/restore', edit('page.restore', async (page, req) => {
    const old = await readHistory(req.params.slug, req.params.ts);
    if (!old) throw httpError(404, 'Versi tidak ditemukan.');
    const slug = page.slug;
    for (const k of Object.keys(page)) delete page[k];
    Object.assign(page, old, { slug });
    if (!page.name) page.name = page.title;
    return { version: req.params.ts };
  }));

  // ---- export / import (signed code, readable only by this system)
  api.get('/pages/:slug/export', wrap(async (req, res) => {
    const { slug } = req.params;
    const { state } = await withPageLock(slug, () => openDraft(slug, initialState(slug)));
    const code = exportCode(state.page, slug);
    await audit(req, 'page.export', { slug });
    res.json({ code, filename: `${slug}-${new Date().toISOString().slice(0, 10)}.mbpage` });
  }));

  api.post('/pages/:slug/import', edit('page.import', async (page, req) => {
    const { page: imported, source } = importCode(req.body?.code);
    const slug = page.slug;
    for (const k of Object.keys(page)) delete page[k];
    Object.assign(page, imported, { slug });
    delete page.updatedAt;
    delete page.updatedBy;
    const missing = [];
    for (const u of pageImages(page).slice(0, 200)) {
      if (!(await uploadExists(decodeURIComponent(u), `${req.protocol}://${req.get('host')}`))) missing.push(u);
    }
    return { from: source, notes: missing.length ? [`${missing.length} gambar tidak ditemukan di server`] : [] };
  }));

  // ---- Promo menu: site-wide promos, draft + publish
  const toWib = (v) => {
    const s = clip(v, 20);
    if (!s) return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}:00${promos.TZ_OFFSET}`))) throw httpError(400, 'Format tanggal tidak valid.');
    return `${s}:00${promos.TZ_OFFSET}`;
  };
  async function promoPayload() {
    const [draft, live] = await Promise.all([promos.getDraft(), promos.getLive()]);
    const now = Date.now();
    const activeDraft = promos.resolveActive(draft, now);
    const activeLive = promos.resolveActive(live, now);
    const brief = (a) => (a.promo ? { id: a.promo.id, name: a.promo.name, kind: a.promo.kind, reason: a.reason, end: a.promo.end || null } : null);
    return {
      promos: draft.promos.map((p) => ({ ...p, status: promos.statusOf(p, activeDraft.promo, now) })),
      active: { draft: brief(activeDraft), live: brief(activeLive) },
      dirty: promos.isDirty(draft, live),
      published: { at: live.updatedAt || null, by: live.updatedBy || null },
    };
  }
  // Every promo edit: lock, load draft, change, save draft, audit.
  const promoEdit = (event, fn) => wrap(async (req, res) => {
    let detail = {};
    await withPageLock('__promos', async () => {
      const data = await promos.getDraft();
      detail = (await fn(data, req)) || {};
      await promos.saveDraft(data);
    });
    if (event) await audit(req, event, { promo: detail.id, name: detail.name, fields: detail.fields });
    res.json(await promoPayload());
  });
  const findPromo = (data, id) => {
    const p = data.promos.find((x) => x.id === id);
    if (!p) throw httpError(404, 'Promo tidak ditemukan.');
    return p;
  };

  api.get('/promos', wrap(async (req, res) => res.json(await promoPayload())));

  api.post('/promos', promoEdit('promo.create', (data, req) => {
    const kind = req.body?.kind === 'regular' ? 'regular' : 'insidentil';
    const name = clip(req.body?.name, 60);
    if (!name) throw new UserError('Nama promo wajib diisi.');
    const p = { id: `p-${crypto.randomBytes(4).toString('hex')}`, kind, name, start: null, end: null, banner: null, badge: null,
      bar: { title: `Promo “${name.toUpperCase()}”`, left: 'Disc up to 60%', right: 'FREE Ongkir Jawa - Bali', color: '#ff0000' } };
    if (kind === 'insidentil') p.manual = false;
    data.promos.push(p);
    return { id: p.id, name };
  }));

  api.patch('/promos/:id', promoEdit('promo.update', (data, req) => {
    const p = findPromo(data, req.params.id);
    const b = req.body || {};
    const fields = [];
    if (b.name != null) { p.name = clip(b.name, 60) || p.name; fields.push('name'); }
    if ('start' in b || 'end' in b) {
      const start = 'start' in b ? toWib(b.start) : p.start;
      const end = 'end' in b ? toWib(b.end) : p.end;
      if (start && end && Date.parse(end) <= Date.parse(start)) throw new UserError('Tanggal selesai harus setelah tanggal mulai.');
      p.start = start;
      p.end = end;
      fields.push('jadwal');
    }
    if (b.manual != null && p.kind === 'insidentil') {
      p.manual = b.manual === true;
      // only one promo can be switched on manually; it also overrides every regular promo
      if (p.manual) for (const o of data.promos) if (o !== p && o.kind === 'insidentil') o.manual = false;
      fields.push('toggle');
    }
    if (b.bar) {
      p.bar = {
        title: clip(b.bar.title ?? p.bar?.title, 80), left: clip(b.bar.left ?? p.bar?.left, 40), right: clip(b.bar.right ?? p.bar?.right, 40),
        color: /^#[0-9a-f]{6}$/i.test(b.bar.color || '') ? b.bar.color.toLowerCase() : p.bar?.color || '#ff0000',
      };
      fields.push('bar');
    }
    return { id: p.id, name: p.name, fields };
  }));

  api.post('/promos/:id/image', withUpload, promoEdit('promo.update', async (data, req) => {
    const p = findPromo(data, req.params.id);
    const part = req.query.part === 'badge' ? 'badge' : 'banner';
    const f = req.files?.images?.[0];
    if (!f) throw new UserError('Pilih gambar.');
    const img = await processImage(f.buffer, 'promos');
    p[part] = { src: img.src, ...(img.ext ? { ext: img.ext } : {}), iw: img.iw, ih: img.ih };
    return { id: p.id, name: p.name, fields: [part] };
  }));

  api.delete('/promos/:id/image', promoEdit('promo.update', (data, req) => {
    const p = findPromo(data, req.params.id);
    const part = req.query.part === 'badge' ? 'badge' : 'banner';
    p[part] = null;
    return { id: p.id, name: p.name, fields: [part] };
  }));

  api.delete('/promos/:id', promoEdit('promo.delete', (data, req) => {
    const p = findPromo(data, req.params.id);
    data.promos = data.promos.filter((x) => x !== p);
    return { id: p.id, name: p.name };
  }));

  api.post('/promos/publish', wrap(async (req, res) => {
    const out = await withPageLock('__promos', () => promos.publish(req.admin.email));
    const a = promos.resolveActive(out).promo;
    await audit(req, 'promo.publish', { name: a ? a.name : '(tidak ada promo aktif)' });
    res.json(await promoPayload());
  }));

  api.post('/promos/discard', wrap(async (req, res) => {
    await withPageLock('__promos', () => promos.discardDraft());
    await audit(req, 'promo.discard', {});
    res.json(await promoPayload());
  }));

  // ---- Laporan (first-party analytics) + Dashboard
  api.get('/reports', wrap(async (req, res) => {
    const today = analytics.dayKey();
    const to = clip(req.query.to, 10) || today;
    const from = clip(req.query.from, 10) || analytics.dayKey(Date.parse(to) - 6 * 864e5);
    const slug = clip(req.query.slug, 80);
    if (slug && !isValidSlug(slug)) throw httpError(400, 'Halaman tidak valid.');
    res.json(await analytics.report({ from, to, slug }));
  }));
  api.get('/reports/sections', wrap(async (req, res) => {
    const slug = clip(req.query.slug, 80);
    const page = isValidSlug(slug) ? await getPage(slug) : null;
    if (!page) throw httpError(404, 'Halaman tidak ditemukan.');
    const rep = await analytics.sectionReport({ from: clip(req.query.from, 10), to: clip(req.query.to, 10), slug });
    const byId = new Map(rep.sections.map((x) => [x.id, x]));
    const ordered = page.sections.filter((x) => x.visible !== false).map((x) => ({ ...(byId.get(x.id) || { id: x.id, reach: 0, reachPct: 0, avgSec: 0, clicks: {}, pts: [] }), name: x.name, type: x.type }));
    const removed = rep.sections.filter((x) => !page.sections.some((p) => p.id === x.id)).map((x) => ({ ...x, name: `${x.id} (sudah dihapus)`, removed: true }));
    res.json({ ...rep, sections: [...ordered, ...removed], name: page.name || page.title });
  }));
  api.get('/reports.csv', wrap(async (req, res) => {
    const today = analytics.dayKey();
    const to = clip(req.query.to, 10) || today;
    const from = clip(req.query.from, 10) || analytics.dayKey(Date.parse(to) - 6 * 864e5);
    const slug = clip(req.query.slug, 80);
    if (slug && !isValidSlug(slug)) throw httpError(400, 'Halaman tidak valid.');
    const rep = await analytics.report({ from, to, slug });
    res.set('Content-Disposition', `attachment; filename="laporan-${slug || 'semua'}-${from}_${to}.csv"`);
    res.type('text/csv; charset=utf-8').send(analytics.reportCsv(rep));
  }));
  api.post('/reports/sample', wrap(async (req, res) => {
    const list = await listPages({ withPage: true });
    const sectionsBySlug = {};
    for (const p of list) sectionsBySlug[p.slug] = p.page.sections.filter((x) => x.visible !== false).map((x) => ({ id: x.id }));
    await analytics.generateSample(list.map((p) => p.slug), 30, sectionsBySlug);
    await audit(req, 'report.sample', {});
    res.json({ ok: true });
  }));
  api.delete('/reports/sample', wrap(async (req, res) => {
    await analytics.clearSample();
    await audit(req, 'report.sample.clear', {});
    res.json({ ok: true });
  }));

  api.get('/dashboard', wrap(async (req, res) => {
    const today = analytics.dayKey();
    const [rep7, slugs, live, draft, entries] = await Promise.all([
      analytics.report({ from: analytics.dayKey(Date.parse(today) - 6 * 864e5), to: today }),
      listSlugs().then(async (list) => ({ list, unsaved: await countUnsaved(list) })),
      promos.getLive(),
      promos.getDraft(),
      readAudit(400),
    ]);
    const unsaved = slugs.unsaved;
    const now = Date.now();
    const a = promos.resolveActive(live, now);
    // next promo that will start by schedule (for "Berikutnya")
    const upcoming = live.promos.filter((p) => p.start && Date.parse(p.start) > now).sort((x, y) => Date.parse(x.start) - Date.parse(y.start))[0];
    const img = (im) => (im ? `${im.src}.${im.ext || 'webp'}` : null);
    res.json({
      report: rep7,
      promo: a.promo ? { name: a.promo.name, kind: a.promo.kind, reason: a.reason, end: a.promo.end || null, banner: img(a.promo.banner), badge: img(a.promo.badge) } : null,
      nextPromo: upcoming ? { name: upcoming.name, start: upcoming.start } : null,
      promoDraft: promos.isDirty(draft, live),
      pages: { total: slugs.list.length, unsaved },
      activity: entries.filter((e) => !String(e.event).startsWith('login') && e.event !== 'logout').slice(0, 6),
    });
  }));

  api.get('/audit', wrap(async (req, res) => res.json({ entries: await readAudit(toNum(req.query.limit, 1, 1000, 300)) })));

  api.use((req, res) => res.status(404).json({ error: 'Tidak ditemukan.' }));
  // eslint-disable-next-line no-unused-vars
  r.use((err, req, res, next) => {
    const status = err instanceof UserError ? 400 : err.status || 500;
    if (status >= 500) console.error(err);
    const message = status < 500 && (err.expose || err instanceof UserError) ? err.message : 'Terjadi kesalahan di server.';
    if (req.path.startsWith('/api/')) return res.status(status).json({ error: message, code: err.code });
    res.status(status).type('text').send(message);
  });
  return r;
}

async function listArchived(liveSlugs) {
  const dir = path.join(ROOT, 'data', 'history');
  let slugs = [];
  try {
    slugs = (await fs.readdir(dir)).filter((slug) => isValidSlug(slug) && !liveSlugs.has(slug));
  } catch {
    return [];
  }
  const out = await Promise.all(slugs.map(async (slug) => {
    const [ts] = await listHistory(slug);
    const p = ts && (await readHistory(slug, ts));
    return p ? { slug, title: p.name || p.title || slug, archivedAt: new Date(ts).toISOString() } : null;
  }));
  return out.filter(Boolean);
}
