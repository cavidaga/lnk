// api/analysis-html.js (Edge)
export const config = { runtime: 'edge' };

const SITE = 'https://lnk.az';
const CARD_VERSION = '2';

function esc(s=''){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export default async function handler(req) {
  const url = new URL(req.url);
  const hash = url.searchParams.get('hash') || url.pathname.split('/').pop() || '';
  if (!hash) {
    return new Response('Missing hash', { status: 400 });
  }

  const pageUrl = `${SITE}/analysis/${encodeURIComponent(hash)}`;
  const cardUrl = `${SITE}/api/card?hash=${encodeURIComponent(hash)}&theme=dark&v=${CARD_VERSION}`;
  const ogDesc = 'Media qərəzi və etibarlılıq təhlili.';

  const html = `<!DOCTYPE html>
<html lang="az">
<head>
<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>LNK.az — Media Təhlili</title>
<meta name="description" content="${esc(ogDesc)}">

<link rel="canonical" href="${esc(pageUrl)}"/>

<meta property="og:type" content="article">
<meta property="og:title" content="LNK.az — Media Təhlili">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:image" content="${esc(cardUrl)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="LNK.az — Media Təhlili">
<meta name="twitter:description" content="${esc(ogDesc)}">
<meta name="twitter:image" content="${esc(cardUrl)}">

<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/static/styles.css">
</head>
<body>
  <div class="wrap">
    <div id="site-header"></div>
    <main id="main" role="main">
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
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
  });
}
