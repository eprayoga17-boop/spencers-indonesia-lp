// Draft editing with undo/redo. Edits never touch the live page until "Simpan" (publish).
// data/drafts/<slug>/meta.json  { rev, pos, savedPos, ids: [n...], next, baseVersion }
// data/drafts/<slug>/<n>.json   one full editor state { page, global } per step
import { fs } from './storage.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, isValidSlug } from './store.js';

const DIR = path.join(ROOT, 'data', 'drafts');
const MAX_STEPS = 80;

const dirOf = (slug) => {
  if (!isValidSlug(slug)) throw new Error('invalid slug');
  return path.join(DIR, slug);
};

async function writeJson(file, data) {
  const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, file);
}
async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

export const info = (meta) => ({
  rev: meta.rev,
  canUndo: meta.pos > 0,
  canRedo: meta.pos < meta.ids.length - 1,
  dirty: meta.pos !== meta.savedPos,
});

export async function readMeta(slug) {
  return readJson(path.join(dirOf(slug), 'meta.json'));
}

/** Current draft; created from the live page + global settings when none exists. */
export async function openDraft(slug, initial) {
  const dir = dirOf(slug);
  let meta = await readMeta(slug);
  if (meta) {
    const state = await readJson(path.join(dir, `${meta.ids[meta.pos]}.json`));
    if (state) return { meta, state };
  }
  const state = await initial();
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  meta = { rev: 1, pos: 0, savedPos: 0, ids: [1], next: 2, baseVersion: state.page.updatedAt || null };
  await writeJson(path.join(dir, '1.json'), state);
  await writeJson(path.join(dir, 'meta.json'), meta);
  return { meta, state };
}

/** Records a new step (drops any redo steps after the current position). */
export async function pushState(slug, meta, state) {
  const dir = dirOf(slug);
  for (const id of meta.ids.splice(meta.pos + 1)) await fs.rm(path.join(dir, `${id}.json`), { force: true });
  const id = meta.next++;
  await writeJson(path.join(dir, `${id}.json`), state);
  meta.ids.push(id);
  while (meta.ids.length > MAX_STEPS) {
    await fs.rm(path.join(dir, `${meta.ids.shift()}.json`), { force: true });
    meta.savedPos -= 1; // may become -1 = saved version no longer in the stack (still dirty)
  }
  meta.pos = meta.ids.length - 1;
  meta.rev += 1;
  await writeJson(path.join(dir, 'meta.json'), meta);
  return meta;
}

export async function step(slug, meta, delta) {
  const pos = meta.pos + delta;
  if (pos < 0 || pos >= meta.ids.length) return null;
  meta.pos = pos;
  meta.rev += 1;
  await writeJson(path.join(dirOf(slug), 'meta.json'), meta);
  return readJson(path.join(dirOf(slug), `${meta.ids[pos]}.json`));
}

export async function markSaved(slug, meta, baseVersion) {
  meta.savedPos = meta.pos;
  meta.baseVersion = baseVersion;
  meta.rev += 1;
  await writeJson(path.join(dirOf(slug), 'meta.json'), meta);
  return meta;
}

/** After a slug change the draft moves with the page. */
export async function moveDraft(from, to) {
  await fs.rm(dirOf(to), { recursive: true, force: true });
  await fs.rename(dirOf(from), dirOf(to));
}

export async function discardDraft(slug) {
  await fs.rm(dirOf(slug), { recursive: true, force: true });
}
