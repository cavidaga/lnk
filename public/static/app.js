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

    const reliability = num(scores?.reliability?.value, 0);
    const polBias = bias(scores?.political_establishment_bias?.value);
    const socBias = bias(scores?.socio_cultural_bias?.value);

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
                ${metric('Etibarlılıq', reliability, '/100')}
                ${metric('Siyasi meyl', polBias, ' (Müxalif ⟷ Hökumətyönlü)')}
                ${metric('Sosial-mədəni meyl', socBias, '')}
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
              <h3 style="margin:0 0 8px">İstinad olunan mənbələr</h3>
              ${Array.isArray(cited_sources) && cited_sources.length ? tableSources(cited_sources) : `<div class="small muted">—</div>`}
            </div>
          </section>

          <section class="card" id="share-card">
            <div class="bd">
              <h3 style="margin:0 0 8px">Paylaş</h3>
              <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">
                <a id="btn-x"  class="btn" target="_blank" rel="noopener">X / Twitter</a>
                <a id="btn-fb" class="btn" target="_blank" rel="noopener">Facebook</a>
                <a id="btn-tg" class="btn" target="_blank" rel="noopener">Telegram</a>
                <a id="btn-wa" class="btn" target="_blank" rel="noopener">WhatsApp</a>
                <a id="btn-dl" class="btn" download>Şəkli endir (PNG)</a>
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

    set('btn-x',  `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent('LNK.az təhlili')}`);
    set('btn-fb', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`);
    set('btn-tg', `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent('LNK.az təhlili')}`);
    set('btn-wa', `https://api.whatsapp.com/send?text=${encodeURIComponent('LNK.az təhlili ' + pageUrl)}`);

    const dl = $('#btn-dl');
    if (dl) { dl.href = cardUrl; dl.download = `lnk-${hash}.png`; }
  }

  // ---------- HELPERS ----------
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

  async function safeJson(res) {
    try { return await res.json(); } catch { return {}; }
  }
})();
