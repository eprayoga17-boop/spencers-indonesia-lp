// Site-wide defaults ("Global" tab): page width, font, favicon, page categories.
import { fs, writeAtomic } from './storage.js';
import path from 'node:path';
import { ROOT } from './store.js';

const FILE = path.join(ROOT, 'data', 'global.json');

// Fonts that are self-hosted in public/assets/fonts (no third-party font requests).
export const FONTS = {
  '': 'Default (Arial)',
  Poppins: 'Poppins',
  Montserrat: 'Montserrat',
  'DM Sans': 'DM Sans',
  'Bebas Neue': 'Bebas Neue',
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

export const DEFAULT_GLOBAL = { maxWidth: 480, font: '', favicon: '/uploads/seed/favicon.png', categories: [], ga4Id: '', rotators: [], fbPixelId: '', tiktokPixelId: '', gadsId: '', gadsLabel: '' };

export function normalizeGlobal(g = {}) {
  const out = { ...DEFAULT_GLOBAL };
  if (WIDTHS.includes(Number(g.maxWidth))) out.maxWidth = Number(g.maxWidth);
  if (Object.hasOwn(FONTS, g.font)) out.font = g.font;
  if (g.favicon === '' || (typeof g.favicon === 'string' && /^\/uploads\/[\w./-]+\.(png|webp|ico)$/.test(g.favicon))) out.favicon = g.favicon;
  if (typeof g.ga4Id === 'string' && /^(G-[A-Z0-9]{4,15})?$/.test(g.ga4Id.trim().toUpperCase())) out.ga4Id = g.ga4Id.trim().toUpperCase();
  if (Array.isArray(g.categories)) {
    out.categories = [...new Set(g.categories.map((c) => String(c).trim().slice(0, 60)).filter(Boolean))].slice(0, 100);
  }
  // CS Rotator: groups of WhatsApp numbers; /go/wa/<id> sends each visitor to the next number in turn.
  if (Array.isArray(g.rotators)) {
    const seen = new Set();
    out.rotators = g.rotators.slice(0, 20).map((r) => {
      const name = String(r?.name || '').trim().slice(0, 60) || 'CS Rotator';
      let id = String(r?.id || name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cs';
      for (let n = 2; seen.has(id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
      seen.add(id);
      const numbers = [...new Set((Array.isArray(r?.numbers) ? r.numbers : String(r?.numbers || '').split(/[\n,;]+/))
        .map((x) => String(x).replace(/\D/g, '').replace(/^0/, '62').replace(/^8/, '628')).filter((x) => x.length >= 9 && x.length <= 15))].slice(0, 30);
      return { id, name, numbers, message: String(r?.message || '').trim().slice(0, 500) };
    });
  }
  // Ad pixels (load only after the visitor accepts the cookie notice, see /assets/js/pixels.js)
  if (typeof g.fbPixelId === 'string' && /^(\d{8,20})?$/.test(g.fbPixelId.trim())) out.fbPixelId = g.fbPixelId.trim();
  if (typeof g.tiktokPixelId === 'string' && /^([A-Z0-9]{10,30})?$/i.test(g.tiktokPixelId.trim())) out.tiktokPixelId = g.tiktokPixelId.trim().toUpperCase();
  if (typeof g.gadsId === 'string' && /^(AW-\d{6,15})?$/i.test(g.gadsId.trim())) out.gadsId = g.gadsId.trim().toUpperCase();
  if (typeof g.gadsLabel === 'string' && /^([\w-]{4,40})?$/.test(g.gadsLabel.trim())) out.gadsLabel = g.gadsLabel.trim();
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
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await writeAtomic(FILE, data);
}
