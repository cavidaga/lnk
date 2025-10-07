import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs', maxDuration: 60 };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    const url = new URL(req.url, 'http://localhost');
    let cursor = Math.max(0, parseInt(url.searchParams.get('cursor') || '0', 10) || 0);
    const limit = Math.min(5000, Math.max(1, parseInt(url.searchParams.get('limit') || '1000', 10) || 1000));

    const start = cursor;
    const end = start + limit - 1;
    const hashes = await kv.lrange('recent_hashes', start, end);
    if (!hashes || hashes.length === 0) {
      return res.status(200).json({ indexed: 0, next_cursor: null });
    }

    let indexed = 0, skipped = 0;
    for (const h of hashes) {
      try {
        const markKey = `search_indexed:${h}`;
        const marked = await kv.get(markKey);
        if (marked) { skipped++; continue; }
        await kv.lpush('search_hashes', h);
        await kv.set(markKey, 1);
        indexed++;
      } catch { skipped++; }
    }
    try { await kv.ltrim('search_hashes', 0, 19999); } catch {}

    const next_cursor = end + 1;
    return res.status(200).json({ indexed, skipped, next_cursor });
  } catch (e) {
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}


