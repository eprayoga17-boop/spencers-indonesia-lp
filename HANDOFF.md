# HANDOFF — context for the next AI session (read this first)

## Quick start (state on 2026-10-15)
- **Code**: https://github.com/eprayoga17-boop/spencers-indonesia-lp (public, branch `main`). Local working copy on the
  user's PC: `C:\Users\RIGA\OneDrive\Documents\mealblend-lp` (Windows 11, Node 24).
- **Live site**: https://spencers-indonesia-lp.vercel.app/slimmealsolutionmintidn2 — admin at `/admin`.
  Vercel project `spencers-indonesia-lp` (account `eprayoga17-boop`, Hobby plan, region sin1). Every push to `main`
  deploys automatically. Environment-variable changes need a redeploy (`vercel redeploy <deployment-url> --target production`).
- **Storage on Vercel**: Upstash Redis `spencers-redis-sg` (primary Singapore, Free, eviction off; env `KV_REST_API_URL/TOKEN`)
  holds pages, drafts, promos, global settings, sessions, analytics and the audit log. Vercel Blob `spencers-indonesia-uploads`
  (public; env `BLOB_READ_WRITE_TOKEN`) holds images uploaded in the admin. Locally the same code uses files in `data/`.
  **The live content lives in Redis, not in the repo's `data/` folder** (that folder only seeded the first deploy).
- **Secrets are not in GitHub**: `.env` (ADMIN_USERS, EXPORT_SECRET) and `data/secrets/admin-credentials.txt` (dummy admin
  `admin@mealblend.test` password) exist only on the user's PC; ADMIN_USERS/EXPORT_SECRET are also Vercel env vars (sensitive).
  Ask the user if a password is needed; never print it.
- **Tools**: Vercel CLI (logged in) for `ls / inspect / logs / env / redeploy` — the Vercel MCP connector gets 403 on this
  personal account. GitHub CLI at `C:\Program Files\GitHub CLI\gh.exe` (logged in). `vercel logs <url>` shows one
  `[timing] … store=<calls>x/<ms>` line per request.
- **Docs**: `README.md` (run/deploy), `SECURITY.md` (OWASP/PDP/SOC mapping), `docs/ALUR.md` (technical flows, Mermaid),
  `docs/flowchart-website/` (non-technical flowcharts for the team: 5-page PDF/PNG + single-page `Alur-Keseluruhan`;
  rebuild with `node scripts/build-flowchart.mjs` / `node scripts/build-flowchart-overall.mjs`).

## How to work with this user
- Indonesian speaker (reply in Bahasa Indonesia), product/marketing person for Spencer's Indonesia (brand: Spencer's MealBlend).
- **Since 2026-10-15: build new features on localhost first, push to GitHub only when the user says the feature is
  finished** ("kerjakan localhost dulu, nanti baru dipush"). Pushing `main` deploys to Vercel. Local test data in `data/`
  (pages, promos, templates) is not committed. Port 3000 may be used by another chat's dev server; `.claude/launch.json`
  also has `mealblend-lp-3001`.
- **Confirm before significant changes** (the user regularly asks "konfirmasi dulu"); for small fixes just do them.
- Do not log in to the live admin with credentials yourself; ask the user to try flows that need a login.
- Prioritise progress over reports; short reports; few screenshots. Wants `ui-ux-pro-max` for UI work; QA skills from
  `petrkindlmann/qa-skills` are installed globally (e.g. `performance-testing`).

## Open items / ideas (not started; ask the user first)
- 2FA (TOTP) and a real admin account (the dummy admin is reachable on the internet); admin roles (who sees security logs).
- Vercel Hobby is non-commercial by Vercel's terms — company use needs Pro.
- Landing page speed: subset the woff2 fonts to Latin and add responsive `srcset` for images (see the Lighthouse section).
- Scheduled backup/export of Redis; GA4 still loads without the cookie notice (pixels.js has one; reuse it for GA4);
  delete sample analytics once real data exists.
- `data/promos.json` / `data/promos-draft.json` changes on the user's PC are local tests — do not commit them.

