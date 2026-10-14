// Small HTML-only fixes applied after the plate builds.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'data', 'pages', 'slimmealsolutionmintidn2.json');
const page = JSON.parse(await fs.readFile(PAGE, 'utf8'));
const sec = (id) => page.sections.find((s) => s.id === id);

// FAQ title as real text instead of the header image
const faq = sec('faq');
faq.html = faq.html.replace(
  /<div class="lp-box" style="--x:-1;--w:319;--h:81"><img src="\/uploads\/seed\/faq-header\.webp"[^>]*><\/div>/,
  '<h2 class="lp-faq-title">Solusi Langsing Mu:<br>FAQ Spencer’s MealBlend</h2>'
);

await fs.writeFile(PAGE, JSON.stringify(page, null, 2) + '\n');
console.log('post-fixes applied', faq.html.includes('lp-faq-title'));
