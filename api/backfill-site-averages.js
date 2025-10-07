import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: true, message: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // Optional limit in body: { limit: number }
    let limit = 500;
    try {
      const body = await req.json();
      if (body && Number.isFinite(body.limit) && body.limit > 0 && body.limit <= 5000) {
        limit = Math.floor(body.limit);
      }
    } catch {}

    // Get recent hashes window
    const hashes = await kv.lrange('recent_hashes', 0, Math.max(0, limit - 1));
    if (!hashes || hashes.length === 0) {
      return new Response(JSON.stringify({ processed: 0, skipped: 0, errors: 0, message: 'No recent hashes' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
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

    return new Response(JSON.stringify({ processed, skipped, errors }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: true, message: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}


