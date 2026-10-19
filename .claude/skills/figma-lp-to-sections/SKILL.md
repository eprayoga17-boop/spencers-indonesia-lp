---
name: figma-lp-to-sections
description: Convert a landing-page design from Figma into sections for this website (Spencer's / MealBlend LP admin) — HTML sections with real text, Gambar sections and elements (Tombol, FAQ, Video…) — and put them in the admin as a DRAFT Page or Template. Use when the user shares a Figma link (or a .fig / exported design) of an LP and wants it on the website.
---

# Figma LP → website sections

Goal: the website section looks like the Figma frame on a phone (375–480 px wide), but headlines, paragraphs and
buttons are **real text and real links** (SEO, tracking, editable), not one flat picture. Everything lands as a
**draft**; the user checks it in the editor and presses *Publikasikan* themselves.

## 1. What to ask the user for

| Input | Use it? | Notes |
|---|---|---|
| **Figma link to the LP frame** | **Best — ask for this** | In Figma: select the LP frame → right-click → *Copy/Paste as → Copy link to selection*. The link must contain `node-id=`. The account behind `FIGMA_TOKEN` must be able to open the file (shared "can view" is enough). |
| `.fig` file | Not directly | `.fig` is Figma's closed binary format; it cannot be read reliably outside Figma. Ask the user to drag it into Figma (free account is fine), then send the link to the frame. |
| PNG/JPG export only | Fallback | Only Gambar sections are possible, or text retyped by eye (lower fidelity). Ask for the Figma link if at all possible. |

Also ask (one short message): **where it goes** — a new Template (name) or an existing Page (slug) — and **where
buttons link to** (WhatsApp number, CS Rotator group, another page, section scroll). Don't guess phone numbers.

## 2. One-time setup

- `FIGMA_TOKEN` in `.env` (Figma → Settings → Security → Personal access tokens, scope *File content: read-only*).
  Never print it, never commit `.env`. If it is missing, tell the user exactly this step. (The Figma MCP server is on the
  Starter plan and its quota runs out — the REST API via the script below has no such limit.)
- Dev server running (`preview_start`, `.claude/launch.json`). The push script logs in with the local test account
  (`data/secrets/admin-credentials.txt` or `ADMIN_EMAIL`/`ADMIN_PASSWORD`) and only talks to `localhost`.

## 3. Workflow

1. **Fetch** — `node scripts/figma/figma.mjs fetch "<figma-url>"`
   Output in `design-src/figma/<fileKey>-<node>/` (git-ignored — designs can be confidential):
   `outline.txt` (every layer: id, position/size in Figma units, fills, fonts, text), `tree.json`, `sections.json`
   (top-level blocks top→bottom), `render/NN-*.png` (picture of each block), `fills/*.png` (original photos),
   `fonts.txt`. Read `outline.txt` and **look at every render** before planning.
2. **Plan** — one row per Figma block: name, website type, what stays an image, links. Use the rules in
   [reference/conversion-rules.md](reference/conversion-rules.md). Show the plan to the user and get a yes before
   building (they want confirmation before big changes). Fonts not in the site: see "Fonts" in the reference.
3. **Assets** — `node scripts/figma/figma.mjs export "<url>" --ids 12:34,12:40 --scale 3` for logos, icons, badges,
   photos with masks/effects, decorative shapes (→ `assets/`). Uncropped photos are in `fills/`. Only PNG/JPG/WebP/GIF/AVIF
   can be uploaded (**no SVG** — export vectors as PNG @3x). Max 30 assets per section, 15 MB each.
4. **Build (automatic)** — write `spec.json` ([reference/spec-format.md](reference/spec-format.md)): the cuts in Figma
   y-units, which template each part belongs to, which flat images become elements, then
   `node scripts/figma/build.mjs design-src/figma/<dir> design-src/figma/<dir>/spec.json`.
   It turns every cut into an `fx` HTML section ([reference/fx-html.md](reference/fx-html.md)): Figma text → real text
   (fonts, sizes, line height, mixed styles, lists, Title Case), simple shapes → CSS, everything else → PNG @3x rendered
   by Figma, frame clipping kept. Fix every "crosses the cut" warning, then compare each part with the Figma render
   before pushing. Hand-write only what the converter can't (e.g. a disclaimer that is a picture in Figma).
5. **Push** — `node scripts/figma/push.mjs design-src/figma/<dir>/build/manifest.json --base http://localhost:<port> --compare`
   creates the templates, the page (if new) with template blocks + loose sections, all as drafts.
   Sections go through the same sanitiser and image pipeline as the editor (WebP/AVIF, EXIF removed).
6. **Verify** — open `compare.png` (left Figma, right website). Fix position/size/wrapping until they match, check the
   editor preview at HP and Desktop, click every button. If you re-push, push into a fresh template (or delete the
   old draft sections first) so there are no duplicates. Read sanitiser notes printed by push.
7. **Report** — editor link, which parts are real text vs images and why, anything not converted, links still to
   fill. Do not publish, do not commit/push to GitHub unless the user asks.

## 4. Rules that come from this project (keep them)

- Posters / product-box art / award artwork / chat screenshots / badges stay **one image**; text-on-photo becomes real
  text over a text-free background ("clean plate").
- Promo banners/badges that change per campaign are **[PROMO]** sections (menu Promo), not baked into the design.
- WhatsApp buttons: prefer **CS Rotator** (`/go/wa/<id>`) when the LP is for ads; set `data-track` / "Event iklan".
- YouTube → element **Video** (click-to-load facade), never an `<iframe>` (the sanitiser removes it anyway).
- Distributor lists → element **Daftar Distributor** (data from the Distributor menu), never retyped.
- Indonesian UI copy, Bahasa Indonesia report. Keep the design's own wording (don't "fix" copy without asking).
