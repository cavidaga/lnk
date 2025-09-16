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
      const url = new FormData(form).get('url');
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
          body: JSON.stringify({ url: String(url).trim() })
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
  }

  // ---------- ANALYSIS FLOW ----------
  async function initAnalysis(hash) {
    const container = ensureResult();
    container.classList.add('show');
    setSpinner(container);

    try {
      const data = await fetchAnalysis(hash);
      renderAnalysis(container, data);
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
    <article class="card">
      <div class="bd">
        ${headerBlock({
          title: meta.title || 'Məqalə',
          publication: meta.publication || (() => {
            try { return new URL(meta.original_url || '').hostname.replace(/^www\./,''); }
            catch { return ''; }
          })(),
          published_at: meta.published_at || '',
          url: meta.original_url || '',
          title_inferred: meta?.title_inferred || false
        })}

        <section class="card">
          <div class="bd">
            <div class="row" style="display:flex;gap:14px;flex-wrap:wrap">
              ${metric('Etibarlılıq', fmt100(reliabilityNum), '')}
              ${metric('Siyasi hakimiyyət meyli', fmtBias(polBiasNum), ' (Müxalif ⟷ İqtidar)')}
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

        <section class="card">
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
                  socio.map(it => `
                    <li>
                      <div><strong>${esc(it.group || '—')}</strong> — ${esc(it.stance || '—')}</div>
                      ${it.rationale ? `<div class="small muted anywrap">${esc(it.rationale)}</div>` : ''}
                    </li>
                  `).join('')
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
              <summary>Xam JSON datanı göstər</summary>
              <pre class="json">${esc(JSON.stringify(data, null, 2))}</pre>
            </details>
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
    const now = new Date();
    const base = `${AZ_MONTHS[d.getMonth()]} ${d.getDate()}`;
    return d.getFullYear() === now.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
  }


function headerBlock({ title, publication, published_at, url, title_inferred }){
  return `
    <header class="hdr">
      <div class="kv">
        <div class="item">
          <div class="k">Başlıq</div>
          <div class="v">${esc(title || '—')}</div>
        </div>
        <div class="item">
          <div class="k">İstinad</div>
          <div class="v">${esc(publication || '—')}</div>
        </div>
        <div class="item">
          <div class="k">Tarix</div>
          <div class="v">${esc(formatAzDate(published_at) || '—')}</div>
        </div>
        <div class="item link">
          <div class="k">Orijinal link</div>
          <div class="v anywrap">
            ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>` : '—'}
          </div>
        </div>
      </div>
      ${title_inferred ? `<div class="micro muted" style="margin-top:6px">Qeyd: Yazıda başlıq yoxdursa avtomatik yaradılır.</div>` : ''}
    </header>
  `;
}

  async function safeJson(res) {
    try { return await res.json(); } catch { return {}; }
  }
})();
