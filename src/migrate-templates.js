// One-time migration (2026-10-15): the MealBlend Women landing page becomes
//   Template 1 + CTA Chat Admin + Pembayaran & Distributor + Template 2 + CTA (2) + Pembayaran (2) + Template 3.
// Section ids stay the same, so the page looks identical and per-section reports continue.
// Idempotent: a page that already uses templates is left alone; a kv claim keeps parallel instances out.
import { getPage, savePage, withPageLock } from './store.js';
import { createTemplate } from './templates.js';
import { discardDraft } from './drafts.js';
import { kv } from './storage.js';

const SLUG = 'slimmealsolutionmintidn2';
const PLAN = [
  { tpl: 'MealBlend Women 1 · Promo s/d Banner Promo', from: null, to: 'promo-banner' },
  { loose: ['cta-1', 'pembayaran-distributor-1'] },
  { tpl: 'MealBlend Women 2 · Offline Experiences s/d Banner Promo', from: 'offline-judul', to: 'promo-banner-2' },
  { loose: ['cta-2', 'pembayaran-distributor-2'] },
  { tpl: 'MealBlend Women 3 · Kisah Distributor s/d Footer', from: 'video-distributor', to: null },
];

export async function migrateTemplatesV1() {
  const page = await getPage(SLUG);
  if (!page || page.sections.some((s) => s.type === 'template')) return 'skip';
  const ids = page.sections.map((s) => s.id);
  // Work out the slices and check they cover the page in order, without gaps.
  const parts = [];
  let at = 0;
  for (const step of PLAN) {
    if (step.loose) {
      for (const id of step.loose) {
        if (ids[at] !== id) return `unexpected section at ${at}: ${ids[at]} (wanted ${id})`;
        parts.push({ loose: page.sections[at++] });
      }
      continue;
    }
    if (step.from && ids[at] !== step.from) return `unexpected section at ${at}: ${ids[at]} (wanted ${step.from})`;
    const end = step.to ? ids.indexOf(step.to, at) : ids.length - 1;
    if (end < at) return `missing ${step.to}`;
    parts.push({ tpl: step.tpl, sections: page.sections.slice(at, end + 1) });
    at = end + 1;
  }
  if (at !== ids.length) return 'sections left over';

  const sections = [];
  let badges = page.badges || [];
  let n = 0;
  for (const p of parts) {
    if (p.loose) { sections.push(p.loose); continue; }
    const own = new Set(p.sections.map((s) => s.id));
    const tpl = await createTemplate({ name: p.tpl, sections: p.sections, badges: badges.filter((b) => own.has(b.section)) }, 'migrasi otomatis');
    badges = badges.filter((b) => !own.has(b.section));
    sections.push({ id: `tpl-ref-${++n}`, name: tpl.name, type: 'template', template: tpl.id });
  }
  await withPageLock(SLUG, async () => {
    await savePage(SLUG, { ...page, sections, badges }, page.updatedBy || 'migrasi otomatis');
    await discardDraft(SLUG); // an old flat draft would undo the split on Simpan
  });
  return 'done';
}

let running = null;
export function ensureMigrated() {
  running ||= (async () => {
    if (!(await kv.claim('migration:templates-v1', { at: Date.now() }, 10 * 365 * 864e5))) return;
    try {
      const out = await migrateTemplatesV1();
      console.log(`migration templates-v1: ${out}`);
    } catch (e) {
      await kv.del('migration:templates-v1'); // try again on the next start
      throw e;
    }
  })().catch((e) => { running = null; console.error('migration templates-v1 failed', e); });
  return running;
}
