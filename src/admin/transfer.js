// Page export/import as a compact signed code: "MBP1.<deflated JSON, base64url>.<HMAC-SHA256>".
// Only this system can read/accept it: the HMAC key (EXPORT_SECRET) never leaves the server,
// so codes that were edited or produced elsewhere are rejected. Images are referenced by their
// /uploads URL (not embedded) because they already live on this server.
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../store.js';
import { UserError } from './media.js';

const PREFIX = 'MBP1';
const MAX_CODE = 8 * 1024 * 1024;

function secret() {
  if (!process.env.EXPORT_SECRET) {
    if (process.env.VERCEL) throw new Error('EXPORT_SECRET is not set'); // set it in the Vercel project env
    // First run: create a key and keep it in .env (gitignored) so codes stay valid after restarts.
    const key = crypto.randomBytes(32).toString('base64url');
    const env = path.join(ROOT, '.env');
    const cur = fs.existsSync(env) ? fs.readFileSync(env, 'utf8') : '';
    fs.writeFileSync(env, `${cur}${cur && !cur.endsWith('\n') ? '\n' : ''}EXPORT_SECRET=${key}\n`, { mode: 0o600 });
    process.env.EXPORT_SECRET = key;
  }
  return process.env.EXPORT_SECRET;
}

const sign = (data) => crypto.createHmac('sha256', secret()).update(`${PREFIX}.${data}`).digest('base64url');

export function exportCode(page, source) {
  const body = { kind: 'mealblend-page', v: 1, source, exportedAt: new Date().toISOString(), page };
  const data = zlib.deflateRawSync(Buffer.from(JSON.stringify(body)), { level: 9 }).toString('base64url');
  return `${PREFIX}.${data}.${sign(data)}`;
}

export function importCode(code) {
  const c = String(code || '').replace(/\s+/g, '');
  if (!c) throw new UserError('Tempel kode export atau pilih file .mbpage.');
  if (c.length > MAX_CODE) throw new UserError('Kode terlalu besar.');
  const [prefix, data, sig] = c.split('.');
  if (prefix !== PREFIX || !data || !sig) throw new UserError('Format kode tidak dikenali. Gunakan kode dari tombol Ekspor.');
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    throw new UserError('Kode tidak valid atau sudah diubah. Hanya kode dari sistem ini yang bisa diimpor.');
  }
  let body;
  try {
    body = JSON.parse(zlib.inflateRawSync(Buffer.from(data, 'base64url'), { maxOutputLength: 50 * 1024 * 1024 }).toString('utf8'));
  } catch {
    throw new UserError('Kode rusak dan tidak bisa dibaca.');
  }
  const page = body && body.page;
  if (body.kind !== 'mealblend-page' || body.v !== 1 || !page || !Array.isArray(page.sections)) throw new UserError('Isi kode bukan halaman yang valid.');
  for (const s of page.sections) {
    if (!s || typeof s.id !== 'string' || !['image', 'html', 'promo'].includes(s.type)) throw new UserError('Isi kode bukan halaman yang valid.');
  }
  return { page, source: body.source, exportedAt: body.exportedAt };
}
