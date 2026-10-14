// Adds or updates an admin account in .env (ADMIN_USERS) with a scrypt password hash.
//   node scripts/create-admin.mjs <email> [password]
// Without a password a strong random one is generated and written to
// data/secrets/admin-credentials.txt (gitignored, local only) — it is never printed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/admin/security.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env');
const [emailArg, passArg] = process.argv.slice(2);
const email = String(emailArg || '').trim().toLowerCase();
if (!/^[^\s@:;]+@[^\s@:;]+\.[^\s@:;]+$/.test(email)) {
  console.error('Usage: node scripts/create-admin.mjs <email> [password]');
  process.exit(1);
}
if (passArg && passArg.length < 12) {
  console.error('Password minimal 12 karakter.');
  process.exit(1);
}
const password = passArg || crypto.randomBytes(15).toString('base64url');

let env = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
const line = env.split(/\r?\n/).find((l) => l.startsWith('ADMIN_USERS='));
const users = new Map(
  (line ? line.slice('ADMIN_USERS='.length) : '').split(';').map((s) => s.trim()).filter(Boolean)
    .map((e) => [e.slice(0, e.indexOf(':')), e.slice(e.indexOf(':') + 1)])
);
users.set(email, hashPassword(password));
const value = `ADMIN_USERS=${[...users].map(([e, h]) => `${e}:${h}`).join(';')}`;
env = line ? env.replace(line, value) : `${env}${env && !env.endsWith('\n') ? '\n' : ''}${value}\n`;
fs.writeFileSync(ENV, env, { mode: 0o600 });

if (!passArg) {
  const dir = path.join(ROOT, 'data', 'secrets');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'admin-credentials.txt');
  fs.appendFileSync(file, `${new Date().toISOString()}  ${email}  ${password}\n`, { mode: 0o600 });
  console.log(`Admin ${email} disimpan di .env. Password acak ditulis ke ${path.relative(ROOT, file)} (jangan dibagikan).`);
} else {
  console.log(`Admin ${email} disimpan di .env.`);
}
console.log('Restart server agar perubahan terbaca.');
