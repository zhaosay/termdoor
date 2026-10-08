  (function () {
    var t = localStorage.getItem('webcli-theme') || 'dark';
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  })();
