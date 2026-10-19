// Official distributors (menu Distributor in the admin). One list, shown on any page through the
// "Daftar Distributor" element, so a change is made once instead of in every page.
// data/distributors.json = { items: [{ id, province, city, name, top, links: [{ type, url, label }] }] }
import crypto from 'node:crypto';
import path from 'node:path';
import { fs, writeAtomic } from './storage.js';
import { ROOT } from './store.js';

const FILE = path.join(ROOT, 'data', 'distributors.json');
export const LINK_KINDS = {
  shopee: 'Order via Shopee', tokopedia: 'Order via Tokopedia', tiktok: 'Order via TikTok Shop', lazada: 'Order via Lazada',
  wa: 'Chat WhatsApp', maps: 'Kunjungi toko offline', web: 'Kunjungi website',
};
export const PROVINCES = ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan', 'Kepulauan Bangka Belitung',
  'Bengkulu', 'Lampung', 'DKI Jakarta', 'Banten', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Bali', 'Nusa Tenggara Barat',
  'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara',
  'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat',
  'Papua Barat Daya', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan'];

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const httpUrl = (v) => { const s = clip(v, 1000); return /^https?:\/\/[^\s<>"]+$/i.test(s) ? s : ''; };
const guessKind = (url) => (/shopee|shp\.ee/i.test(url) ? 'shopee' : /tokopedia/i.test(url) ? 'tokopedia' : /tiktok/i.test(url) ? 'tiktok'
  : /lazada/i.test(url) ? 'lazada' : /wa\.me|whatsapp/i.test(url) ? 'wa' : /maps\.app|goo\.gl\/maps|google\.[a-z.]+\/maps/i.test(url) ? 'maps' : 'web');

export function normalizeDistributor(d = {}, id) {
  const links = (Array.isArray(d.links) ? d.links : []).map((l) => {
    const url = httpUrl(l && l.url);
    if (!url) return null;
    const type = Object.hasOwn(LINK_KINDS, l.type) ? l.type : guessKind(url);
    return { type, url, label: clip(l.label, 40) || LINK_KINDS[type] };
  }).filter(Boolean).slice(0, 8);
  return {
    id: /^d-[a-z0-9]{6,12}$/.test(id || d.id || '') ? id || d.id : `d-${crypto.randomBytes(4).toString('hex')}`,
    province: clip(d.province, 60),
    city: clip(d.city, 60),
    name: clip(d.name, 160),
    top: d.top === true || d.top === 'true',
    links,
  };
}

let cache = null; // { at, items } — short cache so busy pages do not re-read storage every request
export async function getDistributors({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < 15_000) return cache.items;
  let items = [];
  try {
    items = (JSON.parse(await fs.readFile(FILE, 'utf8')).items || []).map((d) => normalizeDistributor(d));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  cache = { at: Date.now(), items };
  return items;
}

let chain = Promise.resolve();
/** Serialised read-modify-write of the list. fn(items) returns the new list. */
export function updateDistributors(fn) {
  const run = chain.then(async () => {
    const items = await getDistributors({ fresh: true });
    const next = (await fn(items.map((d) => ({ ...d, links: d.links.map((l) => ({ ...l })) })))).map((d) => normalizeDistributor(d));
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await writeAtomic(FILE, `${JSON.stringify({ items: next }, null, 2)}\n`);
    cache = { at: Date.now(), items: next };
    return next;
  });
  chain = run.catch(() => {});
  return run;
}

const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });
/** [{ province, cities: [{ city, items }] }]: provinces and cities A–Z (natural numbers), areas in admin order. */
export function groupDistributors(items) {
  const byProv = new Map();
  for (const d of items) {
    const prov = d.province || 'Lainnya';
    if (!byProv.has(prov)) byProv.set(prov, new Map());
    const cities = byProv.get(prov);
    const city = d.city || prov;
    if (!cities.has(city)) cities.set(city, []);
    cities.get(city).push(d);
  }
  return [...byProv].sort((a, b) => collator.compare(a[0], b[0])).map(([province, cities]) => ({
    province,
    cities: [...cities].sort((a, b) => collator.compare(a[0], b[0]))
      .map(([city, list]) => ({ city, items: list.sort((a, b) => b.top - a.top) })), // TOP SELLER first, then the order set in the admin
  }));
}

/** Loads what elements on this page need at render time (page._data). */
export async function attachBlockData(page) {
  if (!page || !page.sections || !page.sections.some((s) => s.type === 'block' && s.kind === 'distributors')) return page;
  return { ...page, _data: { ...(page._data || {}), distributors: await getDistributors() } };
}
