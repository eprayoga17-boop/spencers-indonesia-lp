// Dev check: re-sanitizing every existing HTML section must not change how it renders,
// and known attack samples must come out clean.
import fs from 'node:fs';
import { sanitizeSection } from '../src/admin/sanitize.js';

const p = JSON.parse(fs.readFileSync(new URL('../data/pages/slimmealsolutionmintidn2.json', import.meta.url)));
const norm = (h) => h.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/\s+/g, ' ').replace(/ loading="lazy"/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/ \/>/g, '>').replace(/;"/g, '"').trim();
let bad = 0;
for (const s of p.sections.filter((x) => x.type === 'html')) {
  const r = sanitizeSection(s.html, { scope: '.lp-sec[data-s="t"]' });
  const a = norm(s.html), b = norm(r.html);
  if (a !== b) {
    bad++;
    let i = 0;
    while (a[i] === b[i]) i++;
    console.log(s.id, '\n  orig:', a.slice(Math.max(0, i - 60), i + 80), '\n  new :', b.slice(Math.max(0, i - 60), i + 80));
  }
}
console.log('diffs:', bad);

const t = sanitizeSection(`<!doctype html><html><head><title>X</title><style>@import url(x.css); body{margin:0} h1,.a>p{color:red}
@media (min-width:1px){.b{x:1}} @keyframes k{from{opacity:0}} .z{background:url(bg.png); position:fixed}</style><script>alert(1)</script></head>
<body onload="x()"><h1 onclick="evil()">Hi</h1><img src="Foto 1.JPG"><a href="javascript:alert(1)">x</a><a href="https://wa.me/1" target="_blank">wa</a>
<iframe src="https://www.youtube.com/embed/dBE-GNGdJds?start=1" title="Vid"></iframe><iframe src="https://evil.com"></iframe>
<form><input></form><svg><path fill="url(https://x)" d="M0"/><use href="#a"/></svg></body></html>`, {
  scope: '.lp-sec[data-s="t"]',
  assets: new Map([['foto 1.jpg', { url: '/uploads/sections/a/xyz.webp' }], ['bg.png', { url: '/uploads/sections/a/bg.webp' }]]),
});
console.log(t.html, '\n', t.removed);
