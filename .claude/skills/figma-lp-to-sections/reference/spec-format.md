# spec.json for `scripts/figma/build.mjs`

Put it in the fetch folder (`design-src/figma/<fileKey>-<node>/spec.json`). Positions are Figma units of the LP frame
(read them from `outline.txt` / `sections.json`). First real example: `design-src/figma/i8iKtYHyaQoO69Jq2WZBG7-1-30/spec.json`
(BurnX Matcha, 2026-10-15).

```json
{
  "fileKey": "i8iKtYHyaQoO69Jq2WZBG7",
  "skip": ["21:67"],                 // layers left out (replaced by [PROMO], a Video element, real buttons, an FAQ element…)
  "asImage": ["2:241027"],           // layers forced to ONE picture (e.g. a logo built from text + vectors)
  "templates": [
    { "name": "BurnX Matcha 1 · Testi s/d Resep Brand", "sections": [
      { "type": "fx", "name": "Hero BurnX", "y0": 381, "y1": 1216.7 },          // cut [y0, y1) -> HTML with real text
      { "type": "image", "name": "Poster", "ids": ["12:34"], "alt": "…" },        // Gambar section from rendered layers
      { "type": "block", "kind": "video", "name": "Video", "props": { "url": "https://youtu.be/…" } },
      { "type": "promo", "part": "banner" },
      { "type": "html", "name": "Disclaimer", "file": "disclaimer.html", "assets": [] }  // hand-written, path relative to build/
    ] }
  ],
  "page": { "slug": "burnxmatchawomen", "title": "…", "sections": [
    { "template": 0 },                                     // index into "templates"
    { "type": "fx", "name": "CTA", "y0": 10965.1, "y1": 11190.4 },
    { "type": "block", "kind": "button", "name": "CTA Chat Admin", "props": { "label": "Chat Admin", "link": { "type": "rotator", "rotator": "cs-…" } } },
    { "template": 1 }
  ] }
}
```

## Cutting rules

- This site splits an LP as **Template → CTA (loose sections) → Template**; the user's rule: *the template/section split
  is usually at the CTA*. Product FAQs are their own template per product ("FAQ Spencer's BurnX Matcha"), the legal
  disclaimer is a shared template ("Disclaimer Medis & Legal").
- Cut where no text crosses: build.mjs prints `! … text "…" crosses the cut` — move the cut until it is silent.
  Images/shapes may cross a cut (each side shows its part).
- Leave out the area of a flat image that becomes an element (video thumbnail, PAYDAY banner, FAQ picture) by ending the
  previous cut at its top and starting the next at its bottom, and add its id to `skip` if it overlaps a cut.
- ≤ 30 assets per section: if build.mjs warns, cut the part in two or put logo groups in `asImage`.

## Check before pushing

`node <scratch>/fx-harness.mjs` style check: render `build/NN-*.html` with `lp.css` next to the matching slice of
`render/00-frame.png` and look at every pair (line breaks, positions, clipping). push.mjs `--compare` does the same for
the whole draft page.
