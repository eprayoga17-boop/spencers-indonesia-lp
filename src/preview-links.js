// Temporary, unguessable links to view a page DRAFT on a real phone ("Coba di HP").
// A link is a random 192-bit token valid for 1 hour; tokens are stored hashed in the key-value store.
import crypto from 'node:crypto';
import os from 'node:os';
import { isValidSlug } from './store.js';
import { kv } from './storage.js';

const TTL = 60 * 60 * 1000;
const keyOf = (t) => `pl:${crypto.createHash('sha256').update(String(t)).digest('base64url')}`;

export async function createLink(slug) {
  if (!isValidSlug(slug)) throw new Error('invalid slug');
  const token = crypto.randomBytes(24).toString('base64url');
  await kv.set(keyOf(token), { slug, exp: Date.now() + TTL }, TTL);
  return { token, expiresAt: new Date(Date.now() + TTL).toISOString() };
}

export async function resolveLink(token) {
  if (!/^[\w-]{32}$/.test(String(token))) return null;
  const hit = await kv.get(keyOf(token));
  return hit && hit.exp > Date.now() ? hit.slug : null;
}

/** Base URL a phone on the same Wi-Fi can open (dev); in production the request host is used. */
export function phoneBase(req) {
  const host = String(req.get('host') || '');
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) return `${req.protocol}://${host}`;
  const port = host.split(':')[1] || '80';
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list || []) if (ni.family === 'IPv4' && !ni.internal && !/^169\.254\./.test(ni.address)) return `http://${ni.address}:${port}`;
  }
  return `${req.protocol}://${host}`;
}
