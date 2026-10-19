// Templates: named, reusable groups of sections. A page lists its content as sections, and a section of
// type "template" ({ type:'template', template:<id> }) stands for all sections of that template.
// Templates are shared: saving a template changes every page that uses it (on the next request).
// Storage: data/templates/<id>.json, history snapshots in data/template-history/<id>/<ts>.json.
import crypto from 'node:crypto';
import path from 'node:path';
import { fs, writeAtomic, readMany } from './storage.js';
import { ROOT, listPages } from './store.js';
import { attachBlockData } from './distributors.js';

const DIR = path.join(ROOT, 'data', 'templates');
const HISTORY_DIR = path.join(ROOT, 'data', 'template-history');
const HISTORY_KEEP = 50;
const ID = /^t-[a-z0-9]{8}$/;

export const isTemplateId = (id) => typeof id === 'string' && ID.test(id);
export const newTemplateId = () => `t-${crypto.randomBytes(6).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').padEnd(8, '0').slice(0, 8)}`;
const fileOf = (id) => path.join(DIR, `${id}.json`);
const parse = (t) => { try { return t == null ? null : JSON.parse(t); } catch { return null; } };

export async function getTemplate(id) {
  if (!isTemplateId(id)) return null;
  try {
    return JSON.parse(await fs.readFile(fileOf(id), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

/** Several templates in one batch -> Map id -> template (missing ids are left out). */
export async function getTemplates(ids) {
  const list = [...new Set(ids.filter(isTemplateId))];
  const texts = await readMany(list.map(fileOf));
  const map = new Map();
  list.forEach((id, i) => { const t = parse(texts[i]); if (t) map.set(id, t); });
  return map;
}

export async function listTemplateIds() {
  await fs.mkdir(DIR, { recursive: true });
  return (await fs.readdir(DIR)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter(isTemplateId);
}

export async function listTemplates() {
  const ids = await listTemplateIds();
  const map = await getTemplates(ids);
  return ids.map((id) => map.get(id)).filter(Boolean).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

async function snapshot(id) {
  try {
    const prev = await fs.readFile(fileOf(id), 'utf8');
    const dir = path.join(HISTORY_DIR, id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${Date.now()}.json`), prev);
    const files = (await fs.readdir(dir)).sort();
    await Promise.all(files.slice(0, Math.max(0, files.length - HISTORY_KEEP)).map((old) => fs.unlink(path.join(dir, old))));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

/** Templates never contain other templates (one level only). */
const clean = (tpl) => ({ ...tpl, sections: (tpl.sections || []).filter((s) => s.type !== 'template'), badges: tpl.badges || [] });

export async function saveTemplate(id, tpl, actor) {
  if (!isTemplateId(id)) throw new Error('invalid template id');
  await fs.mkdir(DIR, { recursive: true });
  await snapshot(id);
  const out = clean({ ...tpl, id, updatedAt: new Date().toISOString(), updatedBy: actor || null });
  delete out.slug;
  await writeAtomic(fileOf(id), JSON.stringify(out, null, 2) + '\n');
  return out;
}

export async function createTemplate({ name, sections = [], badges = [], from }, actor) {
  let id = newTemplateId();
  while (await getTemplate(id)) id = newTemplateId();
  const tpl = { id, name: String(name || 'Template').slice(0, 160), sections, badges, createdAt: new Date().toISOString(), ...(from ? { duplicatedFrom: from } : {}) };
  return saveTemplate(id, tpl, actor);
}

export async function deleteTemplate(id) {
  if (!isTemplateId(id)) throw new Error('invalid template id');
  await snapshot(id);
  await fs.unlink(fileOf(id));
}

export async function listTemplateHistory(id) {
  try {
    const files = (await fs.readdir(path.join(HISTORY_DIR, id))).filter((f) => /^\d+\.json$/.test(f));
    return files.map((f) => Number(f.slice(0, -5))).sort((a, b) => b - a);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}
export async function readTemplateHistory(id, ts) {
  if (!isTemplateId(id) || !/^\d{10,16}$/.test(String(ts))) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(HISTORY_DIR, id, `${ts}.json`), 'utf8'));
  } catch {
    return null;
  }
}
export async function readTemplateHistoryMany(id, list) {
  if (!isTemplateId(id)) return list.map(() => null);
  const texts = await readMany(list.map((ts) => path.join(HISTORY_DIR, id, `${ts}.json`)));
  return texts.map(parse);
}

// ---------------------------------------------------------------- pages that use templates
export const templateRefs = (page) => (page.sections || []).filter((s) => s.type === 'template').map((s) => s.template);

/**
 * A page with every template section replaced by the template's sections (what visitors see).
 * Section ids stay the same (analytics per section continue); an id used twice gets a -2, -3 … suffix.
 * Template sections carry `_ref` = the page's template section id (the admin preview maps clicks to it).
 * admin: keep hidden template blocks (rendered faded) and show a placeholder for a missing template.
 */
export function expandPage(page, templates, { admin = false } = {}) {
  if (!(page.sections || []).some((s) => s.type === 'template')) return page;
  const used = new Set(page.sections.filter((s) => s.type !== 'template').map((s) => s.id));
  const sections = [];
  const badges = [...(page.badges || [])];
  for (const s of page.sections) {
    if (s.type !== 'template') { sections.push(s); continue; }
    if (s.visible === false && !admin) continue;
    const tpl = templates.get(s.template);
    if (!tpl) {
      if (admin) sections.push({ id: s.id, name: s.name, type: 'html', html: '<div class="lp-tpl-missing">Template tidak ditemukan</div>', _ref: s.id });
      continue;
    }
    const rename = new Map();
    for (const t of tpl.sections || []) {
      let id = t.id;
      for (let n = 2; used.has(id); n++) id = `${t.id}-${n}`;
      used.add(id);
      rename.set(t.id, id);
      sections.push({ ...t, id, _ref: s.id, ...(s.visible === false ? { visible: false } : {}) });
    }
    for (const b of tpl.badges || []) if (rename.has(b.section)) badges.push({ ...b, section: rename.get(b.section) });
  }
  return { ...page, sections, badges };
}

/** Loads the templates a page uses and expands it (one storage round trip). */
export async function resolvePage(page, opts) {
  if (!page) return page;
  const ids = templateRefs(page);
  return attachBlockData(ids.length ? expandPage(page, await getTemplates(ids), opts) : page);
}

/** Expands many pages with one batch read of all templates they use. */
export async function resolvePages(pages, opts) {
  const map = await getTemplates(pages.flatMap(templateRefs));
  return pages.map((p) => expandPage(p, map, opts));
}

/** Map template id -> [{ slug, name }] of live pages that use it. */
export async function templateUsage() {
  const usage = new Map();
  for (const p of await listPages({ withPage: true })) {
    for (const id of new Set(templateRefs(p.page))) {
      if (!usage.has(id)) usage.set(id, []);
      usage.get(id).push({ slug: p.slug, name: p.name });
    }
  }
  return usage;
}
