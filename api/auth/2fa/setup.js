import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { requireAuth } from '../../../lib/auth.js';
import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    // Require authentication to setup 2FA
    const user = await requireAuth(req, res);
    if (!user) return; // requireAuth already sent the response

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({ 
        error: true, 
        message: '2FA is already enabled for this account' 
      });
    }

    // Generate a secret
    const secret = speakeasy.generateSecret({
      name: `LNK (${user.email})`,
      issuer: 'LNK Media Analyzer',
      length: 32
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store the secret temporarily (will be confirmed later)
    const tempSecretKey = `2fa_temp_secret:${user.id}`;
    await kv.set(tempSecretKey, {
      secret: secret.base32,
      createdAt: new Date().toISOString()
    }, { ex: 300 }); // Expire in 5 minutes

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    });

  } catch (e) {
    console.error('2FA setup error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}
