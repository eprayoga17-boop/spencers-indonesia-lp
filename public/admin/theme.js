// Applies the saved admin theme before first paint (light is the default). Loaded synchronously in <head>.
(() => {
  let theme = 'light';
  try {
    theme = localStorage.getItem('mb-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    /* storage blocked: keep light */
  }
  document.documentElement.dataset.theme = theme;
})();
