import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(req) {
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
      return new Response(JSON.stringify({ error: true, message: 'Missing host or url' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const key = `site_stats:${host}`;
    const stats = await kv.get(key);

    return new Response(JSON.stringify(stats || { host, count: 0, avg_rel: 0, avg_bias: 0 }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
      }
    });
  } catch (e) {
    console.error('site-averages error:', e);
    return new Response(JSON.stringify({ error: true, message: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}


