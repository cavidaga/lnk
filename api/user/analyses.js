import { requireAuth } from '../../lib/auth.js';
import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return; // 401 already sent

    const key = `user:analyses:${user.id}`;

    if (req.method === 'GET') {
      const analyses = (await kv.get(key)) || [];
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ analyses });
    }

    if (req.method === 'DELETE') {
      await kv.set(key, []);
      // Also reset user's analysisCount if present
      try {
        const userKey = `user:id:${user.id}`;
        const fullUser = await kv.get(userKey);
        if (fullUser) {
          await kv.set(userKey, { ...fullUser, analysisCount: 0 });
        }
      } catch {}
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ ok: true, analyses: [] });
    }

    // Optionally support POST to append an analysis (not used by UI yet)
    if (req.method === 'POST') {
      let body = {};
      try { body = req.body || {}; } catch {}
      if (!body || Object.keys(body).length === 0) {
        body = await new Promise((resolve) => {
          try {
            let buf = '';
            req.on('data', (ch) => buf += ch);
            req.on('end', () => {
              try { resolve(JSON.parse(buf || '{}')); } catch { resolve({}); }
            });
          } catch { resolve({}); }
        });
      }

      const analyses = (await kv.get(key)) || [];
      const item = body && typeof body === 'object' ? body : null;
      if (!item) {
        return res.status(400).json({ error: true, message: 'Invalid analysis payload' });
      }
      analyses.push({ ...item, savedAt: new Date().toISOString() });
      await kv.set(key, analyses);
      // bump analysisCount
      try {
        const userKey = `user:id:${user.id}`;
        const fullUser = await kv.get(userKey);
        if (fullUser) {
          const count = (fullUser.analysisCount || 0) + 1;
          await kv.set(userKey, { ...fullUser, analysisCount: count });
        }
      } catch {}
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(201).json({ ok: true });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  } catch (e) {
    console.error('User analyses API error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

