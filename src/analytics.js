// First-party, cookieless analytics for the landing pages ("Laporan").
// Privacy (UU PDP): no cookies, no IP address or full user agent is stored. A visitor is counted with
// sha256(daily random salt + IP + user agent); the salt is replaced every day and the old one is
// thrown away, so visitors cannot be re-identified or followed across days. Referrers are stored
// without query strings. Raw events are kept for RETENTION_DAYS, then deleted.
import { fs } from './storage.js';
import path from 'node:path';
import crypto from 'node:crypto';
import UAParser from 'ua-parser-js';
import { ROOT } from './store.js';

const DIR = path.join(ROOT, 'data', 'analytics');
const SAMPLE_DIR = path.join(ROOT, 'data', 'analytics-sample');
const RETENTION_DAYS = 400;
const WIB = 7 * 3600 * 1000;
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch/i;

export const PROVINCES = {
  AC: 'Aceh', SU: 'Sumatera Utara', SB: 'Sumatera Barat', RI: 'Riau', KR: 'Kepulauan Riau', JA: 'Jambi', SS: 'Sumatera Selatan',
  BE: 'Bengkulu', LA: 'Lampung', BB: 'Kep. Bangka Belitung', JK: 'DKI Jakarta', JB: 'Jawa Barat', JT: 'Jawa Tengah',
  YO: 'DI Yogyakarta', JI: 'Jawa Timur', BT: 'Banten', BA: 'Bali', NB: 'Nusa Tenggara Barat', NT: 'Nusa Tenggara Timur',
  KB: 'Kalimantan Barat', KT: 'Kalimantan Tengah', KS: 'Kalimantan Selatan', KI: 'Kalimantan Timur', KU: 'Kalimantan Utara',
  SA: 'Sulawesi Utara', ST: 'Sulawesi Tengah', SN: 'Sulawesi Selatan', SG: 'Sulawesi Tenggara', SR: 'Sulawesi Barat', GO: 'Gorontalo',
  MA: 'Maluku', MU: 'Maluku Utara', PA: 'Papua', PB: 'Papua Barat', PD: 'Papua Barat Daya', PS: 'Papua Selatan', PT: 'Papua Tengah', PE: 'Papua Pegunungan',
};
// The map uses the older province split; newer provinces are drawn with their parent shape.
export const MAP_PARENT = { KR: 'RI', KU: 'KI', SR: 'SN', PD: 'PB', PS: 'PA', PT: 'PA', PE: 'PA' };

export const dayKey = (t = Date.now()) => new Date(t + WIB).toISOString().slice(0, 10);
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

// ---------------------------------------------------------------- daily salt
let salt = null;
async function dailySalt() {
  const day = dayKey();
  if (salt && salt.day === day) return salt.value;
  const file = path.join(DIR, '.salt.json');
  try {
    const s = JSON.parse(await fs.readFile(file, 'utf8'));
    if (s.day === day) { salt = s; return s.value; }
  } catch { /* new salt */ }
  salt = { day, value: crypto.randomBytes(24).toString('base64url') };
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(salt), { mode: 0o600 }); // yesterday's salt is overwritten = gone
  return salt.value;
}

// ---------------------------------------------------------------- collect
function parseUa(ua) {
  const r = new UAParser(ua).getResult();
  const type = r.device.type === 'mobile' || r.device.type === 'tablet' ? r.device.type : 'desktop';
  const model = [r.device.vendor, r.device.model].filter(Boolean).join(' ');
  const os = r.os.name ? (r.os.name === 'Windows' && r.os.version ? `Windows ${r.os.version}` : r.os.name) : 'Lainnya';
  return { dt: type, dev: type === 'desktop' ? 'Desktop' : model || (type === 'tablet' ? 'Tablet' : 'Smartphone'), br: r.browser.name || 'Lainnya', os };
}

function cleanUrl(u) {
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol)) return null;
    return { url: `${x.protocol}//${x.host}${x.pathname}`.slice(0, 300), host: x.host.toLowerCase() };
  } catch {
    return null;
  }
}

