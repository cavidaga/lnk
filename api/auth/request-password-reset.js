import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { findUserByEmail } from '../../lib/auth.js';
import { sendMail } from '../../lib/email.js';
import { passwordResetHtml } from '../../lib/email-templates.js';

export const config = { runtime: 'nodejs' };

const TTL_SECONDS = 60 * 60; // 1 hour

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
    if (!email) {
      return res.status(200).json({ ok: true }); // generic
    }

    // Find user silently
    const user = await findUserByEmail(email);
    if (user?.id) {
      // Create token and store with TTL
      const token = crypto.randomBytes(32).toString('base64url');
      const key = `pwdreset:token:${token}`;
      await kv.set(key, { userId: user.id, email, createdAt: new Date().toISOString() });
      await kv.expire(key, TTL_SECONDS);

      const base = process.env.PUBLIC_BASE_URL || (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host'] ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}` : '');
      const link = `${base}/reset-password.html?token=${encodeURIComponent(token)}`;

      // Send email (best-effort)
      await sendMail({
        to: email,
        subject: 'Parolun sıfırlanması • LNK.az',
        text: `Parolunuzu sıfırlamaq üçün bu linkdən istifadə edin (1 saat etibarlıdır): ${link}`,
        html: passwordResetHtml(link)
      });
    }

    // Always return success to avoid enumeration
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('request-password-reset error:', e);
    return res.status(200).json({ ok: true }); // still generic
  }
}
