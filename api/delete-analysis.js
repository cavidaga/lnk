import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs', maxDuration: 30 };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    // Simple admin guard using header key
    const adminKey = process.env.ADMIN_DELETE_KEY || '';
    const provided = req.headers['x-admin-key'];
    if (!adminKey || !provided || provided !== adminKey) {
      return res.status(401).json({ error: true, message: 'Unauthorized' });
    }

    const url = new URL(req.url, 'http://localhost');
    const hash = (url.searchParams.get('hash') || '').trim();
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


