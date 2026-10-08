  (function () {
    var t = localStorage.getItem('webcli-theme') || 'dark';
    if (t === 'auto') t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-mode', t);
  })();
