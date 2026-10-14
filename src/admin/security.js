// Admin authentication, sessions, CSRF protection and audit logging.
// - Passwords: scrypt (N=2^15) with per-user salt, constant-time comparison.
// - Sessions: random 256-bit ids kept server-side; cookie is HttpOnly + SameSite=Strict
//   (+ Secure and __Host- prefix in production); idle timeout and absolute lifetime.
// - CSRF: synchronizer token per session, required on every state-changing request.
// - Brute force: per account+IP lockout after repeated failures (plus route rate limit).
// - Audit: append-only JSONL per month, no secrets or passwords are ever written.
import crypto from 'node:crypto';
import { fs, kv, readMany } from '../storage.js';
import path from 'node:path';
import { ROOT } from '../store.js';

const PROD = process.env.NODE_ENV === 'production';
export const COOKIE = PROD ? '__Host-mb_admin' : 'mb_admin';
const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const AUDIT_DIR = path.join(ROOT, 'data', 'audit');
const AUDIT_RETENTION_DAYS = 90;

// ---------------------------------------------------------------- passwords
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const [alg, n, saltB64, keyB64] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, { ...SCRYPT, N: Number(n) });
  return crypto.timingSafeEqual(key, expected);
}

// A dummy hash so unknown emails take the same time as known ones (no user enumeration).
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

export function loadAdmins() {
  // ADMIN_USERS = "email:scrypt$...;email2:scrypt$..."  (set in .env, never committed)
  const list = String(process.env.ADMIN_USERS || '').split(';').map((s) => s.trim()).filter(Boolean);
  const admins = new Map();
  for (const entry of list) {
    const i = entry.indexOf(':');
    if (i > 0) admins.set(entry.slice(0, i).trim().toLowerCase(), entry.slice(i + 1).trim());
  }
  return admins;
}

// ---------------------------------------------------------------- lockout
// Kept in the shared key-value store so every server instance sees the same counters.
const failKey = (email, ip) => `lf:${crypto.createHash('sha256').update(`${email}|${ip}`).digest('base64url')}`;

export async function isLocked(email, ip) {
  const f = await kv.get(failKey(email, ip));
  return Boolean(f && f.until && f.until > Date.now());
}
async function recordFailure(email, ip) {
  const k = failKey(email, ip);
  const f = (await kv.get(k)) || { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILS) { f.until = Date.now() + LOCK_MS; f.count = 0; }
  await kv.set(k, f, LOCK_MS);
  return f.until > Date.now();
}

export async function authenticate(email, password, ip) {
  const admins = loadAdmins();
  const e = String(email || '').trim().toLowerCase().slice(0, 254);
  const stored = admins.get(e);
  const ok = verifyPassword(String(password || '').slice(0, 256), stored || DUMMY_HASH) && Boolean(stored);
  if (ok) { await kv.del(failKey(e, ip)); return { ok: true, email: e }; }
  const locked = await recordFailure(e, ip);
  return { ok: false, email: e, locked };
}

// ---------------------------------------------------------------- sessions
// Kept in the shared key-value store (local file or Redis) under the SHA-256 of the session id,
// so a leaked store cannot be replayed as a cookie. Entries expire on their own after the idle timeout.
const keyOf = (id) => `s:${crypto.createHash('sha256').update(String(id)).digest('base64url')}`;
const ttlOf = (s, now) => Math.min(IDLE_MS, s.created + ABSOLUTE_MS - now);

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* malformed cookie */ }
    }
  }
  return out;
}

function cookieAttrs(maxAgeSec) {
  return `Path=/; HttpOnly; SameSite=Strict${PROD ? '; Secure' : ''}${maxAgeSec != null ? `; Max-Age=${maxAgeSec}` : ''}`;
}

export async function createSession(res, email) {
  const id = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const s = { email, csrf: crypto.randomBytes(32).toString('base64url'), created: now, seen: now };
  await kv.set(keyOf(id), s, ttlOf(s, now));
  res.setHeader('Set-Cookie', `${COOKIE}=${id}; ${cookieAttrs(ABSOLUTE_MS / 1000)}`);
  return id;
}

export async function destroySession(req, res) {
  const id = parseCookies(req.headers.cookie)[COOKIE];
  if (id) await kv.del(keyOf(id));
  res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieAttrs(0)}`);
}

export async function getSession(req) {
  const id = parseCookies(req.headers.cookie)[COOKIE];
  if (!id || id.length > 100) return null;
  const s = await kv.get(keyOf(id));
  if (!s) return null;
  const now = Date.now();
  if (now - s.seen > IDLE_MS || now - s.created > ABSOLUTE_MS || !loadAdmins().has(s.email)) {
    await kv.del(keyOf(id));
    return null;
  }
  // Refresh the idle timer at most once a minute (saves a write on every request).
  if (now - s.seen > 60 * 1000) { s.seen = now; await kv.set(keyOf(id), s, ttlOf(s, now)); }
  return s;
}

// ---------------------------------------------------------------- middleware
export async function requireAdmin(req, res, next) {
  let s;
  try {
    s = await getSession(req);
  } catch (e) {
    return next(e);
  }
  if (!s) {
    if (req.accepts(['html', 'json']) === 'json' || req.path.startsWith('/api/')) return res.status(401).json({ error: 'Sesi berakhir, silakan login ulang.' });
    return res.redirect(303, `/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  req.admin = s;
  res.set('Cache-Control', 'no-store');
  next();
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
export function requireCsrf(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const token = req.get('x-csrf-token') || (req.body && req.body._csrf);
  const expected = req.admin && req.admin.csrf;
  const ok = token && expected && token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!ok) return res.status(403).json({ error: 'Token keamanan tidak valid. Muat ulang halaman.' });
  // Same-origin check as a second layer
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Origin tidak diizinkan.' });
  next();
}

// ---------------------------------------------------------------- audit log
export async function audit(req, event, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    actor: (req && req.admin && req.admin.email) || data.email || null,
    ip: req ? req.ip : null,
    ua: req ? String(req.get('user-agent') || '').slice(0, 160) : null,
    ...data,
  };
  delete entry.password;
  const file = path.join(AUDIT_DIR, `audit-${entry.ts.slice(0, 7)}.log`);
  await fs.mkdir(AUDIT_DIR, { recursive: true });
  await fs.appendFile(file, JSON.stringify(entry) + '\n');
}

export async function readAudit(limit = 200) {
  try {
    const files = (await fs.readdir(AUDIT_DIR)).filter((f) => f.endsWith('.log')).sort().reverse();
    const out = [];
    const texts = await readMany(files.map((f) => path.join(AUDIT_DIR, f))); // all months in one batch
    for (const text of texts) {
      const lines = String(text || '').trim().split('\n').reverse();
      for (const l of lines) { if (l) out.push(JSON.parse(l)); if (out.length >= limit) return out; }
    }
    return out;
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

// PDP data minimisation: drop audit files older than the retention period.
export async function pruneAudit() {
  try {
    const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 864e5).toISOString().slice(0, 7);
    for (const f of await fs.readdir(AUDIT_DIR)) {
      const m = f.match(/^audit-(\d{4}-\d{2})\.log$/);
      if (m && m[1] < cutoff) await fs.unlink(path.join(AUDIT_DIR, f));
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
