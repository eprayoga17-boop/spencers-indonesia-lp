import express from 'express';
import helmet from 'helmet';
import { fs, ensureSeeded, serveUpload, READONLY, timing, kv } from './src/storage.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage } from './src/render.js';
import { getGlobal } from './src/global.js';
import { activePromo } from './src/promos.js';
import { getRedirects } from './src/store.js';
import { track, trackEngagement, pruneAnalytics } from './src/analytics.js';
import { resolveLink } from './src/preview-links.js';
import { openDraft } from './src/drafts.js';
import { resolvePage } from './src/templates.js';
import { ensureMigrated } from './src/migrate-templates.js';
import { ensureHomepage } from './src/migrate-home.js';
import rateLimit from 'express-rate-limit';
import { storefront } from './src/storefront.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// Secrets (ADMIN_USERS) live in .env, which is never committed.
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const { adminRouter } = await import('./src/admin/routes.js');
const PAGES_DIR = path.join(ROOT, 'data', 'pages');
const PORT = Number(process.env.PORT) || 3000;
// On Vercel every instance must agree on the asset version, so use the deployed commit.
const ASSET_VERSION = process.env.ASSET_VERSION || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 10) || String(Date.now());
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

const app = express();
app.disable('x-powered-by');

// Request timing: storage round trips (n, ms) and total time. Admin responses get a Server-Timing header
// (visible in DevTools > Network > Timing); every request is logged on Vercel for diagnosis.
let coldStart = true;
app.use((req, res, next) => {
  const st = { n: 0, ms: 0, t0: performance.now(), cold: coldStart };
  coldStart = false;
  const writeHead = res.writeHead;
  res.writeHead = function (...args) {
    if (req.originalUrl.startsWith('/admin') && !res.headersSent) {
      res.setHeader('Server-Timing', `store;desc="${st.n} calls";dur=${st.ms.toFixed(0)}, total;dur=${(performance.now() - st.t0).toFixed(0)}`);
    }
    return writeHead.apply(this, args);
  };
  if (process.env.VERCEL) {
    res.on('finish', () => console.log(`[timing] ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} total=${(performance.now() - st.t0).toFixed(0)}ms store=${st.n}x/${st.ms.toFixed(0)}ms${st.cold ? ' cold' : ''}`));
  }
  timing.run(st, next);
});
// Vercel's edge sets X-Forwarded-For/-Proto itself (client values are not passed through).
app.set('trust proxy', process.env.VERCEL ? 1 : 'loopback');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        // GA4 / Google Ads, Meta and TikTok pixels: only loaded when configured (pixels: after the visitor accepts)
        'script-src': ["'self'", 'https://www.googletagmanager.com', 'https://connect.facebook.net', 'https://analytics.tiktok.com'],
        'style-src': ["'self'", "'unsafe-inline'"], // section HTML carries its own <style>
        'style-src-attr': ["'unsafe-inline'"], // layout uses CSS variables in style attributes
        'img-src': ["'self'", 'data:', 'https://i.ytimg.com', 'https://*.google-analytics.com', 'https://*.googletagmanager.com', 'https://www.facebook.com', 'https://analytics.tiktok.com', 'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net', 'https://www.google.com', 'https://www.google.co.id'],
        'font-src': ["'self'"],
        'frame-src': ["'self'", 'https://www.youtube-nocookie.com'], // self = admin preview
        'connect-src': ["'self'", 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com', 'https://www.facebook.com', 'https://connect.facebook.net', 'https://analytics.tiktok.com', 'https://*.tiktokw.us', 'https://www.google.com', 'https://googleads.g.doubleclick.net', 'https://www.googleadservices.com'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});
// Cloud storage: the first request after the first deploy copies the bundled data/ into Redis.
// …then one-time data migrations (pages split into templates).
app.use((req, res, next) => ensureSeeded().then(ensureMigrated).then(ensureHomepage).then(() => next(), next));

const PROD = process.env.NODE_ENV === 'production';
express.static.mime.define({ 'image/avif': ['avif'] });
app.use('/assets', express.static(path.join(ROOT, 'public', 'assets'), { maxAge: PROD ? '7d' : 0 }));
app.use('/uploads', express.static(path.join(ROOT, 'public', 'uploads'), { maxAge: PROD ? '30d' : 0, dotfiles: 'deny', index: false }));
app.use('/uploads', serveUpload); // images uploaded after deploy (Vercel Blob)

async function loadPage(slug) {
  if (!SLUG.test(slug)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(PAGES_DIR, `${slug}.json`), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

if (READONLY) {
  // Deployed without a database: pages are served from the bundled content, the admin stays off.
  app.use('/admin', (req, res) => res.status(503).set('Cache-Control', 'no-store').type('text')
    .send('Admin belum aktif: database (Upstash Redis) belum dihubungkan ke project Vercel ini.'));
} else {
  app.use('/admin', adminRouter({ assetVersion: ASSET_VERSION }));
}

// First-party analytics beacon (cookieless, see src/analytics.js). Always answers 204.
// Existence check without downloading the page JSON.
const pageExists = async (slug) => SLUG.test(slug) && fs.access(path.join(PAGES_DIR, `${slug}.json`)).then(() => true, () => false);
app.post('/t', rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: false, legacyHeaders: false }),
  express.text({ type: '*/*', limit: '2kb' }), async (req, res) => {
    try {
      await track(req, JSON.parse(req.body || '{}'), { pageExists });
    } catch {
      /* malformed beacon: ignore */
    }
    res.status(204).end(); // after the write: a serverless instance may be frozen once it has answered
  });
app.post('/t/e', rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: false, legacyHeaders: false }),
  express.text({ type: '*/*', limit: '16kb' }), async (req, res) => {
    try {
      await trackEngagement(req, JSON.parse(req.body || '{}'), { pageExists });
    } catch {
      /* malformed beacon: ignore */
    }
    res.status(204).end();
  });

