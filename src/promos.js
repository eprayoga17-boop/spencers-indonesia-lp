// Site-wide promos (menu "Promo"). Exactly one promo is live at a time:
//   1. an INSIDENTIL promo that is switched on manually, or whose date range covers "now";
//   2. otherwise a REGULAR promo whose date range covers "now" (regular promos have no toggle);
//   3. otherwise none (promo sections render nothing).
// Edits go to a draft (data/promos-draft.json); "Publish" copies it to data/promos.json (live).
import { fs, writeAtomic } from './storage.js';
import path from 'node:path';
import { ROOT } from './store.js';

const LIVE = path.join(ROOT, 'data', 'promos.json');
const DRAFT = path.join(ROOT, 'data', 'promos-draft.json');
export const TZ_OFFSET = '+07:00'; // schedules are entered in WIB

const EMPTY = { promos: [] };

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await writeAtomic(file, JSON.stringify(data, null, 2) + '\n');
}

export const getLive = async () => (await readJson(LIVE)) || structuredClone(EMPTY);
export const getDraft = async () => (await readJson(DRAFT)) || getLive();
export const saveDraft = (data) => writeJson(DRAFT, data);
export async function discardDraft() {
  await fs.rm(DRAFT, { force: true });
}
export async function publish(actor) {
  const data = await getDraft();
  data.updatedAt = new Date().toISOString();
  data.updatedBy = actor || null;
  await writeJson(LIVE, data);
  await fs.rm(DRAFT, { force: true });
  return data;
}

const strip = (d) => JSON.stringify((d && d.promos) || []);
export const isDirty = (draft, live) => strip(draft) !== strip(live);

const t = (iso) => (iso ? Date.parse(iso) : NaN);
const inRange = (p, now) => {
  const s = t(p.start);
  const e = t(p.end);
  if (Number.isNaN(s) && Number.isNaN(e)) return false;
  return (Number.isNaN(s) || s <= now) && (Number.isNaN(e) || now <= e);
};

/** Which promo is active at `now`, and why. */
export function resolveActive(data, now = Date.now()) {
  const list = (data && data.promos) || [];
  const ins = list.filter((p) => p.kind === 'insidentil');
  const manual = ins.find((p) => p.manual);
  if (manual) return { promo: manual, reason: 'manual' };
  const scheduled = ins.find((p) => inRange(p, now));
  if (scheduled) return { promo: scheduled, reason: 'jadwal' };
  const regular = list.find((p) => p.kind === 'regular' && inRange(p, now));
  if (regular) return { promo: regular, reason: 'jadwal' };
  return { promo: null, reason: null };
}

/** Status label of one promo for the admin list. */
export function statusOf(p, active, now = Date.now()) {
  if (active && active.id === p.id) return 'aktif';
  if (p.kind === 'insidentil' && p.manual) return 'aktif';
  const s = t(p.start);
  const e = t(p.end);
  if (!Number.isNaN(e) && e < now) return 'berakhir';
  if (!Number.isNaN(s) && s > now) return 'terjadwal';
  if (inRange(p, now)) return 'tertimpa'; // in range but another promo wins
  return 'nonaktif';
}

/** The public shape used by the renderer. */
export function renderable(p) {
  if (!p) return null;
  return { id: p.id, name: p.name, banner: p.banner || null, badge: p.badge || null, bar: p.bar || null };
}

export async function activePromo(now = Date.now()) {
  return renderable(resolveActive(await getLive(), now).promo);
}
