import speakeasy from 'speakeasy';
import { requireAuth } from '../../../lib/auth.js';
import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    // Require authentication to verify 2FA setup
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

    const token = String(body.token || '').trim();

    if (!token) {
      return res.status(400).json({ error: true, message: 'Verification token required' });
    }

    // Get the temporary secret
    const tempSecretKey = `2fa_temp_secret:${user.id}`;
    const tempSecret = await kv.get(tempSecretKey);

    if (!tempSecret) {
      return res.status(400).json({ 
        error: true, 
        message: '2FA setup session expired. Please start over.' 
      });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: tempSecret.secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps (60 seconds) of tolerance
    });

    if (!verified) {
      return res.status(400).json({ 
        error: true, 
        message: 'Invalid verification code. Please try again.' 
      });
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );

    // Update user with 2FA settings
    const updatedUser = {
      ...user,
      twoFactorEnabled: true,
      twoFactorSecret: tempSecret.secret,
      twoFactorBackupCodes: backupCodes.map(code => ({
        code: code,
        used: false,
        usedAt: null
      })),
      twoFactorEnabledAt: new Date().toISOString()
    };

    await kv.set(`user:id:${user.id}`, updatedUser);

    // Clean up temporary secret
    await kv.del(tempSecretKey);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      message: '2FA has been successfully enabled!',
      backupCodes: backupCodes
    });

  } catch (e) {
    console.error('2FA verify setup error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}
