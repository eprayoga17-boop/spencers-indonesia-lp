// Draft editing with undo/redo. Edits never touch the live document until "Simpan" (publish).
// data/<dir>/<key>/meta.json  { rev, pos, savedPos, ids: [n...], next, baseVersion }
// data/<dir>/<key>/<n>.json   one full editor state { page, global } per step
// Pages use data/drafts/<slug>, templates data/template-drafts/<id> (same editor, same rules).
import { fs, writeAtomic, readMany } from './storage.js';
import path from 'node:path';
import { ROOT, isValidSlug } from './store.js';

const MAX_STEPS = 80;

const writeJson = (file, data) => writeAtomic(file, JSON.stringify(data));
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

export function makeDrafts(dirName) {
  const DIR = path.join(ROOT, 'data', dirName);
  const dirOf = (key) => {
    if (!isValidSlug(key)) throw new Error('invalid draft key');
    return path.join(DIR, key);
  };

  const readMeta = (key) => readJson(path.join(dirOf(key), 'meta.json'));

  /** Current draft; created from the live document (+ global settings) when none exists. */
  async function openDraft(key, initial) {
    const dir = dirOf(key);
    let meta = await readMeta(key);
    if (meta) {
      const state = await readJson(path.join(dir, `${meta.ids[meta.pos]}.json`));
      if (state) return { meta, state };
    }
    const state = await initial();
    if (meta) await fs.rm(dir, { recursive: true, force: true }); // broken draft: start clean
    await fs.mkdir(dir, { recursive: true });
    meta = { rev: 1, pos: 0, savedPos: 0, ids: [1], next: 2, baseVersion: state.page.updatedAt || null };
    await writeJson(path.join(dir, '1.json'), state);
    await writeJson(path.join(dir, 'meta.json'), meta);
    return { meta, state };
  }

  /** Current draft without creating one -> { meta, state } | null. */
  async function peek(key) {
    const meta = await readMeta(key);
    if (!meta) return null;
    const state = await readJson(path.join(dirOf(key), `${meta.ids[meta.pos]}.json`));
    return state ? { meta, state } : null;
  }

  /** Records a new step (drops any redo steps after the current position). */
  async function pushState(key, meta, state) {
    const dir = dirOf(key);
    await Promise.all(meta.ids.splice(meta.pos + 1).map((id) => fs.rm(path.join(dir, `${id}.json`), { force: true })));
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

  async function step(key, meta, delta) {
    const pos = meta.pos + delta;
    if (pos < 0 || pos >= meta.ids.length) return null;
    meta.pos = pos;
    meta.rev += 1;
    // Save the new position and load that step at the same time.
    const [, state] = await Promise.all([writeJson(path.join(dirOf(key), 'meta.json'), meta), readJson(path.join(dirOf(key), `${meta.ids[pos]}.json`))]);
    return state;
  }

  async function markSaved(key, meta, baseVersion) {
    meta.savedPos = meta.pos;
    meta.baseVersion = baseVersion;
    meta.rev += 1;
    await writeJson(path.join(dirOf(key), 'meta.json'), meta);
    return meta;
  }

  /** After a slug change the draft moves with the page. */
  async function moveDraft(from, to) {
    await fs.rm(dirOf(to), { recursive: true, force: true });
    await fs.rename(dirOf(from), dirOf(to));
  }

  async function discardDraft(key) {
    await fs.rm(dirOf(key), { recursive: true, force: true });
  }

  /** Draft metadata of several documents in one batch -> array (null where there is no draft). */
  async function readMetas(keys) {
    const texts = await readMany(keys.map((key) => path.join(dirOf(key), 'meta.json')));
    return texts.map((t) => (t == null ? null : JSON.parse(t)));
  }

  return { readMeta, peek, openDraft, pushState, step, markSaved, moveDraft, discardDraft, readMetas };
}

// Pages (existing imports keep working).
export const { readMeta, openDraft, pushState, step, markSaved, moveDraft, discardDraft, readMetas } = makeDrafts('drafts');
export const templateDrafts = makeDrafts('template-drafts');
