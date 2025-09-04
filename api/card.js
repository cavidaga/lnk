// api/card.js  — Node function (NOT Edge)
import chromium from '@sparticuz/chromium';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerCore from 'puppeteer-core';
import { kv } from '@vercel/kv';

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const hash = url.searchParams.get('hash');
    const theme = (url.searchParams.get('theme') || 'dark').toLowerCase();
    const width = Number(url.searchParams.get('w') || 1200);
    const height = Number(url.searchParams.get('h') || 630);

    if (!hash) {
      res.status(400).send('Missing hash');
      return;
    }

    const data = await kv.get(hash);
    if (!data) {
      res.status(404).send('Not found');
      return;
    }

    const {
      meta = {},
      scores = {},
      human_summary = '',
      modelUsed,
      contentSource
    } = data;

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const fmtBias = (v) => {
      const val = clamp(Number(v) || 0, -5, 5);
      return (val > 0 ? '+' : '') + val.toFixed(1);
    };
    const trunc = (s = '', max = 220) => (s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…');

    const title = meta.title || 'LNK.az — Media Təhlili';
    const publication = meta.publication || '';
    const rel = clamp(scores?.reliability?.value ?? 0, 0, 100);
    const pol = fmtBias(scores?.political_establishment_bias?.value);
    const soc = fmtBias(scores?.socio_cultural_bias?.value);

    const isLight = theme === 'light';
    const bg     = isLight ? '#ffffff' : '#0b0c11';
    const fg     = isLight ? '#0b0c11' : '#f6f7fb';
    const sub    = isLight ? '#3a3d45' : '#c7c9d3';
    const accent = '#e10600';
    const card   = isLight ? '#f5f6f8' : '#141723';
    const border = isLight ? '#e6e8ee' : '#23273a';

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;">
<meta name="viewport" content="width=${width}, initial-scale=1.0" />
<style>
  :root { --bg:${bg}; --fg:${fg}; --sub:${sub}; --accent:${accent}; --card:${card}; --border:${border}; }
  * { box-sizing:border-box; }
  body { margin:0; width:${width}px; height:${height}px; background:var(--bg); color:var(--fg); font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, "Helvetica Neue", Arial, "Noto Sans", sans-serif; }
  .wrap { display:flex; height:100%; padding:40px; }
  .left { flex:1.4; display:flex; flex-direction:column; }
  .brand { display:flex; gap:12px; align-items:center; }
  .logo { width:36px; height:36px; border-radius:8px; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:24px; }
  .title { margin-top:16px; }
  .title h1 { margin:0; font-size:34px; line-height:1.2; font-weight:800; }
  .title .pub { color:var(--sub); margin-top:6px; font-size:20px; }
  .stats { display:flex; gap:14px; margin-top:16px; }
  .stat { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:14px 16px; width:210px; }
  .stat .lbl { color:var(--sub); font-size:14px; }
  .stat .val { font-size:36px; font-weight:800; margin-top:2px; }
  .sum { margin-top:18px; color:var(--sub); font-size:20px; line-height:1.35; max-width:700px; white-space:pre-wrap; }
  .foot { display:flex; gap:16px; margin-top:auto; align-items:center; color:var(--sub); font-size:16px; }
  .right { width:360px; margin-left:28px; display:flex; align-items:center; justify-content:center; }
  .axes { width:320px; height:320px; background:var(--card); border:1px solid var(--border); border-radius:20px; position:relative; display:flex; align-items:center; justify-content:center; }
  .v { position:absolute; width:2px; height:260px; background:var(--border); }
  .h { position:absolute; height:2px; width:260px; background:var(--border); }
  .dot { position:absolute; width:14px; height:14px; border-radius:999px; background:var(--accent); box-shadow:0 0 0 6px rgba(225,6,0,0.125); }
  .axes .lblx { position:absolute; bottom:10px; font-size:14px; color:var(--sub); }
  .axes .lbly { position:absolute; right:10px; top:10px; font-size:14px; color:var(--sub); }
</style>
</head>
<body>
  <div class="wrap">
    <div class="left">
      <div class="brand"><div class="logo">L</div><div style="font-size:24px;font-weight:600">LNK.az</div></div>
      <div class="title">
        <h1>${escapeHtml(title)}</h1>
        ${publication ? `<div class="pub">${escapeHtml(publication)}</div>` : ''}
      </div>
      <div class="stats">
        <div class="stat"><div class="lbl">Etibarlılıq</div><div class="val">${rel}</div></div>
        <div class="stat"><div class="lbl">Siyasi meyl</div><div class="val">${escapeHtml(pol)}</div></div>
        <div class="stat"><div class="lbl">Sosial-mədəni meyl</div><div class="val">${escapeHtml(soc)}</div></div>
      </div>
      <div class="sum">${escapeHtml(trunc(human_summary))}</div>
      <div class="foot">
        <div>Model: <span style="color:var(--fg)">${escapeHtml(modelUsed || '—')}</span> • Mənbə: <span style="color:var(--fg)">${escapeHtml(contentSource || '—')}</span></div>
        <div style="margin-left:auto">lnk.az</div>
      </div>
    </div>
    <div class="right">
      <div class="axes">
        <div class="v"></div><div class="h"></div>
        <div class="dot" style="transform: translate(${mapDot(scores?.political_establishment_bias?.value)}px, ${-mapDot(scores?.socio_cultural_bias?.value)}px)"></div>
        <div class="lblx">Siyasi</div>
        <div class="lbly">Sosial</div>
      </div>
    </div>
  </div>
  <script>
    function mapDot(v){ v=Number(v)||0; if(v<-5)v=-5; if(v>5)v=5; return v*22; }
  </script>
</body>
</html>`;

    let browser;
    try {
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width, height, deviceScaleFactor: 2 },
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const buf = await page.screenshot({ type: 'png' });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).send(buf);
    } finally {
      if (browser) try { await browser.close(); } catch {}
    }
  } catch (e) {
    console.error('Card error:', e);
    res.status(500).send('Card error');
  }
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}