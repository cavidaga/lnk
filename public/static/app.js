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
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = new FormData(form).get('url');
      if (!url) return;
      setSpinner(out || form);

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: String(url).trim() })
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.message || 'Təhlil zamanı xəta');

        const hash = json.hash || json?.meta?.hash;
        if (!hash) throw new Error('Hash tapılmadı');
        location.assign(`/analysis/${encodeURIComponent(hash)}`);
      } catch (err) {
        renderError(out || form, err.message || 'Xəta');
      }
    });
  }

  // ---------- ANALYSIS FLOW ----------
  async function initAnalysis(hash) {
    const container = ensureResult();
    container.classList.add('show');
    setSpinner(container);

    try {
      const data = await fetchAnalysis(hash);
      renderAnalysis(container, data);
      wireShare(hash);
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
  function renderAnalysis(root, data) {
    const { meta = {}, scores = {}, diagnostics = {}, cited_sources = [], human_summary = '' } = data || {};
    const title = meta.title || 'Başlıq yoxdur';
    const publication = meta.publication || '';
    const published_at = meta.published_at || '';
    const url = meta.original_url || '';

    const reliabilityNum = clamp(data?.scores?.reliability?.value ?? 0, 0, 100);
    const polBiasNum     = clamp(data?.scores?.political_establishment_bias?.value ?? 0, -5, 5);
    const socBiasNum     = clamp(data?.scores?.socio_cultural_bias?.value ?? 0, -5, 5);

    const leftPos = clamp(((polBiasNum + 5) / 10) * 100, 0, 100);     // -5..+5  →  0..100
    const topPos  = clamp(100 - reliabilityNum, 0, 100);              // 0..100  →  100..0

    root.innerHTML = `
      <article class="card">
        <div class="bd">
          <header style="margin-bottom:10px">
            <h1 style="margin:0 0 6px">${esc(title)}</h1>
            <div class="small muted">
              ${publication ? `<span>${esc(publication)}</span>` : ''}
              ${published_at ? ` • <time datetime="${esc(published_at)}">${esc(published_at)}</time>` : ''}
            </div>
            ${url ? `<div class="small" style="margin-top:6px;overflow-wrap:anywhere">
              Orijinal link: <a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>
            </div>` : ''}
          </header>

          <section class="card">
            <div class="bd">
              <div class="row" style="display:flex;gap:14px;flex-wrap:wrap">
                ${metric('Etibarlılıq', fmt100(reliabilityNum), '')}
                ${metric('Siyasi meyl', fmtBias(polBiasNum), ' (Müxalif ⟷ Hökumətyönlü)')}
                ${metric('Sosial-mədəni meyl', fmtBias(socBiasNum), '')}
              </div>
              <!-- Axis chart -->
              <div class="bias-chart" role="img" aria-label="Etibarlılıq və siyasi meyl qrafiki" style="margin-top:12px">
                <div class="chart-point" style="top:${topPos}%;left:${leftPos}%;"></div>
                <span class="axis-label y-axis-top">Etibarlı</span>
                <span class="axis-label y-axis-bottom">Etibarsız</span>
                <span class="axis-label x-axis-left">Müxalif</span>
                <span class="axis-label x-axis-right">Hökumətyönümlü</span>
              </div>

              <!-- Coordinate values -->
              <div class="coord-values small">
                Koordinatlar: Etibarlılıq <strong>${fmt100(reliabilityNum)}</strong> ·
                Siyasi meyl <strong>${fmtBias(polBiasNum)}</strong> ·
                Sosial-mədəni <strong>${fmtBias(socBiasNum)}</strong>
              </div>
              <div class="small muted" style="margin-top:8px">
                ✅ LNK tərəfindən təhlil edildi
              </div>
            </div>
          </section>

          <section class="card">
            <div class="bd">
              <h3 style="margin:0 0 8px">Xülasə</h3>
              <p style="margin:0;white-space:pre-wrap">${esc(human_summary || '—')}</p>
            </div>
          </section>
          <section class="card">
            <div class="bd">
              <h3 style="margin:0 0 8px">Əsas oxlar üzrə izah</h3>
              <dl class="explain">
                <dt>Etibarlılıq: <span class="value">${fmt100(reliabilityNum)}</span></dt>
                <dd>${esc(data?.scores?.reliability?.rationale || '—')}</dd>

                <dt>Siyasi hakimiyyət meyli: <span class="value">${fmtBias(polBiasNum)}</span></dt>
                <dd>${esc(data?.scores?.political_establishment_bias?.rationale || '—')}</dd>

                <dt>Sosial-mədəni meyl: <span class="value">${fmtBias(socBiasNum)}</span></dt>
                <dd>${esc(data?.scores?.socio_cultural_bias?.rationale || '—')}</dd>
              </dl>
            </div>
          </section>
          <section class="card">
            <div class="bd">
              <h3 style="margin:0 0 8px">Konkret dil siqnalları</h3>
              ${
                Array.isArray(data?.diagnostics?.language_flags) && data.diagnostics.language_flags.length
                ? `<ul class="flags">` + data.diagnostics.language_flags
                    .map(f => `<li><strong>${esc(f.term)}</strong>: ${esc(f.category)}</li>`)
                    .join('') + `</ul>`
                : `<div class="small muted">—</div>`
              }
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
                <summary>Xam JSON datanı göstər</summary>
                <pre class="json">${esc(JSON.stringify(data, null, 2))}</pre>
              </details>
            </div>
          </section>
    
          <section class="card" id="share-card">
            <div class="bd">
              <h3 style="margin:0 0 8px">Paylaş</h3>
              <div class="share-buttons">
                <!-- X / Twitter -->
                <a class="share-btn x"
                  href="https://x.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(title || '')}"
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
                    <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.784 1.764-1.75 1.764zm13.5 11.268h-3v-5.604c0-1.337-.027-3.06-1.865-3.06-1.868 0-2.155 1.459-2.155 2.965v5.699h-3v-10h2.881v1.367h.041c.402-.761 1.381-1.562 2.842-1.562 3.039 0 3.6 2.001 3.6 4.601v5.594z"/>
                  </svg>
                </a>

                <!-- Telegram -->
                <a class="share-btn tg"
                  href="https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(title || '')}"
                  target="_blank" rel="noopener" aria-label="Telegram-da paylaş">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M9.04 15.47 8.87 19c.36 0 .52-.16.7-.35l1.68-1.6 3.48 2.56c.64.35 1.1.17 1.28-.6l2.33-10.93c.24-1.1-.4-1.53-1.1-1.26L3.9 9.5C2.84 9.92 2.85 10.54 3.7 10.8l3.7 1.15 8.6-5.42c.4-.27.77-.12.47.15"/>
                  </svg>
                </a>

                <!-- WhatsApp -->
                <a class="share-btn wa"
                  href="https://wa.me/?text=${encodeURIComponent((title || '') + ' ' + window.location.href)}"
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

                <!-- Download image -->
                <a id="btn-dl" class="share-btn" download aria-label="Şəkli endir (PNG)">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M5 20h14v-2H5v2zm7-18L5.33 8h3.84v6h4.66V8h3.84L12 2z"/>
                  </svg>
                </a>
              </div>

              <div class="small muted" style="margin-top:8px">
                Məsləhət: Linklə yanaşı şəkli də paylaşın ki, önizləmə itəndə vizual qalsın.
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
        <table class="table">
          <thead><tr><th>Ad</th><th>Rol</th><th>Mövqe</th></tr></thead>
          <tbody>
          ${rows.map(s => `
            <tr>
              <td>${esc(s?.name || '—')}</td>
              <td>${esc(toAZRole(s?.role))}</td>
              <td>${esc(toAZStance(s?.stance))}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function metric(label, value, suffix = '') {
    const v = (value === null || value === undefined || value === '') ? '—' : value;
    return `
      <div class="stat" style="background:var(--card-bg,rgba(255,255,255,0.02));border:1px solid var(--border,#222);border-radius:12px;padding:10px 12px;min-width:210px">
        <div class="small muted">${esc(label)}</div>
        <div style="font-size:28px;font-weight:700;line-height:1">${esc(String(v))}${esc(suffix)}</div>
      </div>`;
  }

  // ---------- SHARE ----------
  function wireShare(hash) {
    const pageUrl = location.origin + `/analysis/${encodeURIComponent(hash)}`;
    const cardUrl = `${location.origin}/api/card?hash=${encodeURIComponent(hash)}&theme=dark`;

    const set = (id, href) => { const a = $(`#${id}`); if (a) a.href = href; };

    const dl = $('#btn-dl');
    if (dl) { dl.href = cardUrl; dl.download = `lnk-${hash}.png`; }
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
    el.innerHTML = `<div class="card"><div class="bd"><div class="small muted">Yüklənir…</div></div></div>`;
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
      btn.innerHTML = ok ? 'Kopyalandı' : 'Kopyalanmadı';
      setTimeout(() => {
        btn.innerHTML = old;
        btn.classList.remove('ok','err');
      }, 1400);
    });
  }

  async function safeJson(res) {
    try { return await res.json(); } catch { return {}; }
  }
})();
