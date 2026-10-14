// Storage backend switch.
// - Local (default): plain files under data/ and public/uploads/, exactly as before.
// - Cloud (Vercel): the serverless file system is read-only and not shared between instances, so
//   data/ files live in Upstash Redis (KV_REST_API_URL/TOKEN, set by the Vercel integration) and
//   uploaded images in Vercel Blob (BLOB_READ_WRITE_TOKEN). Modules use the same fs-like API either way.
import nodeFs from 'node:fs/promises';
import nodeFss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const R_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';
export const CLOUD = Boolean(R_URL && R_TOKEN);

// ---------------------------------------------------------------- Upstash Redis (REST, no SDK)
async function redis(cmd) {
  const r = await fetch(R_URL, { method: 'POST', headers: { Authorization: `Bearer ${R_TOKEN}` }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(`redis: ${j.error}`);
  return j.result;
}
async function pipeline(cmds) {
  if (!cmds.length) return [];
  const r = await fetch(`${R_URL}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${R_TOKEN}` }, body: JSON.stringify(cmds) });
  const out = await r.json();
  if (!Array.isArray(out)) throw new Error(`redis: ${out.error || 'pipeline failed'}`);
  const bad = out.find((x) => x.error);
  if (bad) throw new Error(`redis: ${bad.error}`);
  return out.map((x) => x.result);
}

// ---------------------------------------------------------------- fs-like API over Redis (data/ only)
// Keys: f:<path> file content (string), d:<dir> set of child names, hash "m" = <path> -> mtime ms.
const enoent = (p) => Object.assign(new Error(`ENOENT: no such file or directory, '${p}'`), { code: 'ENOENT' });
function rel(p) {
  const r = path.relative(ROOT, path.resolve(String(p))).split(path.sep).join('/');
  if (r !== 'data' && !r.startsWith('data/')) throw new Error(`cloud storage only covers data/: ${r}`);
  return r;
}
const dirOf = (r) => r.slice(0, r.lastIndexOf('/'));
const baseOf = (r) => r.slice(r.lastIndexOf('/') + 1);
function linkParents(r) {
  const cmds = [];
  for (let cur = r; cur.includes('/'); cur = dirOf(cur)) cmds.push(['SADD', `d:${dirOf(cur)}`, baseOf(cur)]);
  return cmds;
}
async function unlinkEmptyParents(r) {
  for (let dir = dirOf(r); dir.includes('/'); dir = dirOf(dir)) {
    if ((await redis(['SCARD', `d:${dir}`])) > 0) return;
    await redis(['SREM', `d:${dirOf(dir)}`, baseOf(dir)]);
  }
}
const toText = (data) => (Buffer.isBuffer(data) ? data.toString('utf8') : String(data));

async function walk(r) {
  // -> { files: [...], dirs: [...] } below r (r itself included when it is a file)
  if ((await redis(['EXISTS', `f:${r}`])) === 1) return { files: [r], dirs: [] };
  const files = [];
  const dirs = [];
  let level = [r];
  while (level.length) {
    const members = await pipeline(level.map((d) => ['SMEMBERS', `d:${d}`]));
    const next = [];
    const children = [];
    level.forEach((d, i) => { if (members[i]?.length) dirs.push(d); for (const c of members[i] || []) children.push(`${d}/${c}`); });
    const exists = await pipeline(children.map((c) => ['EXISTS', `f:${c}`]));
    children.forEach((c, i) => (exists[i] === 1 ? files.push(c) : next.push(c)));
    level = next;
  }
  return { files, dirs };
}