// "Coba di HP": a temporary link (1 hour) that shows a page DRAFT on a real phone. Never indexed or tracked.
app.get('/p/:token', async (req, res, next) => {
  try {
    const slug = await resolveLink(req.params.token);
    if (!slug || !(await loadPage(slug))) return res.status(410).type('text').send('Link preview sudah kedaluwarsa. Buat link baru dari editor.');
    const { state } = await openDraft(slug, async () => ({ page: await loadPage(slug), global: await getGlobal() }));
    const promo = await activePromo();
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    const page = await resolvePage(state.page);
    res.type('html').send(renderPage({ ...page, robots: 'noindex, nofollow' }, { assetVersion: ASSET_VERSION, global: { ...state.global, ga4Id: '' }, promo }));
  } catch (e) {
    next(e);
  }
});

pruneAnalytics().catch(console.error);
setInterval(() => pruneAnalytics().catch(console.error), 24 * 3600 * 1000).unref();

// Shop: product pages with one-product checkout, order status pages, public shop API.
if (!READONLY) app.use(storefront({ assetVersion: ASSET_VERSION }));

// CS Rotator: /go/wa/<id> sends each click to the next WhatsApp number of that group (Global → CS Rotator).
app.get('/go/wa/:id', rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: false, legacyHeaders: false }), async (req, res, next) => {
  try {
    const id = String(req.params.id).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) return next();
    const rot = ((await getGlobal()).rotators || []).find((r) => r.id === id);
    if (!rot || !rot.numbers.length) return res.status(404).type('text').send('Nomor WhatsApp untuk tombol ini belum diatur.');
    const n = await kv.incr(`rotator:${id}`);
    const number = rot.numbers[(n - 1) % rot.numbers.length];
    // Chats per number (Laporan → CS Rotator): all-time + per WIB day for 40 days. Never blocks the redirect.
    const day = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
    await Promise.all([kv.incr(`rotstat:${id}:${number}`), kv.incr(`rotstat:${id}:${number}:${day}`, 40 * 864e5)]).catch((e) => console.error('rotator stats', e.message));
    const text = typeof req.query.text === 'string' ? req.query.text.slice(0, 500) : rot.message;
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    res.redirect(302, `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
  } catch (e) {
    next(e);
  }
});

// Homepage: the page with slug "home" is served at "/" (and /home redirects there).
const HOME = 'home';
app.get('/', (req, res, next) => servePage(HOME, req, res, next, true));

app.get('/:slug', (req, res, next) => {
  const slug = req.params.slug.toLowerCase();
  if (!SLUG.test(slug)) return next(); // favicon.ico, robots.txt, … : no storage reads
  if (slug === HOME) return res.redirect(301, `/${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`);
  return servePage(slug, req, res, next);
});

async function servePage(slug, req, res, next, isHome = false) {
  try {
    // Page, global settings and the active promo are independent: read them in parallel.
    const [raw, global, promo] = await Promise.all([loadPage(slug), getGlobal(), activePromo()]);
    if (!raw && isHome) return res.redirect(302, '/slimmealsolutionmintidn2'); // no homepage yet
    if (!raw) {
      // Pages whose link was changed in the admin keep working via a permanent redirect.
      const to = (await getRedirects())[slug];
      if (to && SLUG.test(to)) return res.redirect(301, `/${to}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`);
      return next();
    }
    const page = await resolvePage(raw); // template blocks -> their sections
    // Dev-only: ?only=id1,id2 renders just those sections (used by design-src calibration tools)
    if (!PROD && typeof req.query.only === 'string') {
      const ids = new Set(req.query.only.split(','));
      page.sections = page.sections.filter((s) => ids.has(s.id)).map((s, i) => (i === 0 ? { ...s, mt: 0 } : s));
      const html = renderPage(page, { assetVersion: ASSET_VERSION, global, promo }).replaceAll('loading="lazy"', 'loading="eager"');
      return res.set('Cache-Control', 'no-store').type('html').send(html);
    }
    res.set('Cache-Control', PROD ? 'public, max-age=60' : 'no-cache');
    res.type('html').send(renderPage(page, { assetVersion: ASSET_VERSION, global, promo }));
  } catch (err) {
    next(err);
  }
}

app.use((req, res) => res.status(404).type('text').send('Halaman tidak ditemukan'));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).type('text').send('Terjadi kesalahan');
});

// Vercel imports the app and runs it as a function; locally it listens on PORT.
if (!process.env.VERCEL) app.listen(PORT, () => console.log(`Landing page server: http://localhost:${PORT}`));
export default app;
