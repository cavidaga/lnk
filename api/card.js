// /api/card.js  (ESM, Edge runtime)
export const config = { runtime: "edge" };

// --- assets (inline SVGs) ---
const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32" aria-hidden="true">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6EE7F9"/>
      <stop offset="100%" stop-color="#3B82F6"/>
    </linearGradient>
  </defs>
  <g fill="url(#g)" font-family="Inter, ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial" font-weight="700" font-size="24">
    <text x="0" y="24">LNK.az</text>
  </g>
</svg>
`;

const CHECK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="currentColor" d="M20.285 6.708a1 1 0 0 1 0 1.414l-9.9 9.9a1 1 0 0 1-1.414 0l-5.256-5.256a1 1 0 1 1 1.414-1.414l4.55 4.55 9.193-9.193a1 1 0 0 1 1.414 0z"/>
</svg>
`;

// --- helpers ---
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
const clamp = (n, a, b) => Math.min(b, Math.max(a, Number(n)));
const fmt100 = (v) => (Number.isFinite(+v) ? `${+v}/100` : "—");
const fmtBias = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return (n > 0 ? "+" : "") + n;
};

function metricCard({ label, value }) {
  return `
    <div class="metric">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
    </div>
  `;
}
function dot(x, y) {
  const cx = 40 + (x + 5) * 0.1 * 420;   // [-5..+5] -> [40..460]
  const cy = 40 + (1 - (y / 100)) * 420; // [0..100] -> [460..40]
  return `<circle cx="${cx}" cy="${cy}" r="9" class="chart-dot"/>`;
}

function themeVars(theme = "dark") {
  const dark = {
    bg: "#0B0E14", text: "#E5E7EB", title: "#F3F4F6", sub: "#9CA3AF",
    cardBg: "#121622", cardBorder: "#1F2433", axis: "#2A3146",
    dot: "#EF4444", dotShadow: "rgba(239,68,68,.35)", watermark: "#6B7280"
  };
  const light = {
    bg: "#FAFBFF", text: "#111827", title: "#0F172A", sub: "#4B5563",
    cardBg: "#FFFFFF", cardBorder: "#E5E7EB", axis: "#CBD5E1",
    dot: "#DC2626", dotShadow: "rgba(220,38,38,.35)", watermark: "#6B7280"
  };
  return theme === "light" ? light : dark;
}