const cloudFs = {
  async readFile(p, enc) {
    const v = await redis(['GET', `f:${rel(p)}`]);
    if (v == null) throw enoent(p);
    return enc ? v : Buffer.from(v, 'utf8');
  },
  async writeFile(p, data) {
    const r = rel(p);
    await pipeline([['SET', `f:${r}`, toText(data)], ['HSET', 'm', r, String(Date.now())], ...linkParents(r)]);
  },
  async appendFile(p, data) {
    const r = rel(p);
    await pipeline([['APPEND', `f:${r}`, toText(data)], ['HSET', 'm', r, String(Date.now())], ...linkParents(r)]);
  },
  async readdir(p) {
    return (await redis(['SMEMBERS', `d:${rel(p)}`])) || [];
  },
  async stat(p) {
    const r = rel(p);
    const [len, mt, kids] = await pipeline([['STRLEN', `f:${r}`], ['HGET', 'm', r], ['SCARD', `d:${r}`]]);
    if (mt != null || len > 0) {
      const ms = Number(mt) || 0;
      return { size: len, mtimeMs: ms, mtime: new Date(ms), isFile: () => true, isDirectory: () => false };
    }
    if (kids > 0) return { size: 0, mtimeMs: 0, mtime: new Date(0), isFile: () => false, isDirectory: () => true };
    throw enoent(p);
  },
  async access(p) {
    await cloudFs.stat(p);
  },
  async mkdir() {},
  async unlink(p) {
    const r = rel(p);
    const [n] = await pipeline([['DEL', `f:${r}`], ['HDEL', 'm', r], ['SREM', `d:${dirOf(r)}`, baseOf(r)]]);
    if (!n) throw enoent(p);
    await unlinkEmptyParents(r);
  },
  async rm(p, { force = false } = {}) {
    const r = rel(p);
    const { files, dirs } = await walk(r);
    if (!files.length && !dirs.length) { if (force) return; throw enoent(p); }
    await pipeline([
      ...files.flatMap((f) => [['DEL', `f:${f}`], ['HDEL', 'm', f]]),
      ...dirs.map((d) => ['DEL', `d:${d}`]),
      ['SREM', `d:${dirOf(r)}`, baseOf(r)],
    ]);
    await unlinkEmptyParents(r);
  },
  async rename(a, b) {
    const ra = rel(a);
    const rb = rel(b);
    // Fast path for the common "write temp file, then rename over the target" pattern.
    const v = await redis(['GET', `f:${ra}`]);
    if (v != null) {
      await pipeline([
        ['SET', `f:${rb}`, v], ['HSET', 'm', rb, String(Date.now())], ...linkParents(rb),
        ['DEL', `f:${ra}`], ['HDEL', 'm', ra], ['SREM', `d:${dirOf(ra)}`, baseOf(ra)],
      ]);
      if (dirOf(ra) !== dirOf(rb)) await unlinkEmptyParents(ra);
      return;
    }
    const { files } = await walk(ra);
    if (!files.length) throw enoent(a);
    const values = await pipeline(files.map((f) => ['GET', `f:${f}`]));
    const now = String(Date.now());
    const cmds = [];
    files.forEach((f, i) => {
      const to = rb + f.slice(ra.length);
      cmds.push(['SET', `f:${to}`, values[i] ?? ''], ['HSET', 'm', to, now], ...linkParents(to));
    });
    await pipeline(cmds);
    await cloudFs.rm(a, { force: true });
  },
};

// On Vercel without Redis the deployed files are all there is: serve the bundled data/ read-only
// (landing pages work, the admin is switched off in server.js until Redis is connected).
export const READONLY = Boolean(process.env.VERCEL) && !CLOUD;
let seedFiles = null;
const seed = async () => (seedFiles ||= await import('./seed-data.js').then((m) => m.default).catch(() => ({})));
const erofs = (p) => Object.assign(new Error(`EROFS: read-only storage, '${p}'`), { code: 'EROFS' });
const readonlyFs = {
  async readFile(p, enc) {
    const v = (await seed())[rel(p)];
    if (v == null) throw enoent(p);
    return enc ? v : Buffer.from(v, 'utf8');
  },
  async readdir(p) {
    const prefix = `${rel(p)}/`;
    return [...new Set(Object.keys(await seed()).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length).split('/')[0]))];
  },
  async stat(p) {
    const r = rel(p);
    const files = await seed();
    if (files[r] != null) return { size: files[r].length, mtimeMs: 0, mtime: new Date(0), isFile: () => true, isDirectory: () => false };
    if (Object.keys(files).some((k) => k.startsWith(`${r}/`))) return { size: 0, mtimeMs: 0, mtime: new Date(0), isFile: () => false, isDirectory: () => true };
    throw enoent(p);
  },
  async access(p) { await readonlyFs.stat(p); },
  async mkdir() {},
  writeFile: async (p) => { throw erofs(p); },
  appendFile: async (p) => { throw erofs(p); },
  unlink: async (p) => { throw erofs(p); },
  rm: async (p) => { throw erofs(p); },
  rename: async (p) => { throw erofs(p); },
};

export const fs = CLOUD ? cloudFs : READONLY ? readonlyFs : nodeFs;

