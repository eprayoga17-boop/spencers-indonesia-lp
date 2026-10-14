// Google Analytics 4 bootstrap (external file because the CSP forbids inline scripts).
// Loaded only when a Measurement ID is set in Admin → Global.
(() => {
  const id = document.currentScript && document.currentScript.dataset.ga;
  if (!id || location.pathname.startsWith('/admin')) return;
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments); // eslint-disable-line prefer-rest-params
  }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id, { anonymize_ip: true });
})();
