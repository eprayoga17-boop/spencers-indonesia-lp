// Renders a landing page (data/pages/<slug>.json) into a full HTML document.
// Layout numbers (x, w, h, mt) are in "design units": 1 unit = page width / designWidth (320),
// so every section scales together and always fits the page width.

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

// Only http(s), whatsapp-style and relative links are allowed in hrefs.
function safeHref(href) {
  if (!href) return '';
  const h = String(href).trim();
  if (/^(https?:)?\/\//i.test(h) || h.startsWith('/') || h.startsWith('#')) return h;
  return '';
}

function picture(item, { eager = false } = {}) {
  const src = esc(item.src);
  const alt = esc(item.alt || '');
  const load = (eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"') +
    (item.iw && item.ih ? ` width="${num(item.iw)}" height="${num(item.ih)}"` : '');
  if (item.ext) {
    // Single-format asset (gif, svg, or uploaded file served as-is)
    return `<img src="${src}.${esc(item.ext)}" alt="${alt}" ${load} decoding="async">`;
  }
  return `<picture><source type="image/avif" srcset="${src}.avif"><img src="${src}.webp" alt="${alt}" ${load} decoding="async"></picture>`;
}

function boxStyle(b, mt) {
  const parts = [];
  if (b.w != null) parts.push(`--x:${num(b.x)}`, `--w:${num(b.w)}`, `--h:${num(b.h)}`);
  if (mt) parts.push(`--mt:${num(mt)}`);
  return parts.length ? ` style="${parts.join(';')}"` : '';
}

function imageItem(item, eager) {
  const fluid = item.w == null ? ' lp-box--fluid' : '';
  const style = boxStyle(item, item.mt);
  const href = safeHref(item.href);
  const inner = picture(item, { eager });
  if (href) {
    const ext = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a class="lp-box${fluid}" href="${esc(href)}"${ext}${style}>${inner}</a>`;
  }
  return `<div class="lp-box${fluid}"${style}>${inner}</div>`;
}

function imageSlider(sec) {
  const s = sec.slider || {};
  const box = sec.box || { w: 320, h: 320 };
  const slideBox = sec.slideBox || null;
  const attrs = [
    `data-transition="${s.transition === 'slide' ? 'slide' : 'fade'}"`,
    `data-interval="${num(s.interval, 5000)}"`,
    `data-dots="${esc(s.dots || 'ring')}"`,
    `data-arrows="${s.arrows ? '1' : '0'}"`,
  ].join(' ');
  const style = `--sw:${num(box.w, 320)};--sh:${num(box.h, 320)};--mt:${num(box.mt)}`;
  const slides = sec.items
    .map((it) => {
      const b = slideBox ? `<div class="lp-box"${boxStyle(slideBox)}>${picture(it)}</div>` : `<div class="lp-box lp-box--cover">${picture(it)}</div>`;
      const href = safeHref(it.href);
      return `<div class="lp-slide">${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${b}</a>` : b}</div>`;
    })
    .join('');
  return `<div class="lp-slider" ${attrs} style="${style}" aria-label="${esc(sec.name)}">${slides}</div>`;
}

// [PROMO] sections: content comes from the active promo (menu Promo), never edited per page.
function promoBanner(sec, promo, admin) {
  const b = promo && promo.banner;
  if (!b) return admin ? '<div class="lp-promo-empty">[PROMO] Banner — tidak ada promo aktif</div>' : '';
  const style = `--x:${num(sec.x)};--w:${num(sec.w, 320)}`;
  const img = picture({ ...b, alt: promo.name });
  const href = safeHref(sec.href);
  return href
    ? `<a class="lp-promo-banner" style="${style}" href="${esc(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${img}</a>`
    : `<div class="lp-promo-banner" style="${style}">${img}</div>`;
}
function promoBar(promo, admin) {
  const b = promo && promo.bar;
  if (!b || !(b.title || b.left || b.right)) return admin ? '<div class="lp-promo-empty">[PROMO] Bar — tidak ada promo aktif</div>' : '';
  const color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#ff0000';
  const two = b.left && b.right ? '<i aria-hidden="true"></i>' : '';
  return `<div class="lp-promo-bar" style="--pb:${color}"><p class="pb-1">${esc(b.title)}</p><p class="pb-2">${b.left ? `<span>${esc(b.left)}</span>` : ''}${two}${b.right ? `<b>${esc(b.right)}</b>` : ''}</p></div>`;
}
function badges(list, promo, admin) {
  const b = promo && promo.badge;
  if (!b || !list.length) return '';
  return list.map((bd) => `<div class="lp-badge" data-badge="${esc(bd.id)}" style="--cx:${num(bd.cx)};--cy:${num(bd.cy)};--bw:${num(bd.w, 100)}">${picture({ ...b, alt: admin ? '' : promo.name })}</div>`).join('');
}

function section(sec, index, ctx = {}) {
  const { showHidden, promo, badgesBySection } = ctx;
  if (sec.visible === false && !showHidden) return '';
  let body = '';
  if (sec.type === 'image') {
    body = sec.layout === 'slider' ? imageSlider(sec) : sec.items.map((it) => imageItem(it, it.eager || index < 2)).join('');
  } else if (sec.type === 'html') {
    body = sec.html; // stored already sanitized (sanitizer runs on save in the admin)
    if (sec.wrap) body = `<div class="lp-html">${body}</div>`; // uploaded HTML: clipped to the page width
  } else if (sec.type === 'promo') {
    body = sec.part === 'bar' ? promoBar(promo, showHidden) : promoBanner(sec, promo, showHidden);
    if (!body) return '';
  }
  body += badges((badgesBySection && badgesBySection.get(sec.id)) || [], promo, showHidden);
  const mt = sec.mt ? ` style="--smt:${num(sec.mt)}"` : '';
  const scope = sec.scope ? ` data-s="${esc(sec.scope)}"` : '';
  return `<section class="lp-sec lp-sec--${sec.type}${sec.visible === false ? ' lp-sec--hidden' : ''}" id="${esc(sec.id)}" data-name="${esc(sec.name)}"${scope}${mt}>${body}</section>`;
}

export function renderPage(page, { assetVersion = '1', global = {}, showHidden = false, promo = null } = {}) {
  const st = page.settings || {};
  const maxWidth = num(st.maxWidth, 0) || num(global.maxWidth, 0) || 480;
  const font = st.font != null ? st.font : global.font || '';
  const favicon = global.favicon != null ? global.favicon : page.favicon;
  const keywords = Array.isArray(page.keywords) ? page.keywords.join(', ') : '';
  const fontVar = font ? `;--lp-font:'${esc(font.replace(/['"\\]/g, ''))}'` : '';
  const badgesBySection = new Map();
  for (const b of page.badges || []) {
    if (!badgesBySection.has(b.section)) badgesBySection.set(b.section, []);
    badgesBySection.get(b.section).push(b);
  }
  const sections = page.sections.map((sec, i) => section(sec, i, { showHidden, promo, badgesBySection })).join('\n');
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
${page.robots ? `<meta name="robots" content="${esc(page.robots)}">` : ''}
${keywords ? `<meta name="keywords" content="${esc(keywords)}">` : ''}
${page.thumbnail ? `<meta property="og:image" content="${esc(page.thumbnail)}">` : ''}
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#ff0000">
${favicon ? `<link rel="icon" href="${esc(favicon)}">` : ''}
<link rel="preload" href="/assets/fonts/poppins-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/lp.css?v=${esc(assetVersion)}">
</head>
<body style="--lp-outer:${esc(st.outerBackground || '#f2f2f2')}">
<main class="lp" style="--lp-max:${maxWidth}px;--lp-bg:${esc(st.background || '#fff')}${fontVar}">
<div class="lp-page" style="--lp-design:${num(st.designWidth, 320)}">
${sections}
</div>
</main>
<script src="/assets/js/lp.js?v=${esc(assetVersion)}" defer></script>
${global.ga4Id && !showHidden ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(global.ga4Id)}"></script>
<script src="/assets/js/ga.js?v=${esc(assetVersion)}" data-ga="${esc(global.ga4Id)}"></script>` : ''}
</body>
</html>`;
}
