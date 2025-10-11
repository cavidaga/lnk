import { requireAuth } from '../../../lib/auth.js';
import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    // Require authentication to disable 2FA
    const user = await requireAuth(req, res);
    if (!user) return;

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

    const password = String(body.password || '');

    if (!password) {
      return res.status(400).json({ error: true, message: 'Password required to disable 2FA' });
    }

    // Verify password
    const { verifyPassword } = await import('../../../lib/auth.js');
    const passwordValid = await verifyPassword(password, user.passwordHash || '');
    
    if (!passwordValid) {
      return res.status(400).json({ 
        error: true, 
        message: 'Invalid password' 
      });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ 
        error: true, 
        message: '2FA is not enabled for this account' 
      });
    }

    // Update user to disable 2FA
    const updatedUser = {
      ...user,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
      twoFactorDisabledAt: new Date().toISOString()
    };

    await kv.set(`user:id:${user.id}`, updatedUser);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      message: '2FA has been successfully disabled'
    });

  } catch (e) {
    console.error('2FA disable error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}
