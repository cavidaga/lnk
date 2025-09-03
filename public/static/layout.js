// /public/static/layout.js
(function () {
  function headerHTML() {
    return `
      <header>
        <a href="/" class="brand" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit">
          <picture>
            <source srcset="/static/logo-dark.svg" media="(prefers-color-scheme: dark)">
            <source srcset="/static/logo-light.svg" media="(prefers-color-scheme: light)">
            <img src="/static/logo-light.svg" alt="LNK loqo" class="logo-img" width="42" height="42" />
          </picture>
        </a>

        <!-- Mobile menu toggle (hidden on desktop) -->
        <button class="nav-toggle" type="button" aria-label="Menyunu aç" aria-controls="primary-nav" aria-expanded="false" style="display:none">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>

        <div class="nav-backdrop" hidden></div>

        <nav id="primary-nav" class="site-nav" aria-label="Əsas menyu">
          <a href="/">Əsas səhifə</a>
          <a href="/about.html">Haqqımızda</a>
          <a href="/methodology.html">Metodologiya</a>
        </nav>
      </header>
    `;
  }

  function footerHTML() {
    return `
      <footer class="site-footer">
        <div class="footer-row footer-brand">
          <span class="small">LNK.AZ bir</span>
          <a class="small" href="https://cavid.info" target="_blank" rel="noopener">Cavid Ağa</a>
          <span class="small">layihəsidir</span>
        </div>

        <div class="footer-row footer-icons" aria-label="Sosial bağlantılar">
          <a href="https://cavid.info" target="_blank" rel="noopener">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l9 4.5v9L12 21 3 16.5v-9L12 3z" stroke="currentColor" stroke-width="1.5"/></svg>
            Sayt
          </a>
          <a href="https://x.com/cavidaga" target="_blank" rel="noopener">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2H21l-6.59 7.523L22 22h-6.828l-5.34-6.508L3.338 22H1l7.093-8.106L2 2h6.828l4.89 5.972L18.244 2Zm-2.393 18h1.89L7.247 3.98H5.27L15.85 20Z"/></svg>
            X (Twitter)
          </a>
          <a href="https://github.com/cavidaga" target="_blank" rel="noopener">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.637 22.428c.575.108.785-.25.785-.556 0-.274-.01-1-.016-1.963-3.194.694-3.87-1.54-3.87-1.54-.523-1.33-1.277-1.684-1.277-1.684-1.043-.713.08-.699.08-.699 1.152.081 1.759 1.184 1.759 1.184 1.025 1.757 2.69 1.25 3.345.956.104-.743.401-1.25.728-1.538-2.55-.29-5.232-1.275-5.232-5.67 0-1.253.45-2.278 1.187-3.082-.12-.29-.515-1.46.112-3.046 0 0 .967-.31 3.17 1.177a10.98 10.98 0 0 1 5.774 0c2.203-1.486 3.169-1.177 3.169-1.177.628 1.586.233 2.756.114 3.046.739.804 1.186 1.83 1.186 3.082 0 4.406-2.686 5.377-5.247 5.662.41.356.78 1.058.78 2.134 0 1.54-.014 2.78-.014 3.158 0 .309.207.671.792.555A11.5 11.5 0 0 0 12 .5Z"/></svg>
            GitHub
          </a>
          <a href="https://www.buymeacoffee.com/cavidaga" target="_blank" rel="noopener">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h14a3 3 0 0 1 0 6h-1.2l-.7 4.2A3 3 0 0 1 13.14 20H8.86A3 3 0 0 1 6.9 17.2L6.2 13H6a3 3 0 0 1 0-6Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M6.2 13h9.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Layihəyə dəstək ol
          </a>
          <button id="contact-open" type="button">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="1.5"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Əlaqə
          </button>
        </div>

        <div class="small muted">© <span id="y"></span> LNK.AZ — Made by <a class="muted" href="https://cavid.info" target="_blank" rel="noopener">cavid.info</a></div>
      </footer>
    `;
  }

  // Backdrop AFTER modal (correct order for layering)
  function modalHTML() {
    const FORM_ENDPOINT = 'https://formspree.io/f/xgvlpegn';
    return `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="contact-title" aria-describedby="contact-desc">
        <div class="modal-card">
          <div class="modal-head">
            <h3 id="contact-title">Bizə yazın</h3>
            <button class="modal-close" type="button" aria-label="Pəncərəni bağla">×</button>
          </div>
          <p id="contact-desc" class="muted small" style="margin:0 0 10px">
            Mesajınız birbaşa LNK komandası tərəfindən oxunacaq. E-poçt ünvanınızı doğru yazın ki, cavab göndərə bilək.
          </p>

          <form id="contact-form" action="${FORM_ENDPOINT}" method="POST" novalidate>
            <label class="modal-label">Adınız
              <input class="modal-input" type="text" name="name" autocomplete="name" required>
            </label>
            <label class="modal-label">E-poçt
              <input class="modal-input" type="email" name="email" autocomplete="email" required>
            </label>
            <label class="modal-label">Məktubunuz
              <textarea class="modal-input" name="message" rows="5" required></textarea>
            </label>

            <input type="text" name="_gotcha" style="display:none">

            <div class="modal-actions">
              <button type="submit" class="btn">Göndər</button>
              <button type="button" class="btn btn-ghost modal-close">Bağla</button>
            </div>

            <p class="small muted" id="contact-status" role="status" aria-live="polite" style="min-height:1.2em;margin-top:8px"></p>
          </form>
        </div>
      </div>
      <div class="modal-backdrop" aria-hidden="true"></div>
    `;
  }

  function injectHeader() {
    const container = document.getElementById('site-header') || document.querySelector('.wrap') || document.body;
    const html = headerHTML();
    if (container.id === 'site-header') container.innerHTML = html;
    else { const tmp = document.createElement('div'); tmp.innerHTML = html.trim(); container.insertBefore(tmp.firstElementChild, container.firstChild); }

    // Active link highlight
    const path = location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('.site-nav a').forEach(a => {
      const href = (a.getAttribute('href') || '').replace(/\/+$/, '') || '/';
      if (href === path) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
    });

    // Mobile drawer
    const toggle = document.querySelector('.nav-toggle');
    const drawer = document.getElementById('primary-nav');
    const backdrop = document.querySelector('.nav-backdrop');
    const mq = window.matchMedia('(max-width: 768px)');
    function openNav(){ document.body.classList.add('nav-open'); toggle?.setAttribute('aria-expanded','true'); backdrop?.removeAttribute('hidden'); }
    function closeNav(){ document.body.classList.remove('nav-open'); toggle?.setAttribute('aria-expanded','false'); backdrop?.setAttribute('hidden',''); }
    function syncToggle(){ if (!toggle) return; if (mq.matches){ toggle.style.display='inline-flex'; } else { toggle.style.display='none'; closeNav(); } }
    toggle?.addEventListener('click', () => (toggle.getAttribute('aria-expanded') === 'true' ? closeNav() : openNav()));
    backdrop?.addEventListener('click', closeNav);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
    drawer?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
    syncToggle();
    mq.addEventListener ? mq.addEventListener('change', syncToggle) : mq.addListener(syncToggle);
  }

  function injectFooter() {
    const container = document.getElementById('site-footer') || document.querySelector('.wrap') || document.body;
    const html = footerHTML();
    if (container.id === 'site-footer') container.innerHTML = html;
    else { const tmp = document.createElement('div'); tmp.innerHTML = html.trim(); container.appendChild(tmp.firstElementChild); }

    const yearEl = document.getElementById('y'); if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Inject modal markup once (after footer) — correct order: modal then backdrop
    if (!document.querySelector('.modal')) {
      const wrap = document.querySelector('.wrap') || document.body;
      const tmp = document.createElement('div'); tmp.innerHTML = modalHTML();
      wrap.appendChild(tmp);
    }

    // Modal wiring
    const openBtn = document.getElementById('contact-open');
    const modal = document.querySelector('.modal');
    const modalBackdrop = document.querySelector('.modal-backdrop');
    const closeBtns = document.querySelectorAll('.modal-close');
    const form = document.getElementById('contact-form');
    const statusEl = document.getElementById('contact-status');
    let lastFocus = null;

    function openModal(){
      lastFocus = document.activeElement;
      document.body.classList.add('modal-open');
      (modal.querySelector('input, textarea, button') || modal).focus();
    }
    function closeModal(){
      document.body.classList.remove('modal-open');
      lastFocus && lastFocus.focus();
      if (statusEl) statusEl.textContent = '';
      form?.reset();
    }

    openBtn?.addEventListener('click', openModal);
    modalBackdrop?.addEventListener('click', closeModal);
    closeBtns.forEach(b => b.addEventListener('click', closeModal));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('modal-open')) closeModal(); });

    // Basic focus trap inside modal
    modal?.addEventListener('keydown', e => {
      if (!document.body.classList.contains('modal-open') || e.key !== 'Tab') return;
      const focusables = modal.querySelectorAll('a,button,input,textarea,select,[tabindex]:not([tabindex="-1"])');
      const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    });

    // AJAX submit to Formspree
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.textContent = 'Göndərilir…';
      const data = new FormData(form);
      try{
        const res = await fetch(form.action, { method:'POST', body: data, headers: { 'Accept':'application/json' } });
        if (res.ok){
          statusEl.textContent = 'Təşəkkür edirik! Mesajınız göndərildi.';
          setTimeout(closeModal, 1200);
        } else {
          statusEl.textContent = 'Xəta baş verdi. Bir az sonra yenidən cəhd edin.';
        }
      }catch(err){
        statusEl.textContent = 'Şəbəkə xətası. Yenidən cəhd edin.';
      }
    });
  }

  function ready(fn){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(() => { injectHeader(); injectFooter(); });
})();
