import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

function norm(s = '') {
  return String(s).toLowerCase();
}

function normalizeHost(h){
  const x = String(h||'').toLowerCase().replace(/^www\./,'');
  if (x === 'abzas.info' || x === 'abzas.net' || x === 'abzas.org') return 'abzas.org';
  return x;
}

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const host = normalizeHost((url.searchParams.get('host') || '').trim());
    const cursor = Math.max(0, parseInt(url.searchParams.get('cursor') || '0', 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
    const scan = Math.min(5000, Math.max(limit, parseInt(url.searchParams.get('scan') || '1000', 10) || 1000));

    if (!q && !host) {
      return new Response(JSON.stringify({ error: true, message: 'Missing q or host' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // Scan multiple windows to find up to `limit` matches
    const ql = q.toLowerCase();
    const results = [];
    let scanned = 0;
    let next_cursor = cursor;
    const CHUNK = 200;

    while (results.length < limit && scanned < scan) {
      const start = next_cursor;
      const end = start + Math.min(CHUNK, scan - scanned) - 1;
      const hashes = await kv.lrange('recent_hashes', start, end);
      if (!hashes || hashes.length === 0) { next_cursor = null; break; }

      for (const h of hashes) {
        scanned++;
        try {
          const a = await kv.get(h);
          if (!a || !a.meta) continue;
          const title = a.meta.title || '';
          const publication = a.meta.publication || '';
          const original_url = a.meta.original_url || '';
          const hostFromUrl = (() => { try { return normalizeHost(new URL(original_url).hostname); } catch { return ''; } })();

          if (host && hostFromUrl !== host && norm(publication) !== host) continue;

          // Include cited_sources text in haystack to match entities like "København"
          const cited = Array.isArray(a.cited_sources) ? a.cited_sources.map(x => `${x?.name||''} ${x?.role||''} ${x?.stance||''}`).join('\n') : '';
          const hay = `${title}\n${publication}\n${original_url}\n${cited}`.toLowerCase();
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
          if (results.length >= limit) break;
        } catch {}
      }

      next_cursor = end + 1;
      if (hashes.length < (end - start + 1)) { next_cursor = null; break; }
    }

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


