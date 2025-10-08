import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs', maxDuration: 60 };

function norm(s = '') {
  return String(s).toLowerCase();
}

function baseDomain(h){
  const parts = String(h||'').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  return parts.slice(-2).join('.');
}

function normalizeHost(h){
  let x = String(h||'').toLowerCase().replace(/^www\./,'');
  // Collapse common mobile prefixes like m., az.m.
  x = x.replace(/^(?:[a-z]{1,3}\.)?m\./, '');
  // Treat all wikipedia subdomains as one
  if (x.endsWith('.wikipedia.org')) x = 'wikipedia.org';
  // Treat azadliq and abzas domains as single brands
  const b = baseDomain(x);
  if (b === 'abzas.info' || b === 'abzas.net' || b === 'abzas.org') return 'abzas.org';
  if (b === 'azadliq.org') return 'azadliq.org';
  return b || x;
}

function fold(s = ''){
  // Lowercase, strip diacritics, normalize Azeri letters, collapse quotes
  let t = String(s).toLowerCase();
  t = t
    .replace(/[“”„”‹›«»]/g, '"')
    .replace(/[’‘‛']/g, "'");
  // Replace Azerbaijani letters to ASCII approximations
  t = t
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/İ/g, 'i');
  try {
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {}
  return t;
}

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const host = normalizeHost((url.searchParams.get('host') || '').trim());
    const cursor = Math.max(0, parseInt(url.searchParams.get('cursor') || '0', 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
    const scan = Math.min(20000, Math.max(limit, parseInt(url.searchParams.get('scan') || '1000', 10) || 1000));
    const budgetMs = Math.min(20000, Math.max(300, parseInt(url.searchParams.get('budget') || '1500', 10) || 1500));
    const started = Date.now();

    if (!q && !host) {
      return new Response(JSON.stringify({ error: true, message: 'Missing q or host' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // --- Upstash Search (required) ---
    const S_URL = process.env.UPSTASH_SEARCH_REST_URL;
    const S_TOKEN = process.env.UPSTASH_SEARCH_REST_TOKEN;
    const INDEX = 'lnk';
    if (!S_URL || !S_TOKEN) {
      return new Response(JSON.stringify({ error: true, message: 'Search service not configured' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }


    try {
      const body = {
        index: INDEX,
        query: q || '*',
        limit
      };
      
      if (host) {
        body.filter = `publication:"${host}"`;
      }
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const res = await fetch(String(S_URL).replace(/\/$/, '') + '/query', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${S_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      if (!res.ok) {
        return new Response(JSON.stringify({ error: true, message: 'Search query failed' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }
      const data = await res.json();
      const items = Array.isArray(data?.results) ? data.results : Array.isArray(data?.hits) ? data.hits : [];
      const mapped = items.map((it) => {
        const content = it?.content || {};
        const meta = it?.metadata || {};
        const id = it?.id || meta?.id || content?.id || '';
        return {
          hash: id,
          title: content.title || meta.title || '',
          publication: content.publication || meta.publication || '',
          url: content.original_url || meta.original_url || '',
          published_at: content.published_at || meta.published_at || '',
          reliability: Number(content.reliability ?? meta.reliability ?? 0) || 0,
          political_bias: Number(content.political_bias ?? meta.political_bias ?? 0) || 0,
          is_advertisement: Boolean(content.is_advertisement ?? meta.is_advertisement ?? false)
        };
      });
      return new Response(JSON.stringify({ results: mapped, next_cursor: data?.next_cursor || null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=60' }
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        return new Response(JSON.stringify({ error: true, message: 'Search timeout - Upstash Search took too long to respond' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      }
      return new Response(JSON.stringify({ error: true, message: 'Search error', detail: String(e?.message||e) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // Legacy KV scan (unreachable when Upstash envs are set)
    const ql = fold(q);
    const qTokens = ql.split(/\s+/).filter(Boolean);
    const results = [];
    let scanned = 0;
    let next_cursor = cursor;
    const CHUNK = 120;

    while (results.length < limit && scanned < scan) {
      const start = next_cursor;
      const end = start + Math.min(CHUNK, scan - scanned) - 1;
      // Prefer broader search index if present
      // Time guard before hitting storage
      if (Date.now() - started >= budgetMs) { next_cursor = start; break; }

      let hashes = await kv.lrange('search_hashes', start, end);
      if (!hashes || hashes.length === 0) {
        hashes = await kv.lrange('recent_hashes', start, end);
      }
      if (!hashes || hashes.length === 0) { next_cursor = null; break; }

      for (let i = 0; i < hashes.length; i++) {
        const h = hashes[i];
        scanned++;
        try {
          const a = await kv.get(h);
          if (a && a.meta) {
            const title = a.meta.title || '';
            const publication = a.meta.publication || '';
            const original_url = a.meta.original_url || '';
            const hostFromUrl = (() => { try { return normalizeHost(new URL(original_url).hostname); } catch { return ''; } })();

            if (host) {
              const pubNorm = normalizeHost(publication);
              if (hostFromUrl !== host && pubNorm !== host) { if (Date.now() - started >= budgetMs) { next_cursor = start + i + 1; break; } continue; }
            }

            const cited = Array.isArray(a.cited_sources) ? a.cited_sources.map(x => `${x?.name||''} ${x?.role||''} ${x?.stance||''}`).join('\n') : '';
            const human = a.human_summary || '';
            const hayRaw = `${title}\n${publication}\n${original_url}\n${cited}\n${human}`;
            const hay = fold(hayRaw);
            if (q) {
              let okTok = true;
              for (const tok of qTokens) { if (!hay.includes(tok)) { okTok = false; break; } }
              if (!okTok) { if (Date.now() - started >= budgetMs) { next_cursor = start + i + 1; break; } continue; }
            }

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
            if (results.length >= limit) { next_cursor = start + i + 1; break; }
          }
        } catch {}
        if (Date.now() - started >= budgetMs) { next_cursor = start + i + 1; break; }
      }

      if (next_cursor === start) {
        // budget hit before scanning this chunk; keep next_cursor at start
      } else if (next_cursor == null || next_cursor === cursor) {
        next_cursor = end + 1;
      }
      if (hashes.length < (end - start + 1)) { next_cursor = null; break; }
      if (Date.now() - started >= budgetMs) break;
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


