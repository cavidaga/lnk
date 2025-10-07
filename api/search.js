import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

function norm(s = '') {
  return String(s).toLowerCase();
}

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const host = (url.searchParams.get('host') || '').trim().toLowerCase();
    const cursor = Math.max(0, parseInt(url.searchParams.get('cursor') || '0', 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));

    if (!q && !host) {
      return new Response(JSON.stringify({ error: true, message: 'Missing q or host' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // Read a window of recent hashes
    const start = cursor;
    const end = cursor + limit - 1;
    const hashes = await kv.lrange('recent_hashes', start, end);

    const ql = q.toLowerCase();
    const results = [];

    if (hashes && hashes.length) {
      for (const h of hashes) {
        try {
          const a = await kv.get(h);
          if (!a || !a.meta) continue;
          const title = a.meta.title || '';
          const publication = a.meta.publication || '';
          const original_url = a.meta.original_url || '';
          const hostFromUrl = (() => { try { return new URL(original_url).hostname.replace(/^www\./,'').toLowerCase(); } catch { return ''; } })();

          if (host && hostFromUrl !== host && publication.toLowerCase() !== host) continue;

          const hay = `${title}\n${publication}\n${original_url}`.toLowerCase();
          if (q && !hay.includes(ql)) continue;

          results.push({
            hash: a.hash || h,
            title,
            publication,
            url: original_url,
            published_at: a.meta.published_at || '',
            reliability: a.scores?.reliability?.value ?? 0,
            political_bias: a.scores?.political_establishment_bias?.value ?? 0,
            is_advertisement: !!a.is_advertisement
          });
        } catch {}
      }
    }

    const next_cursor = hashes && hashes.length === limit ? end + 1 : null;
    return new Response(JSON.stringify({ results, next_cursor }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: true, message: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}


