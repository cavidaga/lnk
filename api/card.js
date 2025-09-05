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
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
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

function renderHtml(data) {
  const {
    title = "Ukrayna sülhü və Azərbaycan üçün potensial təhlükələr",
    platform = "Facebook",
    reliability = 45,
    political_bias = -3.5,
    socio_cultural_bias = 0.0,
    summary = "Tarixçi və analitik ...",
    footer = "LNK tərəfindən təhlil edilib"
  } = data || {};

  return `<!doctype html>
  <html><head><meta charset="utf-8"/>
  <style>
    *{box-sizing:border-box} html,body{margin:0;padding:0;width:1200px;height:630px}
    body{font-family:Inter,ui-sans-serif,-apple-system,Segoe UI,Roboto,Arial,"Noto Color Emoji";background:#0B0E14;color:#E5E7EB}
    .wrap{position:relative;display:flex;height:100%;padding:40px 48px;gap:32px}
    .left{flex:1.15;display:flex;flex-direction:column}
    .right{width:520px;position:relative}
    .brand{display:flex;align-items:center;gap:14px;margin-bottom:20px}
    .brand-logo{display:inline-flex;width:120px;height:32px}
    .title{font-size:56px;line-height:1.06;font-weight:800;margin:6px 0 10px;color:#F3F4F6}
    .platform{font-size:22px;color:#9CA3AF;margin-bottom:22px;display:flex;align-items:center;gap:8px}
    .platform .check{display:inline-flex;width:18px;height:18px;color:#34D399}
    .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:10px 0 20px}
    .metric{background:#121622;border:1px solid #1F2433;border-radius:16px;padding:18px 20px}
    .metric-label{font-size:16px;color:#9CA3AF}
    .metric-value{font-size:44px;font-weight:800;margin-top:6px;color:#E5E7EB}
    .summary{margin-top:2px;font-size:24px;line-height:1.4;color:#D1D5DB;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
    .footer{margin-top:auto;font-size:18px;color:#9CA3AF;display:flex;align-items:center;gap:8px}
    .footer .check{width:16px;height:16px;color:#34D399}
    .panel{position:absolute;inset:0;background:#0E1220;border:1px solid #1F2433;border-radius:20px;padding:24px;display:flex;flex-direction:column;gap:12px}
    .quad{position:relative;flex:1;border:1px solid #2A3146;border-radius:14px;overflow:hidden;background:linear-gradient(to bottom,rgba(255,255,255,.02),rgba(255,255,255,0))}
    /* Axes (the two lines) */
    .axis-x, .axis-y {
      position: absolute;
      background: #2A3146;   /* line color */
    }
    .axis-x {                /* horizontal line */
      left: 40px;
      right: 40px;
      top: 50%;
      height: 1px;
    }
    .axis-y {                /* vertical line */
      top: 40px;
      bottom: 40px;
      left: 50%;
      width: 1px;
    }
    /* replace the old .axis-labels .top/.bottom/.left/.right rules */
    .axis-labels { position:absolute; inset:0; pointer-events:none; font-size:16px; color:#9CA3AF; }
    .axis-labels .lab-top    { position:absolute; top:6px;    left:50%; transform:translateX(-50%); }
    .axis-labels .lab-bottom { position:absolute; bottom:6px; left:50%; transform:translateX(-50%); }
    .axis-labels .lab-left   { position:absolute; top:50%;    left:6px;  transform:translateY(-50%); }
    .axis-labels .lab-right  { position:absolute; top:50%;    right:6px; transform:translateY(-50%); }
    .chart-dot{fill:#EF4444;filter:drop-shadow(0 0 10px rgba(239,68,68,.35))}
    .wm{position:absolute;right:24px;bottom:18px;font-weight:700;letter-spacing:.5px;color:#6B7280;opacity:.35;font-size:18px}
  </style></head>
  <body>
    <div class="wrap">
      <div class="left">
        <div class="brand"><div class="brand-logo">${LOGO_SVG}</div></div>
        <div class="title">${escapeHtml(title)}</div>
        <div class="platform"><span class="check">${CHECK_SVG}</span><span>${escapeHtml(platform)}</span></div>
        <div class="metrics">
          ${metricCard({label:"Etibarlılıq", value:String(reliability)})}
          ${metricCard({label:"Siyasi meyl", value:String(political_bias)})}
          ${metricCard({label:"Sosial-Mədəni meyl", value:String(socio_cultural_bias)})}
        </div>
        <div class="summary">${escapeHtml(summary)}</div>
        <div class="footer"><span class="check">${CHECK_SVG}</span><span>${escapeHtml(footer)}</span></div>
      </div>
      <div class="right">
        <div class="panel">
          <div class="quad">
            <div class="axis-x"></div><div class="axis-y"></div>
            <svg viewBox="0 0 500 500" width="100%" height="100%" style="position:absolute;inset:0;">
              ${dot(political_bias, reliability)}
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

// Edge handler
export default async function handler(req) {
  // If you actually use ?hash=..., fetch and map it here.
  // For now we read query but fall back to demo values.
  const url = new URL(req.url);
  const dataParam = url.searchParams.get("data");
  let data = {};
  if (dataParam) {
    try { data = JSON.parse(dataParam); } catch {}
  }
  const html = renderHtml(data);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
