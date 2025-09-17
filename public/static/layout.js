// /public/static/layout.js
(function () {
  function headerHTML() {
    return `
      <header>
        <!-- Mobile theme toggle (left side on mobile) -->
        <button class="mobile-theme-toggle" type="button" 
                data-tooltip="Tema dəyişdir" aria-label="Tema dəyişdir" style="display:none">
          <svg class="icon theme-icon-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <svg class="icon theme-icon-moon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display: none;">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="sr-only">Tema dəyişdir</span>
        </button>

        <a href="/" class="brand" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit">
          <picture>
            <source srcset="/static/logo-dark.svg" media="(prefers-color-scheme: dark)">
            <source srcset="/static/logo-light.svg" media="(prefers-color-scheme: light)">
            <img src="/static/logo-light.svg" alt="LNK loqo" class="logo-img" width="42" height="42" />
          </picture>
        </a>

        <!-- Mobile menu toggle (right side on mobile) -->
        <button class="nav-toggle" type="button" aria-label="Menyunu aç" aria-controls="primary-nav" aria-expanded="false" style="display:none">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>

        <div class="nav-backdrop" hidden></div>

        <nav id="primary-nav" class="site-nav" aria-label="Əsas menyu">
          <!-- Mobile nav header -->
          <div class="mobile-nav-header">
            <span class="mobile-nav-title">Menyu</span>
            <button class="mobile-nav-close" type="button" aria-label="Menyunu bağla">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          
          <a href="/" class="nav-link" data-tooltip="Əsas səhifə" aria-label="Əsas səhifə">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="sr-only">Əsas səhifə</span>
          </a>
          
          <a href="/history.html" class="nav-link" data-tooltip="Tarixçə" aria-label="Tarixçə">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 3v5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 7v5l4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="sr-only">Tarixçə</span>
          </a>
          
          <a href="/about.html" class="nav-link" data-tooltip="Haqqımızda" aria-label="Haqqımızda">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="sr-only">Haqqımızda</span>
          </a>
          
          <a href="/methodology.html" class="nav-link" data-tooltip="Metodologiya" aria-label="Metodologiya">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="10,9 9,9 8,9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="sr-only">Metodologiya</span>
          </a>
          
          <a href="/privacy.html" class="nav-link" data-tooltip="Məxfilik" aria-label="Məxfilik">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="16" r="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="sr-only">Məxfilik</span>
          </a>

          <!-- Theme toggle button (desktop) -->
          <button id="theme-toggle" class="theme-toggle" type="button" 
                  data-tooltip="Tema dəyişdir" aria-label="Tema dəyişdir">
            <svg class="icon theme-icon-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <svg class="icon theme-icon-moon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display: none;">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="sr-only">Tema dəyişdir</span>
          </button>

          <!-- Support button (desktop) -->
          <a href="https://www.buymeacoffee.com/cavidaga" target="_blank" rel="noopener"
            class="btn-support" data-tooltip="Layihəyə dəstək ol" aria-label="Layihəyə dəstək ol">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h14a3 3 0 0 1 0 6h-1.2l-.7 4.2A3 3 0 0 1 13.14 20H8.86A3 3 0 0 1 6.9 17.2L6.2 13H6a3 3 0 0 1 0-6Z"
                    stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M6.2 13h9.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="label">Dəstək ol</span>
          </a>

          <!-- Action buttons container (mobile only) -->
          <div class="nav-actions">
            <!-- Theme toggle button (mobile) -->
            <button class="theme-toggle theme-toggle-mobile" type="button" 
                    data-tooltip="Tema dəyişdir" aria-label="Tema dəyişdir">
              <svg class="icon theme-icon-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <svg class="icon theme-icon-moon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display: none;">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span class="sr-only">Tema dəyişdir</span>
            </button>
          </div>
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
          <a href="https://x.com/lnk_az" target="_blank" rel="noopener" data-tooltip="X (Twitter)" aria-label="X (Twitter)">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2H21l-6.59 7.523L22 22h-6.828l-5.34-6.508L3.338 22H1l7.093-8.106L2 2h6.828l4.89 5.972L18.244 2Zm-2.393 18h1.89L7.247 3.98H5.27L15.85 20Z"/>
            </svg>
            <span class="sr-only">X (Twitter)</span>
          </a>

          <a href="https://www.facebook.com/lnk.page" target="_blank" rel="noopener" data-tooltip="Facebook" aria-label="Facebook">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13.5 9H15V6h-2c-2.2 0-3.5 1.3-3.5 3.5V12H7v3h2.5v7h3v-7H15l.5-3h-3v-2c0-.6.2-1 1-1Z"/>
            </svg>
            <span class="sr-only">Facebook</span>
          </a>

          <a href="https://www.instagram.com/lnk.az" target="_blank" rel="noopener" data-tooltip="Instagram" aria-label="Instagram">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="4" ry="4"/>
              <circle cx="12" cy="12" r="4.5"/>
              <circle cx="17.5" cy="6.5" r="1.5"/>
            </svg>
            <span class="sr-only">Instagram</span>
          </a>

          <a href="https://www.linkedin.com/company/lnk-az/" target="_blank" rel="noopener" data-tooltip="LinkedIn" aria-label="LinkedIn">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3 9h4v12H3V9Zm7 0h3.6v1.8h.1c.5-1 1.7-2.1 3.6-2.1 3.8 0 4.5 2.5 4.5 5.8V21h-4v-6.3c0-1.5 0-3.5-2.2-3.5-2.3 0-2.6 1.6-2.6 3.4V21h-4V9Z"/>
            </svg>
            <span class="sr-only">LinkedIn</span>
          </a>

          <a href="https://github.com/cavidaga/lnk" target="_blank" rel="noopener" data-tooltip="GitHub" aria-label="GitHub">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5a11.5 11.5 0 0 0-3.637 22.428c.575.108.785-.25.785-.556 0-.274-.01-1-.016-1.963-3.194.694-3.87-1.54-3.87-1.54-.523-1.33-1.277-1.684-1.277-1.684-1.043-.713.08-.699.08-.699 1.152.081 1.759 1.184 1.759 1.184 1.025 1.757 2.69 1.25 3.345.956.104-.743.401-1.25.728-1.538-2.55-.29-5.232-1.275-5.232-5.67 0-1.253.45-2.278 1.187-3.082-.12-.29-.515-1.46.112-3.046 0 0 .967-.31 3.17 1.177a10.98 10.98 0 0 1 5.774 0c2.203-1.486 3.169-1.177 3.169-1.177.628 1.586.233 2.756.114 3.046.739.804 1.186 1.83 1.186 3.082 0 4.406-2.686 5.377-5.247 5.662.41.356.78 1.058.78 2.134 0 1.54-.014 2.78-.014 3.158 0 .309.207.671.792.555A11.5 11.5 0 0 0 12 .5Z"/>
            </svg>
            <span class="sr-only">GitHub</span>
          </a>

          <!-- Highlighted Buy Me a Coffee -->
          <a href="https://www.buymeacoffee.com/cavidaga" target="_blank" rel="noopener"
            class="support" data-tooltip="Layihəyə dəstək ol" aria-label="Layihəyə dəstək ol">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h14a3 3 0 0 1 0 6h-1.2l-.7 4.2A3 3 0 0 1 13.14 20H8.86A3 3 0 0 1 6.9 17.2L6.2 13H6a3 3 0 0 1 0-6Z"
                    stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M6.2 13h9.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="sr-only">Layihəyə dəstək ol</span>
          </a>

          <a id="contact-link" href="/about.html#contact" data-tooltip="Əlaqə" aria-label="Əlaqə">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="1.5"/>
              <path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="sr-only">Əlaqə</span>
          </a>

          <a href="/privacy.html" data-tooltip="Məxfilik" aria-label="Məxfilik">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="sr-only">Məxfilik</span>
          </a>
        </div>

        <div class="small muted">© <span id="y"></span> LNK.AZ — Made by <a class="muted" href="https://cavid.info" target="_blank" rel="noopener">cavid.info</a></div>
      </footer>
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
    const mobileThemeToggle = document.querySelector('.mobile-theme-toggle');
    const mq = window.matchMedia('(max-width: 768px)');
    function openNav(){ document.body.classList.add('nav-open'); toggle?.setAttribute('aria-expanded','true'); backdrop?.removeAttribute('hidden'); }
    function closeNav(){ document.body.classList.remove('nav-open'); toggle?.setAttribute('aria-expanded','false'); backdrop?.setAttribute('hidden',''); }
    function syncToggle(){ 
      if (!toggle) return; 
      if (mq.matches){ 
        toggle.style.display='inline-flex'; 
        if (mobileThemeToggle) mobileThemeToggle.style.display='inline-flex';
      } else { 
        toggle.style.display='none'; 
        if (mobileThemeToggle) mobileThemeToggle.style.display='none';
        closeNav(); 
      } 
    }
    toggle?.addEventListener('click', () => (toggle.getAttribute('aria-expanded') === 'true' ? closeNav() : openNav()));
    backdrop?.addEventListener('click', closeNav);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
    drawer?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
    drawer?.querySelector('.nav-actions .theme-toggle')?.addEventListener('click', closeNav);
    drawer?.querySelector('.mobile-nav-close')?.addEventListener('click', closeNav);
    syncToggle();
    mq.addEventListener ? mq.addEventListener('change', syncToggle) : mq.addListener(syncToggle);
    
    // Initialize mobile theme toggle visibility
    if (mobileThemeToggle) {
      mobileThemeToggle.style.display = mq.matches ? 'inline-flex' : 'none';
    }

    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleMobile = document.querySelector('.theme-toggle-mobile');
    const themeIconSun = document.querySelectorAll('.theme-icon-sun');
    const themeIconMoon = document.querySelectorAll('.theme-icon-moon');
    
    // Theme management
    function getStoredTheme() {
      return localStorage.getItem('theme');
    }
    
    function setStoredTheme(theme) {
      localStorage.setItem('theme', theme);
    }
    
    function getSystemTheme() {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    function getCurrentTheme() {
      const stored = getStoredTheme();
      return stored || getSystemTheme();
    }
    
    function applyTheme(theme) {
      const root = document.documentElement;
      const isDark = theme === 'dark';
      
      // Remove existing theme classes
      root.classList.remove('theme-light', 'theme-dark');
      
      // Add new theme class
      root.classList.add(isDark ? 'theme-dark' : 'theme-light');
      
      // Update favicon
      updateFavicon(isDark);
      
      // Update logo
      updateLogo(isDark);
      
      // Update theme toggle icons
      themeIconSun.forEach(icon => {
        icon.style.display = isDark ? 'block' : 'none';
      });
      themeIconMoon.forEach(icon => {
        icon.style.display = isDark ? 'none' : 'block';
      });
      
      // Update theme toggle tooltip
      if (themeToggle) {
        themeToggle.setAttribute('data-tooltip', isDark ? 'Açıq tema' : 'Qaranlıq tema');
        themeToggle.setAttribute('aria-label', isDark ? 'Açıq tema' : 'Qaranlıq tema');
      }
      if (mobileThemeToggle) {
        mobileThemeToggle.setAttribute('data-tooltip', isDark ? 'Açıq tema' : 'Qaranlıq tema');
        mobileThemeToggle.setAttribute('aria-label', isDark ? 'Açıq tema' : 'Qaranlıq tema');
      }
    }
    
    function updateFavicon(isDark) {
      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon) {
        favicon.href = isDark ? '/static/favicon-dark.svg' : '/static/favicon-light.svg';
      }
    }
    
    function updateLogo(isDark) {
      const picture = document.querySelector('picture');
      if (picture) {
        const sources = picture.querySelectorAll('source');
        const img = picture.querySelector('img');
        
        if (sources.length >= 2 && img) {
          // Update the media queries to force the correct logo
          sources[0].setAttribute('media', isDark ? 'all' : 'none'); // dark logo source
          sources[1].setAttribute('media', isDark ? 'none' : 'all'); // light logo source
          
          // Also update the fallback img src
          img.src = isDark ? '/static/logo-dark.svg' : '/static/logo-light.svg';
        }
      }
    }
    
    function resetLogoToSystem() {
      const picture = document.querySelector('picture');
      if (picture) {
        const sources = picture.querySelectorAll('source');
        const img = picture.querySelector('img');
        
        if (sources.length >= 2 && img) {
          // Reset to original media queries
          sources[0].setAttribute('media', '(prefers-color-scheme: dark)');
          sources[1].setAttribute('media', '(prefers-color-scheme: light)');
          
          // Reset fallback to light (original default)
          img.src = '/static/logo-light.svg';
        }
      }
    }
    
    function toggleTheme() {
      const currentTheme = getCurrentTheme();
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setStoredTheme(newTheme);
      applyTheme(newTheme);
    }
    
    // Initialize theme
    function initTheme() {
      const theme = getCurrentTheme();
      applyTheme(theme);
    }
    
    // Set up theme toggle
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }
    if (themeToggleMobile) {
      themeToggleMobile.addEventListener('click', toggleTheme);
    }
    if (mobileThemeToggle) {
      mobileThemeToggle.addEventListener('click', toggleTheme);
    }
    
    // Listen for system theme changes (only if no manual preference is stored)
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeQuery.addEventListener('change', () => {
      if (!getStoredTheme()) {
        const systemTheme = getSystemTheme();
        applyTheme(systemTheme);
        resetLogoToSystem();
      }
    });
    
    // Initialize theme on load
    initTheme();
  }

  function injectFooter() {
    const container = document.getElementById('site-footer') || document.querySelector('.wrap') || document.body;
    const html = footerHTML();
    if (container.id === 'site-footer') container.innerHTML = html;
    else { const tmp = document.createElement('div'); tmp.innerHTML = html.trim(); container.appendChild(tmp.firstElementChild); }

    const yearEl = document.getElementById('y');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }
  const upBtn = document.createElement('button');
    upBtn.id = 'to-top';
    upBtn.setAttribute('aria-label','Yuxarı qayıt');
    upBtn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5l-7 7m7-7l7 7m-7-7v14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    document.body.appendChild(upBtn);

    // Scroll behaviour
    upBtn.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));

    // Show only after scrolling down a bit
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) upBtn.classList.add('visible');
      else upBtn.classList.remove('visible');
    });
  function ready(fn){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(() => { injectHeader(); injectFooter(); });
})();
