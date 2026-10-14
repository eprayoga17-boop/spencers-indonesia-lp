# HANDOFF — context for the next AI session (read this first)

Project root: `C:\Users\RIGA\OneDrive\Documents\mealblend-lp` (Windows 11, Node 24, not a git repo yet).
User: Indonesian speaker (reply in Bahasa Indonesia), product/marketing person for Spencer's MealBlend.
User preferences: prioritise progress over reports; short reports; few screenshots; build the whole thing first,
then revise piece by piece; ask only when genuinely blocked. Wants the `ui-ux-pro-max` skill used for UI work.

## The user's original brief (6 points)
1. Mobile-only landing page (no desktop version) identical to the live Wix page
   https://www.spencerscalifornia.com/slimmealsolutionmintidn2 (user chose "persis halaman live" over the
   Figma file E65QWhPp9QOLxMfSOs6lmd "LP-MEALBLEND-NEW-2026", whose content differs). Approve visuals before
   doing anything else. **Status: DONE** (see "Phase 1" below) — user has seen it; explicitly told us to continue.
2. Admin page to edit the site **by section**, sections defined by topic/visual (e.g. "Slider Event under the red
   promo bar" is one section, "Testimoni" is one section), NOT by Figma layers.
3. In the admin: drag to reorder sections up/down (like a list with drag handles); each section's content is either
   an uploaded **HTML file** or an uploaded **image**.
   - HTML upload: system automatically strips `<html>`, `<head>`, `<body>` and keeps only the section content so it
     cannot break the page (keep `<style>` from head, scope it to the section).
   - Image upload: fit-to-width (any upload width scales to the page max width). HTML also limited to page width.
4. Pages are **templates**: a page can be duplicated to a new link (slug) with identical content, then edited.
5. Ask the user if anything is unclear.
6. Security baseline: OWASP Top 10, PDP (Indonesian UU Pelindungan Data Pribadi), SOC-style controls.
   Admin login = email + password only (NO Google Authenticator/2FA yet).

Answers already given by the user for phase 2:
- Hosting: **local only for now**.
- Admin email: **dummy** for now (e.g. `admin@mealblend.test`).
- Login: **email + dummy password** (not magic link).

## Current state
### Phase 1 — landing page (done)
- Server: `server.js` (Express 4 + helmet CSP). Run: `npm run dev` → http://localhost:3000/slimmealsolutionmintidn2
  (Claude preview config: `C:\Users\RIGA\OneDrive\Documents\.claude\launch.json` entry `mealblend-lp`, port 3000).
- Page data: `data/pages/slimmealsolutionmintidn2.json` = `{ title, description, settings, sections[] }`.
  Section types: `image` (items with src w/o extension → `.avif` + `.webp`; optional x,w,h,mt in design units,
  320 = page width; `layout: "slider"` makes a slider) and `html` (`html` string). HTML sections built by our tools
  keep their source image list in `_items` (used by the design tools only — keep it when editing).
- Renderer: `src/render.js`. Front-end: `public/assets/css/lp.css`, `public/assets/js/lp.js` (sliders,
  click-to-load YouTube facade via `.lp-yt[data-yt=ID]`, FAQ uses `<details>`). Fonts self-hosted in
  `public/assets/fonts`. Images: `public/uploads/seed` (from live page), `public/uploads/sections/<sectionId>/`.
- Dev-only query `?only=id1,id2` renders just those sections (used by calibration tools).
- 48 sections, 41 are real HTML text over "clean plate" background images. User rules for this conversion:
  posters/product-box art stay ONE image (Award "National Best Brand", Artisan Tea x2, "200.000++ customer",
  CTA promo banner), badges stay images (Instant Effect, 14-Day promo badge), WhatsApp chat screenshots stay
  images, "Explore 10 Flavors" = 10 separate images, YouTube "Langsung Kenyang, Tahan Lama!" box = 4:5.
- Design tooling (dev only, `design-src/`): `plates.mjs build|calibrate <ids>` (erases text from live artwork,
  overlays HTML text, auto-calibrates with puppeteer-core + headless Chrome), specs in `plates-spec.mjs` +
  `plates-spec-2.mjs`, calibration state `plates-calib.json`, first 5 sections from Figma via
  `build-sections.mjs`, visual diff `compare-section.mjs <ids>`, final small edits `post-fixes.mjs`.
  Live originals in `design-src/live/`. Figma MCP is on the Starter plan and its quota ran out.

### Phase 2–4 + 6 — admin (DONE 2026-10-14, tested end-to-end)
Admin at `/admin` (login, Halaman, Editor, Riwayat, Log Aktivitas). Files: `src/admin/{security,sanitize,media,routes}.js`,
`public/admin/{admin.css,admin.js}`, `scripts/create-admin.mjs`, `.env` (+ `.env.example`), `SECURITY.md`.
Dummy admin `admin@mealblend.test`; password only in `data/secrets/admin-credentials.txt` (gitignored).
Section JSON additions: `scope` (CSS scope key → `data-s` attr), `source` (unscoped sanitized HTML shown in editor),
`wrap: true` (uploaded HTML wrapped in `.lp-html`, clipped to page width), image items `iw/ih` (pixel size).
Tests: `node design-src/test-sanitize.mjs` (existing 46 HTML sections survive re-sanitize; attack samples clean).
Sessions are in-memory: `node --watch` restarts (any server-side file edit) log the admin out.
Possible next steps (ask user): 2FA later, real admin email, hosting/HTTPS + backups, user feedback on admin UI.

### Editor v2 (Berdu-style) — DONE 2026-10-14
User asked to mirror Berdu's page editor. Header: Kembali · name · status · undo/redo · Lihat live · **Simpan**.
Tabs: Konten (Nama Halaman, Domain Utama (fixed), URL Path, Kategori, section list) · Desain (Lebar, Warna BG, Font,
Thumbnail Upload/Cari, Export/Import) · SEO (noindex, Judul, Meta Deskripsi, Keywords tags) · Global (default width,
font, favicon) · Riwayat (published versions → "Muat ke draft", + this page's activity log).
- **Draft model** (user approved): every edit goes to `data/drafts/<slug>/` (one JSON state per step, `meta.json`
  with pos/savedPos/rev); live page changes only on Simpan (`POST /publish`). Undo/redo = move pos (Ctrl+Z / Ctrl+Shift+Z).
  `src/drafts.js`. Global settings (`data/global.json`, `src/global.js`) are part of the draft state too.
- URL change applies on Simpan: `renamePage` moves page + history, adds 301 in `data/redirects.json` (server.js).
- Preview = iPhone 11 frame drawn in CSS (414×896 screen, scaled to fit), iframe `/admin/preview/:slug` renders the
  draft incl. hidden sections (faded). `public/admin/preview.css` is injected by admin.js: click in preview selects
  section (two-way), selection = orange 12% overlay + outline, pulse scale 1.03 (user agreed 3%, not 5%).
- Right-click menu on rows and in preview: Cut/Copy/Tempel atas/bawah/Sembunyikan/Perlihatkan/Rename/Edit/Duplikat/
  Hapus (confirm). Clipboard per admin in `data/clipboard/` (works across pages). Shortcuts Ctrl+X/C/V, F2, Del, Ctrl+S.
- Export/Import: `src/admin/transfer.js` → code `MBP1.<deflate base64url>.<HMAC>` (key `EXPORT_SECRET` auto-added to
  .env). Images referenced by URL (internal-only per user). Import replaces draft content (keeps slug), undoable.
- Later (user said): admin account types/roles decide who sees login/security logs.

### Promo (site-wide) — DONE 2026-10-14
Menu **Promo** (`/admin/promo`, `src/promos.js`, API `/admin/api/promos*`). Only ONE promo is live:
manual-toggled INSIDENTIL > INSIDENTIL whose date range covers now > REGULAR whose date range covers now > none.
Regular promos have no toggle (schedule only); turning one insidentil toggle on turns the others off. Dates are WIB.
Edits go to `data/promos-draft.json`; **Publish** writes `data/promos.json` → all live pages change immediately
(resolved per request, no page re-save). Each promo: banner, badge (images in `/uploads/sections/promos/`) and the
red bar text (title, left, right, colour). Banner link is static per page section (`sec.href`).
- Page sections `type:"promo"`, `part:"banner"|"bar"` (locked: only name/visible/spacing editable; `x`,`w` keep the
  old banner placement). Badges: `page.badges[] = {id, section, cx, cy, w}` (centre + width in design units, relative
  to the section), rendered as `.lp-badge` inside the section; dragged/resized in the editor preview (draft steps).
- Migration `scripts/migrate-promo.mjs` (already run): promo bar + both CTA banners → [PROMO] sections (CTA rest
  renamed "CTA Chat Admin"), the SVG 14-Day badge in "Manfaat Utama" → floating badge. Seeded promos: 10.10
  (insidentil, 10 Okt 2026) and 14 Day Promo (regular, 1 Okt – 31 Des 2026 — assumed, user can change).
- Admin sessions are now mirrored (hashed ids) to `data/sessions.json` so dev restarts don't log out.

### Admin redesign + Laporan — DONE 2026-10-14
- Shell: dark sidebar (Dashboard · Laporan · Halaman · Logout; collapsible, off-canvas on mobile), app bar with
  light/dark toggle (`public/admin/theme.js` sets `data-theme` before paint; light default; tokens in admin.css).
  Halaman has sub-tabs Halaman | Promo; Laporan has sub-tabs Page View | Log Aktivitas (`/admin/audit` → redirect).
- Analytics (`src/analytics.js`): beacon `POST /t` from lp.js (skips /admin, honours GPC), cookieless, daily-rotated
  salt hash for visitors, no IP stored, JSONL per WIB day in `data/analytics/`, 400-day retention. Geo comes from
  hosting headers (cf-region-code / x-vercel-ip-country-region), empty locally. `ua-parser-js@1.0.41` (MIT).
  Sample data (user approved) in `data/analytics-sample/`, removable from Laporan ("Hapus data contoh").
- GA4: Global setting `ga4Id` → gtag + `/assets/js/ga.js` (CSP allows Google domains). UI field not added yet.
- Map: `public/admin/id-map.json` built by `design-src/build-map.mjs` from superpikar/indonesia-geojson (old
  province split; new provinces coloured via MAP_PARENT).
- Charts are hand-written SVG in admin.js (lineChart, sparkline, donut, indoMap, rankList).
- Brand: "Spencer's Indonesia" + medallion logo `public/admin/logo.png` (96px copy of the favicon; user may drop a
  bigger PNG there). Admin font Geist (`public/assets/fonts/geist-variable.woff2`, OFL licence file next to it).

- Later change (user): sidebar has 4 pages — Dashboard, Laporan, Halaman, **Promo** (no Halaman|Promo sub-tabs).
  Login left panel = the user's company image (`public/admin/login-hero.webp`, already contains logo + copy).
  Promo bar: one font size for both lines (12.69 design units).

### UX round 2 — DONE 2026-10-14 (all 13 audit items approved by user)
- Split-screen login (`login-hero.webp` cropped from manfaat-utama bg). `?next=` return-to-page after login
  (validated by `safeNext`, admin paths only). Idle warning 2 min before the 30-min logout ("Tetap masuk" → `/admin/api/ping`).
- Editor: sidebar navigation asks Simpan/Pindah/Batal when the draft is dirty; "Coba di HP" → QR + 1-hour link
  `/p/<token>` (`src/preview-links.js`, hashed tokens in data/preview-links.json, LAN IP in dev; renders the draft,
  noindex, not tracked); warning box when the live promo has no badge/banner/bar for this page.
- Nav dots (`/admin/api/status`) for unsaved page drafts / unpublished promo draft; promo toasts offer "Publish sekarang";
  promo timeline (100 days, same resolution rules as server) with "Tidak ada promo" gap warning.
- Halaman: search box, auto cover (first page image), "Statistik" button → `/admin/reports?slug=`, template gallery in
  "Halaman baru". Global tab: GA4 Measurement ID field.
- Laporan: WhatsApp clicks + conversion KPIs (dashboard too), CSV export (`/admin/api/reports.csv`), tab **Per Bagian**
  (user chose "bagian + klik + heatmap", only in Laporan): lp.js sends `/t/e` on hide/leave with seen sections, ms per
  section and clicks [section, kind, x, y in design units]; `sectionReport()` aggregates; heatmap = `/admin/live/:slug`
  in an iframe with attention tint (reach %) or click dots. Sample data includes engagement for the main page.

#### Original admin plan (kept for reference)
Installed deps: express, helmet, sharp@0.35.5 (upgraded for CVEs; `npm audit` = 0), multer@2,
sanitize-html@2, express-rate-limit@7; dev: puppeteer-core.

Written so far (not wired into server.js yet, untested):
- `src/store.js` — page JSON storage: `getPage/listPages/savePage/createPage/archivePage`, atomic writes,
  history snapshot on every save in `data/history/<slug>/<ts>.json` (keep 50), `listHistory/readHistory`,
  per-page write lock `withPageLock`, `isValidSlug` (reserved: admin, assets, uploads, api…), `newSectionId`.
- `src/admin/security.js` — scrypt password hashing (`hashPassword`), admins from env `ADMIN_USERS`
  (`email:scrypt$...;email2:...`), `authenticate` with per email+IP lockout (5 fails → 15 min), dummy-hash
  timing equalisation, server-side sessions (32-byte ids, HttpOnly, SameSite=Strict, Secure+__Host- in prod,
  idle 30 min, absolute 8 h), `requireAdmin`, `requireCsrf` (token from session via `x-csrf-token` header or
  `_csrf` field + origin check), `audit()` JSONL in `data/audit/audit-YYYY-MM.log`, `readAudit`, `pruneAudit`
  (90-day retention for PDP).

(all items below are implemented)
1. `src/admin/sanitize.js`: extract body (+ head `<style>`) from uploaded HTML; convert YouTube iframes to
   `<div class="lp-yt" data-yt="ID">`; sanitize with sanitize-html (no script/iframe/object/form/on* attrs,
   http/https/mailto/tel links, data: only for img); scope CSS by nesting it under `#<sectionId>` and hoisting
   `@font-face/@keyframes`, drop `@import`, `expression(`, `javascript:`; rewrite references to uploaded asset
   files (HTML + its images uploaded together) to their new URLs; wrap content so it never exceeds page width.
2. `src/admin/media.js`: sharp with `limitInputPixels`, `.rotate()`, resize max width 1440, output webp+avif,
   metadata stripped (EXIF/GPS — PDP), random filenames, reject SVG/non-images (validate by decoding),
   animated GIF → animated webp only (`ext: 'webp'`). Image sections without w/h render fluid (fit to width);
   add width/height attrs to avoid layout shift.
3. `src/admin/routes.js` mounted at `/admin` (+ `express.urlencoded`/`json` with small limits, rate limit on login):
   login/logout, pages list (edit / view / duplicate-to-new-slug / archive), page editor, JSON API:
   page meta, reorder, create section (image|html, multipart), update section (name, visible, spacing,
   alt/link per image, replace content, raw HTML edit → sanitized), duplicate/delete section, history list +
   restore, audit log view, admin preview `/admin/preview/:slug` (auth required). Every write → audit + history.
4. Admin UI (no build step, CSP `script-src 'self'`, CSRF token in `<meta>`): `public/admin/admin.css`, `admin.js`.
   Pages list as cards; editor = section list (drag handle via HTML5 DnD + ↑/↓ buttons for keyboard/touch,
   visibility toggle, edit, duplicate, delete) next to a 375-px phone preview iframe that scrolls to the
   selected section; section dialog with tabs Gambar / HTML. Indonesian UI text. Brand accent ~#e3727a.
5. `server.js`: `process.loadEnvFile(path.join(ROOT,'.env'))` (try/catch), mount admin router before `/:slug`,
   remove/keep `?only=` dev-only. `.env` (gitignored) with `ADMIN_USERS`; create `scripts/create-admin.mjs`
   to generate a hash; create a dummy admin `admin@mealblend.test` with a random password stored only in a
   gitignored local file (tell the user where), `.env.example` without secrets.
6. `SECURITY.md` mapping controls to OWASP Top 10 / PDP / SOC (access control, crypto, injection/XSS sanitising,
   upload validation, rate limiting, CSP/headers, session mgmt, CSRF, audit logging & retention, change history,
   least data). Then test end-to-end in the browser (login, reorder, upload image/HTML, duplicate page, lockout).

## 2026-10-14 — GitHub + Vercel

- Flowcharts of every user/admin flow: `docs/ALUR.md` (Mermaid, renders on GitHub).
- `src/storage.js` switches storage by environment: files locally; Upstash Redis (`KV_REST_API_*`) + Vercel Blob
  (`BLOB_READ_WRITE_TOKEN`) on Vercel. All modules import `fs` from it. Sessions, lockouts and preview links use its `kv`.
  `server.js` exports the app (Vercel) and only listens when not on Vercel. Beacons are written before the 204.
- `npm run vercel-build` → `src/seed-data.js` (gitignored); first request seeds Redis once (`seeded` key).
- Fixed on the way: promo date regex had lost its backslashes (dates were rejected); export codes of pages with
  [PROMO] sections were rejected on import.
- Not in git (large design references): `design-src/live/`, `design-src/figma/`, `perbandingan-5-section.jpg`.
- Live: https://spencers-indonesia-lp.vercel.app (Vercel project `spencers-indonesia-lp`, region sin1, Node 24, Express preset
  via `vercel.json`, auto-deploy from GitHub `main`).
- Without Redis env vars the Vercel build runs **read-only** (`READONLY` in storage.js): pages come from the bundled seed,
  `/admin` answers 503. Connect Upstash Redis (Vercel Marketplace, env `KV_REST_API_*`) and redeploy to enable the admin.
- Vercel's function loader cannot `require()` ES modules, so `sanitize-html` 2.18 (+ ESM-only htmlparser2 12) is bundled into
  `src/vendor/sanitize-html.js` by `scripts/bundle-sanitizer.mjs` (postinstall + vercel-build; gitignored). Output verified
  identical to the package with `design-src/test-sanitize.mjs`. Do not downgrade to 2.17.x (known XSS advisories).

## 2026-10-14 — Admin performance

- Every request logs `[timing] … total=…ms store=<calls>x/<ms>` on Vercel (`vercel logs <deployment>`); admin responses carry a
  `Server-Timing` header. Measured live: one Upstash call ≈ 225–300 ms from sin1 because the current database's primary is not
  in Singapore (endpoint `global-ap1` forwards). **Fix: a new Upstash Redis DB with primary region ap-southeast-1**, then copy keys.
- Code: batched reads (`readMany`, `mtimes`), `writeAtomic` (no temp+rename in Redis), single-round-trip deletes, parallel
  independent reads in routes, analytics range = 2 round trips. 100 ms/call simulation: dashboard 1.6→0.6 s, editor 1.7→0.6 s,
  30-day report 1.8→0.55 s, one edit 1.1→0.65 s. Versioned assets/uploads cached immutable via vercel.json.
- `.agents/`, `.claude/skills/`, `skills-lock.json` (Upstash agent skills added by the Upstash setup) are not committed.
