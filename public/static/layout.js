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
        <button class="nav-toggle radial-menu-toggle" type="button" aria-label="Menyunu aç" aria-controls="primary-nav" aria-expanded="false" style="display:none">
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          <svg class="close-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display: none;">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>

        <div class="nav-backdrop" hidden></div>

        <nav id="primary-nav" class="site-nav radial-menu" aria-label="Əsas menyu">
          <!-- Center logo -->
          <div class="radial-center-logo">
            <picture>
              <source srcset="/static/logo-dark.svg" media="(prefers-color-scheme: dark)">
              <source srcset="/static/logo-light.svg" media="(prefers-color-scheme: light)">
              <img src="/static/logo-light.svg" alt="LNK loqo" width="32" height="32" />
            </picture>
          </div>
          
          <a href="/" class="radial-item nav-link" data-tooltip="Əsas səhifə" aria-label="Əsas səhifə" data-angle="0">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="label">Əsas</span>
          </a>
          
          <a href="/about.html" class="radial-item nav-link" data-tooltip="Haqqımızda" aria-label="Haqqımızda" data-angle="72">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="label">Haqqımızda</span>
          </a>
          
          <a href="/methodology.html" class="radial-item nav-link" data-tooltip="Metodologiya" aria-label="Metodologiya" data-angle="144">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="10,9 9,9 8,9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="label">Metodologiya</span>
          </a>

          
          <a href="/privacy.html" class="radial-item nav-link" data-tooltip="Məxfilik" aria-label="Məxfilik" data-angle="216">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="16" r="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="label">Məxfilik</span>
          </a>

          <a href="/about.html#contact" class="radial-item nav-link" data-tooltip="Əlaqə" aria-label="Əlaqə" data-angle="252">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16v12H4z" stroke="currentColor" stroke-width="1.5"/>
              <path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="label">Əlaqə</span>
          </a>

          <!-- User login/register links -->
          
          <a href="/user-login.html" class="radial-item nav-link" data-tooltip="Daxil ol" aria-label="Daxil ol" data-angle="288">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="10,17 15,12 10,7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="15" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="label">Daxil ol</span>
          </a>

          <a href="/user-register.html" class="radial-item nav-link" data-tooltip="Qeydiyyat" aria-label="Qeydiyyat" data-angle="306">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="label">Qeydiyyat</span>
          </a>

          <a href="/user-dashboard.html" class="radial-item nav-link" data-tooltip="İstifadəçi Paneli" aria-label="İstifadəçi paneli" data-angle="324">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="14" y="3" width="7" height="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="14" y="14" width="7" height="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="3" y="14" width="7" height="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="label">Panel</span>
          </a>

          <!-- Support button (desktop) -->
          <a href="https://www.buymeacoffee.com/cavidaga" target="_blank" rel="noopener"
            class="radial-item support-item" data-tooltip="Layihəyə dəstək ol" aria-label="Layihəyə dəstək ol" data-angle="342">
            <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h14a3 3 0 0 1 0 6h-1.2l-.7 4.2A3 3 0 0 1 13.14 20H8.86A3 3 0 0 1 6.9 17.2L6.2 13H6a3 3 0 0 1 0-6Z"
                    stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M6.2 13h9.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="label">Dəstək ol</span>
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

        </nav>
      </header>
    `;
  }

  function footerHTML() {
    return `
      <footer class="site-footer">
        <div class="footer-row" style="margin:12px 0; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <a href="/documentation" class="footer-link-btn">
            <svg width="16" height="16" viewBox="0 0 1024 1024" class="icon" version="1.1" xmlns="http://www.w3.org/2000/svg">
              <path d="M877.685565 727.913127l-0.584863-0.365539a32.898541 32.898541 0 0 1-8.041866-46.423497 411.816631 411.816631 0 1 0-141.829267 145.777092c14.621574-8.992268 33.62962-5.117551 43.645398 8.772944l0.146216 0.073108a30.412874 30.412874 0 0 1-7.968758 43.206751l-6.141061 4.020933a475.201154 475.201154 0 1 1 163.615412-164.419599 29.974227 29.974227 0 0 1-42.841211 9.357807z m-537.342843-398.584106c7.164571-7.091463 24.71046-9.650239 33.26408 0 10.600641 11.185504 7.164571 29.462472 0 37.138798l-110.612207 107.468569L370.901811 576.14119c7.164571 7.091463 8.114974 27.342343 0 35.384209-9.796455 9.723347-29.828011 8.188081-36.480827 1.535265L208.309909 487.388236a18.423183 18.423183 0 0 1 0-25.953294l132.032813-132.032813z m343.314556 0l132.032813 132.032813a18.423183 18.423183 0 0 1 0 25.953294L689.652124 613.133772c-6.652816 6.579708-25.587754 10.746857-36.553935 0-10.30821-10.235102-7.091463-31.290168 0-38.381632l108.345863-100.669537-111.855041-108.638294c-7.164571-7.676326-9.504023-26.611265 0-36.04218 9.284699-9.138484 26.903696-7.091463 34.068267 0z m-135.54199-26.318833c3.582286-9.504023 21.347498-15.498868 32.679217-11.258612 10.819965 4.020933 17.180349 19.008046 14.256035 28.512069l-119.896906 329.716493c-3.509178 9.504023-20.616419 13.305632-30.193551 9.723347-10.161994-3.509178-21.201282-17.545889-17.545888-26.976804l120.627985-329.716493z" fill="currentColor" />
            </svg>
            Sənədlər
          </a>
          <a href="/dev" class="footer-link-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="si-glyph si-glyph-hammer-and-wrench">
              <title>Hammer-and-wrench</title>
              <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                <g transform="translate(0.000000, 1.000000)" fill="currentColor">
                  <g>
                    <path d="M14.217,14.949 C14.748,15.482 15.076,15.103 15.512,14.668 C15.948,14.233 16.326,13.904 15.795,13.372 C15.795,13.372 8.393,5.977 6.565,4.154 L4.987,5.731 L14.217,14.949 L14.217,14.949 Z"></path>
                    <path d="M2.048,7.015 L2.662,6.411 C2.662,6.411 2.391,5.668 2.788,5.312 C3.185,4.956 3.855,5.176 3.855,5.176 L6.01,3.093 C6.01,3.093 5.859,2.01 6.059,1.81 C6.259,1.61 8.494,0.521 8.71,0.303 L8.251,-0.156 C8.251,-0.156 5.123,0.22 4.784,0.558 C4.585,0.758 3.096,2.262 2.034,3.324 C2.034,3.324 2.3,4.083 1.95,4.433 C1.599,4.784 0.809,4.533 0.809,4.533 C0.436,4.906 0.186,5.155 0.186,5.155 C-0.077,5.42 0.078,5.792 0.401,6.115 L1.087,6.801 C1.412,7.125 1.785,7.278 2.048,7.015 L2.048,7.015 Z"></path>
                  </g>
                  <path d="M11.733,5.515 C12.81,6.026 14.161,5.869 15.055,4.975 C15.745,4.285 16.019,3.336 15.872,2.444 L14.351,3.963 L13.057,4.284 L11.595,2.842 L11.938,1.505 L13.445,0.017 C12.552,-0.129 11.543,0.082 10.853,0.773 C9.958,1.668 9.836,3.052 10.347,4.13 L9.353,5.123 C9.79,5.558 10.257,6.025 10.741,6.508 L11.733,5.515 L11.733,5.515 Z"></path>
                  <path d="M7.432,10.119 L5.927,8.615 L4.619,9.924 C4.537,10.004 4.479,10.095 4.438,10.19 C4.361,10.16 4.318,10.159 4.291,10.17 C4.041,10.087 3.777,10.031 3.5,10.031 C2.119,10.031 1,11.136 1,12.5 C1,13.864 2.119,14.969 3.5,14.969 C4.881,14.969 6,13.864 6,12.5 C6,12.217 5.941,11.949 5.854,11.696 C5.849,11.672 5.848,11.65 5.834,11.615 C5.938,11.572 6.036,11.514 6.122,11.427 L7.432,10.119 L7.432,10.119 Z M3.5,13.938 C2.688,13.938 2.031,13.295 2.031,12.5 C2.031,11.705 2.687,11.062 3.5,11.062 C4.313,11.062 4.969,11.705 4.969,12.5 C4.969,13.295 4.312,13.938 3.5,13.938 L3.5,13.938 Z"></path>
                </g>
              </g>
            </svg>
            Təkmilləşdirici
          </a>
        </div>

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
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z"/>
              <path d="M18 5C17.4477 5 17 5.44772 17 6C17 6.55228 17.4477 7 18 7C18.5523 7 19 6.55228 19 6C19 5.44772 18.5523 5 18 5Z"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M1.65396 4.27606C1 5.55953 1 7.23969 1 10.6V13.4C1 16.7603 1 18.4405 1.65396 19.7239C2.2292 20.8529 3.14708 21.7708 4.27606 22.346C5.55953 23 7.23969 23 10.6 23H13.4C16.7603 23 18.4405 23 19.7239 22.346C20.8529 21.7708 21.7708 20.8529 22.346 19.7239C23 18.4405 23 16.7603 23 13.4V10.6C23 7.23969 23 5.55953 22.346 4.27606C21.7708 3.14708 20.8529 2.2292 19.7239 1.65396C18.4405 1 16.7603 1 13.4 1H10.6C7.23969 1 5.55953 1 4.27606 1.65396C3.14708 2.2292 2.2292 3.14708 1.65396 4.27606ZM13.4 3H10.6C8.88684 3 7.72225 3.00156 6.82208 3.0751C5.94524 3.14674 5.49684 3.27659 5.18404 3.43597C4.43139 3.81947 3.81947 4.43139 3.43597 5.18404C3.27659 5.49684 3.14674 5.94524 3.0751 6.82208C3.00156 7.72225 3 8.88684 3 10.6V13.4C3 15.1132 3.00156 16.2777 3.0751 17.1779C3.14674 18.0548 3.27659 18.5032 3.43597 18.816C3.81947 19.5686 4.43139 20.1805 5.18404 20.564C5.49684 20.7234 5.94524 20.8533 6.82208 20.9249C7.72225 20.9984 8.88684 21 10.6 21H13.4C15.1132 21 16.2777 20.9984 17.1779 20.9249C18.0548 20.8533 18.5032 20.7234 18.816 20.564C19.5686 20.1805 20.1805 19.5686 20.564 18.816C20.7234 18.5032 20.8533 18.0548 20.9249 17.1779C20.9984 16.2777 21 15.1132 21 13.4V10.6C21 8.88684 20.9984 7.72225 20.9249 6.82208C20.8533 5.94524 20.7234 5.49684 20.564 5.18404C20.1805 4.43139 19.5686 3.81947 18.816 3.43597C18.5032 3.27659 18.0548 3.14674 17.1779 3.0751C16.2777 3.00156 15.1132 3 13.4 3Z"/>
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
    function openNav(){ 
      document.body.classList.add('nav-open'); 
      toggle?.setAttribute('aria-expanded','true'); 
      backdrop?.removeAttribute('hidden');
      drawer?.classList.add('open');
      // Toggle icons
      const menuIcon = toggle?.querySelector('.menu-icon');
      const closeIcon = toggle?.querySelector('.close-icon');
      if (menuIcon) menuIcon.style.display = 'none';
      if (closeIcon) closeIcon.style.display = 'block';
    }
    function closeNav(){ 
      document.body.classList.remove('nav-open'); 
      toggle?.setAttribute('aria-expanded','false'); 
      backdrop?.setAttribute('hidden','');
      drawer?.classList.remove('open');
      // Toggle icons
      const menuIcon = toggle?.querySelector('.menu-icon');
      const closeIcon = toggle?.querySelector('.close-icon');
      if (menuIcon) menuIcon.style.display = 'block';
      if (closeIcon) closeIcon.style.display = 'none';
    }
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
    drawer?.querySelectorAll('.radial-item').forEach(link => link.addEventListener('click', closeNav));
    // Theme toggle removed from mobile nav
    // Close button removed - navigation closes on backdrop click or outside click
    syncToggle();
    mq.addEventListener ? mq.addEventListener('change', syncToggle) : mq.addListener(syncToggle);
    
    // Initialize mobile theme toggle visibility
    if (mobileThemeToggle) {
      mobileThemeToggle.style.display = mq.matches ? 'inline-flex' : 'none';
    }

    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
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
      // Update all picture elements (main header logo and radial menu center logo)
      const pictures = document.querySelectorAll('picture');
      pictures.forEach(picture => {
        const sources = picture.querySelectorAll('source');
        const img = picture.querySelector('img');
        
        if (sources.length >= 2 && img) {
          // Update the media queries to force the correct logo
          sources[0].setAttribute('media', isDark ? 'all' : 'none'); // dark logo source
          sources[1].setAttribute('media', isDark ? 'none' : 'all'); // light logo source
          
          // Also update the fallback img src
          img.src = isDark ? '/static/logo-dark.svg' : '/static/logo-light.svg';
        }
      });
    }
    
    function resetLogoToSystem() {
      // Reset all picture elements to system theme
      const pictures = document.querySelectorAll('picture');
      pictures.forEach(picture => {
        const sources = picture.querySelectorAll('source');
        const img = picture.querySelector('img');
        
        if (sources.length >= 2 && img) {
          // Reset to original media queries
          sources[0].setAttribute('media', '(prefers-color-scheme: dark)');
          sources[1].setAttribute('media', '(prefers-color-scheme: light)');
          
          // Reset fallback to light (original default)
          img.src = '/static/logo-light.svg';
        }
      });
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
    
    // Set active navigation link
    function setActiveNavLink() {
      const currentPath = window.location.pathname;
      const navLinks = document.querySelectorAll('.nav-link');
      
      navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '/' && href === '/')) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }
    
    // Set active link on page load
    setActiveNavLink();
  
  function ready(fn){ if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(() => { injectHeader(); injectFooter(); });
})();