## Template + Page + editor v3 — DONE on localhost (2026-10-15, not pushed yet)
- User's model: **Homepage** (clone of www.spencers.id at `/`, NEXT step, not started) · **Page** (landing page with a link,
  composed of Templates + standalone Sections) · **Template** (ordered group of sections). Templates are **linked**: saving a
  template changes every page that uses it; "Lepas jadi section biasa" copies it into one page only.
- Data: `src/templates.js` (`data/templates/<id>.json`, id `t-xxxxxxxx`, history `data/template-history/`, drafts
  `data/template-drafts/` via `makeDrafts()` in `src/drafts.js`). A page section `{ type:'template', template:<id> }` is a
  reference; `expandPage/resolvePage/resolvePages` replace it with the template's sections (same section ids → per-section
  reports continue; duplicates get `-2`; admin preview adds `data-ref=<ref id>`; template badges are merged). Templates
  cannot contain templates. Rendering calls `resolvePage` in server.js (`/:slug`, `/p/:token`) and admin preview/live/reports.
- API: one editor router (`ed` in routes.js) mounted at `/admin/api/pages/:key` and `/admin/api/templates/:key` with doc
  adapters (`DOCS.page|template`); template list/create/duplicate/import/delete at `/admin/api/templates` (delete refused
  while used). New: `POST …/sections` `{type:'template', template}`, `POST …/sections/:id/detach`. Views `/admin/templates`,
  `/admin/templates/:id` (body `data-kind="template"`), preview `/admin/preview-template/:id`.
- Migration `src/migrate-templates.js` (runs once per storage, kv claim `migration:templates-v1`, idempotent; also on Vercel at
  first request after deploy): LP `slimmealsolutionmintidn2` → Template 1 (promo-bar…promo-banner, 32 sections, owns the
  14-day badge) + cta-1 + pembayaran-distributor-1 + Template 2 (offline-judul…promo-banner-2) + cta-2 +
  pembayaran-distributor-2 + Template 3 (video-distributor…footer). Verified: public HTML byte-identical before/after.
  It discards an existing draft of that page.
- Editor v3 (admin.js `viewEditor`, CSS "Editor v3" block): narrow left panel + preview canvas; Desktop | Tablet | HP toggle
  in the bar (remembered in localStorage `mb-device`; HP = iPhone 11 frame, Tablet = iPad Air 820×1180 frame, Desktop =
  full width); template rows expand to show their sections; "+ Tambah" menu (Muat Template… / Section / [PROMO] / Tempel);
  template block selected as one in the preview with a "Template · name" tag. Halaman menu has tabs **Page | Template**.
- Tests (scratchpad, not in repo): template e2e 29/29 and the old regression suite pass locally and against mock Redis.

## Homepage (clone of www.spencers.id) — DONE on localhost (2026-10-15, not pushed yet)
- The homepage is the page with slug `home`, served at `/` (`/home` → 301 `/`; if it is missing `/` still redirects to the
  MealBlend Women LP). Slug `home` is reserved: it cannot be renamed, archived, created again or taken by another page.
- Admin: Halaman has tabs **Homepage | Page | Template** (`/admin/homepage`); the Page list hides `home`; the editor shows a
  "Homepage" chip, a locked URL field and "Lihat live" → `/`.
