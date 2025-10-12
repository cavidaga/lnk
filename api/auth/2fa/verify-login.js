import speakeasy from 'speakeasy';
import { findUserByEmail } from '../../../lib/auth.js';
import { kv } from '@vercel/kv';

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
    const token = String(body.token || '').trim();
    const backupCode = String(body.backupCode || '').trim();

    if (!email) {
      return res.status(400).json({ error: true, message: 'Email required' });
    }

    if (!token && !backupCode) {
      return res.status(400).json({ error: true, message: 'Verification code or backup code required' });
    }

    // Get user
    const user = await findUserByEmail(email);
    if (!user) {
      await new Promise(r => setTimeout(r, 300)); // Prevent timing attacks
      return res.status(401).json({ error: true, message: 'Invalid credentials' });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ 
        error: true, 
        message: '2FA is not enabled for this account' 
      });
    }

    let verified = false;

    // Try backup code first if provided (hashed storage)
    if (backupCode) {
      if (user.twoFactorBackupCodes && Array.isArray(user.twoFactorBackupCodes)) {
        const { createHash } = await import('crypto');
        const hash = createHash('sha256').update(backupCode.toUpperCase()).digest('hex');
        const backupCodeEntry = user.twoFactorBackupCodes.find(entry => 
          (entry.codeHash === hash) && !entry.used
        );
        
        if (backupCodeEntry) {
          // Mark backup code as used
          backupCodeEntry.used = true;
          backupCodeEntry.usedAt = new Date().toISOString();
          
          // Update user with used backup code
          await kv.set(`user:id:${user.id}`, user);
          verified = true;
        }
      }
    } else if (token) {
      // Try TOTP token
      verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 2 time steps (60 seconds) of tolerance
      });
    }

    if (!verified) {
      await new Promise(r => setTimeout(r, 300)); // Prevent timing attacks
      return res.status(401).json({ 
        error: true, 
        message: 'Invalid verification code' 
      });
    }

    // Update last login time
    const updatedUser = {
      ...user,
      lastLoginAt: new Date().toISOString()
    };
    await kv.set(`user:id:${user.id}`, updatedUser);

    // Issue JWT token
    const { issueJwt, buildSessionCookie } = await import('../../../lib/auth.js');
    const jwtToken = issueJwt(updatedUser);
    const cookie = buildSessionCookie(jwtToken);
    
    res.setHeader('Set-Cookie', cookie);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan || 'free',
        role: user.role || null,
        isAdmin: user.isAdmin === true,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });

  } catch (e) {
    console.error('2FA verify login error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}
