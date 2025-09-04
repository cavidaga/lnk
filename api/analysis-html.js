// api/analysis-html.js
export const config = { runtime: 'edge' };

const SITE = 'https://lnk.az';

function esc(s = '') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json?.result) return null;
  try { return JSON.parse(json.result); } catch { return null; }
}

export default async function handler(req) {
  const url = new URL(req.url);
  const hash = url.searchParams.get('hash') || url.pathname.split('/').pop() || '';
  if (!hash) return new Response('Missing hash', { status: 400 });

  const data = await kvGet(hash);
  const title = data?.meta?.title || 'LNK.az — Media Təhlili';
  const human = data?.human_summary ? String(data.human_summary) : '';
  const ogDesc = human ? (human.length > 180 ? human.slice(0,177).trimEnd() + '…' : human) : 'Media qərəzi və etibarlılıq təhlili.';

  const pageUrl = `${SITE}/analysis/${encodeURIComponent(hash)}`;
  const cardUrl = `${SITE}/api/card?hash=${encodeURIComponent(hash)}&theme=dark`;

  const html = `<!DOCTYPE html>
<html lang="az">
<head>
<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${esc(pageUrl)}"/>

<title>${esc(title)}</title>
<meta name="description" content="${esc(ogDesc)}">

<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:image" content="${esc(cardUrl)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(ogDesc)}">
<meta name="twitter:image" content="${esc(cardUrl)}">

<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/static/styles.css">
</head>
<body>
  <div class="wrap">
    <div id="site-header"></div>
    <main id="main"><div id="result" class="result" aria-live="polite"></div></main>
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