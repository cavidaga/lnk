// /static/app.js
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const escapeHTML = (s = '') =>
    String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---- Route helpers ----
  const HASH =
    (typeof window !== 'undefined' && window.__LNK_HASH__) ||
    (location.pathname.startsWith('/analysis/') ? location.pathname.split('/').pop() : null);

  const isAnalysisPage = !!HASH;

  // ---- Home page: handle form submit -> POST /api/analyze -> redirect /analysis/<hash> ----
  function initHome() {
    const form = $('#analyze-form'); // expects <form id="analyze-form"> with <input name="url">
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const url = (fd.get('url') || '').toString().trim();
      const out = $('#result'); // optional: a result container on home
      if (!url) return;
      setLoading(true, form, out);

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.message || 'Təhlil alınmadı');
        }
        // server returns { hash, ... }
        const hash = json.hash || json?.meta?.hash || '';
        if (!hash) throw new Error('Hash tapılmadı');
        location.assign(`/analysis/${encodeURIComponent(hash)}`);
      } catch (err) {
        showError(err.message || 'Təhlil zamanı xəta baş verdi.', out || form);
      } finally {
        setLoading(false, form, out);
      }
    });
  }

  // ---- Analysis page: fetch & render by hash via /api/get-analysis?hash=... ----
  async function initAnalysis() {
    const container = $('#result') || createResult();
    if (!HASH) return;

    setSpinner(container);

    try {
      const res = await fetch(`/api/get-analysis?id=${encodeURIComponent(HASH)}`, {
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || 'Nəticə tapılmadı.');
      }

      renderAnalysis(container, data);
      wireShare(HASH);
      document.title = `${data?.meta?.title ? data.meta.title + ' — ' : ''}LNK.az`;
    } catch (err) {
      container.innerHTML = `<div class="card"><div class="bd">
        <strong>Xəta:</strong> ${escapeHTML(err.message || 'Yüklənmə xətası')}
      </div></div>`;
    }
  }

  // ---- Rendering ----
  function renderAnalysis(root, data) {
    const { meta = {}, scores = {}, diagnostics = {}, cited_sources = [], human_summary = '' } = data || {};
    const title = meta.title || 'Başlıq yoxdur';
    const publication = meta.publication || '';
    const published_at = meta.published_at || '';
    const url = meta.original_url || '';

    const reliability = toInt(scores?.reliability?.value, 0);
    const polBias = fmtBias(scores?.political_establishment_bias?.value);
    const socBias = fmtBias(scores?.socio_cultural_bias?.value);

    const langLoad = toInt(diagnostics?.language_loadedness, 0);
    const sourceTrans = toInt(diagnostics?.sourcing_transparency, 0);
    const headlineAcc = toInt(diagnostics?.headline_accuracy, 0);
    const flags = Array.isArray(diagnostics?.language_flags) ? diagnostics.language_flags : [];

    root.innerHTML = `
      <article class="card">
        <div class="bd">
          <header style="margin-bottom:10px">
            <h1 style="margin:0 0 6px">${escapeHTML(title)}</h1>
            <div class="small muted">
              ${publication ? `<span>${escapeHTML(publication)}</span>` : ''}
              ${published_at ? ` • <time datetime="${escapeHTML(published_at)}">${escapeHTML(published_at)}</time>` : ''}
            </div>
            ${url ? `<div class="small" style="margin-top:6px;overflow-wrap:anywhere">
              Orijinal link: <a href="${escapeHTML(url)}" rel="noopener" target="_blank">${escapeHTML(url)}</a>
            </div>` : ''}
          </header>

          <div class="grid" style="display:grid;grid-template-columns:1fr;gap:12px">
            <section class="card">
              <div class="bd">
                <div class="row" style="display:flex;gap:14px;flex-wrap:wrap">
                  ${metric('Etibarlılıq', reliability, '/100')}
                  ${metric('Siyasi quruluşa meyl', polBias, ' (Müxalif ⟷ Hökumətyönlü)')}
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
                <p style="margin:0;white-space:pre-wrap">${escapeHTML(human_summary || '—')}</p>
              </div>
            </section>

            <section class="card">
              <div class="bd">
                <h3 style="margin:0 0 8px">Diaqnostika</h3>
                <div class="row" style="display:flex;gap:14px;flex-wrap:wrap">
                  ${metric('Yüklənmiş dil', langLoad, '/100')}
                  ${metric('Mənbə şəffaflığı', sourceTrans, '/100')}
                  ${metric('Başlıq dəqiqliyi', headlineAcc, '/100')}
                </div>
                ${flags.length ? `
                  <div class="small muted" style="margin-top:10px">Dil siqnalları:</div>
                  <ul style="margin:6px 0 0;padding-left:18px">
                    ${flags.map(f => `<li>${escapeHTML(f.term)} — <em>${escapeHTML(f.category)}</em></li>`).join('')}
                  </ul>` : ''}
              </div>
            </section>

            <section class="card">
              <div class="bd">
                <h3 style="margin:0 0 8px">İstinad olunan mənbələr</h3>
                ${cited_sources && cited_sources.length ? `
                  <div class="table-wrap" style="overflow:auto">
                    <table class="table">
                      <thead>
                        <tr><th>Ad</th><th>Rol</th><th>Mövqe</th></tr>
                      </thead>
                      <tbody>
                        ${cited_sources.map(s => `
                          <tr>
                            <td>${escapeHTML(s.name || '—')}</td>
                            <td>${escapeHTML(toAZRole(s.role))}</td>
                            <td>${escapeHTML(toAZStance(s.stance))}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                ` : `<div class="small muted">—</div>`}
              </div>
            </section>

            <section class="card" id="share-card">
              <div class="bd">
                <h3 style="margin:0 0 8px">Paylaş</h3>
                <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">
                  <a id="btn-x" class="btn" rel="noopener" target="_blank">X / Twitter</a>
                  <a id="btn-fb" class="btn" rel="noopener" target="_blank">Facebook</a>
                  <a id="btn-tg" class="btn" rel="noopener" target="_blank">Telegram</a>
                  <a id="btn-wa" class="btn" rel="noopener" target="_blank">WhatsApp</a>
                  <a id="btn-dl" class="btn" rel="noopener">Şəkli endir (PNG)</a>
                </div>
                <div class="small muted" style="margin-top:8px">
                  Məsləhət: Linklə yanaşı şəkli də paylaşın ki, önizləmə itəndə vizual qalsın.
                </div>
              </div>
            </section>
          </div>
        </div>
      </article>
    `;
  }

  function metric(label, value, suffix = '') {
    const v = (value === null || value === undefined || value === '') ? '—' : value;
    return `
      <div class="stat" style="background:var(--card-bg,rgba(255,255,255,0.02));border:1px solid var(--border,#222);border-radius:12px;padding:10px 12px;min-width:210px">
        <div class="small muted">${escapeHTML(label)}</div>
        <div style="font-size:28px;font-weight:700;line-height:1">${escapeHTML(String(v))}${escapeHTML(suffix)}</div>
      </div>
    `;
  }

  // ---- Share buttons ----
  function wireShare(hash) {
    const pageUrl = location.origin + `/analysis/${encodeURIComponent(hash)}`;
    const cardUrl = `${location.origin}/api/card?id=${encodeURIComponent(hash)}&theme=dark`;

    const x  = $('#btn-x');
    const fb = $('#btn-fb');
    const tg = $('#btn-tg');
    const wa = $('#btn-wa');
    const dl = $('#btn-dl');

    if (x)  x.href  = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent('LNK.az təhlili')}`;
    if (fb) fb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
    if (tg) tg.href = `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent('LNK.az təhlili')}`;
    if (wa) wa.href = `https://api.whatsapp.com/send?text=${encodeURIComponent('LNK.az təhlili ' + pageUrl)}`;
    if (dl) { dl.href = cardUrl; dl.setAttribute('download', `lnk-${hash}.png`); }
  }

  // ---- Helpers: i18n normalization for role/stance (fallbacks) ----
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

  // ---- UI helpers ----
  function createResult() {
    const main = $('#main') || document.body;
    const sec = document.createElement('section');
    sec.id = 'result';
    main.appendChild(sec);
    return sec;
  }
  function setSpinner(el) {
    if (!el) return;
    el.innerHTML = `<div class="card"><div class="bd"><div class="small muted">Yüklənir...</div></div></div>`;
  }
  function setLoading(on, form, out) {
    if (on) {
      if (form) form.classList.add('is-loading');
      if (out) setSpinner(out);
    } else {
      if (form) form.classList.remove('is-loading');
    }
  }
  function showError(msg, where) {
    const target = where || $('#result') || document.body;
    const html = `<div class="card"><div class="bd"><strong>Xəta:</strong> ${escapeHTML(msg)}</div></div>`;
    if (target) target.insertAdjacentHTML('afterbegin', html);
  }
  function toInt(x, def = 0) {
    const n = Number(x);
    if (!isFinite(n)) return def;
    return Math.round(n);
  }
  function fmtBias(v) {
    const n = Number(v);
    if (!isFinite(n)) return '0.0';
    return (n > 0 ? '+' : n < 0 ? '' : '') + n.toFixed(1);
  }

  // ---- Boot ----
  if (isAnalysisPage) {
    initAnalysis();
  } else {
    initHome();
  }
})();