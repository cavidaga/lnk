// /public/static/header.js
(function () {
  function renderHeader() {
    const container =
      document.getElementById('site-header') ||
      document.querySelector('.wrap') ||
      document.body;

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

    // If #site-header exists, fill it; otherwise prepend to container
    if (container.id === 'site-header') {
      container.innerHTML = headerHTML;
    } else {
      const tmp = document.createElement('div');
      tmp.innerHTML = headerHTML.trim();
      container.insertBefore(tmp.firstElementChild, container.firstChild);
    }

    // Auto-highlight active link
    const path = location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('.site-nav a').forEach(a => {
      const href = (a.getAttribute('href') || '').replace(/\/+$/, '') || '/';
      if (href === path) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  // Ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderHeader);
  } else {
    renderHeader();
  }
})();
