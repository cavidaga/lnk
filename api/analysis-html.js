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

  const pageUrl    = `${SITE}/analysis/${encodeURIComponent(hash)}`;
  const ogImageUrl = `https://lnk.az/api/card?hash=${hash}`;
  const ogTitle    = 'LNK — Media qərəzi qiymətləndiricisi';
  const ogDesc     = 'Media qərəzi və etibarlılıq təhlili.';

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

  <!-- Fonts (match index.html) -->
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Canonical & Open Graph -->
  <link rel="canonical" href="${esc(pageUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(ogDesc)}" />
  <meta property="og:url" content="${esc(pageUrl)}" />
  <meta property="og:image" content="https://lnk.az/api/card-image?hash=${esc(hash)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="az_AZ" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://lnk.az/api/card-image?hash=${esc(hash)}" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDesc)}" />

  <!-- Optional axis labels for client (read by app.js if desired) -->
  <meta name="lnk:x-axis" content="Siyasi hakimiyyət meyli (−5…+5)">
  <meta name="lnk:y-axis" content="Etibarlılıq (0–100)">

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
  <script>
    // Minimal client-side schema hint for stability
    window.__LNK_SCHEMA__ = {
      meta: ["article_type","title","original_url","publication","published_at"],
      scores: {
        reliability: ["value","rationale"],
        political_establishment_bias: ["value","rationale"]
      },
      diagnostics: {
        socio_cultural_descriptions: true,
        language_flags: true
      },
      cited_sources: true,
      human_summary: true
    };
  </script>
  <script src="/static/layout.js" defer></script>
  <script src="/static/app.js" defer></script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // small TTL + SWR, keeps shell fast while allowing background refresh
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=900'
    }
  });
}
