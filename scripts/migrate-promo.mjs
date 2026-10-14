// One-off migration (2026-10-14): introduce site-wide promos.
//   node scripts/migrate-promo.mjs <14day-banner> <14day-badge> <1010-banner> <1010-badge>
// - Creates data/promos.json with "14 Day Promo" (regular) and "10.10" (insidentil).
// - slimmealsolutionmintidn2: promo bar + both CTA banners become [PROMO] sections, and the
//   14-Day badge drawn inside "Manfaat Utama" becomes a floating promo badge.
import fs from 'node:fs';
import path from 'node:path';
import { getPage, savePage, ROOT } from '../src/store.js';
import { processImage } from '../src/admin/media.js';

const [b14, g14, b1010, g1010] = process.argv.slice(2);
if (!g1010) {
  console.error('Usage: node scripts/migrate-promo.mjs <14day-banner> <14day-badge> <1010-banner> <1010-badge>');
  process.exit(1);
}
const img = async (file) => {
  const out = await processImage(fs.readFileSync(file), 'promos');
  return { src: out.src, ...(out.ext ? { ext: out.ext } : {}), iw: out.iw, ih: out.ih };
};

const promos = {
  promos: [
    {
      id: 'p-1010', kind: 'insidentil', name: '10.10', manual: false,
      start: '2026-10-10T00:00:00+07:00', end: '2026-10-10T23:59:00+07:00',
      banner: await img(b1010), badge: await img(g1010),
      bar: { title: 'Promo “10.10 BIG SALE”', left: 'Disc up to 60%', right: 'FREE Ongkir Jawa - Bali', color: '#ff0000' },
    },
    {
      id: 'p-14day', kind: 'regular', name: '14 Day Promo',
      start: '2026-10-01T00:00:00+07:00', end: '2026-12-31T23:59:00+07:00',
      banner: await img(b14), badge: await img(g14),
      bar: { title: 'Promo “14 DAY SLIMMING PROGRAM”', left: 'Disc up to 60%', right: 'FREE Ongkir Jawa - Bali', color: '#ff0000' },
    },
  ],
  updatedAt: new Date().toISOString(),
  updatedBy: 'migration',
};
fs.writeFileSync(path.join(ROOT, 'data', 'promos.json'), JSON.stringify(promos, null, 2) + '\n');

const slug = 'slimmealsolutionmintidn2';
const page = await getPage(slug);
if (page.sections.some((s) => s.type === 'promo')) {
  console.log('Page already migrated; promos.json written.');
  process.exit(0);
}
const idx = (id) => page.sections.findIndex((s) => s.id === id);

// 1. promo bar
const bar = page.sections[idx('promo-bar')];
page.sections[idx('promo-bar')] = { id: 'promo-bar', name: '[PROMO] Bar', type: 'promo', part: 'bar', ...(bar.mt ? { mt: bar.mt } : {}) };

// 2. CTA sections: banner part -> [PROMO] Banner, rest stays as "CTA Chat Admin"
for (const [id, n] of [['cta-1', ''], ['cta-2', ' (2)']]) {
  const i = idx(id);
  const cta = page.sections[i];
  const m = cta.html.match(/^<div class="lp-box" style="--x:(-?[\d.]+);--w:([\d.]+);--h:[\d.]+;--mt:0">[\s\S]*?cta-banner[\s\S]*?<\/div>/);
  if (!m) throw new Error(`banner not found in ${id}`);
  const banner = { id: `promo-banner${n ? '-2' : ''}`, name: `[PROMO] Banner${n}`, type: 'promo', part: 'banner', x: Number(m[1]), w: Number(m[2]), ...(cta.mt ? { mt: cta.mt } : {}) };
  cta.html = cta.html.slice(m[0].length);
  cta.name = `CTA Chat Admin${n}`;
  delete cta.mt;
  if (cta._items) cta._items = cta._items.slice(1);
  page.sections.splice(i, 0, banner);
}

// 3. badge drawn inside "Manfaat Utama" -> floating promo badge (same centre, same width)
const mu = page.sections[idx('manfaat-utama')];
const svg = mu.html.match(/<svg class="a mu-badge" style="left:calc\(([\d.]+)\*var\(--k\)\);top:calc\(([\d.]+)\*var\(--k\)\);width:calc\(([\d.]+)\*var\(--k\)\);height:calc\(([\d.]+)\*var\(--k\)\);"[\s\S]*?<\/svg>/);
if (!svg) throw new Error('badge svg not found');
const k = Number(mu.html.match(/--k:calc\(100cqw\*([\d.]+)\/320\)/)[1]); // 1 k = k design units
const [l, t, w, h] = svg.slice(1).map(Number);
mu.html = mu.html.replace(svg[0], '');
page.badges = [{ id: 'badge-manfaat', section: 'manfaat-utama', cx: +((l + w / 2) * k).toFixed(1), cy: +((t + h / 2) * k).toFixed(1), w: +(w * k).toFixed(1) }];

await savePage(slug, page, 'migration');
fs.rmSync(path.join(ROOT, 'data', 'drafts', slug), { recursive: true, force: true });
console.log('Migrated:', page.sections.filter((s) => s.type === 'promo').map((s) => s.id).join(', '), '| badge', JSON.stringify(page.badges[0]));
