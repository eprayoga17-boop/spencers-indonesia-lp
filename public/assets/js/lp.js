// Landing page behaviour: click-to-load YouTube, sliders. No dependencies.
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const YT_ID = /^[\w-]{11}$/;

  // ---------- YouTube facade: thumbnail first, iframe only after a tap ----------
  const PLAY_SVG =
    '<svg class="lp-yt-play" viewBox="0 0 68 48" aria-hidden="true"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="#f00"/><path d="M45 24 27 14v20" fill="#fff"/></svg>';

  function initYouTube(el) {
    const id = el.dataset.yt;
    if (!YT_ID.test(id || '') || el.dataset.ready) return;
    el.dataset.ready = '1';
    const title = el.dataset.title || 'Video';
    const start = parseInt(el.dataset.start || '0', 10) || 0;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Putar video: ${title}`);
    const img = document.createElement('img');
    img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    img.style.transform = el.style.getPropertyValue("--h") && +el.style.getPropertyValue("--h") > +el.style.getPropertyValue("--w") * 0.6 ? "scale(1.02)" : "";
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    const cap = document.createElement('span');
    cap.className = 'lp-yt-title';
    cap.textContent = title;
    btn.append(img, cap);
    btn.insertAdjacentHTML('beforeend', PLAY_SVG);

    btn.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
      if (start) params.set('start', String(start));
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?${params}`;
      iframe.title = title;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      el.replaceChildren(iframe);
      el.dispatchEvent(new CustomEvent('lp:videoplay', { bubbles: true }));
    });
    el.replaceChildren(btn);
  }

  // ---------- Slider ----------
  const ARROW_SVG =
    '<svg viewBox="0 0 50 50" aria-hidden="true"><path d="M28.5 32.4c.1 0 .3-.1.4-.2.2-.2.2-.5 0-.7L22.2 25l6.7-6.5c.2-.2.2-.5 0-.7s-.5-.2-.7 0L21 24.7c-.1.1-.2.2-.2.4 0 .1.1.3.2.4l7.1 6.8c.1 0 .3.1.4.1"/></svg>';

  function initSlider(root) {
    if (root.classList.contains('is-ready')) return;
    const slides = [...root.querySelectorAll(':scope > .lp-slide')];
    if (slides.length < 2) { root.classList.add('is-ready'); slides[0]?.classList.add('is-active'); return; }

    const mode = root.dataset.transition === 'slide' ? 'slide' : 'fade';
    const interval = Math.max(2000, parseInt(root.dataset.interval || '5000', 10) || 5000);
    let index = 0;
    let timer = null;
    let visible = false;
    let stopped = false; // a video started playing inside the slider

    let track = null;
    if (mode === 'slide') {
      track = document.createElement('div');
      track.className = 'lp-track';
      track.append(...slides);
      root.prepend(track);
    }

    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'carousel');
    slides.forEach((s, i) => {
      s.setAttribute('role', 'group');
      s.setAttribute('aria-roledescription', 'slide');
      s.setAttribute('aria-label', `${i + 1} dari ${slides.length}`);
    });

    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'lp-dots';
    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Slide ${i + 1}`);
      b.append(document.createElement('span'));
      b.addEventListener('click', () => { go(i); restart(); });
      dotsWrap.append(b);
      return b;
    });
    root.append(dotsWrap);

    if (root.dataset.arrows === '1') {
      for (const dir of ['prev', 'next']) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `lp-arrow lp-arrow--${dir}`;
        b.setAttribute('aria-label', dir === 'prev' ? 'Sebelumnya' : 'Berikutnya');
        b.innerHTML = ARROW_SVG;
        b.addEventListener('click', () => { go(index + (dir === 'prev' ? -1 : 1)); restart(); });
        root.append(b);
      }
    }

    function go(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, k) => {
        const on = k === index;
        s.classList.toggle('is-active', on);
        s.inert = !on;
      });
      dots.forEach((d, k) => d.setAttribute('aria-current', String(k === index)));
      if (track) track.style.transform = `translateX(${-100 * index}%)`;
    }

    function tick() { go(index + 1); }
    function start() {
      if (timer || stopped || reduceMotion || !visible || document.hidden) return;
      timer = setInterval(tick, interval);
    }
    function stop() { clearInterval(timer); timer = null; }
    function restart() { stop(); start(); }

    // Swipe
    let x0 = null, y0 = null;
    root.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { x0 = e.clientX; y0 = e.clientY; } });
    root.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = y0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { go(index + (dx < 0 ? 1 : -1)); restart(); }
    });
    root.addEventListener('pointercancel', () => { x0 = y0 = null; });

    // Keyboard
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { go(index - 1); restart(); }
      if (e.key === 'ArrowRight') { go(index + 1); restart(); }
    });

    // Pause while a video plays inside the slider, and while focused for reading
    root.addEventListener('lp:videoplay', () => { stopped = true; stop(); });
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    }, { threshold: 0.25 }).observe(root);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    go(0);
    root.classList.add('is-ready');
  }

  function init(scope = document) {
    scope.querySelectorAll('.lp-yt').forEach(initYouTube);
    scope.querySelectorAll('.lp-slider').forEach(initSlider);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
  window.LP = { init };

  // ---------- Cookieless page-view beacon (first-party "Laporan"; nothing stored in the browser) ----------
  // Skipped for the admin preview and for visitors who send Global Privacy Control.
  const TRACK = !/^\/(admin|p)\//.test(location.pathname) && !navigator.globalPrivacyControl && navigator.sendBeacon;
  if (TRACK) {
    try {
      navigator.sendBeacon('/t', JSON.stringify({ p: location.pathname, r: document.referrer }));
    } catch {
      /* analytics must never break the page */
    }
  }

  // ---------- Section engagement: which sections were seen, for how long, and what was clicked ----------
  // Aggregated per page in Admin → Laporan → Per Bagian. Only section ids, durations, click type and click
  // position (in page design units) are sent — never text, form input or anything that identifies a person.
  if (TRACK) {
    const seen = new Map(); // section id -> ms visible (since last flush)
    const reached = new Set();
    const since = new Map(); // section id -> visible since (performance.now)
    let clicks = [];
    const close = (id, now) => {
      const t0 = since.get(id);
      if (t0 == null) return;
      seen.set(id, (seen.get(id) || 0) + (now - t0));
      since.delete(id);
    };
    const io = new IntersectionObserver((entries) => {
      const now = performance.now();
      for (const e of entries) {
        const id = e.target.id;
        const visible = e.isIntersecting && e.intersectionRect.height >= Math.min(e.boundingClientRect.height * 0.35, innerHeight * 0.5);
        if (visible && !document.hidden) {
          reached.add(id);
          if (!since.has(id)) since.set(id, now);
        } else close(id, now);
      }
    }, { threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] });
    document.querySelectorAll('.lp-sec[id]').forEach((s) => io.observe(s));

    const flush = () => {
      const now = performance.now();
      for (const id of [...since.keys()]) { close(id, now); if (!document.hidden) since.set(id, now); }
      const s = {};
      for (const [id, ms] of seen) if (ms >= 300) s[id] = Math.round(ms);
      if (!reached.size && !clicks.length && !Object.keys(s).length) return;
      try {
        navigator.sendBeacon('/t/e', JSON.stringify({ p: location.pathname, s, r: [...reached], c: clicks }));
      } catch {
        /* ignore */
      }
      seen.clear();
      reached.clear();
      clicks = [];
    };

    document.addEventListener('click', (e) => {
      const sec = e.target.closest && e.target.closest('.lp-sec[id]');
      if (!sec || clicks.length >= 60) return;
      const a = e.target.closest('a[href]');
      const href = a ? a.getAttribute('href') : '';
      const kind = a ? (/wa\.me|whatsapp/i.test(href) ? 'wa' : 'link')
        : e.target.closest('.lp-yt') ? 'video'
          : e.target.closest('.lp-slider') ? 'slider'
            : e.target.closest('summary') ? 'faq' : 'other';
      const r = sec.getBoundingClientRect();
      const u = r.width / 320;
      clicks.push([sec.id, kind, Math.round(((e.clientX - r.left) / u) * 10) / 10, Math.round(((e.clientY - r.top) / u) * 10) / 10]);
      if (kind === 'wa' || kind === 'link') flush(); // the visitor is leaving the page
    }, true);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    addEventListener('pagehide', flush);
  }
})();
