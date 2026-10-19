// Turns an uploaded/edited HTML document into a safe section fragment.
// - Keeps only what is inside <body> (plus every <style>, including the ones in <head>).
// - Removes scripts, iframes (YouTube iframes become the page's click-to-load player),
//   forms, event handlers and dangerous URLs (OWASP A03 Injection / XSS).
// - Scopes the CSS to the section so it cannot restyle the rest of the page.
// - Rewrites references to files uploaded together with the HTML to their new URLs.
import sanitizeHtml from '../vendor/sanitize-html.js'; // bundled by scripts/bundle-sanitizer.mjs (Vercel cannot require() ESM)

const SVG_TAGS = ['svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan',
  'lineargradient', 'radialgradient', 'stop', 'clippath', 'title', 'desc'];
const SVG_ATTRS = ['viewbox', 'xmlns', 'preserveaspectratio', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r',
  'rx', 'ry', 'd', 'points', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-dasharray', 'stroke-opacity', 'opacity', 'transform', 'offset', 'stop-color', 'stop-opacity', 'gradientunits',
  'gradienttransform', 'clip-path', 'clip-rule', 'text-anchor', 'dominant-baseline', 'font-size', 'font-weight', 'font-style',
  'font-family', 'letter-spacing', 'paint-order', 'dx', 'dy'];

const DANGER = /expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:|@import/gi;
const YT_ID = /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i;

