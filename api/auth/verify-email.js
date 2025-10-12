import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    const token = String(req.query?.token || '').trim();
    if (!token) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Missing token' });
    }

    const key = `emailverify:token:${token}`;
    const data = await kv.get(key);
    if (!data?.userId) {
      // Invalid or expired
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Invalid or expired token' });
    }

    const userKey = `user:id:${data.userId}`;
    const user = await kv.get(userKey);
    if (!user) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Invalid or expired token' });
    }

    // Mark verified
    const updatedUser = { ...user, emailVerified: true, verifiedAt: new Date().toISOString() };
    await kv.set(userKey, updatedUser);
    try { await kv.del(key); } catch {}

    // Redirect to login with success flag
    res.statusCode = 302;
    res.setHeader('Location', `/user-login.html?verified=1`);
    return res.end();
  } catch (e) {
    console.error('verify-email error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

