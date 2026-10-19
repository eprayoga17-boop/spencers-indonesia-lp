# The `fx` HTML pattern (how this site draws a Figma block)

Every hand-built section of the existing LPs uses it. A section is a box with the frame's aspect ratio; each Figma
layer becomes an absolutely positioned child placed in **Figma units × `--k`**, and `--k` scales with the page column
(`.lp` is a CSS container, so `100cqw` = page width). The result is pixel-close to Figma at every phone width.

```html
<div class="fx s-hero" style="--k:calc(100cqw/375);aspect-ratio:375/520">
  <style>
    .s-hero{background:#fdf3e6;color:#111}
    .s-hero .t-eyebrow{font-weight:400;letter-spacing:.02em}
    .s-hero .t-title{font-weight:800}
    .s-hero .btn{display:flex;align-items:center;justify-content:center;gap:.4em;border:1px solid #111;color:#111;text-decoration:none;font-weight:500}
  </style>
  <img class="a" src="hero-photo.png" alt="Tiga gelas MealBlend dan dua kotak produk" fetchpriority="high" decoding="async"
       style="left:calc(170*var(--k));top:calc(40*var(--k));width:calc(205*var(--k));height:calc(300*var(--k));object-fit:cover">
  <p class="a ff-montserrat t-eyebrow" style="left:calc(24*var(--k));top:calc(120*var(--k));font-size:calc(14*var(--k));line-height:calc(17*var(--k))">SPENCER’S MEALBLEND</p>
  <h2 class="a ff-montserrat t-title" style="left:calc(24*var(--k));top:calc(140*var(--k));width:calc(200*var(--k));font-size:calc(22*var(--k));line-height:calc(26*var(--k))">SLIMMING PROGRAM<br>FOR WOMAN</h2>
  <a class="a btn ff-montserrat" href="/go/wa/cs-women?text=Halo%20kak" data-track="Contact"
     style="left:calc(24*var(--k));top:calc(250*var(--k));width:calc(120*var(--k));height:calc(38*var(--k));border-radius:calc(8*var(--k));font-size:calc(13*var(--k))">ORDER NOW →</a>
</div>
```

## Mapping (values from `outline.txt` / `tree.json`, all relative to the section frame)

| Figma | CSS on the layer |
|---|---|
| frame `w × h` | wrapper `--k:calc(100cqw/<frame width of the whole LP>)`, `aspect-ratio:w/h` (use the LP frame width for every section so all sections share one scale) |
| layer `x, y, w, h` | `left/top/width/height: calc(N*var(--k))` with `class="a"` (subtract the section's own x/y) |
| text `size / lh / ls` | `font-size`, `line-height`, `letter-spacing` as `calc(N*var(--k))` — always use `lineHeightPx`; then the text box `top` = Figma `y` exactly |
| text align CENTER / RIGHT | keep `left` + `width` of the box, `text-align:center|right` |
| auto-width text (`autoResize: WIDTH_AND_HEIGHT`) | add class `nw` (no wrapping), no width |
| fixed-width text | set `width`; check line breaks in `compare.png`, add `<br>` where Figma breaks |
| `case: UPPER` | write the text in capitals (or `text-transform:uppercase`) |
| mixed styles (`runs`) | `<span style="font-weight:800;color:#e3262f">…</span>` per run |
| solid fill on shapes | `background:#hex` (+ `opacity`); radius → `border-radius:calc(r*var(--k))` |
| gradient | `linear-gradient(<angle>deg, c1 p1%, c2 p2%)`, angle = atan2(dy·h, dx·w)·180/π + 90 from the first two handles |
| DROP_SHADOW | `box-shadow:calc(x*var(--k)) calc(y*var(--k)) calc(r*var(--k)) rgba(…)` (images: `filter:drop-shadow(…)`) |
| image fill / masked photo | export that layer (`figma.mjs export --ids … --scale 3`) and use `<img class="a" … style="…;object-fit:cover">` |
| logo / icon (vector) | small: paste the exported SVG **inline**; big or complex: PNG @3x |
| rotated layer | export it as an image (CSS rotation of Figma bounding boxes rarely lines up) |
| font family | class `ff-montserrat`, `ff-poppins`, … (see conversion-rules.md → Fonts) |

## Assets and links

- Refer to uploaded files by **bare file name** (`src="hero-photo.png"`) and list them under `"assets"` in the manifest;
  the server uploads, converts to WebP/AVIF and rewrites the URLs. Max 30 per section, no `.svg` files.
- First visible image of the LP: `fetchpriority="high"`; others: `loading="lazy" decoding="async"`.
- Links: internal `/slug`, section scroll `#section-id`, WhatsApp `https://wa.me/62…?text=…` or CS Rotator
  `/go/wa/<id>?text=…`, add `data-track="Contact|Lead|…"` for ad events. External links get `target="_blank"`.

## Text-free backgrounds ("clean plate")

Best: build the background from the layers under the text (shapes, photos, decorations exported separately).
If the background only exists as one flat render with text baked in, remove the text pixels like
`scripts/home-banners.mjs` does (`eraseInk`: repaint only pixels between the local background and the ink colour,
then a pass for compression halo), and keep the product photos untouched. Check the result image before using it.

## Gotchas

- Use one `--k` for the whole LP (frame width), otherwise sizes jump between sections.
- Unique class prefix per section (`s-hero`, `s-testi`) — styles are scoped automatically but readable names help.
- `p`, `h2`, `h3` inside `.fx` have no margin and inherit weight (lp.css) — set weights explicitly.
- Never put `<script>`, `<iframe>`, forms or `on*=` — they are stripped. Video → element Video.
- Keep real, readable copy in the HTML (no text in images) unless the conversion rules say the block stays an image.
