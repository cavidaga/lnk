import { requireAuth, verifyPassword, hashPassword, issueJwt, buildSessionCookie } from '../../lib/auth.js';
import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    const user = await requireAuth(req, res);
    if (!user) return; // 401 already sent

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

    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: true, message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: true, message: 'New password must be at least 8 characters' });
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash || '');
    if (!ok) {
      await new Promise(r => setTimeout(r, 300));
      return res.status(401).json({ error: true, message: 'Invalid credentials' });
    }

    const passwordHash = await hashPassword(newPassword);
    const updatedUser = { ...user, passwordHash, passwordChangedAt: new Date().toISOString() };
    await kv.set(`user:id:${user.id}`, updatedUser);

    // Re-issue session cookie (old sessions will be rejected by passwordChangedAt check)
    const token = issueJwt(updatedUser);
    const cookie = buildSessionCookie(token);
    res.setHeader('Set-Cookie', cookie);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.displayName || updatedUser.username,
        plan: updatedUser.plan || 'free',
        role: updatedUser.role || (updatedUser.isAdmin ? 'admin' : 'user'),
        isAdmin: updatedUser.isAdmin === true
      }
    });
  } catch (e) {
    console.error('Change password error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

