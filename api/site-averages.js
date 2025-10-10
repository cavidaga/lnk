import { kv } from '@vercel/kv';
import { withAuth } from '../lib/middleware.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  try {
    const url = new URL(req.url);
    const hostParam = (url.searchParams.get('host') || '').trim();
    const urlParam = (url.searchParams.get('url') || '').trim();

    function normalizeHost(h){
      const x = String(h||'').toLowerCase().replace(/^www\./,'');
      if (x === 'abzas.info' || x === 'abzas.net' || x === 'abzas.org') return 'abzas.org';
      return x;
    }

    let host = hostParam;
    if (!host && urlParam) {
      try { host = new URL(urlParam).hostname.replace(/^www\./, ''); } catch {}
    }
    host = normalizeHost(host);

    if (!host) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Missing host or url' });
    }

    const key = `site_stats:${host}`;
    const stats = await kv.get(key);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(stats || { host, count: 0, avg_rel: 0, avg_bias: 0 });
  } catch (e) {
    console.error('site-averages error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

// Export with authentication required
export default withAuth(handler, { 
  require: 'any', // Accepts both session and API key
  permission: 'site-averages', // Requires site-averages permission for API keys
  rateLimit: true // Apply rate limiting
});


