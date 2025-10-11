import { requireAuth, verifyPassword, issueJwt, buildSessionCookie, findUserByEmail } from '../../lib/auth.js';
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
    const newEmail = String(body.newEmail || '').trim().toLowerCase();

    if (!currentPassword || !newEmail) {
      return res.status(400).json({ error: true, message: 'Current password and new email are required' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      return res.status(400).json({ error: true, message: 'Valid email required' });
    }
    if (newEmail === (user.email || '').toLowerCase()) {
      return res.status(400).json({ error: true, message: 'New email must be different' });
    }

    // Verify current password
    const ok = await verifyPassword(currentPassword, user.passwordHash || '');
    if (!ok) {
      await new Promise(r => setTimeout(r, 300));
      return res.status(401).json({ error: true, message: 'Invalid credentials' });
    }

    // Check uniqueness of new email
    const existing = await findUserByEmail(newEmail);
    if (existing) {
      return res.status(409).json({ error: true, message: 'Email already in use' });
    }

    // Update user record
    const oldEmail = user.email;
    const updatedUser = { ...user, email: newEmail };
    await kv.set(`user:id:${user.id}`, updatedUser);
    // Update email index
    await kv.set(`user:email:${newEmail}`, { id: user.id, email: newEmail });
    try { await kv.del(`user:email:${String(oldEmail || '').toLowerCase()}`); } catch {}

    // Re-issue session cookie with updated email claim
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
    console.error('Change email error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

