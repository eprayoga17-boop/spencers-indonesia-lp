// Ad pixels (Meta, TikTok, Google Ads) — loaded ONLY after the visitor accepts the cookie notice (UU PDP).
// The choice is kept in localStorage ("mb-consent": yes | no). Buttons with data-track="<Event>" send that event.
(() => {
  'use strict';
  const me = document.currentScript;
  const cfg = { fb: me?.dataset.fb || '', tt: me?.dataset.tt || '', gads: me?.dataset.gads || '', label: me?.dataset.gadsLabel || '' };
  if (!cfg.fb && !cfg.tt && !cfg.gads) return;
  if (/^\/(admin|p)\//.test(location.pathname) || navigator.globalPrivacyControl) return;
  const KEY = 'mb-consent';
  let choice = null;
  try { choice = localStorage.getItem(KEY); } catch { /* storage blocked: ask every visit */ }

  const load = (src) => { const s = document.createElement('script'); s.async = true; s.src = src; document.head.append(s); };
  let ready = false;
  function start() {
    if (ready) return;
    ready = true;
    if (cfg.fb) {
      const fbq = function fbq(...a) { fbq.callMethod ? fbq.callMethod(...a) : fbq.queue.push(a); };
      fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
      window.fbq = window.fbq || fbq;
      window._fbq = window._fbq || window.fbq;
      load('https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', cfg.fb);
      window.fbq('track', 'PageView');
    }
    if (cfg.tt) {
      const ttq = window.ttq = window.ttq || [];
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
      ttq.setAndDefer = (t, e) => { t[e] = (...a) => { t.push([e, ...a]); }; };
      ttq.methods.forEach((m) => ttq.setAndDefer(ttq, m));
      ttq._i = ttq._i || {}; ttq._i[cfg.tt] = []; ttq._t = ttq._t || {}; ttq._t[cfg.tt] = Date.now(); ttq._o = ttq._o || {}; ttq._o[cfg.tt] = {};
      load(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(cfg.tt)}&lib=ttq`);
      ttq.page();
    }
    if (cfg.gads) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
      load(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.gads)}`);
      window.gtag('js', new Date());
      window.gtag('config', cfg.gads);
    }
  }

  // events from buttons
  const TT = { Lead: 'SubmitForm', Contact: 'Contact', CompleteRegistration: 'CompleteRegistration', InitiateCheckout: 'InitiateCheckout', AddToCart: 'AddToCart', Purchase: 'CompletePayment', ViewContent: 'ViewContent' };
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-track]');
    if (!el || !ready) return;
    const ev = el.dataset.track;
    try {
      if (cfg.fb && window.fbq) window.fbq('track', ev);
      if (cfg.tt && window.ttq) window.ttq.track(TT[ev] || ev);
      if (cfg.gads && cfg.label && window.gtag && ['Lead', 'Contact', 'CompleteRegistration', 'Purchase', 'InitiateCheckout'].includes(ev)) window.gtag('event', 'conversion', { send_to: `${cfg.gads}/${cfg.label}` });
    } catch { /* tracking must never break the page */ }
  }, true);

  if (choice === 'yes') { start(); return; }
  if (choice === 'no') return;

  // cookie notice
  const bar = document.createElement('div');
  bar.className = 'lp-consent';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Pemberitahuan cookie');
  const p = document.createElement('p');
  p.textContent = 'Kami memakai cookie iklan (Meta, TikTok, Google) untuk mengukur promosi. Boleh?';
  const mk = (cls, text, val) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = text;
    b.addEventListener('click', () => { try { localStorage.setItem(KEY, val); } catch { /* ignore */ } bar.remove(); if (val === 'yes') start(); });
    return b;
  };
  bar.append(p, mk('no', 'Tolak', 'no'), mk('yes', 'Setuju', 'yes'));
  const show = () => document.body.append(bar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