// ---------------------------------------------------------------- small key-value store with expiry
// Sessions, login lockouts and preview links. Cloud: Redis keys. Local: memory mirrored to data/kv.json.
const KV_FILE = path.join(ROOT, 'data', 'kv.json');
let local = null;
let saveTimer = null;
function localMap() {
  if (local) return local;
  local = new Map();
  try {
    for (const [k, v] of Object.entries(JSON.parse(nodeFss.readFileSync(KV_FILE, 'utf8')))) local.set(k, v);
  } catch { /* empty */ }
  return local;
}
function saveLocal() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const now = Date.now();
    for (const [k, v] of local) if (v.exp && v.exp < now) local.delete(k);
    try {
      nodeFss.mkdirSync(path.dirname(KV_FILE), { recursive: true });
      nodeFss.writeFileSync(KV_FILE, JSON.stringify(Object.fromEntries(local)), { mode: 0o600 });
    } catch (e) {
      console.error('kv save failed', e.message);
    }
  }, 300);
  saveTimer.unref?.();
}

export const kv = {
  async get(key) {
    if (CLOUD) {
      const v = await redis(['GET', `kv:${key}`]);
      return v == null ? null : JSON.parse(v);
    }
    const hit = localMap().get(key);
    if (!hit) return null;
    if (hit.exp && hit.exp < Date.now()) { local.delete(key); saveLocal(); return null; }
    return hit.v;
  },
  async set(key, value, ttlMs) {
    const ttl = Math.max(1000, Math.round(ttlMs));
    if (CLOUD) return void (await redis(['SET', `kv:${key}`, JSON.stringify(value), 'PX', String(ttl)]));
    localMap().set(key, { v: value, exp: Date.now() + ttl });
    saveLocal();
  },
  async del(key) {
    if (CLOUD) return void (await redis(['DEL', `kv:${key}`]));
    localMap().delete(key);
    saveLocal();
  },
};

// ---------------------------------------------------------------- uploaded images
// urlPath is the public URL, e.g. /uploads/sections/<id>/<name>.webp
const UPLOAD_URL = /^\/uploads\/[a-z0-9/_-]+\.(webp|avif|png|jpe?g|gif|ico)$/i;
const TYPES = { webp: 'image/webp', avif: 'image/avif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', ico: 'image/x-icon' };

export async function saveUpload(urlPath, buffer) {
  if (!UPLOAD_URL.test(urlPath)) throw new Error('invalid upload path');
  if (CLOUD) {
    if (!BLOB_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
    const { put } = await import('@vercel/blob');
    const ext = urlPath.split('.').pop().toLowerCase();
    await put(urlPath.slice(1), buffer, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: TYPES[ext], token: BLOB_TOKEN });
    return;
  }
  const file = path.join(ROOT, 'public', urlPath);
  await nodeFs.mkdir(path.dirname(file), { recursive: true });
  await nodeFs.writeFile(file, buffer);
}

/** Does an uploaded image exist? origin is used in the cloud, where deployed images sit on the CDN. */
export async function uploadExists(urlPath, origin) {
  if (!CLOUD) {
    try { await nodeFs.access(path.join(ROOT, 'public', urlPath)); return true; } catch { return false; }
  }
  try {
    return (await fetch(origin + urlPath, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
}

/** Cloud only: serve /uploads/* that are not part of the deployment from Vercel Blob. */
export async function serveUpload(req, res, next) {
  const urlPath = `/uploads${req.path}`;
  if (!CLOUD || !BLOB_TOKEN || !UPLOAD_URL.test(urlPath)) return next();
  try {
    const { head } = await import('@vercel/blob');
    const meta = await head(urlPath.slice(1), { token: BLOB_TOKEN }).catch(() => null);
    if (!meta) return next();
    const r = await fetch(meta.url);
    if (!r.ok) return next();
    res.set({
      'Content-Type': meta.contentType || TYPES[urlPath.split('.').pop().toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable', // file names are random and never reused
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    next(e);
  }
}

// ---------------------------------------------------------------- first deploy: copy bundled data/ into Redis
let seeding = null;
export function ensureSeeded() {
  if (!CLOUD) return Promise.resolve();
  seeding ||= (async () => {
    if ((await redis(['SET', 'seeded', String(Date.now()), 'NX'])) !== 'OK') return;
    let files;
    try {
      files = (await import('./seed-data.js')).default; // generated by `npm run vercel-build`
    } catch {
      console.error('seed-data.js missing: cloud storage starts empty');
      return;
    }
    for (const [p, text] of Object.entries(files)) await cloudFs.writeFile(path.join(ROOT, p), text);
    console.log(`seeded ${Object.keys(files).length} files into cloud storage`);
  })().catch((e) => { seeding = null; throw e; });
  return seeding;
}
