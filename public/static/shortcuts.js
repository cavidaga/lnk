// /static/shortcuts.js — Keyboard shortcuts for power users

(function() {
  'use strict';

  // Safe shortcuts that won't conflict with OS/browser defaults
  const SHORTCUTS = {
    'Ctrl+Alt+A': {
      action: 'analyze',
      description: 'Yeni analiz başlat',
      page: 'home'
    },
    'Ctrl+Alt+H': {
      action: 'history',
      description: 'Tarixçəyə keç',
      page: 'all'
    },
    'Ctrl+Alt+M': {
      action: 'methodology',
      description: 'Metodologiyaya keç',
      page: 'all'
    },
    'Ctrl+Alt+P': {
      action: 'privacy',
      description: 'Məxfilik səhifəsinə keç',
      page: 'all'
    },
    'Ctrl+Alt+F': {
      action: 'focus-input',
      description: 'URL daxil etmə sahəsini fokusla',
      page: 'home'
    },
    'Ctrl+Alt+Enter': {
      action: 'submit',
      description: 'Formu göndər',
      page: 'home'
    },
    'Ctrl+Alt+Escape': {
      action: 'clear',
      description: 'Formu təmizlə',
      page: 'home'
    },
    'Ctrl+Alt+C': {
      action: 'clear-history',
      description: 'Tarixçəni təmizlə',
      page: 'history'
    },
    'Ctrl+Alt+S': {
      action: 'share',
      description: 'Keçidi kopyala',
      page: 'analysis'
    },
    'Ctrl+Alt+?': {
      action: 'help',
      description: 'Qısayollar köməyini göstər',
      page: 'all'
    }
  };

  // Conflict detection
  const CONFLICT_KEYS = [
    'Ctrl+A', 'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+Y',
    'Ctrl+S', 'Ctrl+O', 'Ctrl+P', 'Ctrl+F', 'Ctrl+G', 'Ctrl+H',
    'Ctrl+N', 'Ctrl+T', 'Ctrl+W', 'Ctrl+R', 'Ctrl+L',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
    'Alt+Tab', 'Alt+F4', 'Alt+Enter', 'Alt+Left', 'Alt+Right',
    'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+1', 'Ctrl+2', 'Ctrl+3'
  ];

  function isSafeShortcut(combo) {
    return !CONFLICT_KEYS.includes(combo);
  }

  function getCurrentPage() {
    const path = location.pathname;
    if (path === '/' || path === '/index.html') return 'home';
    if (path === '/history.html') return 'history';
    if (path.startsWith('/analysis/')) return 'analysis';
    return 'other';
  }

  function executeAction(action) {
    const currentPage = getCurrentPage();
    
    switch (action) {
      case 'analyze':
        if (currentPage === 'home') {
          const input = document.getElementById('url');
          if (input) {
            input.focus();
            input.select();
          }
        } else {
          location.href = '/';
        }
        break;

      case 'history':
        if (currentPage !== 'history') {
          location.href = '/history.html';
        }
        break;

      case 'methodology':
        location.href = '/methodology.html';
        break;

      case 'privacy':
        location.href = '/privacy.html';
        break;

      case 'focus-input':
        if (currentPage === 'home') {
          const input = document.getElementById('url');
          if (input) {
            input.focus();
            input.select();
          }
        }
        break;

      case 'submit':
        if (currentPage === 'home') {
          const form = document.getElementById('analyze-form');
          if (form) {
            const url = document.getElementById('url').value.trim();
            if (url) {
              form.submit();
            }
          }
        }
        break;

      case 'clear':
        if (currentPage === 'home') {
          const input = document.getElementById('url');
          if (input) {
            input.value = '';
            input.focus();
          }
        } else if (currentPage === 'history') {
          location.href = '/';
        }
        break;

      case 'clear-history':
        if (currentPage === 'history') {
          const clearBtn = document.getElementById('clear-history');
          if (clearBtn) {
            clearBtn.click();
          }
        }
        break;

      case 'share':
        if (currentPage === 'analysis') {
          const copyBtn = document.getElementById('copy-link');
          if (copyBtn) {
            copyBtn.click();
          }
        }
        break;

      case 'help':
        showShortcutsHelp();
        break;
    }
  }

  function showShortcutsHelp() {
    const overlay = document.getElementById('shortcuts-help');
    if (overlay) {
      overlay.style.display = 'flex';
      // Focus the close button for accessibility
      const closeBtn = overlay.querySelector('.shortcuts-close');
      if (closeBtn) closeBtn.focus();
    }
  }

  function hideShortcuts() {
    const overlay = document.getElementById('shortcuts-help');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  function getShortcutsForCurrentPage() {
    const currentPage = getCurrentPage();
    const pageShortcuts = {};
    
    Object.entries(SHORTCUTS).forEach(([combo, data]) => {
      if (data.page === 'all' || data.page === currentPage) {
        pageShortcuts[combo] = data;
      }
    });
    
    return pageShortcuts;
  }

  function renderShortcutsHelp() {
    const overlay = document.getElementById('shortcuts-help');
    if (!overlay) return;

    const shortcuts = getShortcutsForCurrentPage();
    const shortcutsList = overlay.querySelector('.shortcuts-list');
    
    if (shortcutsList) {
      shortcutsList.innerHTML = Object.entries(shortcuts)
        .map(([combo, data]) => {
          const keys = combo.split('+').map(key => `<kbd>${key}</kbd>`).join(' + ');
          return `
            <div class="shortcut-item">
              <div class="shortcut-keys">${keys}</div>
              <div class="shortcut-description">${data.description}</div>
            </div>
          `;
        })
        .join('');
    }
  }

  function addShortcutsBubble() {
    // Only show bubble on desktop (screen width > 768px)
    if (window.innerWidth <= 768) {
      return; // Don't create bubble on mobile
    }
    
    // Create a floating bubble for shortcuts
    const bubble = document.createElement('div');
    bubble.id = 'shortcuts-bubble';
    bubble.className = 'shortcuts-bubble';
    bubble.innerHTML = `
      <button class="shortcuts-bubble-btn" onclick="showShortcutsHelp()" aria-label="Klaviatura qısayollarını göstər" title="Klaviatura qısayolları">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M9 9h6v6H9z" fill="currentColor"/>
          <path d="M9 1h6v2H9zM9 21h6v2H9zM1 9h2v6H1zM21 9h2v6h-2z" fill="currentColor"/>
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
        <span class="shortcuts-bubble-text">Qısayollar</span>
      </button>
    `;
    
    document.body.appendChild(bubble);
  }

  function initShortcuts() {
    // Register keyboard event listener
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
        return;
      }

      const combo = `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}`;
      
      if (SHORTCUTS[combo] && isSafeShortcut(combo)) {
        e.preventDefault();
        executeAction(SHORTCUTS[combo].action);
      }
    });

    // Don't show popup automatically - power users can find the bubble

    // Add clickable bubble
    addShortcutsBubble();

    // Handle screen size changes
    window.addEventListener('resize', () => {
      const bubble = document.getElementById('shortcuts-bubble');
      if (window.innerWidth <= 768 && bubble) {
        bubble.remove(); // Remove bubble on mobile
      } else if (window.innerWidth > 768 && !bubble) {
        addShortcutsBubble(); // Add bubble on desktop
      }
    });

    // Render shortcuts help
    renderShortcutsHelp();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShortcuts);
  } else {
    initShortcuts();
  }

  // Make functions globally available
  window.showShortcutsHelp = showShortcutsHelp;
  window.hideShortcuts = hideShortcuts;
  window.renderShortcutsHelp = renderShortcutsHelp;

})();
