import { kv } from '@vercel/kv';
import { hashPassword, issueJwt, buildSessionCookie } from '../../lib/auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

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

    const token = String(body.token || '');
    const newPassword = String(body.newPassword || '');
    if (!token || !newPassword) {
      return res.status(400).json({ error: true, message: 'Invalid reset request' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: true, message: 'Password must be at least 8 characters' });
    }

    const key = `pwdreset:token:${token}`;
    const data = await kv.get(key);
    if (!data?.userId) {
      // Invalid or expired token
      return res.status(400).json({ error: true, message: 'Invalid or expired token' });
    }

    // Rotate password
    const userKey = `user:id:${data.userId}`;
    const user = await kv.get(userKey);
    if (!user) {
      return res.status(400).json({ error: true, message: 'Invalid or expired token' });
    }
    const passwordHash = await hashPassword(newPassword);
    const updatedUser = { ...user, passwordHash, passwordChangedAt: new Date().toISOString() };
    await kv.set(userKey, updatedUser);
    // Delete token to make it single-use
    try { await kv.del(key); } catch {}

    // Auto-login the user
    const jwt = issueJwt(updatedUser);
    const cookie = buildSessionCookie(jwt);
    res.setHeader('Set-Cookie', cookie);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('reset-password error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

