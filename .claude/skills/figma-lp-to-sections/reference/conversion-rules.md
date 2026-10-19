# Which website section for which Figma block

The site renders a page as a vertical list of sections, 320 design units wide (= the page column, 375–480 px on
screen). Every Figma block becomes one of these:

| Figma block looks like… | Website section | Why / how |
|---|---|---|
| Headline / paragraph / list / price on a flat colour or a photo | **HTML (`fx` pattern)** | Real text over a text-free background. See `fx-html.md`. |
| Photo + text side by side, simple | HTML, or element **Gambar + Teks** | Element if the user should edit it without code. |
| Big image with a title and one button on it | element **Banner + Teks** | Background image + real `<h2>` + real button, positions in %. Background must be text-free (export the layers under the text, or remove the text from a flat render). |
| Poster, product box art, award artwork, collage with tiny text, WhatsApp/chat screenshot, testimonial screenshot | **Gambar** (one image) | Project rule: these stay one picture. Give a meaningful `alt`. |
| Several images in a row that scroll | **Gambar → Slider** | `layout: "slider"`. |
| Button (WhatsApp / order / more info) | element **Tombol**, or `<a class="a …">` inside the HTML section | Real link + "Event iklan". WhatsApp for ads → CS Rotator. |
| YouTube thumbnail with play button | element **Video** | Click-to-load; keeps the page fast. |
| Questions that open/close | element **FAQ** | `style: "box"` for grey cards, `"line"` for lines. |
| Testimonial cards | element **Testimoni** (text) or Gambar (screenshots) | |
| "Promo ends in" timer | element **Countdown** | `mode: "promo"` follows the running promo. |
| Feature list with icons | element **Daftar Fitur**, or HTML when the layout is special | |
| Voucher code / bank account | **Copy Teks** / **Daftar Rekening** | Copy button included. |
| Distributor/stockist list | element **Daftar Distributor** | Data lives in menu Distributor. |
| Campaign promo banner / "14 hari" badge | **[PROMO] Banner / Bar**, promo badge | Changes per campaign from menu Promo; don't bake it in. |
| Floating WhatsApp button, popup | elements **Tombol WA Melayang** / **Popup Promo** | |

## Splitting the frame

- `sections.json` lists the direct children of the frame top→bottom; that is usually the right split. Merge tiny
  spacer frames into the next section (`mt` in design units), split a giant group if it holds unrelated blocks.
- Keep each HTML section a single visual block (≈ one screen or less). Easier to reorder, to reuse in templates, and
  per-section reports stay meaningful.
- Name sections like the content ("Hero", "Testimoni", "CTA Chat Admin"); names show in the editor and reports.

## Units

`k = 320 / frameWidth` design units per Figma unit (frame 375 wide → k = 0.8533; 1080 wide → 0.2963).
Element props (sizes "px", spacing) are design units: `size_design = size_figma × k`. The editor shows the real
pixel size on a phone next to every size field.

## Fonts

Available on the site (self-hosted, `public/assets/css/lp.css`): Poppins (400–800), Montserrat (400–900), Inter, Lato,
Open Sans, Roboto, Raleway 800 italic, Josefin Sans 700, Libre Baskerville, Caveat 700, Imprima, Carlito.
Use the class `ff-<name>` in HTML (`ff-poppins`, `ff-montserrat`, …) or the "Font" field of elements.
A font that is missing: download the OFL/Apache woff2 (latin subset) from Google Fonts into `public/assets/fonts/`,
add `@font-face` + `.ff-<name>` in `lp.css` and the name in `FONTS` (`src/global.js`). Never load fonts from a CDN
(the Content-Security-Policy blocks it). Commercial fonts: ask the user; fall back to the closest free font and say so.

## What the sanitiser does to HTML (so don't rely on it)

Removes `<script>`, `<iframe>`, forms, `on*=` attributes, `javascript:` links, external CSS. `<style>` is kept and
scoped to the section automatically. Inline `<svg>` is allowed; uploading `.svg` files is not. HTML max 1 MB.

## Quality bar before reporting

- `compare.png` matches the Figma render: same line breaks, nothing overlapping, nothing cut off.
- Text is selectable; every button is a real link with the right target; images have `alt`.
- Check HP and Desktop in the editor preview; no horizontal scroll.
- Contrast of small text ≥ 4.5:1 (flag it to the user if the design itself is below that).
