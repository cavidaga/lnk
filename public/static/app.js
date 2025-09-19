// /static/app.js — robust bootstrap for home & analysis pages

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s = '') =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
             .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Show any runtime errors in the page as well as console
  window.addEventListener('error', (e) => showFatal(e.message || 'Script error'));
  window.addEventListener('unhandledrejection', (e) => showFatal((e.reason && e.reason.message) || 'Unhandled Promise rejection'));

  document.addEventListener('DOMContentLoaded', bootstrap);

  function bootstrap() {
    try {
      const hash =
        (typeof window !== 'undefined' && window.__LNK_HASH__) ||
        (location.pathname.startsWith('/analysis/') ? location.pathname.split('/').pop() : '');

      console.log('[app.js] boot; hash=', hash);

      if (hash) {
        initAnalysis(hash);
      } else {
        initHome();
      }
    } catch (err) {
      showFatal(err && err.message ? err.message : 'Boot error');
    }
  }

  // ---------- HOME FLOW ----------
  function initHome() {
    const form = $('#analyze-form');
    if (!form) return; // not on home

    const out = $('#result');
    let inFlight = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const url = formData.get('url');
      const modelType = formData.get('model-type') || 'auto';
      if (!url) return;
      if (inFlight) return;           // prevent double submits
      inFlight = true;
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn?.setAttribute('disabled','');
      submitBtn?.classList.add('busy');

      setSpinner(out || form);
      (out || form).classList.add('show');   // <-- make spinner visible
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: String(url).trim(),
            modelType: String(modelType)
          })
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          // Blocked-site special case (Cloudflare, etc.)
          if (json.isBlockError) {
            renderBlockError(out || form, { message: json.message, prompt: json.prompt, url });
            return;
          }
          throw new Error(json.message || 'Təhlil zamanı xəta baş verdi');
        }

        const hash = json.hash || json?.meta?.hash;
        if (!hash) throw new Error('Hash tapılmadı');
        
        
        // Refresh recent analyses and statistics before redirecting
        loadRecentAnalyses();
        loadStatistics();
        
        location.assign(`/analysis/${encodeURIComponent(hash)}`);
      } catch (err) {
        renderError(out || form, err.message || 'Xəta');
        } finally {
        inFlight = false;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn?.removeAttribute('disabled');
        submitBtn?.classList.remove('busy');
      }
    });

    // Load recent analyses and statistics
    loadRecentAnalyses();
    loadStatistics();
  }

  // ---------- RECENT ANALYSES ----------
  async function loadRecentAnalyses() {
    try {
      console.log('Loading recent analyses...');
      const res = await fetch('/api/recent-analyses');
      console.log('Recent analyses response:', res.status, res.ok);
      
      if (!res.ok) {
        console.error('Recent analyses API error:', res.status);
        return;
      }
      
      const analyses = await res.json();
      console.log('Recent analyses data:', analyses);
      
      if (analyses && analyses.length > 0) {
        renderRecentAnalyses(analyses);
      } else {
        console.log('No recent analyses found');
        // Show section even if empty for debugging
        const section = $('#recent-analyses');
        if (section) {
          section.style.display = 'block';
          const container = $('#recent-list');
          if (container) {
            container.innerHTML = '<div class="small muted">Hələ heç bir təhlil edilməyib.</div>';
          }
        }
      }
    } catch (e) {
      console.error('Failed to load recent analyses:', e);
    }
  }

  // ---------- STATISTICS ----------
  async function loadStatistics() {
    try {
      console.log('Loading statistics...');
      const res = await fetch('/api/statistics');
      console.log('Statistics response:', res.status, res.ok);
      
      if (!res.ok) {
        console.error('Statistics API error:', res.status);
        return;
      }
      
      const stats = await res.json();
      console.log('Statistics data:', stats);
      
      const totalElement = $('#total-analyses');
      const recentElement = $('#recent-analyses-count');
      
      if (totalElement && stats.total_analyses !== undefined) {
        // Format the number with thousands separator
        const formattedTotal = stats.total_analyses.toLocaleString('az-AZ');
        totalElement.textContent = formattedTotal;
        console.log('Updated total analyses display:', formattedTotal);
      }
      
      if (recentElement && stats.recent_analyses !== undefined) {
        // Format the number with thousands separator
        const formattedRecent = stats.recent_analyses.toLocaleString('az-AZ');
        recentElement.textContent = formattedRecent;
        console.log('Updated recent analyses display:', formattedRecent);
      }
    } catch (e) {
      console.error('Failed to load statistics:', e);
    }
  }

  // Helper functions for color classification
  function getReliabilityColorClass(score) {
    if (score >= 80) return 'reliability-excellent';
    if (score >= 60) return 'reliability-good';
    if (score >= 40) return 'reliability-fair';
    if (score >= 20) return 'reliability-poor';
    return 'reliability-very-poor';
  }

  function getBiasColorClass(score) {
    if (score >= 3) return 'bias-strong-pro';
    if (score >= 1) return 'bias-pro';
    if (score === 0) return 'bias-neutral';
    if (score >= -2) return 'bias-critical';
    return 'bias-strong-opposition';
  }

  function renderRecentAnalyses(analyses) {
    console.log('Rendering recent analyses:', analyses);
    const container = $('#recent-list');
    const section = $('#recent-analyses');
    
    console.log('Container found:', !!container);
    console.log('Section found:', !!section);
    
    if (!container || !section) {
      console.error('Missing container or section elements');
      return;
    }

    const html = analyses.map(analysis => {
      const title = esc(analysis.title || 'Başlıq yoxdur');
      const publication = esc(analysis.publication || '');
      const url = esc(analysis.url || '');
      const publishedAt = analysis.published_at ? formatAzDate(analysis.published_at) : '';
      const reliability = num(analysis.reliability, 0);
      const politicalBias = num(analysis.political_bias, 0);
      const analysisUrl = `/analysis/${encodeURIComponent(analysis.hash)}`;

      // Get color classes based on scores
      const reliabilityClass = getReliabilityColorClass(reliability);
      const biasClass = getBiasColorClass(politicalBias);

      return `
        <a href="${analysisUrl}" class="recent-item">
          <div class="recent-item-title">${title}</div>
          <div class="recent-item-meta">
            ${publication ? `<span>${publication}</span>` : ''}
            ${publishedAt ? `<span>•</span><span>${publishedAt}</span>` : ''}
          </div>
          <div class="recent-item-scores">
            <div class="score-item">
              <span>Etibarlılıq:</span>
              <span class="score-value reliability ${reliabilityClass}">${reliability}/100</span>
            </div>
            <div class="score-item">
              <span>Siyasi meyl:</span>
              <span class="score-value bias ${biasClass}">${bias(politicalBias)}</span>
            </div>
          </div>
          ${url ? `<div class="recent-item-url">${url}</div>` : ''}
        </a>
      `;
    }).join('');

    container.innerHTML = html;
    section.style.display = 'block';
    console.log('Recent analyses rendered, section shown');
  }

  // ---------- ANALYSIS FLOW ----------
  async function initAnalysis(hash) {
    const container = ensureResult();
    container.classList.add('show');
    setSpinner(container);

    try {
      const data = await fetchAnalysis(hash);
      renderAnalysis(container, data, hash);
      wireCopyButton(location.origin + `/analysis/${encodeURIComponent(hash)}`);
      
      
      document.title = `${data?.meta?.title ? data.meta.title + ' — ' : ''}LNK.az`;
    } catch (err) {
      renderError(container, err.message || 'Yüklənmə xətası');
    }
  }

  async function fetchAnalysis(hash) {
    // Try ?id= first
    let res = await fetch(`/api/get-analysis?id=${encodeURIComponent(hash)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) return res.json();

    // Fallback to ?hash=
    res = await fetch(`/api/get-analysis?hash=${encodeURIComponent(hash)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) return res.json();

    const a = await safeJson(res);
    throw new Error(a.message || `Nəticə tapılmadı (HTTP ${res.status})`);
  }

  // ---------- RENDERERS ----------
function renderAnalysis(root, data, hash) {
  const { meta = {}, scores = {}, diagnostics = {}, cited_sources = [], human_summary = '', warnings = [], is_advertisement = false, advertisement_reason = '' } = data || {};
  const title = meta.title || 'Başlıq yoxdur';
  

  // Numbers (with guards)
  const reliabilityNum = clamp(scores?.reliability?.value ?? 0, 0, 100);
  const polBiasNum     = clamp(scores?.political_establishment_bias?.value ?? 0, -5, 5);

  // Chart coordinates
  const leftPos = clamp(((polBiasNum + 5) / 10) * 100, 0, 100); // -5..+5 → 0..100
  const topPos  = clamp(100 - reliabilityNum, 0, 100);          // 0..100 → 100..0

  // Diagnostics (new schema)
  const socio = Array.isArray(diagnostics?.socio_cultural_descriptions) ? diagnostics.socio_cultural_descriptions : [];
  const flags = Array.isArray(diagnostics?.language_flags) ? diagnostics.language_flags : [];

  root.innerHTML = `
    ${headerBlock({
      title: meta.title || 'Məqalə',
      publication: meta.publication || (() => {
        try { return new URL(meta.original_url || '').hostname.replace(/^www\./,''); }
        catch { return ''; }
      })(),
      published_at: meta.published_at || '',
      url: meta.original_url || '',
      title_inferred: meta?.title_inferred || false,
      is_advertisement: is_advertisement,
      advertisement_reason: advertisement_reason
    })}
    
    ${warnings.length ? `
    <section class="card warnings-section" style="margin-bottom:16px">
      <div class="bd">
        <h3 style="margin:0 0 8px;color:var(--warning-color,#ff9800)">⚠️ Xəbərdarlıq</h3>
        <ul style="margin:0;padding-left:20px">
          ${warnings.map(warning => `
            <li class="warning-item" style="margin-bottom:8px">
              <strong>${esc(warning.type === 'content_blocked' ? 'Mənbə bloklanıb' : 
                        warning.type === 'archived_content' ? 'Arxiv məlumatı' : 
                        warning.type === 'limited_content' ? 'Məhdud məzmun' : 'Xəbərdarlıq')}:</strong>
              ${esc(warning.message || '')}
            </li>
          `).join('')}
        </ul>
      </div>
    </section>
    ` : ''}
    
    <article class="card">
      <div class="bd">

        <section class="card">
          <div class="bd">
            <div class="row" style="display:flex;gap:14px;flex-wrap:wrap">
              ${metric('Etibarlılıq', fmt100(reliabilityNum), '')}
              ${metric('Siyasi hakimiyyət meyli', fmtBias(polBiasNum), '')}
            </div>

            <!-- Axis chart -->
            <div class="bias-chart" role="img" aria-label="Etibarlılıq və siyasi hakimiyyət meyli qrafiki" style="margin-top:12px">
              <div class="chart-point" style="top:${topPos}%;left:${leftPos}%;"></div>
              <span class="axis-label y-axis-top">Etibarlı</span>
              <span class="axis-label y-axis-bottom">Etibarsız</span>
              <span class="axis-label x-axis-left">Müxalif</span>
              <span class="axis-label x-axis-right">İqtidar</span>
            </div>

            <!-- Coordinate values -->
            <div class="coord-values small">
              Koordinatlar: Etibarlılıq <strong>${fmt100(reliabilityNum)}</strong> ·
              Siyasi hakimiyyət meyli <strong>${fmtBias(polBiasNum)}</strong>
            </div>
            <div class="small muted" style="margin-top:8px">
              ✅ LNK tərəfindən təhlil edildi
            </div>
          </div>
        </section>

        <section class="card summary-section">
          <div class="bd">
            <h3 style="margin:0 0 8px">Xülasə</h3>
            <p style="margin:0;white-space:pre-wrap">${esc(human_summary || '—')}</p>
          </div>
        </section>

        <!-- New diagnostics layout -->
        <section class="card">
          <div class="bd">
            <h3 style="margin:0 0 8px">Diaqnostika</h3>

            <h4 class="micro" style="margin:0 0 6px">Sosial-mədəni təsvirlər</h4>
            ${
              socio.length
              ? `<ul class="socio-list">${
                  socio.map(it => {
                    const stance = it?.stance || '';
                    const stanceClass = stance.toLowerCase().includes('müsbət') ? 'stance-positive' : 
                                       stance.toLowerCase().includes('mənfi') ? 'stance-negative' : 
                                       stance.toLowerCase().includes('neytral') ? 'stance-neutral' : '';
                    return `
                    <li class="${stanceClass}">
                      <div><strong>${esc(it.group || '—')}</strong> — ${esc(it.stance || '—')}</div>
                      ${it.rationale ? `<div class="small muted anywrap">${esc(it.rationale)}</div>` : ''}
                    </li>`;
                  }).join('')
                }</ul>`
              : `<div class="small muted">—</div>`
            }

            <h4 class="micro" style="margin:12px 0 6px">Dil siqnalları</h4>
            ${
              flags.length
              ? `<ul class="flags">${
                  flags.map(f => `
                    <li>
                      <strong>${esc(f.term || '—')}</strong>: ${esc(f.category || '—')}
                      ${f.evidence ? `<div class="small muted anywrap" style="margin-top:2px">${esc(f.evidence)}</div>` : ''}
                    </li>
                  `).join('')
                }</ul>`
              : `<div class="small muted">—</div>`
            }
          </div>
        </section>

        <section class="card">
          <div class="bd">
            <h3 style="margin:0 0 8px">Koordinatlar üzrə izah</h3>
            <dl class="explain">
              <dt>Etibarlılıq: <span class="value">${fmt100(reliabilityNum)}</span></dt>
              <dd>${esc(scores?.reliability?.rationale || '—')}</dd>

              <dt>Siyasi hakimiyyət meyli: <span class="value">${fmtBias(polBiasNum)}</span></dt>
              <dd>${esc(scores?.political_establishment_bias?.rationale || '—')}</dd>
            </dl>
          </div>
        </section>

        <section class="card">
          <div class="bd">
            <h3 style="margin:0 0 8px">İstinad olunan mənbələr</h3>
            ${Array.isArray(cited_sources) && cited_sources.length ? tableSources(cited_sources) : `<div class="small muted">—</div>`}
          </div>
        </section>

        <section class="card">
          <div class="bd">
            <details>
              <summary class="json-summary">
                <span>Xam JSON datanı göstər</span>
                <button class="copy-json-btn" onclick="copyJsonData()">
                  📋 Kopyala
                </button>
              </summary>
              <pre class="json">${esc(JSON.stringify(data, null, 2))}</pre>
            </details>
          </div>
        </section>

        <section class="card" id="complaint-card">
          <div class="bd">
            <h3 style="margin:0 0 8px">Analizdə problem tapmısınız?</h3>
            <p style="margin:0 0 12px;color:var(--muted);font-size:14px">
              Əgər analizimizdə səhv tapmısınızsa və ya təklifiniz varsa, lütfən bizə bildirin.
            </p>
            <button class="btn" onclick="window.open('/complaint.html?analysis_url=${encodeURIComponent(window.location.href)}', '_blank')" style="display:inline-flex;align-items:center;gap:6px">
              👎 Şikayət et
            </button>
          </div>
        </section>

        <section class="card" id="share-card">
          <div class="bd">
            <h3 style="margin:0 0 8px">Paylaş</h3>
            <div class="share-buttons">
              <!-- X / Twitter -->
              <a class="share-btn x"
                href="https://x.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Yeni analiz: ' + (title || '') + ' via @lnk_az')}"
                target="_blank" rel="noopener" aria-label="X-də paylaş">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M18.244 2H21l-6.59 7.523L22 22h-6.828l-5.34-6.508L3.338 22H1l7.093-8.106L2 2h6.828l4.89 5.972L18.244 2Zm-2.393 18h1.89L7.247 3.98H5.27L15.85 20Z"/>
                </svg>
              </a>

              <!-- Facebook -->
              <a class="share-btn fb"
                href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}"
                target="_blank" rel="noopener" aria-label="Facebook-da paylaş">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 5 3.657 9.127 8.438 9.878v-6.988h-2.54v-2.89h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.242 0-1.63.771-1.63 1.562v1.875h2.773l-.443 2.89h-2.33v6.988C18.343 21.127 22 17 22 12z"/>
                </svg>
              </a>

              <!-- LinkedIn -->
              <a class="share-btn li"
                href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}"
                target="_blank" rel="noopener" aria-label="LinkedIn-də paylaş">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5zm-11 19h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.784 1.764-1.75 1.764zm13.5 11.268h-3v-5.604c0-1.337-.027-3.06-1.865-3.06-1.868 0-2.155 1.459-2.155 2.965v5.699h-3v-10h2.881v1.367h.041c.402-.761 1.381-1.562 2.842-1.562 3.039 0 3.6 2.001 3.6 4.601v5.594z"/>
                </svg>
              </a>

              <!-- Telegram -->
              <a class="share-btn tg"
                href="https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Yeni analiz: ' + (title || ''))}"
                target="_blank" rel="noopener" aria-label="Telegram-da paylaş">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M9.04 15.47 8.87 19c.36 0 .52-.16.7-.35l1.68-1.6 3.48 2.56c.64.35 1.1.17 1.28-.6l2.33-10.93c.24-1.1-.4-1.53-1.1-1.26L3.9 9.5C2.84 9.92 2.85 10.54 3.7 10.8l3.7 1.15 8.6-5.42c.4-.27.77-.12.47.15"/>
                </svg>
              </a>

              <!-- WhatsApp -->
              <a class="share-btn wa"
                href="https://wa.me/?text=${encodeURIComponent(('Yeni analiz: ' + (title || '')) + ' ' + window.location.href)}"
                target="_blank" rel="noopener" aria-label="WhatsApp-da paylaş">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M20.52 3.48A11.86 11.86 0 0 0 12.03 0C5.46 0 .11 5.35.11 11.92c0 2.1.55 4.16 1.6 5.97L0 24l6.28-1.65a11.86 11.86 0 0 0 5.75 1.47h.01c6.57 0 11.92-5.35 11.92-11.92 0-3.18-1.24-6.18-3.44-8.39zM12.04 21.3h-.01a9.38 9.38 0 0 1-4.78-1.31l-.34-.2-3.73.98 1-3.64-.22-.37a9.38 9.38 0 0 1-1.43-4.97c0-5.17 4.21-9.38 9.39-9.38 2.5 0 4.85.97 6.62 2.74a9.32 9.32 0 0 1 2.75 6.64c0 5.17-4.21 9.38-9.39 9.38zm5.45-7.04c-.3-.15-1.78-.88-2.06-.98-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.08-.79.38-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.2 3.06.15.2 2.09 3.2 5.06 4.48.71.31 1.27.5 1.7.64.71.22 1.36.19 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.07-.13-.27-.2-.57-.35z"/>
                </svg>
              </a>

              <!-- Copy link -->
              <button class="share-btn copy" id="copy-link" aria-label="Keçidi kopyala">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 18H8V7h11v16z"/>
                </svg>
              </button>
            </div>
          </div>
        </section>
      </div>
    </article>
  `;
}

  function tableSources(rows) {
    return `
      <div class="table-wrap" style="overflow:auto">
        <table class="sources-table">
          <thead><tr><th>Ad</th><th>Rol</th><th>Mövqe</th></tr></thead>
          <tbody>
          ${rows.map(s => {
            const stance = s?.stance || '';
            const stanceClass = stance.toLowerCase().includes('müsbət') ? 'stance-positive' : 
                               stance.toLowerCase().includes('mənfi') ? 'stance-negative' : 
                               stance.toLowerCase().includes('neytral') ? 'stance-neutral' : '';
            return `
            <tr class="${stanceClass}">
              <td>${esc(s?.name || '—')}</td>
              <td>${esc(toAZRole(s?.role))}</td>
              <td>${esc(toAZStance(s?.stance))}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function metric(label, value, suffix = '') {
    const v = (value === null || value === undefined || value === '') ? '—' : value;
    
    // Determine background color based on label
    let bgColor, borderColor;
    if (label.includes('Etibarlılıq')) {
      bgColor = 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))';
      borderColor = 'rgba(16, 185, 129, 0.3)';
    } else if (label.includes('Siyasi')) {
      bgColor = 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(185, 28, 28, 0.05))';
      borderColor = 'rgba(239, 68, 68, 0.3)';
    } else {
      bgColor = 'var(--card-bg,rgba(255,255,255,0.02))';
      borderColor = 'var(--border,#222)';
    }
    
    return `
      <div class="stat" style="
        background: ${bgColor};
        border: 1px solid ${borderColor};
        border-radius: 12px;
        padding: 16px;
        min-width: 0;
        flex: 1;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        text-align: center;
      ">
        <div class="small muted" style="margin-bottom: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">${esc(label)}</div>
        <div style="font-size: 28px; font-weight: 700; line-height: 1; color: var(--text);">${esc(String(v))}${esc(suffix)}</div>
      </div>`;
  }



  // ---------- SHARE ----------
  function wireShare(hash) {
    const pageUrl = location.origin + `/analysis/${encodeURIComponent(hash)}`;

    const dl = $('#btn-dl');
    if (dl) {
      dl.addEventListener('click', (e) => {
        try {
          e.preventDefault();
          const data = (window && window.__LNK_DATA__) || {};
          const href = generatePngFromData(data);
          if (href) {
            dl.href = href;
            dl.download = `lnk-${hash}.png`;
            // trigger download
            setTimeout(() => dl.click(), 0);
          }
        } catch (err) {
          // fallback to static image
          dl.href = `${location.origin}/static/og-cover.png`;
          dl.download = `lnk-${hash}.png`;
        }
      });
    }
  }

  function generatePngFromData(data){
    try{
      const title = String(data?.meta?.title || data?.title || 'Analiz');
      const rel = clamp(Number(data?.scores?.reliability?.value ?? data?.reliability ?? 0), 0, 100);
      const pol = clamp(Number(data?.scores?.political_establishment_bias?.value ?? data?.political_establishment_bias ?? 0), -5, 5);
      const summary = String(data?.human_summary || data?.summary || '');

      const W = 1200, H = 630;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      // theme
      const bg = '#0B0E14', text = '#E5E7EB', sub = '#9CA3AF', cardBg = '#121622', cardBorder = '#1F2433', axis = '#2A3146', dot = '#EF4444';

      // background
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

      // title
      ctx.fillStyle = text; ctx.font = '800 56px Poppins, Inter, ui-sans-serif';
      wrapText(ctx, title, 40, 120, 680, 60);

      // metrics boxes
      drawMetricBox(ctx, cardBg, cardBorder, sub, text, 'Etibarlılıq', `${rel}/100`, 40, 160, 320, 110);
      drawMetricBox(ctx, cardBg, cardBorder, sub, text, 'Siyasi hakimiyyət meyli', (pol>0?`+${pol}`:`${pol}`), 380, 160, 320, 110);

      // summary
      ctx.fillStyle = sub; ctx.font = '22px Poppins, Inter, ui-sans-serif';
      wrapText(ctx, summary, 40, 320, 660, 32, 4);

      // right panel chart
      drawChart(ctx, {x: 760, y: 40, w: 400, h: 550}, cardBg, cardBorder, axis, dot, rel, pol);

      // watermark
      ctx.fillStyle = 'rgba(156,163,175,.7)';
      ctx.font = '700 18px Inter, ui-sans-serif';
      ctx.fillText('lnk.az', W - 120, H - 24);

      return canvas.toDataURL('image/png');
    } catch(e){ return ''; }
  }

  function drawMetricBox(ctx, cardBg, cardBorder, sub, text, label, value, x, y, w, h){
    ctx.fillStyle = cardBg; ctx.strokeStyle = cardBorder; ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 16, true, true);
    ctx.fillStyle = sub; ctx.font = '16px Poppins, Inter, ui-sans-serif'; ctx.fillText(label, x+16, y+34);
    ctx.fillStyle = text; ctx.font = '800 44px Poppins, Inter, ui-sans-serif'; ctx.fillText(value, x+16, y+88);
  }

  function drawChart(ctx, rect, cardBg, cardBorder, axis, dotColor, rel, pol){
    const {x,y,w,h} = rect;
    // panel
    ctx.fillStyle = cardBg; ctx.strokeStyle = cardBorder; ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 20, true, true);
    // quad area
    const pad = 24; const qx = x+pad, qy = y+pad, qw = w-2*pad, qh = h-2*pad;
    ctx.strokeStyle = axis; ctx.lineWidth = 1;
    // border
    roundRect(ctx, qx, qy, qw, qh, 14, false, true);
    // axes
    ctx.beginPath(); ctx.moveTo(qx, qy+qh/2); ctx.lineTo(qx+qw, qy+qh/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(qx+qw/2, qy); ctx.lineTo(qx+qw/2, qy+qh); ctx.stroke();
    // dot
    const cx = qx + ((pol + 5) / 10) * qw;
    const cy = qy + (1 - (rel/100)) * qh;
    ctx.fillStyle = dotColor; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI*2); ctx.fill();
    // labels
    ctx.fillStyle = '#9CA3AF'; ctx.font = '16px Inter, ui-sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('Etibarlı', qx+qw/2, qy+16);
    ctx.fillText('Etibarsız', qx+qw/2, qy+qh-6);
    ctx.textAlign = 'left'; ctx.fillText('Müxalif', qx+6, qy+qh/2+6);
    ctx.textAlign = 'right'; ctx.fillText('İqtidar', qx+qw-6, qy+qh/2+6);
    ctx.textAlign = 'left';
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
    const words = String(text||'').split(/\s+/);
    let line = '', lines = 0;
    for (let n = 0; n < words.length; n++) {
      const test = line ? line + ' ' + words[n] : words[n];
      const m = ctx.measureText(test);
      if (m.width > maxWidth && n>0) {
        ctx.fillText(line, x, y); y += lineHeight; lines += 1; line = words[n];
        if (maxLines && lines >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (!maxLines || (maxLines && lines < maxLines)) ctx.fillText(line, x, y);
  }

  // ---------- HELPERS ----------
  function clamp(n, min, max){ n = Number(n); if(!Number.isFinite(n)) n = 0; return Math.min(max, Math.max(min, n)); }
  function fmt100(v){ v = Number(v); return Number.isFinite(v) ? `${v}/100` : 'N/A'; }
  function fmtBias(v){ v = Number(v); if(!Number.isFinite(v)) v = 0; return (v>0? '+' : '') + v; }

  function ensureResult() {
    let el = $('#result');
    if (!el) {
      const main = $('#main') || document.body;
      el = document.createElement('section');
      el.id = 'result';
      main.appendChild(el);
    }
    return el;
  }

  function setSpinner(el) {
    if (!el) return;
    el.innerHTML = `<div class="card"><div class="bd"><div class="small muted">Təhlil aparılır… Gözləyin.</div></div></div>`;
  }

  function renderError(where, msg) {
    if (where) where.classList.add('show');
    const html = `<div class="card"><div class="bd"><strong>Xəta:</strong> ${esc(msg)}</div></div>`;
    if (where) where.innerHTML = html;
    else showFatal(msg);
  }

  function showFatal(msg) {
    console.error('[app.js error]', msg);
    const box = ensureResult();
    box.innerHTML = `<div class="card"><div class="bd"><strong>Xəta:</strong> ${esc(msg)}</div></div>`;
  }

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

  function toAZRole(role = '') {
    const r = String(role).toLowerCase();
    if (r.includes('news outlet') || r.includes('newsroom') || r.includes('media')) return 'Media qurumu';
    if (r.includes('academic')) return 'Akademik';
    if (r.includes('military theorist') || r.includes('theorist')) return 'Hərb nəzəriyyəçisi';
    if (r.includes('government') || r.includes('official')) return 'Rəsmi qurum';
    if (r.includes('ngo')) return 'QHT';
    return role || '—';
  }

  function toAZStance(stance = '') {
    const s = String(stance).toLowerCase();
    if (s.includes('factual')) return 'Fakt yönümlü';
    if (s.includes('neutral')) return 'Neytral';
    if (s.includes('critical')) return 'Tənqidi';
    if (s.includes('supportive') || s.includes('pro-')) return 'Dəstəkləyən';
    return stance || '—';
  }

  async function copyText(text){
  // modern API
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  // fallback for non-secure or denied clipboard
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

  function wireCopyButton(hrefToCopy){
    const btn = document.getElementById('copy-link');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const ok = await copyText(hrefToCopy);
      const old = btn.innerHTML;
      btn.classList.add(ok ? 'ok' : 'err');
      btn.setAttribute('aria-live','polite');
      btn.innerHTML = ok ? '✅' : '❎';
      setTimeout(() => {
        btn.innerHTML = old;
        btn.classList.remove('ok','err');
      }, 1400);
    });
  }

  const AZ_MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
  function formatAzDate(dateLike){
    if (!dateLike) return '';
    const d = new Date(dateLike);
    if (isNaN(d)) return String(dateLike);
    const base = `${AZ_MONTHS[d.getMonth()]} ${d.getDate()}`;
    return `${base}, ${d.getFullYear()}`;
  }


function headerBlock({ title, publication, published_at, url, title_inferred, is_advertisement, advertisement_reason }){
  return `
    <header class="hdr">
      <div class="kv">
        <div class="item">
          <div class="k">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            Başlıq
          </div>
          <div class="v">${esc(title || '—')}</div>
        </div>
        <div class="item">
          <div class="k">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M8 12h8"></path>
              <path d="M12 8v8"></path>
            </svg>
            İstinad
          </div>
          <div class="v">${esc(publication || '—')}</div>
        </div>
        <div class="item">
          <div class="k">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Tarix
          </div>
          <div class="v">${esc(formatAzDate(published_at) || '—')}</div>
        </div>
        <div class="item buttons">
          ${url ? `
          <a href="${esc(url)}" target="_blank" rel="noopener" class="action-btn original-link-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15,3 21,3 21,9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Orijinalı oxu
          </a>
          ` : ''}
          <button class="action-btn summary-btn" onclick="document.querySelector('.summary-section')?.scrollIntoView({behavior: 'smooth'})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            Xülasəyə keç
          </button>
        </div>
      </div>
      ${is_advertisement ? `
      <div class="advertisement-label">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
        </svg>
        <span>REKLAM XARAKTERLİ</span>
        <button class="complaint-btn" onclick="window.open('/complaint.html?analysis_url=' + encodeURIComponent(window.location.href), '_blank')" title="Şikayət et">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4"></path>
            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.5 0 2.91.37 4.15 1.02"></path>
          </svg>
        </button>
      </div>
      ${advertisement_reason ? `<div class="micro muted" style="margin-top:6px;color:var(--muted);font-size:12px;">${esc(advertisement_reason)}</div>` : ''}
      ` : ''}
      ${title_inferred ? `<div class="micro muted" style="margin-top:6px">Qeyd: Yazıda başlıq yoxdursa avtomatik yaradılır.</div>` : ''}
    </header>
  `;
}

  async function safeJson(res) {
    try { return await res.json(); } catch { return {}; }
  }

  // Copy JSON data to clipboard
  window.copyJsonData = function() {
    try {
      const hash = window.__LNK_HASH__ || (location.pathname.startsWith('/analysis/') ? location.pathname.split('/').pop() : '');
      if (!hash) {
        alert('JSON məlumatı tapılmadı');
        return;
      }

      // Get the current analysis data from the page
      const jsonPre = document.querySelector('.json');
      if (!jsonPre) {
        alert('JSON məlumatı tapılmadı');
        return;
      }

      const jsonText = jsonPre.textContent;
      
      // Copy to clipboard
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(jsonText).then(() => {
          showCopySuccess();
        }).catch(() => {
          fallbackCopyTextToClipboard(jsonText);
        });
      } else {
        fallbackCopyTextToClipboard(jsonText);
      }
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Kopyalama uğursuz oldu');
    }
  };

  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showCopySuccess();
      } else {
        alert('Kopyalama uğursuz oldu');
      }
    } catch (err) {
      alert('Kopyalama uğursuz oldu');
    }
    
    document.body.removeChild(textArea);
  }

  function showCopySuccess() {
    const button = document.querySelector('.copy-json-btn');
    if (button) {
      const originalText = button.textContent;
      button.textContent = '✅ Kopyalandı!';
      button.style.background = '#28a745';
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = 'var(--accent)';
      }, 2000);
    }
  }

})();
