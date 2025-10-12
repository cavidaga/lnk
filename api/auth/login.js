import { findUserByEmail, verifyPassword, issueJwt, buildSessionCookie } from '../../lib/auth.js';

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

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'Email and password required' });
    }

    // Basic per-identity throttle using KV (5 attempts per 5 minutes)
    try {
      const { kv } = await import('@vercel/kv');
      const key = `login_attempts:${email}`;
      const attempts = await kv.incr(key);
      if (attempts === 1) { await kv.expire(key, 300); }
      if (attempts > 5) {
        await new Promise(r => setTimeout(r, 350));
        return res.status(429).json({ error: true, message: 'Too many attempts. Try again later.' });
      }
    } catch {}

    const user = await findUserByEmail(email);
    if (!user) {
      await new Promise(r => setTimeout(r, 300));
      return res.status(401).json({ error: true, message: 'Invalid credentials' });
    }
    const ok = await verifyPassword(password, user.passwordHash || '');
    if (!ok) {
      await new Promise(r => setTimeout(r, 300));
      return res.status(401).json({ error: true, message: 'Invalid credentials' });
    }

    // Require email verification for regular users (new accounts only)
    if ((user.role === 'user' || !user.role) && Object.prototype.hasOwnProperty.call(user, 'emailVerified') && user.emailVerified !== true) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(403).json({ error: true, message: 'Zəhmət olmasa e‑poçtunuzu təsdiqləyin. Poçtunuza təsdiq linki göndərilib.' });
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Return a special response indicating 2FA is required
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        requiresTwoFactor: true,
        message: 'Please enter your 2FA code to complete login',
        email: user.email
      });
    }

    const token = issueJwt(user);
    const cookie = buildSessionCookie(token);
    res.setHeader('Set-Cookie', cookie);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan || 'free',
        role: user.role || null,
        isAdmin: user.isAdmin === true,
        twoFactorEnabled: user.twoFactorEnabled || false
      }
    });
  } catch (e) {
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}