- Content built by `scripts/clone-homepage.mjs` (one-off; `--force` rebuilds): header logo bar, 7-banner slider, the
  banner image blocks with their links (other Berdu pages still link to www.spencers.id; "Chat Admin" uses Berdu's CS
  rotate link until our CS Rotator has numbers), Paper.id, media awards, the distributor list (element "Daftar
  Distributor", data from the Distributor menu) and a black contact footer (phone links improved to tel:/wa.me).
  Images were re-encoded into `public/uploads/sections/home-*/` (commit them with the page).
- `scripts/home-banners.mjs` (step 2, after the clone): the product cards + "Customer Care" became **Banner + Teks**
  elements — the baked-in headline/button pixels were removed from the images ("ink" between background and black only)
  and replaced by a real `<h2>` + real buttons in Montserrat, positioned/sized from measurements. Re-running needs a fresh
  clone (`clone-homepage.mjs --force`) because it deletes the source slices. Headline copy kept as on the live site
  ("FOR WOMAN").
- Vercel: `src/migrate-home.js` copies the bundled `data/pages/home.json` and `data/distributors.json` into Redis once
  (kv claim `migration:homepage-v1`) when the storage was seeded before they existed (tested against mock Redis).

## Figma → website: skill `figma-lp-to-sections` + first LP BurnX Matcha — DONE on localhost (2026-10-15, not pushed)
- Skill: `.claude/skills/figma-lp-to-sections/` (SKILL.md + reference/conversion-rules.md, fx-html.md, spec-format.md).
  Input = a Figma link to the LP frame (`node-id=`), not a .fig. `FIGMA_TOKEN` (read-only) is in the user's `.env`.
  Scripts: `scripts/figma/figma.mjs` (fetch tree/renders/fills, export layers), `build.mjs` (spec → fx HTML with real
  text + assets + manifest), `push.mjs` (manifest → local admin drafts: templates, page, sections; `--compare`).
  Figma exports live in `design-src/figma/` (git-ignored). New fonts: Bebas Neue, DM Sans (+ classes ff-bebas, ff-dmsans);
  FAQ "Kotak" got header colours (`headBg`, `headColor`).
- BurnX Matcha (Figma `i8iKtYHyaQoO69Jq2WZBG7`, node 1:30) → draft page **/burnxmatchawomen** = Template "BurnX Matcha 1 ·
  Testi s/d Resep Brand" (19 HTML + Video + [PROMO] Banner) → CTA (HTML + Tombol Chat Admin → CS Rotator
  `cs-burnx-matcha`, still EMPTY by the user's choice; Tombol Info Peluang Distributor → spencers.id/agentslimdistributorretail1)
  → Template "BurnX Matcha 2 · Testi s/d Award" → Template "FAQ Spencer's BurnX Matcha" → Template "Disclaimer Medis &
  Legal". User rule: FAQ = one template per PRODUCT (not men/women). Nothing published yet.
- /burnxmatchawomen was then aligned with the LIVE Wix page (spencerscalifornia.com/slimmealsolutionburnxidn2), which
  differs from the Figma file: [PROMO] Bar on top; promo badge on both heroes; live-only images 200.000++ Customer,
  12 Years Journey/National Award, Offline Experiences, Telah Teruji, "12 years of Success Stories" + MealBlend's media
  slider; [PROMO] Banner after "Resep Brand"; CTA + Pembayaran Paper.id + Info Peluang Distributor
  (agentslimdistributorretail3) twice; FAQ; shared template **"Footer Spencer's"** (t-7w224czk, also on MealBlend; the
  MealBlend one is now "MealBlend · Disclaimer" + Footer). No award block / disclaimer at the end (as live). Template
  "Disclaimer Medis & Legal" is now unused. Live Chat Admin goes to WA 0853-8553-9053; our button uses the empty CS
  Rotator `cs-burnx-matcha`. Published locally.
- MealBlend Women (local, published 2026-10-15): Template 3 split → "MealBlend Women 3 · Kisah Distributor s/d Tips
  Dokter" + **"FAQ Spencer's MealBlend"** (t-79rs4nay) + "MealBlend · Disclaimer & Footer" (t-brzmg3j5); page refs
  `tpl-ref-faq`, `tpl-ref-footer`. Public HTML byte-identical before/after.
- ⚠ Vercel/Redis: the live Redis was seeded long ago, so the BurnX templates/page and this FAQ split exist only in the
  local data files. Before/at deploy: recreate them on live (push.mjs can't target live — it is localhost-only), or add
  a one-time migration like `migrate-home.js` that copies these templates/pages from the bundle when missing.

## UX round 3 — DONE on localhost (2026-10-15, not pushed yet). User approved review items 1–7 and 9 (not 8 = move all
## LPs here, not 10 = admin security: still testing/pitching, many people need access)
1. "Simpan" → **Publikasikan**; status "Draft tersimpan · belum live" / "Live · <tanggal>" (`role=status`); leaving with
   a draft offers "Publikasikan & keluar" or "Keluar, simpan sebagai draft".
2. **Gambar & HTML are edited in the left panel** (old popup `sectionDialog` removed): image list with alt/link,
   replace/reorder/delete, stack ↔ slider, drop zone; HTML code with live preview (1.2 s idle or Ctrl+Enter), .html upload,
   supporting images, sanitiser notes. New Gambar/HTML create nothing until there is content. `?render=` now re-renders any
   section type.
3. **Templates are edited in place** from the page editor (row edit / click in preview): panel with a "tersambung ke N
   halaman" warning, its sections, add elements, "Publikasikan template" / "Buang". The page preview shows template
   drafts (`/admin/preview/:slug` uses `templateDrafts.peek`). Publishing the page asks "Halaman saja / Halaman +
   template" when a used template has a draft. Template calls send their own draft revision: `api(…, { rev })`.
   The full template editor is still in the row menu ("Buka editor template penuh").
4. Homepage headlines/buttons are real text (see Homepage). New element **Banner + Teks**; button size "Sangat kecil",
   icon left/right, arrow icon; font **Montserrat** (OFL, `public/assets/fonts/montserrat-latin-var.woff2`).
5. **Distributor menu** (`/admin/distributors`, `src/distributors.js`, `data/distributors.json`, audit
   `distributor.*`): province / city / area / TOP SELLER / links (type guessed from URL, https only). Element **Daftar
   Distributor**: grouped per province, search box ("Cari kota atau provinsi…", opens matches when ≤3), help link when
   nothing matches. Changes are live at once (15 s cache per instance). Medan Barat merged into Sumatera Utara › Medan.
6. Number fields show real size: "≈16px HP" (+ desktop in the tooltip), because sizes are 1/320 of the page width.
7. **Laporan → CS Rotator**: chats per number (today, 7 days per day, total), counted in `/go/wa/:id`
   (`rotstat:<id>:<number>[:<day>]`, day keys expire after 40 days); link from Global → CS Rotator.
9. Picker: hover/focus a card shows a live example (`/admin/block-preview/:kind`); element cards can be dragged into the
   preview (drop line "Lepas di sini"); clicking still works (WCAG drag alternative).
- Tests (scratchpad): `round2-e2e.mjs` 35/35 local (29/30 on mock Redis without Blob: the only miss was clicks left by an
  aborted run), blocks e2e 39/39, templates 29/29, cloud regression and homepage guards pass; migration on pre-seeded
  storage verified.

## Elements (blocks) for Page + Template — DONE on localhost (2026-10-15, not pushed yet)
- User asked for Berdu's addable section features, adapted (not a 1:1 clone); Gambar + HTML stay the main types. Chosen:
  groups A–D, settings edited **in the left panel with live preview**.
- 16 kinds: Teks, Tombol, Ruang Kosong, Garis, Quote · Video YouTube, Galeri, Gambar + Teks · FAQ, Testimoni, Countdown
  (own date or "ikut promo aktif"), Daftar Fitur, Copy Teks, Daftar Rekening · Tombol WA Melayang, Popup Promo.
- Data: section `{ type:'block', kind, props }`. One schema (`src/admin/block-props.js`) drives server normalisation
  (`normalizeBlock`) and the generated admin forms (`GET /admin/api/blocks` → schema, icons, fonts, pages, rotators).
  Rich text goes through `sanitizeBlockText` (sanitize.js). Renderers in `src/blocks.js`; CSS appended to `lp.css`
  (block FAQ uses `.lp-bq*`, NOT `.lp-faq*` which belongs to the LP's own FAQ); JS in `lp.js` (`LP.init(scope)`).
- Smart links: WhatsApp, **CS Rotator** (Global tab: groups of numbers, `/go/wa/<id>` round-robin via `kv.incr`), page,
  section scroll, URL, tel, email, PDF (`POST …/files`, `/uploads/files/`). Images: `POST …/assets`.
- Live preview: props PATCH is debounced (`PATCH …/sections/:id?render=:id`), the response carries the re-rendered
  section HTML which replaces the element in the preview iframe (no reload). `edit()`, Simpan and Kembali flush pending
  props first. Clicking a block in the preview opens its settings; Esc / back arrow returns to the list.
- "+ Tambah" opens a picker in the left panel (search; Utama = Gambar/HTML/Template; then categories; Lainnya = [PROMO]/Tempel).
- Ad pixels (Global tab): Meta Pixel, TikTok Pixel, Google Ads ID + label. `public/assets/js/pixels.js` shows a cookie notice
  and loads nothing until the visitor accepts (UU PDP; also skipped with Global Privacy Control). Buttons with an
  "Event iklan" send it (`data-track`). Laporan click type `copy` added.
- Tests (scratchpad `blocks-e2e.mjs`): 39/39 locally and against mock Redis; template e2e and cloud regression still pass.

## Produk module (Berdu clone) — IN PROGRESS on localhost (2026-10-15, not pushed yet)
- Goal (user): duplicate Berdu + Wix features, starting with Berdu "Produk". Scope chosen: products + stock + categories +
  catalogs + bundles, then Order/Checkout (manual bank transfer; shipping = manual rates per province/city), public product
  page `/produk/<slug>`. **Work on localhost first, push only when the user says the feature is finished.**
- Files: `src/shop.js` (data model, `data/shop/*.json`, stock log `data/shop/stock-log/YYYY-MM.jsonl`),
  `src/shop-import.js` (Berdu import), `src/admin/shop-routes.js` (API `/admin/api/shop/*`), `public/admin/shop.js` + `shop.css`
  (views; admin.js exposes helpers on `window.MBA`). Admin URLs: `/admin/products`, `/products/:id/edit`, `/products/:id`
  (Laporan/Riwayat Stok/Order), `/stock`, `/categories`, `/catalogs`, `/bundles`.
- Variants work like Berdu: up to 3 option groups with values; a value may override price/compare price/weight (later group
  wins). Stock is shared per product unless one group is the "stock group" (`variants.stockAxis`): then each value has its own
  SKU + stock; units have vid `<groupId>:<valueId>`. All stock changes go through `applyStock` and are logged.
- Berdu data: no CSV export for this account. Data was read (read-only) from the Berdu admin GraphQL `/_/graph` on
  www.spencers.id (camp id `bsob0d3ebsogk72t2x_2`) via Claude in Chrome with the user's logged-in session and saved as
  `data/import/berdu-products-2026-10-15.json` (453 products, 14 categories; gitignored). Field meaning: `stockManagement`
  0 = not tracked, 1 = tracked + can buy when empty, 2 = tracked; `publishTime` in year 2200 = Tersembunyi; `unlisted` = link
  only; prices/weights `variationID` "" = base, "<group>:<option>" = per value, "$minCount:N" = harga grosir; `salePrice` =
  harga coret; descriptions are Draft.js JSON; `cdn://img/...` = https://bdsingapore.com/img/...
- Import: Produk → "Import" (upload that JSON) runs 8 products per request (downloads images). Duplicate Berdu SKUs
  (e.g. MTR0000432 x13) get new SKUs. Catalogs/bundles were not exported (3 catalogs, 2 bundles — recreate by hand or export later).
- Order & checkout (2026-10-15, localhost): `src/orders.js` (orders `data/shop/orders/<no>.json` + `orders-index.json`,
  settings `data/shop/settings.json`), `src/storefront.js` (public `/produk/<slug>` = product page with one-product
  checkout, `/pesanan/<no>?t=<token>` = order page with bank accounts + "Konfirmasi via WhatsApp", API `/api/shop/ongkir`,
  `/api/shop/checkout` rate-limited + honeypot + same-origin), `public/assets/{css,js}/shop.*`. Admin: sidebar **Order**
  (`/admin/orders`, `/admin/orders/<no>`, `/admin/shop-settings` = WhatsApp admin, rekening, tarif ongkir per provinsi/kota,
  teks persetujuan PDP). User choices: one-product checkout (no cart), order page + WA button, NO unique transfer code.
  Order no. like Berdu `SP` + YYMMDD (WIB) + 6-digit daily counter. Stock is reserved at checkout ("Checkout (SP…)" in
  Riwayat Stok) and returned on Batalkan. Statuses: Belum Bayar → Terbayar → Diproses → Dikirim (resi) → Selesai; Dibatalkan.
  Product Laporan/Order tabs read the order index (paid statuses by default). Region data `public/assets/wilayah/`
  (cahyadsn/wilayah, Kepmendagri 2025, MIT; built from its wilayah.sql). Local settings hold PLACEHOLDER bank/WA values.
- Diskon (2026-10-15, localhost): `src/discounts.js` (`data/shop/discounts.json`), admin sidebar **Diskon**
  (`/admin/discounts`, editor + Laporan tab). Types like Berdu: Potongan Harga, % Diskon Produk, Potongan per Produk,
  Dapat produk gratis (gift item price 0, stock reserved), Gratis Ongkir (optional cap), Potongan Ongkir, % Diskon Ongkir.
  Conditions: total pembelian min/max, pelanggan terpilih (WA numbers), produk/kategori terpilih, metode pembayaran,
  kuantitas min/max; schedule (WIB), coupon code (case/#/space-insensitive), max uses + per customer (counted from the
  order index, cancelled orders excluded). ONE discount per order: a valid code wins, else the best automatic one; an
  invalid code keeps the automatic discount and shows why. Checkout uses `POST /api/shop/quote` (server computes subtotal,
  shipping, discount, gift, total) so preview and order always match.
- Berdu discounts imported locally (2026-10-15): read-only from GraphQL `camp.discounts(search:"",viewer:staff,first:100)`
  fields `id name notes couponCode trigger oneTimeUse type useLimit useDateFrom useDateTo discountPrice discountPercent
  conditions tags` → `data/import/berdu-discounts-2026-10-15.json` (3,922; categories merged in). Importer
  `src/discount-import.js` + Diskon → "Import" (mapping documented in the file header). Result: 3,867 active imported,
  52 ended skipped, 3 VIP discounts (Berdu customer ids) imported disabled, 3 with value 0 skipped. Berdu "Dapat produk
  gratis" = gift `pid: "same"` (buy X get N of the same product). New condition "Lokasi Pengiriman" (province/city codes).
  Usage counters start at 0 here (Berdu's used counts are not available). Combos that mix several products only work once
  a cart exists (checkout is one product line).
- Berdu admin menus for this account: Home, Produk, Diskon, Laporan, Blog, Tampilan, Apps, Pengaturan (no Order menu
  for this staff role).
- Local quirk: OneDrive locks files briefly → `writeAtomic` retries rename on EPERM; `.claude/launch.json` watches only
  `src/` + `server.js` (node --watch restarted constantly on node_modules changes).

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
- Hosting: local only at first; since 2026-10-14 on Vercel (see Quick start).
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
- 48 original sections (50 now, incl. 3 [PROMO] sections after the promo migration), 41 are real HTML text over "clean plate" background images. User rules for this conversion:
  posters/product-box art stay ONE image (Award "National Best Brand", Artisan Tea x2, "200.000++ customer",
  CTA promo banner), badges stay images (Instant Effect, 14-Day promo badge), WhatsApp chat screenshots stay
  images, "Explore 10 Flavors" = 10 separate images, YouTube "Langsung Kenyang, Tahan Lama!" box = 4:5.
- Design tooling (dev only, `design-src/`): `plates.mjs build|calibrate <ids>` (erases text from live artwork,
  overlays HTML text, auto-calibrates with puppeteer-core + headless Chrome), specs in `plates-spec.mjs` +
  `plates-spec-2.mjs`, calibration state `plates-calib.json`, first 5 sections from Figma via
  `build-sections.mjs`, visual diff `compare-section.mjs <ids>`, final small edits `post-fixes.mjs`.
  Live originals in `design-src/live/` (only on the user's PC, not in git). Figma MCP is on the Starter plan and its quota ran out.

### Phase 2–4 + 6 — admin (DONE 2026-10-14, tested end-to-end)
Admin at `/admin` (login, Halaman, Editor, Riwayat, Log Aktivitas). Files: `src/admin/{security,sanitize,media,routes}.js`,
`public/admin/{admin.css,admin.js}`, `scripts/create-admin.mjs`, `.env` (+ `.env.example`), `SECURITY.md`.
Dummy admin `admin@mealblend.test`; password only in `data/secrets/admin-credentials.txt` (gitignored).
Section JSON additions: `scope` (CSS scope key → `data-s` attr), `source` (unscoped sanitized HTML shown in editor),
`wrap: true` (uploaded HTML wrapped in `.lp-html`, clipped to page width), image items `iw/ih` (pixel size).
Tests: `node design-src/test-sanitize.mjs` (existing 46 HTML sections survive re-sanitize; attack samples clean).
Sessions now live in the shared key-value store (`kv` in src/storage.js: Redis on Vercel, `data/kv.json` locally).
Next steps: see "Open items" at the top.

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
- (Superseded) sessions were mirrored to `data/sessions.json`; they now use the `kv` store (see GitHub + Vercel).

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
  `/p/<token>` (`src/preview-links.js`, hashed tokens in the `kv` store, LAN IP in dev; renders the draft,
  noindex, not tracked); warning box when the live promo has no badge/banner/bar for this page.
- Nav dots (`/admin/api/status`) for unsaved page drafts / unpublished promo draft; promo toasts offer "Publish sekarang";
  promo timeline (100 days, same resolution rules as server) with "Tidak ada promo" gap warning.
- Halaman: search box, auto cover (first page image), "Statistik" button → `/admin/reports?slug=`, template gallery in
  "Halaman baru". Global tab: GA4 Measurement ID field.
- Laporan: WhatsApp clicks + conversion KPIs (dashboard too), CSV export (`/admin/api/reports.csv`), tab **Per Bagian**
  (user chose "bagian + klik + heatmap", only in Laporan): lp.js sends `/t/e` on hide/leave with seen sections, ms per
  section and clicks [section, kind, x, y in design units]; `sectionReport()` aggregates; heatmap = `/admin/live/:slug`
  in an iframe with attention tint (reach %) or click dots. Sample data includes engagement for the main page.

#### Original admin plan (historical — everything below is implemented and tested)
Installed deps: express, helmet, sharp@0.35.5 (upgraded for CVEs; `npm audit` = 0), multer@2,
sanitize-html@2, express-rate-limit@7; dev: puppeteer-core.

First files written:
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
  in Singapore (endpoint `global-ap1` forwards). Fixed 2026-10-14: new DB `spencers-redis-sg` (primary sin1, Free, eviction off),
  keys copied over REST; now ~5 ms per call and the landing page takes 9–14 ms on the server (was 450–930 ms).
- Code: batched reads (`readMany`, `mtimes`), `writeAtomic` (no temp+rename in Redis), single-round-trip deletes, parallel
  independent reads in routes, analytics range = 2 round trips. 100 ms/call simulation: dashboard 1.6→0.6 s, editor 1.7→0.6 s,
  30-day report 1.8→0.55 s, one edit 1.1→0.65 s. Versioned assets/uploads cached immutable via vercel.json.
- `.agents/`, `.claude/skills/`, `skills-lock.json` (Upstash agent skills added by the Upstash setup) are not committed.

## 2026-10-14 — Landing page Lighthouse (mobile)

- SEO 63 → 100: the page carried `robots: "noindex"` (imported). The SEO tab checkbox only recognised
  "noindex, nofollow"; fixed (`/noindex/i`), the owner then unticked it.
- Performance: sections from index 4 on get `content-visibility:auto` (`.lp-cv`, placeholder `--ih` from section data,
  first box margin moved onto the section because containment stops margin collapse; promo sections, sections with
  badges, admin preview and heatmap keep full layout). Page CSS is inlined in the HTML (`pageCss()` in render.js).
  Verified by full-page screenshot comparison (identical page/section heights). Local Lighthouse: 57 → ~80, TBT 660 → 0 ms,
  style+layout 3.2 → ~1.1 s, initial bytes 989 → ~700 KiB; observed FCP/LCP ≈ 1.0 s.
- Next candidates: subset the 21 woff2 fonts to Latin (≈430 KB loaded on the first screen) and responsive `srcset`
  (uploads are 1440 px wide for ~412 px slots, ≈290 KB).
