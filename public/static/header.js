// /static/header.js
(() => {
  const headerHTML = `
    <header>
      <a href="/" class="brand" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit">
        <img src="/static/logo.svg" alt="LNK loqo" class="logo-img" width="42" height="42" />
        <h1 style="font-size:22px;margin:0;">LNK.az</h1>
      </a>
      <nav class="site-nav" aria-label="Əsas menyu">
        <a href="/">Əsas səhifə</a>
        <a href="/about.html">Haqqımızda</a>
        <a href="/methodology.html">Metodologiya</a>
      </nav>
    </header>
  `;

  // Insert header at the top of .wrap (fallback to body if .wrap not found)
  const wrap = document.querySelector('.wrap') || document.body;
  const tmp = document.createElement('div');
  tmp.innerHTML = headerHTML.trim();
  const headerEl = tmp.firstElementChild;
  wrap.insertBefore(headerEl, wrap.firstChild);

  // Auto-highlight active link
  const path = location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('.site-nav a').forEach(a => {
    const href = a.getAttribute('href');
    const normalized = href.replace(/\/+$/, '') || '/';
    if (normalized === path) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
})();
