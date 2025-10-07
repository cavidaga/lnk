import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs', maxDuration: 60 };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // Pagination via query params: ?cursor=0&limit=100
    const url = new URL(req.url, 'http://localhost');
    let cursor = Number(url.searchParams.get('cursor') || 0);
    if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;

    // Optional JSON body for limit override
    let limit = 100;
    try {
      let parsedBody = {};
      const data = await new Promise((resolve) => {
        try {
          let buf = '';
          req.on('data', (chunk) => { buf += chunk; });
          req.on('end', () => resolve(buf));
        } catch { resolve(''); }
      });
      if (data && String(data).trim()) {
        try { parsedBody = JSON.parse(String(data)); } catch {}
      }
      if (parsedBody && Number.isFinite(parsedBody.limit) && parsedBody.limit > 0 && parsedBody.limit <= 1000) {
        limit = Math.floor(parsedBody.limit);
      }
    } catch {}

    const start = cursor;
    const end = cursor + Math.max(1, limit) - 1;

    // Get a window of recent hashes
    const hashes = await kv.lrange('recent_hashes', start, end);
    if (!hashes || hashes.length === 0) {
      return res.status(200).json({ processed: 0, skipped: 0, errors: 0, message: 'No hashes in range', next_cursor: null });
    }

    let processed = 0, skipped = 0, errors = 0;

    for (const hash of hashes) {
      try {
        // Idempotency guard per-hash
        const markerKey = `processed_site_stats:${hash}`;
        const already = await kv.get(markerKey);
        if (already) { skipped++; continue; }

        const analysis = await kv.get(hash);
        if (!analysis || analysis.is_advertisement) { skipped++; continue; }

        const originalUrl = analysis?.meta?.original_url || '';
        let host = '';
        try { host = new URL(originalUrl).hostname.replace(/^www\./, ''); } catch {}
        if (!host) { skipped++; continue; }

        const rel = analysis?.scores?.reliability?.value;
        const bias = analysis?.scores?.political_establishment_bias?.value;
        if (typeof rel !== 'number' || typeof bias !== 'number') { skipped++; continue; }

        const key = `site_stats:${host}`;
        const existing = await kv.get(key) || { count: 0, sum_rel: 0, sum_bias: 0 };
        const count = (existing.count || 0) + 1;
        const sum_rel = (existing.sum_rel || 0) + rel;
        const sum_bias = (existing.sum_bias || 0) + bias;
        const avg_rel = sum_rel / count;
        const avg_bias = sum_bias / count;

        await kv.set(key, {
          host,
          count,
          sum_rel,
          sum_bias,
          avg_rel,
          avg_bias,
          updated_at: new Date().toISOString()
        });

        // Mark as processed (no expiry)
        await kv.set(markerKey, 1);
        processed++;
      } catch (e) {
        errors++;
      }
    }

    const next_cursor = end + 1;
    return res.status(200).json({ processed, skipped, errors, next_cursor });
  } catch (e) {
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}


