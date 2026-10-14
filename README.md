# Spencer's Indonesia Landing Pages

Mobile-only landing pages for Spencer's Indonesia (MealBlend), built as an ordered list of
topic-based sections. Each section is either an **image** section (one or more
images stacked, or a slider) or an **HTML** section.

All user and admin flows are drawn as flowcharts in [docs/ALUR.md](docs/ALUR.md) (technical). A non-technical
website flowchart for the team (PDF + PNG) is in [docs/flowchart-website/](docs/flowchart-website/), built by
`node scripts/build-flowchart.mjs`.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000/slimmealsolutionmintidn2

## Admin

http://localhost:3000/admin — login with an account from `.env` (`ADMIN_USERS`). Create one with
`node scripts/create-admin.mjs <email>` (random password goes to `data/secrets/admin-credentials.txt`, gitignored).

- **Halaman**: list of pages; duplicate a page to a new link (template), archive / restore.
- **Editor**: sections with drag handle and up/down buttons, show/hide, edit, duplicate, delete; live 375 px preview.
  A section is either images (stacked or slider; any width is fitted to the page, converted to WebP/AVIF,
  EXIF removed) or HTML (upload .html + its images, or paste code; sanitized and CSS scoped to the section).
- Editor works on a **draft** with undo/redo; the live page changes only when you click **Simpan**.
  Tabs: Konten, Desain (width, background, font, thumbnail, export/import code), SEO, Global (defaults, favicon), Riwayat.
  Preview is an iPhone 11 (414×896); click a section there to select it, right-click for Cut/Copy/Paste/Hide/Rename/Delete.
- **Riwayat**: every Simpan keeps the previous version (last 50); load one back into the draft. Shows the page's activity.
- **Promo**: one site-wide promo at a time (Insidentil: toggle or schedule; Regular: schedule). Each promo has a
  banner, a badge and the red promo-bar text; pages use locked **[PROMO]** sections and draggable promo badges.
  Edits are a draft until **Publish**, then every live page switches immediately.
- **Log Aktivitas**: audit log of logins and changes (90-day retention).

See [SECURITY.md](SECURITY.md) for the OWASP / PDP / SOC control mapping.

## Deploy (Vercel)

Locally everything is stored as files (`data/`, `public/uploads/`). On Vercel the file system is read-only, so
`src/storage.js` switches automatically when these environment variables are present:

| Variable | Purpose |
| --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis (Vercel Marketplace): pages, drafts, promos, sessions, analytics, audit |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob: images uploaded in the admin after deploy |
| `ADMIN_USERS` | Admin accounts (`email:scrypt-hash`, same format as `.env`) |
| `EXPORT_SECRET` | HMAC key for page export codes (copy from `.env` so old codes still import) |

`npm run vercel-build` bundles the starting content of `data/` into `src/seed-data.js`; the first request after the
first deploy copies it into Redis. After that, content is edited in the admin and later deploys do not overwrite it.
Images that are in the repo (`public/uploads/`) are served by the Vercel CDN; new uploads are served from Blob via
`/uploads/...` (same URLs).

## Structure

| Path | What |
| --- | --- |
| `data/pages/<slug>.json` | Page data: settings + ordered sections |
| `src/render.js` | Renders a page JSON into HTML |
| `public/assets/css/lp.css` | Page styles (layout in design units, 320 = page width) |
| `public/assets/js/lp.js` | Sliders and click-to-load YouTube |
| `public/uploads/seed/` | Images copied from the live page (AVIF + WebP) |

## Section format

```json
{ "id": "promo-bar", "name": "Promo Bar", "type": "image",
  "items": [{ "src": "/uploads/seed/promo-bar", "alt": "...", "href": "", "x": 0, "w": 320, "h": 46, "mt": 0 }] }
```

- `x`, `w`, `h`, `mt` are optional design units (page width = 320). Without them
  an image fits the page width at its natural height.
- `layout: "slider"` turns an image section into a slider.
- `type: "html"` sections hold an HTML fragment; `.lp-yt[data-yt=ID]` and
  `.lp-slider` inside them are enhanced automatically.

## Sections rebuilt as HTML (from Figma)

`design-src/build-sections.mjs` turns Figma layers into HTML sections: text, vectors and
shapes are real HTML/SVG/CSS; photos and chat/story screenshots stay images.

```bash
node design-src/build-sections.mjs          # assets + HTML
node design-src/build-sections.mjs --html-only
node design-src/compare.mjs                 # pixel diff vs the live artwork (server on :3000)
```
