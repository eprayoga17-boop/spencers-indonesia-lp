// Site-wide defaults ("Global" tab): page width, font, favicon, page categories.
import { fs } from './storage.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './store.js';

const FILE = path.join(ROOT, 'data', 'global.json');

// Fonts that are self-hosted in public/assets/fonts (no third-party font requests).
export const FONTS = {
  '': 'Default (Arial)',
  Poppins: 'Poppins',
  Inter: 'Inter',
  Lato: 'Lato',
  'Open Sans': 'Open Sans',
  Roboto: 'Roboto',
  Raleway: 'Raleway',
  'Josefin Sans': 'Josefin Sans',
  'Libre Baskerville': 'Libre Baskerville',
  Caveat: 'Caveat',
};
export const WIDTHS = [360, 375, 390, 414, 430, 480, 540, 600];

export const DEFAULT_GLOBAL = { maxWidth: 480, font: '', favicon: '/uploads/seed/favicon.png', categories: [], ga4Id: '' };

export function normalizeGlobal(g = {}) {
  const out = { ...DEFAULT_GLOBAL };
  if (WIDTHS.includes(Number(g.maxWidth))) out.maxWidth = Number(g.maxWidth);
  if (Object.hasOwn(FONTS, g.font)) out.font = g.font;
  if (g.favicon === '' || (typeof g.favicon === 'string' && /^\/uploads\/[\w./-]+\.(png|webp|ico)$/.test(g.favicon))) out.favicon = g.favicon;
  if (typeof g.ga4Id === 'string' && /^(G-[A-Z0-9]{4,15})?$/.test(g.ga4Id.trim().toUpperCase())) out.ga4Id = g.ga4Id.trim().toUpperCase();
  if (Array.isArray(g.categories)) {
    out.categories = [...new Set(g.categories.map((c) => String(c).trim().slice(0, 60)).filter(Boolean))].slice(0, 100);
  }
  return out;
}

export async function getGlobal() {
  try {
    return normalizeGlobal(JSON.parse(await fs.readFile(FILE, 'utf8')));
  } catch (e) {
    if (e.code === 'ENOENT') return normalizeGlobal();
    throw e;
  }
}

export async function saveGlobal(g) {
  const data = JSON.stringify(normalizeGlobal(g), null, 2) + '\n';
  const tmp = `${FILE}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, FILE);
}
