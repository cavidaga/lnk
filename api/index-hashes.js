import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs', maxDuration: 30 };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    const adminKey = process.env.ADMIN_INDEX_KEY || '';

    // Accept key via header, bearer, or query
    const hdrKey = String(req.headers['x-admin-key'] || '').trim();
    const auth = String(req.headers['authorization'] || '').trim();
    const url = new URL(req.url, 'http://localhost');
    const queryKey = String(url.searchParams.get('key') || '').trim();
    let provided = '';
    if (hdrKey) provided = hdrKey;
    else if (auth.toLowerCase().startsWith('bearer ')) provided = auth.slice(7).trim();
    else if (queryKey) provided = queryKey;

    const ok = (() => {
      try {
        if (!adminKey || !provided) return false;
        const a = Buffer.from(String(adminKey));
        const b = Buffer.from(String(provided));
        if (a.length !== b.length) return false;
        return require('crypto').timingSafeEqual(a, b);
      } catch { return false; }
    })();
    if (!ok) return res.status(401).json({ error: true, message: 'Unauthorized' });

    let hashes = [];
    try {
      let buf = '';
      await new Promise((resolve) => { req.on('data', c => { buf += c; }); req.on('end', resolve); });
      if (buf && String(buf).trim()) {
        const body = JSON.parse(String(buf));
        if (Array.isArray(body?.hashes)) hashes = body.hashes.filter(x => typeof x === 'string' && x.trim());
      }
    } catch {}

    if (!hashes.length) {
      return res.status(400).json({ error: true, message: 'Provide { "hashes": ["..."] }' });
    }

    let indexed = 0, skipped = 0;
    for (const hRaw of hashes) {
      const h = String(hRaw).trim();
      if (!h) { skipped++; continue; }
      try {
        const exists = await kv.get(h);
        if (!exists) { skipped++; continue; }
        const markKey = `search_indexed:${h}`;
        const marked = await kv.get(markKey);
        if (marked) { skipped++; continue; }
        await kv.lpush('search_hashes', h);
        await kv.set(markKey, 1);
        indexed++;
      } catch { skipped++; }
    }
    try { await kv.ltrim('search_hashes', 0, 19999); } catch {}

    return res.status(200).json({ ok: true, indexed, skipped });
  } catch (e) {
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}