/** Records one page view. Returns false when the hit is ignored (bot, unknown page, admin preview…). */
export async function track(req, body, { pageExists }) {
  const ua = String(req.get('user-agent') || '');
  if (!ua || BOT.test(ua)) return false;
  const p = String(body?.p || '').split(/[?#]/)[0].toLowerCase().replace(/\/+$/, '');
  if (!/^\/[a-z0-9][a-z0-9-]{0,79}$/.test(p) || !(await pageExists(p.slice(1)))) return false;
  const ref = body?.r ? cleanUrl(String(body.r)) : null;
  const ownHost = String(req.get('host') || '').toLowerCase();
  const external = !ref || ref.host !== ownHost;
  const country = String(req.get('cf-ipcountry') || req.get('x-vercel-ip-country') || req.get('x-country') || '').toUpperCase();
  let region = String(req.get('x-vercel-ip-country-region') || req.get('cf-region-code') || req.get('x-region') || '').toUpperCase().replace(/^ID-/, '');
  if (country && country !== 'ID') region = '';
  if (region && !PROVINCES[region]) region = '';
  const ev = {
    t: Date.now(),
    p: p.slice(1),
    v: crypto.createHash('sha256').update(`${await dailySalt()}|${req.ip}|${ua}`).digest('base64url').slice(0, 16),
    ...(ref && external ? { rd: ref.host, ru: ref.url } : {}),
    ...(external ? { lp: 1 } : {}),
    ...parseUa(ua),
    ...(country ? { cc: country } : {}),
    ...(region ? { rg: region } : {}),
  };
  await fs.mkdir(DIR, { recursive: true });
  await fs.appendFile(path.join(DIR, `${dayKey(ev.t)}.jsonl`), JSON.stringify(ev) + '\n');
  return true;
}

const SEC = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KINDS = new Set(['wa', 'link', 'video', 'slider', 'faq', 'other']);
const clampN = (v, a, b) => Math.min(b, Math.max(a, Math.round(Number(v) * 10) / 10 || 0));
const visitorOf = async (req) => crypto.createHash('sha256').update(`${await dailySalt()}|${req.ip}|${String(req.get('user-agent') || '')}`).digest('base64url').slice(0, 16);

/** Records section engagement for one page: seen sections, time per section, clicks (kind + position). */
export async function trackEngagement(req, body, { pageExists }) {
  const ua = String(req.get('user-agent') || '');
  if (!ua || BOT.test(ua)) return false;
  const p = String(body?.p || '').split(/[?#]/)[0].toLowerCase().replace(/\/+$/, '');
  if (!/^\/[a-z0-9][a-z0-9-]{0,79}$/.test(p) || !(await pageExists(p.slice(1)))) return false;
  const sMs = {};
  for (const [id, ms] of Object.entries(body?.s || {}).slice(0, 120)) if (SEC.test(id)) sMs[id] = Math.round(clampN(ms, 0, 30 * 60 * 1000));
  const r = (Array.isArray(body?.r) ? body.r : []).filter((id) => typeof id === 'string' && SEC.test(id)).slice(0, 120);
  const c = (Array.isArray(body?.c) ? body.c : []).slice(0, 60)
    .filter((x) => Array.isArray(x) && SEC.test(String(x[0])) && KINDS.has(x[1]))
    .map((x) => [x[0], x[1], clampN(x[2], -40, 360), clampN(x[3], -40, 6000)]);
  if (!Object.keys(sMs).length && !r.length && !c.length) return false;
  const ev = { k: 'e', t: Date.now(), p: p.slice(1), v: await visitorOf(req), ...(Object.keys(sMs).length ? { s: sMs } : {}), ...(r.length ? { r } : {}), ...(c.length ? { c } : {}) };
  await fs.mkdir(DIR, { recursive: true });
  await fs.appendFile(path.join(DIR, `${dayKey(ev.t)}.jsonl`), JSON.stringify(ev) + '\n');
  return true;
}

export async function pruneAnalytics() {
  const cutoff = dayKey(Date.now() - RETENTION_DAYS * 864e5);
  try {
    for (const f of await fs.readdir(DIR)) if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) && f.slice(0, 10) < cutoff) await fs.unlink(path.join(DIR, f));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

// ---------------------------------------------------------------- read + aggregate
const cache = new Map(); // file -> { mtime, events }
async function readDay(dir, day) {
  const file = path.join(dir, `${day}.jsonl`);
  let st;
  try {
    st = await fs.stat(file);
  } catch {
    return [];
  }
  const hit = cache.get(file);
  if (hit && hit.mtime === st.mtimeMs) return hit.events;
  const events = [];
  for (const line of (await fs.readFile(file, 'utf8')).split('\n')) {
    if (!line) continue;
    try { events.push(JSON.parse(line)); } catch { /* skip broken line */ }
  }
  cache.set(file, { mtime: st.mtimeMs, events });
  return events;
}

export const hasSample = async () => (await fs.readdir(SAMPLE_DIR).catch(() => [])).length > 0;
export async function clearSample() {
  await fs.rm(SAMPLE_DIR, { recursive: true, force: true });
  for (const k of cache.keys()) if (k.startsWith(SAMPLE_DIR)) cache.delete(k);
}

function daysBetween(from, to) {
  const out = [];
  for (let t = Date.parse(from); t <= Date.parse(to) && out.length < 400; t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

async function eventsFor(days, slug) {
  const sample = await hasSample();
  // Days are read in parallel batches (each read is a network round trip in cloud storage).
  const perDay = [];
  for (let i = 0; i < days.length; i += 16) {
    perDay.push(...(await Promise.all(days.slice(i, i + 16).map(async (d) => {
      const evs = [...(await readDay(DIR, d)), ...(sample ? await readDay(SAMPLE_DIR, d) : [])];
      return { d, evs: slug ? evs.filter((e) => e.p === slug) : evs };
    }))));
  }
  return perDay;
}

function rank(map, total, limit = 10) {
  return [...map].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([key, n]) => ({ key, n, pct: total ? Math.round((n / total) * 1000) / 10 : 0 }));
}

/** Report for an inclusive WIB date range, compared with the previous period of the same length. */
export async function report({ from, to, slug = '' }) {
  if (!isDay(from) || !isDay(to) || from > to) throw Object.assign(new Error('Rentang tanggal tidak valid.'), { status: 400, expose: true });
  const days = daysBetween(from, to);
  const len = days.length;
  const prevTo = new Date(Date.parse(from) - 864e5).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(prevTo) - (len - 1) * 864e5).toISOString().slice(0, 10);
  const cur = await eventsFor(days, slug);
  const prev = await eventsFor(daysBetween(prevFrom, prevTo), slug);

  const pv = (evs) => evs.filter((e) => !e.k);
  const series = (list) => list.map(({ d, evs }) => { const p = pv(evs); return { d, views: p.length, visitors: new Set(p.map((e) => e.v)).size }; });
  const sCur = series(cur);
  const sPrev = series(prev);
  const sum = (s, k) => s.reduce((a, x) => a + x[k], 0);

  // one "visit" per visitor per day: first event of the visitor that day
  const pages = new Map(); const landings = new Map(); const google = new Map(); const domains = new Map(); const urls = new Map();
  const devices = new Map(); const types = new Map(); const browsers = new Map(); const oses = new Map(); const regions = new Map();
  const inc = (m, k) => k && m.set(k, (m.get(k) || 0) + 1);
  let visits = 0; let regionKnown = 0;
  let waClicks = 0; let converters = 0;
  for (const { evs } of cur) {
    const seen = new Set();
    const conv = new Set();
    for (const e of evs) {
      if (e.k === 'e') {
        for (const c of e.c || []) if (c[1] === 'wa') { waClicks++; conv.add(e.v); }
        continue;
      }
      inc(pages, e.p);
      if (e.lp) {
        inc(landings, e.p);
        if (e.rd) { inc(domains, e.rd); inc(urls, e.ru); }
        if (e.rd && /(^|\.)google\./.test(e.rd)) inc(google, e.p);
      }
      if (seen.has(e.v)) continue;
      seen.add(e.v);
      visits++;
      inc(devices, e.dev); inc(types, e.dt); inc(browsers, e.br); inc(oses, e.os);
      if (e.rg) { inc(regions, e.rg); regionKnown++; }
    }
    converters += conv.size;
  }
  const views = sum(sCur, 'views');
  const landingTotal = [...landings.values()].reduce((a, b) => a + b, 0);
  const refTotal = [...domains.values()].reduce((a, b) => a + b, 0);
  return {
    from, to, prevFrom, prevTo, slug, sample: await hasSample(),
    series: sCur, prevSeries: sPrev,
    totals: {
      visitors: sum(sCur, 'visitors'), views, prevVisitors: sum(sPrev, 'visitors'), prevViews: sum(sPrev, 'views'),
      direct: landingTotal - refTotal, landings: landingTotal,
      waClicks, converters, conversion: visits ? Math.round((converters / visits) * 1000) / 10 : 0,
    },
    pages: rank(pages, views), landings: rank(landings, landingTotal), google: rank(google, [...google.values()].reduce((a, b) => a + b, 0)),
    domains: rank(domains, refTotal, 20), urls: rank(urls, refTotal, 20),
    devices: rank(devices, visits), types: rank(types, visits, 3), browsers: rank(browsers, visits), os: rank(oses, visits),
    regions: rank(regions, regionKnown, 40).map((r) => ({ ...r, name: PROVINCES[r.key] || r.key, map: MAP_PARENT[r.key] || r.key })),
    regionCoverage: visits ? Math.round((regionKnown / visits) * 100) : 0,
  };
}

/** Per-section engagement for one page: reach, time seen, clicks by type and click positions. */
export async function sectionReport({ from, to, slug }) {
  if (!isDay(from) || !isDay(to) || from > to || !slug) throw Object.assign(new Error('Pilih halaman dan rentang tanggal.'), { status: 400, expose: true });
  const days = await eventsFor(daysBetween(from, to), slug);
  const stats = new Map(); // section -> { reach, ms, timed, clicks: {kind:n}, pts: [] }
  const st = (id) => { if (!stats.has(id)) stats.set(id, { reach: 0, ms: 0, timed: 0, clicks: {}, pts: [] }); return stats.get(id); };
  let visitors = 0; let waClicks = 0; let converters = 0; let depthSum = 0;
  for (const { evs } of days) {
    const pvVisitors = new Set();
    const reach = new Map(); // visitor -> Set(sections)
    const time = new Map(); // "v|sec" -> ms
    const conv = new Set();
    for (const e of evs) {
      if (!e.k) { pvVisitors.add(e.v); continue; }
      if (!reach.has(e.v)) reach.set(e.v, new Set());
      for (const id of e.r || []) reach.get(e.v).add(id);
      for (const [id, ms] of Object.entries(e.s || {})) { reach.get(e.v).add(id); time.set(`${e.v}|${id}`, (time.get(`${e.v}|${id}`) || 0) + ms); }
      for (const [id, kind, x, y] of e.c || []) {
        const s2 = st(id);
        s2.clicks[kind] = (s2.clicks[kind] || 0) + 1;
        if (s2.pts.length < 400) s2.pts.push([x, y, kind]);
        if (kind === 'wa') { waClicks++; conv.add(e.v); }
      }
    }
    visitors += pvVisitors.size;
    converters += conv.size;
    for (const set of reach.values()) { for (const id of set) st(id).reach++; depthSum += set.size; }
    for (const [key, ms] of time) { const id = key.slice(key.indexOf('|') + 1); const s2 = st(id); s2.ms += ms; s2.timed++; }
  }
  const sections = [...stats].map(([id, x]) => ({
    id, reach: x.reach, reachPct: visitors ? Math.min(100, Math.round((x.reach / visitors) * 1000) / 10) : 0,
    avgSec: x.timed ? Math.round(x.ms / x.timed / 100) / 10 : 0, clicks: x.clicks, pts: x.pts,
  }));
  return { from, to, slug, sample: await hasSample(), visitors, waClicks, converters,
    conversion: visitors ? Math.round((converters / visitors) * 1000) / 10 : 0, sections, depthSum };
}

/** CSV export of a report (daily series + ranked lists). */
export function reportCsv(r) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Laporan', `${r.from} s/d ${r.to}`, r.slug ? `/${r.slug}` : 'Semua halaman'], [], ['Tanggal', 'Pengunjung', 'Page view']];
  for (const d of r.series) rows.push([d.d, d.visitors, d.views]);
  rows.push([], ['Total', r.totals.visitors, r.totals.views], ['Klik WhatsApp', r.totals.waClicks], ['Konversi (%)', r.totals.conversion]);
  const block = (title, list, key = (x) => x.key) => { rows.push([], [title, 'Jumlah', '%']); for (const x of list) rows.push([key(x), x.n, x.pct]); };
  block('Halaman terpopuler', r.pages); block('Halaman landasan', r.landings); block('Pencarian Google', r.google);
  block('Sumber domain', r.domains); block('Sumber URL', r.urls); block('Wilayah', r.regions, (x) => x.name);
  block('Perangkat', r.devices); block('Browser', r.browsers); block('Sistem operasi', r.os);
  return '\uFEFF' + rows.map((row) => row.map(q).join(',')).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- sample data (clearly marked, removable)
export async function generateSample(slugs, days = 30, sectionsBySlug = {}) {
  await clearSample();
  await fs.mkdir(SAMPLE_DIR, { recursive: true });
  let seed = 42;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = (w) => { let r = rnd() * w.reduce((a, x) => a + x[1], 0); for (const [k, n] of w) { if ((r -= n) <= 0) return k; } return w[0][0]; };
  const pagesW = [...slugs.map((s, i) => [s, i === 0 ? 30 : 6]), ['slimtestimealblend', 14], ['agentslimdistributorproposal', 10], ['guidance', 8], ['distributormealblendidn', 6], ['testiburnxmatcha', 4]];
  const refW = [[null, 45], ['https://instagram.com/', 22], ['https://www.google.com/', 9], ['http://m.facebook.com/', 8], ['https://www.threads.com/', 5], ['https://www.spencerscalifornia.com/', 5], ['https://www.facebook.com/', 3], ['https://l.wl.co/', 1], ['https://linktr.ee/', 1]];
  const regW = [['JB', 26], ['JK', 18], ['JT', 12], ['JI', 13], ['BT', 8], ['SU', 4], ['SN', 3], ['BA', 2], ['YO', 2], ['RI', 2], ['SS', 2], ['KI', 1.5], ['LA', 1.5], ['SA', 1], ['KB', 1], ['PA', 1], ['SB', 1], ['NB', 0.8], ['KR', 0.8]];
  const uaW = [
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', 30],
    ['Mozilla/5.0 (Linux; Android 14; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36', 14],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1', 16],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', 12],
    ['Mozilla/5.0 (Linux; Android 13; Infinix X6833B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36', 6],
    ['Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36', 4],
    ['Mozilla/5.0 (Linux; Android 13; RMX3710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36', 5],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', 3],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0', 2],
  ];
  const uaCache = new Map();
  const today = Date.parse(dayKey());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today - i * 864e5).toISOString().slice(0, 10);
    const wave = 1 + 0.25 * Math.sin(i / 2.3) + (i < 2 ? 1.6 - i * 0.6 : 0);
    const visitors = Math.round(780 * wave * (0.85 + rnd() * 0.3));
    const lines = [];
    for (let v = 0; v < visitors; v++) {
      const ua = pick(uaW);
      if (!uaCache.has(ua)) uaCache.set(ua, parseUa(ua));
      const vid = crypto.createHash('sha256').update(`${d}|${v}`).digest('base64url').slice(0, 16);
      const ru = pick(refW);
      const ref = ru ? cleanUrl(ru) : null;
      const t = Date.parse(`${d}T00:00:00+07:00`) + Math.floor(rnd() * 864e5);
      const rg = rnd() < 0.85 ? pick(regW) : null;
      const n = rnd() < 0.3 ? 2 : 1;
      const pageOf = [];
      for (let k = 0; k < n; k++) {
        pageOf.push(pick(pagesW));
        lines.push(JSON.stringify({ t: t + k * 60000, p: pageOf[k], v: vid, ...(k === 0 && ref ? { rd: ref.host, ru: ref.url } : {}), ...(k === 0 ? { lp: 1 } : {}), ...uaCache.get(ua), cc: 'ID', ...(rg ? { rg } : {}), x: 1 }));
      }
      const secs = sectionsBySlug[pageOf[0]];
      if (secs && secs.length) {
        let depth = 1;
        while (depth < secs.length && rnd() < (depth < 4 ? 0.97 : 0.955)) depth++;
        const r = secs.slice(0, depth).map((x) => x.id);
        const sMs = {};
        for (const id of r) sMs[id] = Math.round(800 + rnd() * rnd() * 14000);
        const c = [];
        const jit = (v, d) => Math.round((v + (rnd() - 0.5) * 2 * d) * 10) / 10;
        for (const x of secs.slice(0, depth)) {
          if (/^cta/.test(x.id) && rnd() < 0.12) c.push([x.id, 'wa', jit(160, 55), jit(212, 14)]);
          else if (x.id === 'faq' && rnd() < 0.18) c.push([x.id, 'faq', jit(160, 120), jit(120 + Math.floor(rnd() * 6) * 34, 6)]);
          else if (/^video/.test(x.id) && rnd() < 0.1) c.push([x.id, 'video', jit(160, 30), jit(95, 25)]);
          else if (/slider/.test(x.id) && rnd() < 0.08) c.push([x.id, 'slider', rnd() < 0.5 ? jit(14, 6) : jit(306, 6), jit(300, 20)]);
          else if (rnd() < 0.002) c.push([x.id, 'other', jit(160, 140), jit(80, 70)]);
        }
        lines.push(JSON.stringify({ k: 'e', t: t + 90000, p: pageOf[0], v: vid, s: sMs, r, ...(c.length ? { c } : {}), x: 1 }));
      }
    }
    await fs.writeFile(path.join(SAMPLE_DIR, `${d}.jsonl`), lines.join('\n') + '\n');
  }
}
