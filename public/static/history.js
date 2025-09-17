// /static/history.js — Analysis history management

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s = '') =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
             .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  document.addEventListener('DOMContentLoaded', initHistory);

  function initHistory() {
    console.log('History page initialized');
    loadHistory();
    wireClearButton();
  }

  // ---------- HISTORY STORAGE ----------
  function getHistory() {
    try {
      const stored = localStorage.getItem('lnk_analysis_history');
      console.log('Stored history data:', stored);
      const history = JSON.parse(stored || '[]');
      console.log('Parsed history:', history);
      return history;
    } catch (e) {
      console.error('Failed to load history:', e);
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem('lnk_analysis_history', JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  function clearHistory() {
    try {
      localStorage.removeItem('lnk_analysis_history');
      return true;
    } catch (e) {
      console.error('Failed to clear history:', e);
      return false;
    }
  }

  // ---------- HISTORY DISPLAY ----------
  function loadHistory() {
    const history = getHistory();
    const loadingEl = $('#history-loading');
    const emptyEl = $('#history-empty');
    const listEl = $('#history-list');
    const actionsEl = $('#history-actions');
    const countEl = $('#history-count');

    // Show loading state
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (listEl) listEl.style.display = 'none';
    if (actionsEl) actionsEl.style.display = 'none';

    setTimeout(() => {
      // Hide loading
      if (loadingEl) loadingEl.style.display = 'none';

      if (history.length === 0) {
        // Show empty state
        if (emptyEl) emptyEl.style.display = 'block';
        console.log('History is empty, showing empty state');
        return;
      }

      // Show history
      renderHistory(history);
      if (listEl) listEl.style.display = 'block';
      if (actionsEl) actionsEl.style.display = 'block';
      if (countEl) countEl.textContent = `${history.length} analiz`;
      console.log('History loaded:', history.length, 'items');
    }, 300);
  }

  function renderHistory(history) {
    const listEl = $('#history-list');
    
    const html = history.map(item => {
      const title = esc(item.title || 'Başlıq yoxdur');
      const publication = esc(item.publication || '');
      const url = esc(item.url || '');
      const date = formatAzDate(item.timestamp);
      const reliability = num(item.reliability, 0);
      const politicalBias = num(item.politicalBias, 0);
      const analysisUrl = `/analysis/${encodeURIComponent(item.hash)}`;

      return `
        <a href="${analysisUrl}" class="history-item">
          <div class="history-item-header">
            <div class="history-item-title">${title}</div>
            <div class="history-item-date">${date}</div>
          </div>
          <div class="history-item-meta">
            ${publication ? `<span>${publication}</span>` : ''}
            ${url ? `<span>•</span><span class="history-item-url">${url}</span>` : ''}
          </div>
          <div class="history-item-scores">
            <div class="score-item">
              <span>Etibarlılıq:</span>
              <span class="score-value reliability">${reliability}/100</span>
            </div>
            <div class="score-item">
              <span>Siyasi meyl:</span>
              <span class="score-value bias">${bias(politicalBias)}</span>
            </div>
          </div>
        </a>
      `;
    }).join('');

    listEl.innerHTML = html;
  }

  // ---------- CLEAR HISTORY ----------
  function wireClearButton() {
    const clearBtn = $('#clear-history');
    if (!clearBtn) return;

    clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (confirm('Tarixçəni təmizləmək istədiyinizə əminsiniz? Bu əməliyyat geri alına bilməz.')) {
        if (clearHistory()) {
          loadHistory();
        } else {
          alert('Tarixçə təmizlənərkən xəta baş verdi.');
        }
      }
    });
  }

  // ---------- UTILITY FUNCTIONS ----------
  function num(x, def = 0) {
    const n = Number(x);
    if (!isFinite(n)) return def;
    return Math.round(n);
  }

  function bias(v) {
    const n = Number(v);
    if (!isFinite(n)) return '0.0';
    return (n > 0 ? '+' : n < 0 ? '' : '') + n.toFixed(1);
  }

  const AZ_MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
  function formatAzDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    if (isNaN(d)) return '';
    
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Bu gün';
    } else if (diffDays === 1) {
      return 'Dünən';
    } else if (diffDays < 7) {
      return `${diffDays} gün əvvəl`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} həftə əvvəl`;
    } else {
      const base = `${AZ_MONTHS[d.getMonth()]} ${d.getDate()}`;
      return d.getFullYear() === now.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
    }
  }

  // ---------- GLOBAL FUNCTIONS (for use by app.js) ----------
  window.LNKHistory = {
    addAnalysis: function(analysisData) {
      const history = getHistory();
      
      // Remove if already exists (update)
      const filtered = history.filter(item => item.hash !== analysisData.hash);
      
      // Add to beginning
      filtered.unshift({
        hash: analysisData.hash,
        title: analysisData.meta?.title || 'Başlıq yoxdur',
        url: analysisData.meta?.original_url || '',
        publication: analysisData.meta?.publication || '',
        reliability: analysisData.scores?.reliability?.value || 0,
        politicalBias: analysisData.scores?.political_establishment_bias?.value || 0,
        timestamp: Date.now()
      });
      
      // Keep only last 50
      if (filtered.length > 50) filtered.splice(50);
      
      saveHistory(filtered);
    },
    
    getHistory: getHistory,
    clearHistory: clearHistory
  };
})();
