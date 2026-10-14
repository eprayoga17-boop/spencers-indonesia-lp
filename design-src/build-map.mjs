// Builds public/admin/id-map.json (simplified SVG paths of Indonesian provinces) from the open
// BAKOSURTANAL-based GeoJSON (github.com/superpikar/indonesia-geojson, indonesia-province-simple.json).
//   node design-src/build-map.mjs <path-to-geojson>
// The source has the older province split, so newer provinces are coloured with their parent shape
// (see PARENT in src/analytics.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME_TO_CODE = {
  'DI. ACEH': 'AC', 'SUMATERA UTARA': 'SU', 'SUMATERA BARAT': 'SB', RIAU: 'RI', JAMBI: 'JA', 'SUMATERA SELATAN': 'SS',
  BENGKULU: 'BE', LAMPUNG: 'LA', 'BANGKA BELITUNG': 'BB', 'DKI JAKARTA': 'JK', 'JAWA BARAT': 'JB', 'JAWA TENGAH': 'JT',
  'DAERAH ISTIMEWA YOGYAKARTA': 'YO', 'JAWA TIMUR': 'JI', PROBANTEN: 'BT', BALI: 'BA', 'NUSATENGGARA BARAT': 'NB',
  'NUSA TENGGARA TIMUR': 'NT', 'KALIMANTAN BARAT': 'KB', 'KALIMANTAN TENGAH': 'KT', 'KALIMANTAN SELATAN': 'KS',
  'KALIMANTAN TIMUR': 'KI', 'SULAWESI UTARA': 'SA', 'SULAWESI TENGAH': 'ST', 'SULAWESI SELATAN': 'SN', 'SULAWESI TENGGARA': 'SG',
  GORONTALO: 'GO', MALUKU: 'MA', 'MALUKU UTARA': 'MU', 'IRIAN JAYA BARAT': 'PB', 'IRIAN JAYA TENGAH': 'PA', 'IRIAN JAYA TIMUR': 'PA',
};
const [, , src] = process.argv;
const geo = JSON.parse(fs.readFileSync(src, 'utf8'));
const K = 21.5;
const X0 = 94.8;
const Y0 = 6.2;
const proj = ([lon, lat]) => [+((lon - X0) * K).toFixed(1), +((Y0 - lat) * K).toFixed(1)];
const area = (pts) => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

const shapes = new Map();
for (const f of geo.features) {
  const code = NAME_TO_CODE[f.properties.Propinsi];
  if (!code) throw new Error(`unknown province ${f.properties.Propinsi}`);
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = shapes.get(code) || '';
  for (const poly of polys) {
    const ring = [];
    for (const c of poly[0]) {
      const p = proj(c);
      const last = ring[ring.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 0.8) ring.push(p);
    }
    if (ring.length < 3 || area(ring) < 1.2) continue; // drop specks
    d += `M${ring.map((p) => p.join(',')).join('L')}Z`;
  }
  shapes.set(code, d);
}
const out = { viewBox: `0 0 ${Math.round((141.2 - X0) * K)} ${Math.round((Y0 + 11.2) * K)}`, provinces: [...shapes].map(([code, d]) => ({ code, d })) };
fs.writeFileSync(path.join(ROOT, 'public', 'admin', 'id-map.json'), JSON.stringify(out));
console.log(out.viewBox, out.provinces.length, 'provinces', Math.round(JSON.stringify(out).length / 1024), 'KB');
