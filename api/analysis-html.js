// api/analysis-html.js — Edge
export const config = { runtime: 'edge' };

// inline esc() so we don't import anything
function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SITE = 'https://lnk.az';
const CARD_VERSION = '2';

export default async function handler(req) {
  const url = new URL(req.url);
  const hash = url.searchParams.get('hash') || url.pathname.split('/').pop() || '';
  if (!hash) return new Response('Missing hash', { status: 400 });

  const pageUrl   = `${SITE}/analysis/${encodeURIComponent(hash)}`;
  const cardPngUrl = `${SITE}/static/og-cover.png?v=${CARD_VERSION}`;
  const ogTitle = 'LNK - Media qərəzi qiymətləndiricisi';
  const ogDesc  = 'Media qərəzi və etibarlılıq təhlili.';

  const html = `<!DOCTYPE html>
<html lang="az" class="no-js">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <title>${esc(ogTitle)}</title>
  <meta name="description" content="${esc(ogDesc)}" />
  <meta name="theme-color" content="#0c0d12">
  <meta name="color-scheme" content="light dark" />
  <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
  <meta property="fb:app_id" content="1493746861646864" />

  <!-- Google Fonts: Poppins (match index.html) -->
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Canonical & Open Graph -->
  <link rel="canonical" href="${esc(pageUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(ogDesc)}" />
  <meta property="og:url" content="${esc(pageUrl)}" />
  <meta property="og:image" content="https://lnk.az/static/og-cover.png?v=2" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://lnk.az/static/og-cover.png?v=2" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDesc)}" />
  
  <!-- Icons (match index.html) -->
  <link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
  <link rel="alternate icon" href="/static/favicon.ico">
  <link rel="icon" href="/static/favicon-light.svg" media="(prefers-color-scheme: light)">
  <link rel="icon" href="/static/favicon-dark.svg"  media="(prefers-color-scheme: dark)">
  <link rel="apple-touch-icon" href="/static/apple-touch-icon.png">
  <link rel="mask-icon" href="/static/safari-pinned-tab.svg" color="#e10600">

  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
  <a class="skip-link" href="#main">Mündəricata keç</a>
  <div class="wrap">
    <div id="site-header"></div>
    <main id="main" role="main">
      <!-- container expected by app.js -->
      <div id="result" class="result" aria-live="polite"></div>
    </main>
    <div id="site-footer"></div>
  </div>

  <script>window.__LNK_HASH__ = ${JSON.stringify(hash)};</script>
  <script src="/static/layout.js" defer></script>
  <script src="/static/app.js" defer></script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}