function renderHtml(data, theme = "dark") {
  const T = themeVars(theme);

  const {
    title = "Analiz",
    platform = "Paylaşım üçün kart",
    reliability = 0,                           // 0..100
    political_establishment_bias = 0,          // -5..+5
    summary = "",
    footer = "LNK tərəfindən təhlil edilib"
  } = data || {};

  const relNum = clamp(reliability, 0, 100);
  const polNum = clamp(political_establishment_bias, -5, 5);

  return `<!doctype html>
  <html><head><meta charset="utf-8"/>
  <style>
    *{box-sizing:border-box} html,body{margin:0;padding:0;width:1200px;height:630px}
    body{
      font-family:Inter,ui-sans-serif,-apple-system,Segoe UI,Roboto,Arial,"Noto Color Emoji";
      background:${T.bg}; color:${T.text}
    }
    .wrap{position:relative;display:flex;height:100%;padding:40px 48px;gap:32px}
    .left{flex:1.15;display:flex;flex-direction:column}
    .right{width:520px;position:relative}
    .brand{display:flex;align-items:center;gap:14px;margin-bottom:20px}
    .brand-logo{display:inline-flex;width:120px;height:32px}
    .title{font-size:56px;line-height:1.06;font-weight:800;margin:6px 0 10px;color:${T.title}}
    .platform{font-size:22px;color:${T.sub};margin-bottom:22px;display:flex;align-items:center;gap:8px}
    .platform .check{display:inline-flex;width:18px;height:18px;color:#34D399}
    .metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:10px 0 20px}
    .metric{background:${T.cardBg};border:1px solid ${T.cardBorder};border-radius:16px;padding:18px 20px}
    .metric-label{font-size:16px;color:${T.sub}}
    .metric-value{font-size:44px;font-weight:800;margin-top:6px;color:${T.text}}
    .summary{margin-top:2px;font-size:24px;line-height:1.4;color:${T.text};opacity:.9;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
    .footer{margin-top:auto;font-size:18px;color:${T.sub};display:flex;align-items:center;gap:8px}
    .footer .check{width:16px;height:16px;color:#34D399}
    .panel{position:absolute;inset:0;background:${T.cardBg};border:1px solid ${T.cardBorder};border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:12px}
    .quad{position:relative;flex:1;border:1px solid ${T.axis};border-radius:14px;overflow:hidden;background:linear-gradient(to bottom,rgba(0,0,0,.02),rgba(0,0,0,0))}
    .axis-x, .axis-y { position:absolute; background:${T.axis}; }
    .axis-x { left:40px; right:40px; top:50%; height:1px; }
    .axis-y { top:40px; bottom:40px; left:50%; width:1px; }
    .axis-labels { position:absolute; inset:0; pointer-events:none; font-size:16px; color:${T.sub}; }
    .axis-labels .lab-top    { position:absolute; top:6px;    left:50%; transform:translateX(-50%); }
    .axis-labels .lab-bottom { position:absolute; bottom:6px; left:50%; transform:translateX(-50%); }
    .axis-labels .lab-left   { position:absolute; top:50%;    left:6px;  transform:translateY(-50%); }
    .axis-labels .lab-right  { position:absolute; top:50%;    right:6px; transform:translateY(-50%); }
    .chart-dot{fill:${T.dot};filter:drop-shadow(0 0 10px ${T.dotShadow})}
    .wm{position:absolute;right:24px;bottom:18px;font-weight:700;letter-spacing:.5px;color:${T.watermark};opacity:.35;font-size:18px}
  </style></head>
  <body>
    <div class="wrap">
      <div class="left">
        <div class="brand"><div class="brand-logo">${LOGO_SVG}</div></div>
        <div class="title">${esc(title)}</div>
        <div class="platform"><span class="check">${CHECK_SVG}</span><span>${esc(platform)}</span></div>
        <div class="metrics">
          ${metricCard({label:"Etibarlılıq", value: esc(fmt100(relNum))})}
          ${metricCard({label:"Siyasi hakimiyyət meyli", value: esc(fmtBias(polNum))})}
        </div>
        <div class="summary">${esc(summary)}</div>
        <div class="footer"><span class="check">${CHECK_SVG}</span><span>${esc(footer)}</span></div>
      </div>
      <div class="right">
        <div class="panel">
          <div class="quad">
            <div class="axis-x"></div><div class="axis-y"></div>
            <svg viewBox="0 0 500 500" width="100%" height="100%" style="position:absolute;inset:0;">
              ${dot(polNum, relNum)}
            </svg>
            <div class="axis-labels">
              <div class="lab-top">Etibarlı</div>
              <div class="lab-bottom">Etibarsız</div>
              <div class="lab-left">Müxalif</div>
              <div class="lab-right">İqtidar</div>
            </div>
          </div>
        </div>
        <div class="wm">lnk.az</div>
      </div>
    </div>
  </body></html>`;
}

// Map API analysis JSON → card data
function mapFromAnalysis(json) {
  const title = json?.meta?.title || "Analiz";
  const reliability = clamp(json?.scores?.reliability?.value ?? 0, 0, 100);
  const political_establishment_bias = clamp(json?.scores?.political_establishment_bias?.value ?? 0, -5, 5);
  const summary = typeof json?.human_summary === "string" ? json.human_summary : "";
  return { title, reliability, political_establishment_bias, summary };
}

// Edge handler
export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const theme = (url.searchParams.get("theme") || "dark").toLowerCase();
    const hash = url.searchParams.get("hash");
    const dataParam = url.searchParams.get("data");

    let data = null;

    if (hash) {
      // Fetch your stored analysis and map
      const origin = url.origin; // same host
      const r = await fetch(`${origin}/api/get-analysis?id=${encodeURIComponent(hash)}`, {
        headers: { "Accept": "application/json" }
      });
      if (r.ok) {
        const json = await r.json();
        data = mapFromAnalysis(json);
        // Optional extra: platform/footer hints from headers
        data.platform = "Analiz kartı";
        data.footer = json?.publication ? `Mənbə: ${json.publication}` : "LNK tərəfindən təhlil edilib";
      } else {
        // fall through to demo/fallback below
      }
    } else if (dataParam) {
      try { data = JSON.parse(dataParam); } catch {}
    }

    if (!data) {
      // Demo defaults (nice looking numbers)
      data = {
        title: "Məqalə analizi",
        reliability: 72,
        political_establishment_bias: -1.5,
        summary: "Məqalə mövzuya dair əsas faktları təqdim edir, lakin bəzi açıqlanmayan mənbələrə istinadlar var. Hakimiyyət siyasətinə tənqidi çalar hiss olunur.",
        platform: "Paylaşım üçün kart",
        footer: "LNK tərəfindən təhlil edilib"
      };
    }

    const html = renderHtml(data, theme);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    const msg = e?.message || "Internal error";
    return new Response(
      `<!doctype html><meta charset="utf-8"><pre>Card error: ${esc(msg)}</pre>`,
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}