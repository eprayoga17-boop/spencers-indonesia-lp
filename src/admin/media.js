// Image upload processing (OWASP A04/A08: never trust the upload).
// - The file is decoded by sharp to prove it is a real raster image (SVG and anything else are rejected).
// - Decompression bombs are refused via limitInputPixels.
// - Output is re-encoded (WebP + AVIF), so EXIF/GPS/camera metadata is dropped (PDP data minimisation).
// - Stored under a random file name; the original name is never used on disk.
import sharp from 'sharp';
import crypto from 'node:crypto';
import { SECTION_ID } from '../store.js';
import { saveUpload } from '../storage.js';

sharp.cache(false);
const MAX_WIDTH = 1440; // 3x the 480px page column, plenty for retina phones
const MAX_PIXELS = 60_000_000;
const ACCEPTED = new Set(['jpeg', 'png', 'webp', 'gif', 'heif', 'tiff']); // heif covers AVIF/HEIC

export class UserError extends Error {}

/**
 * @returns {Promise<{src:string, ext?:string, iw:number, ih:number}>}  src is the URL without extension
 */
export async function processImage(buffer, sectionId) {
  if (!SECTION_ID.test(sectionId)) throw new Error('invalid section id');
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new UserError('File bukan gambar yang valid atau terlalu besar.');
  }
  if (!ACCEPTED.has(meta.format)) throw new UserError(`Format ${meta.format || 'tidak dikenal'} tidak didukung. Gunakan JPG, PNG, WebP, GIF atau AVIF.`);

  const name = crypto.randomBytes(8).toString('hex');
  const url = `/uploads/sections/${sectionId}/${name}`;
  const animated = (meta.pages || 1) > 1 && (meta.format === 'gif' || meta.format === 'webp');

  if (animated) {
    const info = await sharp(buffer, { limitInputPixels: MAX_PIXELS, animated: true })
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer({ resolveWithObject: true })
      .then(async ({ data, info: i }) => { await saveUpload(`${url}.webp`, data); return i; });
    const pageH = meta.pageHeight || meta.height / meta.pages;
    return { src: url, ext: 'webp', iw: info.width, ih: Math.round((pageH * info.width) / meta.width) };
  }

  const base = sharp(buffer, { limitInputPixels: MAX_PIXELS }).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true });
  const { data: webp, info } = await base.clone().webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true });
  const avif = await base.clone().avif({ quality: 55, effort: 4 }).toBuffer();
  await Promise.all([saveUpload(`${url}.webp`, webp), saveUpload(`${url}.avif`, avif)]);
  return { src: url, iw: info.width, ih: info.height };
}
