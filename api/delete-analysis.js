import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs', maxDuration: 30 };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    // Simple admin guard using header key
    const adminKey = process.env.ADMIN_DELETE_KEY || '';
    // Accept X-Admin-Key or Authorization: Bearer <key> or ?key=<key>
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

    let hash = (url.searchParams.get('hash') || '').trim();
    if (!hash) {
      try {
        let buf = '';
        await new Promise((resolve) => {
          req.on('data', (c) => { buf += c; });
          req.on('end', resolve);
        });
        if (buf && String(buf).trim()) {
          const body = JSON.parse(String(buf));
          if (body?.hash) hash = String(body.hash).trim();
        }
      } catch {}
    }
    if (!hash) {
      return res.status(400).json({ error: true, message: 'Missing hash' });
    }

    // Delete the entry
    const existed = await kv.get(hash);
    await kv.del(hash);

    // Also remove from recent_hashes list best-effort
    try {
      await kv.lrem('recent_hashes', 0, hash);
    } catch {}

    return res.status(200).json({ ok: true, deleted: !!existed, hash });
  } catch (e) {
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}


