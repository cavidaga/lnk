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


