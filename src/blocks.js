// Element sections ("blocks"): text, button, video, FAQ, … edited with forms in the admin instead of HTML.
// A block is a section { type:'block', kind, props }. Props are normalised + sanitised when saved
// (src/admin/block-props.js); rendering here only escapes and assembles markup. Sizes are design units
// (320 = page width, see --u in lp.css) so blocks scale with the page like every other section.
import { groupDistributors } from './distributors.js';

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const color = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : '');

// ---------------------------------------------------------------- smart links
export const LINK_TYPES = ['none', 'page', 'url', 'section', 'wa', 'rotator', 'tel', 'email', 'file'];
export function waNumber(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  else if (d.startsWith('8')) d = `62${d}`;
  return d.length >= 9 && d.length <= 15 ? d : '';
}
/** href for a smart link (empty when incomplete). */
export function linkHref(link) {
  if (!link || typeof link !== 'object') return '';
  const msg = link.message ? `?text=${encodeURIComponent(link.message)}` : '';
  switch (link.type) {
    case 'page': return /^[a-z0-9][a-z0-9-]{0,79}$/.test(link.page || '') ? `/${link.page}` : '';
    case 'url': return /^https?:\/\/[^\s"'<>]+$/i.test(link.url || '') ? link.url : '';
    case 'section': return /^[a-z0-9][a-z0-9-]{0,63}$/.test(link.section || '') ? `#${link.section}` : '';
    case 'wa': { const n = waNumber(link.phone); return n ? `https://wa.me/${n}${msg}` : ''; }
    case 'rotator': return /^[a-z0-9][a-z0-9-]{0,39}$/.test(link.rotator || '') ? `/go/wa/${link.rotator}${msg}` : '';
    case 'tel': { const n = waNumber(link.phone); return n ? `tel:+${n}` : ''; }
    case 'email': return /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(link.email || '') ? `mailto:${link.email}${link.subject ? `?subject=${encodeURIComponent(link.subject)}` : ''}` : '';
    case 'file': return /^\/uploads\/files\/[\w.-]+\.pdf$/.test(link.file || '') ? link.file : '';
    default: return '';
  }
}
/** Attributes for an <a> made from a smart link (+ optional pixel event). */
function linkAttrs(link, track) {
  const href = linkHref(link);
  if (!href) return null;
  const ext = /^https?:/i.test(href) || link.type === 'file';
  const kind = link.type === 'wa' || link.type === 'rotator' ? ' data-kind="wa"' : '';
  const ev = track && track !== 'none' ? ` data-track="${esc(track)}"` : '';
  return `href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}${kind}${ev}`;
}

// ---------------------------------------------------------------- icons (24px stroke icons, no emoji)
export const ICONS = {
  check: 'M20 6 9 17l-5-5', arrow: 'M5 12h14M13 6l6 6-6 6', star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10zM2 21c0-3 1.9-5.4 5.1-6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  chat: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-5.2a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3a8.4 8.4 0 0 1 8.5 8.5z',
  fire: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.3 1.4 1.5 2.7 2.5 2.7z',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z', smile: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  award: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.2 13.9 7 23l5-3 5 3-1.2-9.1', scale: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z',
  cart: 'M3 3h2l2.4 12.2a2 2 0 0 0 2 1.8h8.2a2 2 0 0 0 2-1.6L21 8H6M9 21h.01M18 21h.01', arrow: 'M5 12h14M12 5l7 7-7 7',
  wa: 'M3 21l1.6-4.8A8.5 8.5 0 1 1 7.9 19.6zM8.5 9.5c.3 2.4 2.6 4.8 5 5.2l1.2-1.2 2.1 1-.3 1.6c-3.8.6-9.2-4.4-8.8-8.6l1.6-.4 1 2.1z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1', x: 'M18 6 6 18M6 6l12 12',
};
const svg = (name, cls = 'lp-ic') => (ICONS[name] ? `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>` : '');

// ---------------------------------------------------------------- shared pieces
function picture(img, { cls = '', eager = false } = {}) {
  if (!img || !img.src) return '';
  const src = esc(img.src);
  const alt = esc(img.alt || '');
  const size = img.iw && img.ih ? ` width="${num(img.iw)}" height="${num(img.ih)}"` : '';
  const load = eager ? 'loading="eager"' : 'loading="lazy"';
  if (img.ext) return `<img class="${cls}" src="${src}.${esc(img.ext)}" alt="${alt}"${size} ${load} decoding="async">`;
  return `<picture><source type="image/avif" srcset="${src}.avif"><img class="${cls}" src="${src}.webp" alt="${alt}"${size} ${load} decoding="async"></picture>`;
}
const imgUrl = (img) => (img && img.src ? `${img.src}.${img.ext || 'webp'}` : '');
/** Box styles every block accepts: background + padding (design units). */
function box(p, extra = '') {
  const parts = [`--pt:${num(p.pt, 12)}`, `--pb:${num(p.pb, 12)}`, `--px:${num(p.px, 16)}`];
  if (color(p.bg)) parts.push(`background:${p.bg}`);
  if (extra) parts.push(extra);
  return ` style="${parts.join(';')}"`;
}
const fontVar = (f) => (f ? `;--bf:'${esc(String(f).replace(/['"\\]/g, ''))}'` : '');
const align = (a) => (['left', 'center', 'right'].includes(a) ? a : 'left');

function button(p) {
  const attrs = linkAttrs(p.link, p.track);
  const style = [`--bc:${color(p.color) || '#e3262f'}`, `--bt:${color(p.textColor) || '#ffffff'}`, `--br:${num(p.radius, 10)}`].join(';');
  const cls = `lp-btn lp-btn--${['fill', 'outline', 'soft'].includes(p.style) ? p.style : 'fill'} lp-btn--${['xs', 's', 'm', 'l'].includes(p.size) ? p.size : 'm'}${p.width === 'full' ? ' lp-btn--full' : ''}${['pulse', 'shake'].includes(p.anim) ? ` lp-anim-${p.anim}` : ''}`;
  const ic = p.icon && p.icon !== 'none' ? svg(p.icon) : '';
  const inner = p.iconPos === 'right' ? `<span>${esc(p.label || 'Tombol')}</span>${ic}` : `${ic}<span>${esc(p.label || 'Tombol')}</span>`;
  return attrs ? `<a class="${cls}" style="${style}" ${attrs}>${inner}</a>` : `<span class="${cls}" style="${style}">${inner}</span>`;
}
const stars = (n) => `<span class="lp-stars" role="img" aria-label="${num(n)} dari 5 bintang">${'★'.repeat(Math.max(0, Math.min(5, num(n))))}<i>${'★'.repeat(5 - Math.max(0, Math.min(5, num(n))))}</i></span>`;

// ---------------------------------------------------------------- renderers
const R = {
  text: (p) => `<div class="lp-b lp-b-text"${box(p, `text-align:${align(p.align)};--fs:${num(p.size, 14)};--lh:${num(p.lineHeight, 1.5)}${color(p.color) ? `;color:${p.color}` : ''}${fontVar(p.font)}`)}>${p.html || ''}</div>`,

  button: (p) => `<div class="lp-b lp-b-button"${box(p, `text-align:${align(p.align || 'center')}`)}>${button(p)}</div>`,

  // Background image with real text (h2) and a button laid on top; positions are % of the image so it scales.
  banner: (p) => {
    const img = p.image;
    const ratio = img && img.iw && img.ih ? `${num(img.iw)} / ${num(img.ih)}` : '16 / 9';
    const lines = (t) => esc(t).replace(/\n/g, '<br>');
    const b = p.button || {};
    const btn = b.label ? `<div class="lp-ban-btn" style="left:${num(p.bx, 6)}%;top:${num(p.by, 75)}%">${button(b)}</div>` : '';
    const text = p.eyebrow || p.title || p.text
      ? `<div class="lp-ban-text" style="left:${num(p.x, 6)}%;top:${num(p.y, 30)}%;width:${num(p.w, 55)}%;text-align:${align(p.align)};color:${color(p.color) || '#111111'};--ts:${num(p.titleSize, 14)};--es:${num(p.eyebrowSize, 8)};--tl:${num(p.titleLh, 1.2)};--tg:${num(p.gap, 2)}">${p.eyebrow ? `<p class="lp-ban-eyebrow">${esc(p.eyebrow)}</p>` : ''}${p.title ? `<h2 class="lp-ban-title">${lines(p.title)}</h2>` : ''}${p.text ? `<p class="lp-ban-desc${p.descBold ? ' lp-ban-desc--bold' : ''}">${lines(p.text)}</p>` : ''}</div>`
      : '';
    return `<div class="lp-b lp-b-banner"${box(p, fontVar(p.font).slice(1))}><div class="lp-ban" style="aspect-ratio:${ratio}">${picture(img, { cls: 'lp-ban-img' }) || '<div class="lp-b-empty">Gambar banner belum diisi</div>'}${text}${btn}</div></div>`;
  },

  spacer: (p) => `<div class="lp-b-spacer" style="height:calc(${num(p.h, 24)} * var(--u))${color(p.bg) ? `;background:${p.bg}` : ''}" aria-hidden="true"></div>`,

  divider: (p) => `<div class="lp-b lp-b-divider"${box(p)}><hr style="--dc:${color(p.color) || '#e5d9da'};--dt:${num(p.thickness, 1)};--dw:${num(p.width, 100)};--ds:${['solid', 'dashed', 'dotted'].includes(p.style) ? p.style : 'solid'}"></div>`,

  quote: (p) => `<div class="lp-b lp-b-quote lp-q--${['bar', 'card', 'big'].includes(p.style) ? p.style : 'bar'}"${box(p, `--qa:${color(p.accent) || '#e3262f'}${color(p.color) ? `;color:${p.color}` : ''};text-align:${align(p.align)}`)}><blockquote><p>${esc(p.text || '')}</p>${p.author ? `<footer>${esc(p.author)}</footer>` : ''}</blockquote></div>`,

  video: (p) => {
    const ratio = { '16:9': '16 / 9', '9:16': '9 / 16', '4:5': '4 / 5', '1:1': '1 / 1' }[p.ratio] || '16 / 9';
    if (!/^[\w-]{11}$/.test(p.yt || '')) return `<div class="lp-b lp-b-video"${box(p)}><div class="lp-b-empty">Video belum diisi</div></div>`;
    return `<div class="lp-b lp-b-video"${box(p)}><div class="lp-yt lp-yt--fluid" style="aspect-ratio:${ratio}" data-yt="${esc(p.yt)}" data-title="${esc(p.title || 'Video')}"${num(p.start) ? ` data-start="${num(p.start)}"` : ''}></div></div>`;
  },

  gallery: (p) => {
    const imgs = (p.images || []).filter((i) => i && i.src);
    if (!imgs.length) return `<div class="lp-b lp-b-gallery"${box(p)}><div class="lp-b-empty">Galeri belum berisi gambar</div></div>`;
    const cols = Math.max(1, Math.min(4, num(p.cols, 2)));
    return `<div class="lp-b lp-b-gallery"${box(p, `--gc:${cols};--gg:${num(p.gap, 6)};--gr:${num(p.radius, 8)}`)}><div class="lp-gal${p.zoom === false ? '' : ' lp-gal--zoom'}">${imgs.map((i) => `<figure>${p.zoom === false ? picture(i) : `<button type="button" class="lp-gal-open" data-full="${esc(imgUrl(i))}" aria-label="Perbesar gambar${i.alt ? `: ${esc(i.alt)}` : ''}">${picture(i)}</button>`}</figure>`).join('')}</div></div>`;
  },

  imagetext: (p) => {
    const layout = ['top', 'left', 'right', 'bottom'].includes(p.layout) ? p.layout : 'top';
    return `<div class="lp-b lp-b-imgtext lp-it--${layout}"${box(p, `--iw:${num(p.imgWidth, 40)};--fs:${num(p.size, 14)};text-align:${align(p.align)}${color(p.color) ? `;color:${p.color}` : ''}`)}><div class="lp-it-img">${picture(p.image) || '<div class="lp-b-empty">Gambar</div>'}</div><div class="lp-it-text">${p.html || ''}</div></div>`;
  },

  faq: (p) => `<div class="lp-b lp-b-faq${p.style === 'box' ? ' lp-b-faq--box' : ''}"${box(p, `--fa:${color(p.accent) || '#e3262f'}${color(p.color) ? `;color:${p.color}` : ''};--fs:${num(p.size, 14)}${color(p.headBg) ? `;--fh:${p.headBg}` : ''}${color(p.headColor) ? `;--fhc:${p.headColor}` : ''}`)}>${p.title ? `<h3 class="lp-b-title">${esc(p.title)}</h3>` : ''}${(p.items || []).map((it, i) => `<details class="lp-bq"${i === 0 && p.openFirst ? ' open' : ''}><summary>${esc(it.q || '')}</summary><div class="lp-bq-a">${it.a || ''}</div></details>`).join('')}</div>`,

  testimonial: (p) => {
    const layout = ['list', 'slider', 'grid'].includes(p.layout) ? p.layout : 'slider';
    const cards = (p.items || []).map((it) => `<figure class="lp-testi">${it.rating ? stars(it.rating) : ''}<blockquote>${esc(it.text || '')}</blockquote><figcaption>${it.photo && it.photo.src ? picture({ ...it.photo, alt: it.name || '' }, { cls: 'lp-testi-photo' }) : ''}<span><b>${esc(it.name || '')}</b>${it.role ? `<small>${esc(it.role)}</small>` : ''}</span></figcaption></figure>`).join('');
    return `<div class="lp-b lp-b-testi"${box(p, `--tc:${color(p.cardColor) || '#ffffff'};--tt:${color(p.textColor) || '#2b1a1a'};--ts:${color(p.starColor) || '#f5a623'}`)}>${p.title ? `<h3 class="lp-b-title">${esc(p.title)}</h3>` : ''}<div class="lp-testis lp-testis--${layout}">${cards}</div></div>`;
  },

  countdown: (p, ctx) => {
    const end = p.mode === 'promo' ? ctx.promo && ctx.promo.end : p.end;
    const t = Date.parse(end || '');
    if (!Number.isFinite(t)) return ctx.admin ? `<div class="lp-b lp-b-countdown"${box(p)}><div class="lp-b-empty">${p.mode === 'promo' ? 'Promo yang aktif tidak punya tanggal selesai' : 'Tanggal selesai belum diisi'}</div></div>` : '';
    const units = [['d', 'Hari'], ['h', 'Jam'], ['m', 'Menit'], ['s', 'Detik']].map(([k, l]) => `<span class="lp-cd-u"><b data-u="${k}">00</b><small>${l}</small></span>`).join('');
    return `<div class="lp-b lp-b-countdown"${box(p, `--cb:${color(p.boxColor) || '#e3262f'};--ct:${color(p.textColor) || '#ffffff'};--cl:${color(p.labelColor) || '#2b1a1a'}`)} data-end="${new Date(t).toISOString()}" data-expired="${p.expired === 'text' ? 'text' : 'hide'}">${p.label ? `<p class="lp-cd-label">${esc(p.label)}</p>` : ''}<div class="lp-cd" role="timer" aria-live="off">${units}</div><p class="lp-cd-done" hidden>${esc(p.expiredText || 'Promo sudah berakhir')}</p></div>`;
  },

  features: (p) => {
    const cols = num(p.cols, 1) === 2 ? 2 : 1;
    return `<div class="lp-b lp-b-features"${box(p, `--fc:${cols};--fi:${color(p.iconColor) || '#e3262f'};--fib:${color(p.iconBg) || '#fdeef0'}${color(p.color) ? `;color:${p.color}` : ''}`)}>${p.title ? `<h3 class="lp-b-title">${esc(p.title)}</h3>` : ''}<ul class="lp-feats">${(p.items || []).map((it) => `<li>${svg(it.icon || 'check', 'lp-feat-ic')}<span><b>${esc(it.title || '')}</b>${it.text ? `<small>${esc(it.text)}</small>` : ''}</span></li>`).join('')}</ul></div>`;
  },

  copytext: (p) => `<div class="lp-b lp-b-copy"${box(p, `--ca:${color(p.accent) || '#e3262f'}`)}>${p.label ? `<p class="lp-copy-label">${esc(p.label)}</p>` : ''}<div class="lp-copy"><code>${esc(p.code || '')}</code><button type="button" data-copy="${esc(p.code || '')}" data-done="${esc(p.doneLabel || 'Tersalin!')}">${svg('copy')}<span>${esc(p.buttonLabel || 'Salin')}</span></button></div></div>`,

  bank: (p) => `<div class="lp-b lp-b-bank"${box(p, `--ca:${color(p.accent) || '#e3262f'}`)}>${p.title ? `<h3 class="lp-b-title">${esc(p.title)}</h3>` : ''}${(p.items || []).map((it) => `<div class="lp-bank"><div><b>${esc(it.bank || '')}</b><code>${esc(it.number || '')}</code><small>a.n. ${esc(it.holder || '')}</small></div><button type="button" data-copy="${esc(String(it.number || '').replace(/\s/g, ''))}" data-done="Tersalin!">${svg('copy')}<span>Salin</span></button></div>`).join('')}${p.note ? `<p class="lp-bank-note">${esc(p.note)}</p>` : ''}</div>`,

  floatwa: (p, ctx) => {
    const attrs = linkAttrs(p.link, p.track);
    if (!attrs) return ctx.admin ? '<div class="lp-b lp-b-admin-note">Tombol WhatsApp melayang: isi nomor / CS Rotator</div>' : '';
    const side = p.position === 'left' ? 'left' : 'right';
    return `${ctx.admin ? `<div class="lp-b lp-b-admin-note">Tombol WhatsApp melayang (pojok ${side === 'left' ? 'kiri' : 'kanan'} bawah)</div>` : ''}<a class="lp-float lp-float--${side}" style="--fb:${color(p.color) || '#25d366'};--fy:${num(p.bottom, 20)}" data-after="${num(p.showAfter, 0)}" aria-label="${esc(p.label || 'Chat WhatsApp')}" ${attrs}>${svg('wa')}${p.label ? `<span>${esc(p.label)}</span>` : ''}</a>`;
  },

  popup: (p, ctx) => {
    const trig = ['delay', 'scroll', 'exit'].includes(p.trigger) ? p.trigger : 'delay';
    const card = `<div class="lp-pop-card" style="--pc:${color(p.bg) || '#ffffff'}"><button type="button" class="lp-pop-x" aria-label="Tutup">${svg('x')}</button>${picture(p.image)}${p.title ? `<h3>${esc(p.title)}</h3>` : ''}${p.html ? `<div class="lp-pop-text">${p.html}</div>` : ''}${p.button && p.button.label ? `<div class="lp-pop-btn">${button({ ...p.button, width: 'full' })}</div>` : ''}</div>`;
    if (ctx.admin) {
      const when = trig === 'scroll' ? `setelah scroll ${num(p.scroll, 50)}%` : trig === 'exit' ? 'saat pengunjung mau keluar (desktop)' : `setelah ${num(p.delay, 5)} detik`;
      return `<div class="lp-b lp-b-admin-note">Popup — muncul ${when}${p.frequency === 'always' ? ', setiap kunjungan' : ', sekali per sesi'}</div><div class="lp-pop-preview">${card}</div>`;
    }
    return `<div class="lp-pop" hidden data-trigger="${trig}" data-delay="${num(p.delay, 5)}" data-scroll="${num(p.scroll, 50)}" data-freq="${p.frequency === 'always' ? 'always' : p.frequency === 'day' ? 'day' : 'session'}" role="dialog" aria-modal="true" aria-label="${esc(p.title || 'Promo')}">${card}</div>`;
  },

  // Official distributors from the Distributor menu (ctx.data.distributors), grouped by province and city, with a search box.
  distributors: (p, ctx) => {
    const groups = groupDistributors((ctx.data && ctx.data.distributors) || []);
    const fold = (t) => String(t).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    const linkHtml = (l) => `<a class="lp-dist-l lp-dist-l--${esc(l.type)}" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a>`;
    const area = (d) => {
      const shops = d.links.filter((l) => l.type !== 'maps');
      const maps = d.links.filter((l) => l.type === 'maps');
      return `<p><strong>${esc(d.name)}</strong>${d.top ? ' <span class="lp-dist-top">TOP SELLER</span>' : ''}<br>${shops.map(linkHtml).join(' <span class="lp-dist-sep">|</span> ')}${maps.map((m) => `<br>${linkHtml(m)}`).join('')}</p>`;
    };
    const byProv = p.group !== 'city';
    const cities = (g) => g.cities.map((c) => `<details class="lp-bq lp-dist-city" data-q="${esc(fold([c.city, g.province, ...c.items.map((d) => d.name)].join(' ')))}"><summary>${esc(c.city)}</summary><div class="lp-bq-a">${c.items.map(area).join('')}</div></details>`).join('');
    const list = byProv
      ? groups.map((g) => `<div class="lp-dist-prov"><h4>${esc(g.province)}</h4>${cities(g)}</div>`).join('')
      : cities({ province: '', cities: groups.flatMap((g) => g.cities.map((c) => ({ ...c, province: g.province }))).sort((x, y) => x.city.localeCompare(y.city, 'id')) });
    const empty = linkAttrs(p.emptyLink || {}, 'Contact');
    const search = p.search === false ? '' : `<label class="lp-dist-search"><svg class="lp-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3"/></svg><input type="search" placeholder="${esc(p.placeholder || 'Cari kota atau provinsi…')}" aria-label="Cari distributor" autocomplete="off" data-dist-search></label>`;
    return `<div class="lp-b lp-b-faq lp-b-faq--box lp-b-dist"${box(p, `--fa:${color(p.accent) || '#000000'}${color(p.color) ? `;color:${p.color}` : ''};--fs:${num(p.size, 11)}`)}>${p.title ? `<h3 class="lp-b-title">${esc(p.title)}</h3>` : ''}${search}<div class="lp-dist-list">${list || (ctx.admin ? '<div class="lp-b-empty">Belum ada distributor. Tambahkan di menu Distributor.</div>' : '')}</div><p class="lp-dist-empty" hidden>${esc(p.emptyText || 'Belum ada distributor di daerah itu.')}${empty ? ` <a ${empty}>${esc(p.emptyLabel || 'Tanya admin')}</a>` : ''}</p></div>`;
  },
};

export const BLOCK_KINDS = Object.keys(R);
/** Markup of one block (inside its <section>). ctx: { admin, promo } */
export function renderBlock(sec, ctx = {}) {
  const fn = R[sec.kind];
  return fn ? fn(sec.props || {}, ctx) : '';
}
/** Blocks that sit outside the page flow (fixed / overlay). */
export const OVERLAY_KINDS = new Set(['floatwa', 'popup']);