const baseName = (u) => {
  try {
    return decodeURIComponent(String(u).split(/[?#]/)[0].split(/[\\/]/).pop()).toLowerCase();
  } catch {
    return '';
  }
};
const isRelative = (u) => !/^([a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(String(u).trim());

function cleanCssText(css) {
  return String(css).replace(/\/\*[\s\S]*?\*\//g, '').replace(DANGER, '/*removed*/').replace(/position\s*:\s*fixed/gi, 'position:absolute');
}

// ---------------------------------------------------------------- CSS scoping
function skipString(s, i) {
  const q = s[i];
  for (i++; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === q) return i + 1;
  }
  return s.length;
}
function matchBrace(s, i) {
  let depth = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'") { i = skipString(s, i) - 1; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return s.length;
}
function splitRules(css) {
  const rules = [];
  let i = 0, start = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '"' || c === "'") { i = skipString(css, i); continue; }
    if (c === ';') { const p = css.slice(start, i).trim(); if (p) rules.push({ prelude: p, body: null }); start = ++i; continue; }
    if (c === '{') {
      const end = matchBrace(css, i);
      rules.push({ prelude: css.slice(start, i).trim(), body: css.slice(i + 1, end) });
      i = start = end + 1;
      continue;
    }
    if (c === '}') { start = ++i; continue; }
    i++;
  }
  return rules;
}
function splitSelectors(sel) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
function scopeSelector(sel, scope) {
  const root = sel.match(/^(?:(?:html|body|:root)(?![\w-])\s*)+/i);
  if (root) {
    const rest = sel.slice(root[0].length).trim();
    return rest ? `${scope} ${rest.replace(/^[>+~]\s*/, '')}` : scope;
  }
  return `${scope} ${sel}`;
}
function scopeRules(rules, scope, hoisted) {
  let out = '';
  for (const { prelude, body } of rules) {
    if (prelude.startsWith('@')) {
      const name = (prelude.match(/^@(-[a-z]+-)?([a-z-]+)/i) || [])[2]?.toLowerCase();
      if (body == null) continue; // @import, @charset, @namespace, @layer statements are dropped
      if (name === 'font-face' || name === 'keyframes') hoisted.push(`${prelude}{${body}}`);
      else if (['media', 'supports', 'container', 'layer'].includes(name)) out += `${prelude}{${scopeRules(splitRules(body), scope, hoisted)}}`;
      continue; // @page, @property and unknown at-rules are dropped
    }
    if (body == null || !prelude) continue;
    out += `${splitSelectors(prelude).map((s) => scopeSelector(s, scope)).join(',')}{${body}}`;
  }
  return out;
}
export function scopeCss(css, scope) {
  const hoisted = [];
  const body = scopeRules(splitRules(cleanCssText(css)), scope, hoisted);
  return hoisted.join('') + body;
}

// ---------------------------------------------------------------- assets
function rewriteUrl(u, assets) {
  const v = String(u || '').trim();
  if (!v || !isRelative(v)) return v;
  const hit = assets.get(baseName(v));
  return hit ? hit.url : v.startsWith('uploads/') ? `/${v}` : null;
}
function rewriteCssUrls(css, assets) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => {
    const r = rewriteUrl(u, assets);
    return r ? `url("${r.replace(/"/g, '%22')}")` : 'none';
  });
}
function rewriteSrcset(v, assets) {
  return String(v).split(',').map((part) => {
    const [u, ...d] = part.trim().split(/\s+/);
    const r = rewriteUrl(u, assets);
    return r ? [r, ...d].join(' ') : null;
  }).filter(Boolean).join(', ');
}

// ---------------------------------------------------------------- main
/**
 * @param {string} input   full HTML document or fragment
 * @param {object} opts
 * @param {string} opts.scope   CSS selector the styles are nested under (e.g. `.lp-sec[data-s="ab12"]`)
 * @param {Map<string,{url:string}>} [opts.assets]  lower-case file name -> uploaded file URL
 * @returns {{ html: string, source: string, removed: string[] }}
 *   html   = safe fragment with scoped CSS (rendered on the page)
 *   source = safe fragment with unscoped CSS (shown in the admin code editor)
 */
export function sanitizeSection(input, { scope, assets = new Map() } = {}) {
  let doc = String(input || '').replace(/^﻿/, '');
  const removed = new Set();

  // 1. Collect every <style> block (head and body); style content is raw text up to "</style".
  const styles = [];
  doc = doc.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (m, css) => { styles.push(css); return ''; });

  // 2. Keep only the body content.
  const body = doc.match(/<body\b[^>]*>([\s\S]*?)(?:<\/body\s*>|$)/i);
  if (body) doc = body[1];
  else doc = doc.replace(/<!doctype[^>]*>/gi, '').replace(/<head\b[\s\S]*?<\/head\s*>/gi, '').replace(/<\/?html\b[^>]*>/gi, '');

  // 3. YouTube iframes -> click-to-load facade used by the landing page (no third-party load until tap).
  doc = doc.replace(/<iframe\b([^>]*)>[\s\S]*?<\/iframe\s*>|<iframe\b([^>]*)\/?>/gi, (m, a1, a2) => {
    const attrs = a1 || a2 || '';
    const src = (attrs.match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    const id = (src.match(YT_ID) || [])[1];
    if (!id) { removed.add('iframe'); return ''; }
    const title = (attrs.match(/\btitle\s*=\s*"([^"]*)"/i) || [])[1] || 'Video';
    return `<div class="lp-yt" data-yt="${id}" data-title="${title.replace(/[<>"]/g, '')}"></div>`;
  });

  const assetsTransform = (tagName, attribs) => {
    for (const a of ['src', 'poster']) {
      if (attribs[a] != null) {
        const r = rewriteUrl(attribs[a], assets);
        if (r) attribs[a] = r; else delete attribs[a];
      }
    }
    if (attribs.srcset) attribs.srcset = rewriteSrcset(attribs.srcset, assets);
    if (attribs.href && tagName === 'a') {
      const r = rewriteUrl(attribs.href, assets);
      if (r) attribs.href = r;
    }
    if (attribs.style) {
      if (/expression\s*\(|javascript\s*:|vbscript\s*:|-moz-binding|behavior\s*:/i.test(attribs.style)) delete attribs.style;
      else attribs.style = rewriteCssUrls(attribs.style.replace(/position\s*:\s*fixed/gi, 'position:absolute'), assets);
    }
    for (const k of ['fill', 'stroke', 'clip-path']) if (attribs[k] && /url\(\s*['"]?[^#'"\s]/i.test(attribs[k])) delete attribs[k];
    if (tagName === 'a' && attribs.target === '_blank') attribs.rel = 'noopener noreferrer';
    if (tagName === 'img' && !attribs.loading) attribs.loading = 'lazy';
    return { tagName, attribs };
  };

  const clean = sanitizeHtml(doc, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'picture', 'source', 'figure', 'figcaption', 'details', 'summary',
      'video', 'button', 'center', 'font', ...SVG_TAGS],
    disallowedTagsMode: 'discard',
    selfClosing: [...sanitizeHtml.defaults.selfClosing, 'source', 'col', 'wbr'],
    allowedAttributes: {
      '*': ['class', 'id', 'style', 'title', 'role', 'lang', 'dir', 'hidden', 'tabindex', 'aria-*', 'data-*', 'align'],
      a: ['href', 'target', 'rel', 'name', 'download'],
      img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding', 'fetchpriority'],
      source: ['src', 'srcset', 'type', 'media', 'sizes'],
      video: ['src', 'poster', 'controls', 'muted', 'loop', 'playsinline', 'autoplay', 'width', 'height', 'preload'],
      td: ['colspan', 'rowspan', 'width'], th: ['colspan', 'rowspan', 'scope', 'width'], col: ['span', 'width'],
      details: ['open'], ol: ['start', 'type', 'reversed'], li: ['value'], font: ['color', 'size', 'face'],
      button: ['type', 'disabled'],
      ...Object.fromEntries(SVG_TAGS.map((t) => [t, SVG_ATTRS])),
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'], source: ['http', 'https', 'data'] },
    allowedSchemesAppliedToAttributes: ['href', 'src', 'cite', 'poster'],
    allowProtocolRelative: false,
    transformTags: { '*': assetsTransform },
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'title', 'template', 'select'],
  });

  // Report what was removed so the admin knows (best effort, for the UI message).
  for (const t of ['script', 'form', 'input', 'object', 'embed', 'canvas']) if (new RegExp(`<${t}\\b`, 'i').test(input)) removed.add(t);
  if (/\son[a-z]+\s*=/i.test(input)) removed.add('event handler (on*)');
  if (/@import/i.test(styles.join(''))) removed.add('@import');

  const rawCss = styles.map((css) => rewriteCssUrls(cleanCssText(css), assets)).join('\n').trim();
  const html = (rawCss ? `<style>${scopeCss(rawCss, scope).replace(/<\/style/gi, '')}</style>` : '') + clean.trim();
  const source = (rawCss ? `<style>\n${rawCss.replace(/<\/style/gi, '')}\n</style>\n` : '') + clean.trim();
  return { html, source, removed: [...removed] };
}

/**
 * Product descriptions from the rich-text editor: a small allowlist (headings, bold/italic/underline/strike,
 * lists, links, images, line breaks). No classes, ids, styles or scripts. Images only from our uploads or https.
 */
export function sanitizeRich(input) {
  return sanitizeHtml(String(input || ''), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'hr', 'div', 'span'],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      b: 'strong', i: 'em', strike: 's',
      a: (tagName, attribs) => ({ tagName, attribs: { href: attribs.href, ...(attribs.target === '_blank' ? { target: '_blank', rel: 'noopener noreferrer' } : {}) } }),
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !/^(\/uploads\/[\w./-]+|https:\/\/)/.test(frame.attribs.src || ''),
  }).trim();
}

/**
 * Text from the element editor (Teks, FAQ answers, popup text…): basic formatting plus colour, relative size
 * (em) and alignment. Links: http(s), mailto, tel and #anchors only. No classes, ids or scripts.
 */
export function sanitizeBlockText(input) {
  const colorRe = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i];
  return sanitizeHtml(String(input || ''), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li', 'a', 'span', 'div', 'mark', 'small'],
    allowedAttributes: { a: ['href', 'target', 'rel'], '*': ['style'] },
    allowedStyles: {
      '*': {
        color: colorRe, 'background-color': colorRe,
        'font-size': [/^(0?\.[5-9]|[1-3](\.\d{1,2})?|4)em$/],
        'text-align': [/^(left|center|right|justify)$/],
        'font-weight': [/^(400|500|600|700|800|bold|normal)$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      b: 'strong', i: 'em', strike: 's',
      a: (tagName, attribs) => ({ tagName, attribs: { href: attribs.href, ...(/^https?:/i.test(attribs.href || '') ? { target: '_blank', rel: 'noopener noreferrer' } : {}) } }),
    },
    exclusiveFilter: (frame) => frame.tag === 'a' && !/^(https?:|mailto:|tel:|#[a-z0-9-]+$)/i.test(frame.attribs.href || ''),
  }).trim();
}
