// Page storage: one JSON file per page in data/pages, atomic writes, and a history
// snapshot of the previous version on every save (change management / rollback).
import { fs, writeAtomic as writeFileAtomic, readMany } from './storage.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAGES_DIR = path.join(ROOT, 'data', 'pages');
const HISTORY_DIR = path.join(ROOT, 'data', 'history');
const HISTORY_KEEP = 50;

export const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const SECTION_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RESERVED = new Set(['admin', 'assets', 'uploads', 'api', 'login', 'logout', 'favicon-ico', 'robots-txt', 'produk', 'pesanan', 'checkout', 'katalog']);

export function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG.test(slug) && !RESERVED.has(slug);
}

const pageFile = (slug) => path.join(PAGES_DIR, `${slug}.json`);

export async function getPage(slug) {
  if (!isValidSlug(slug)) return null;
  try {
    return JSON.parse(await fs.readFile(pageFile(slug), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

/** Slugs of all live pages (one directory listing, no page reads). */
export async function listSlugs() {
  await fs.mkdir(PAGES_DIR, { recursive: true });
  return (await fs.readdir(PAGES_DIR)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter(isValidSlug);
}

/** All live pages, read in one batch. withPage adds the full page object as `page` (not for JSON output). */
export async function listPages({ withPage = false } = {}) {
  const slugs = await listSlugs();
  const texts = await readMany(slugs.map(pageFile));
  const out = [];
  for (const [i, slug] of slugs.entries()) {
    if (texts[i] == null) continue;
    const page = JSON.parse(texts[i]);
    const st = page.updatedAt ? null : await fs.stat(pageFile(slug)).catch(() => null);
    out.push({
      ...(withPage ? { page } : {}),
      slug,
      name: page.name || page.title || slug,
      title: page.title || slug,
      category: page.category || '',
      thumbnail: page.thumbnail || null,
      sections: page.sections.length,
      updatedAt: page.updatedAt || (st ? st.mtime.toISOString() : new Date(0).toISOString()),
      updatedBy: page.updatedBy || null,
      duplicatedFrom: page.duplicatedFrom || null,
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const writeAtomic = (file, data) => writeFileAtomic(file, data);

async function snapshot(slug) {
  try {
    const prev = await fs.readFile(pageFile(slug), 'utf8');
    const dir = path.join(HISTORY_DIR, slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${Date.now()}.json`), prev);
    const files = (await fs.readdir(dir)).sort();
    await Promise.all(files.slice(0, Math.max(0, files.length - HISTORY_KEEP)).map((old) => fs.unlink(path.join(dir, old))));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

// Serialise writes per page so two quick edits cannot interleave.
const locks = new Map();
export function withPageLock(slug, fn) {
  const prev = locks.get(slug) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(slug, next.catch(() => {}));
  return next;
}

export async function savePage(slug, page, actor) {
  if (!isValidSlug(slug)) throw new Error('invalid slug');
  await fs.mkdir(PAGES_DIR, { recursive: true });
  await snapshot(slug);
  page.slug = slug;
  page.updatedAt = new Date().toISOString();
  page.updatedBy = actor || null;
  await writeAtomic(pageFile(slug), JSON.stringify(page, null, 2) + '\n');
  return page;
}

export async function createPage(slug, page, actor) {
  if (!isValidSlug(slug)) throw new Error('invalid slug');
  if (await getPage(slug)) throw Object.assign(new Error('slug exists'), { code: 'EXISTS' });
  return savePage(slug, page, actor);
}

export async function archivePage(slug) {
  await snapshot(slug);
  await fs.unlink(pageFile(slug));
}

export async function listHistory(slug) {
  try {
    const files = (await fs.readdir(path.join(HISTORY_DIR, slug))).filter((f) => /^\d+\.json$/.test(f));
    return files.map((f) => Number(f.slice(0, -5))).sort((a, b) => b - a);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

export async function readHistory(slug, ts) {
  if (!isValidSlug(slug) || !/^\d{10,16}$/.test(String(ts))) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(HISTORY_DIR, slug, `${ts}.json`), 'utf8'));
  } catch {
    return null;
  }
}

/** Several history versions in one batch -> array of pages (null where unreadable). */
export async function readHistoryMany(slug, list) {
  if (!isValidSlug(slug)) return list.map(() => null);
  const texts = await readMany(list.map((ts) => path.join(HISTORY_DIR, slug, `${ts}.json`)));
  return texts.map((t) => { try { return t == null ? null : JSON.parse(t); } catch { return null; } });
}

export function newSectionId(page, base = 'section') {
  const clean = String(base).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'section';
  const ids = new Set(page.sections.map((s) => s.id));
  let id = clean, n = 2;
  while (ids.has(id)) id = `${clean}-${n++}`;
  return id;
}

// ---------------------------------------------------------------- slug change + redirects
const REDIRECTS = path.join(ROOT, 'data', 'redirects.json');

export async function getRedirects() {
  try {
    return JSON.parse(await fs.readFile(REDIRECTS, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

/** Moves a page to a new slug: writes the new file, moves its history, removes the old file, adds a 301 redirect. */
export async function renamePage(from, to, page, actor) {
  if (!isValidSlug(from) || !isValidSlug(to)) throw new Error('invalid slug');
  if (await getPage(to)) throw Object.assign(new Error('slug exists'), { code: 'EXISTS' });
  await savePage(to, page, actor);
  try {
    await fs.rename(path.join(HISTORY_DIR, from), path.join(HISTORY_DIR, to));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  await snapshot(to); // keep the pre-rename state restorable
  await fs.unlink(pageFile(from));
  const map = await getRedirects();
  for (const k of Object.keys(map)) if (map[k] === from) map[k] = to; // no redirect chains
  delete map[to];
  map[from] = to;
  await writeAtomic(REDIRECTS, JSON.stringify(map, null, 2) + '\n');
}
