import { hashPassword } from '../../lib/auth.js';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { sendMail } from '../../lib/email.js';
import { verificationEmailHtml } from '../../lib/email-templates.js';

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
    const username = String(body.username || '').trim();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: true, message: 'Valid email required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: true, message: 'Password must be at least 8 characters' });
    }
    if (!username || username.length < 3) {
      return res.status(400).json({ error: true, message: 'Username must be at least 3 characters' });
    }

    // Check if email already exists
    const emailKey = `user:email:${email}`;
    const existingEmail = await kv.get(emailKey);
    if (existingEmail) {
      return res.status(400).json({ error: true, message: 'Email already registered' });
    }

    // Check if username already exists
    const usernameKey = `user:username:${username.toLowerCase()}`;
    const existingUsername = await kv.get(usernameKey);
    if (existingUsername) {
      return res.status(400).json({ error: true, message: 'Username already taken' });
    }

    // Create user
    const id = `u_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const passwordHash = await hashPassword(password);

    const user = {
      id,
      email,
      username: username.toLowerCase(),
      displayName: username,
      passwordHash,
      role: 'user',
      isAdmin: false,
      plan: 'free',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      analysisCount: 0,
      emailVerified: false
    };

    // Store user data
    await kv.set(`user:id:${id}`, user);
    await kv.set(emailKey, { id, email: user.email });
    await kv.set(usernameKey, { id, username: user.username });

    // Initialize user analysis tracking
    await kv.set(`user:analyses:${id}`, []);

    // Send email verification link (valid for 48h)
    try {
      const TTL_SECONDS = 60 * 60 * 24 * 2; // 48 hours
      const token = crypto.randomBytes(32).toString('base64url');
      const key = `emailverify:token:${token}`;
      await kv.set(key, { userId: id, email, createdAt: new Date().toISOString() });
      await kv.expire(key, TTL_SECONDS);

      const base = process.env.PUBLIC_BASE_URL || (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host'] ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}` : '');
      const link = `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

      const subject = 'E-poçtunuzu təsdiqləyin | LNK.az';
      const text = `Qeydiyyatı tamamlamaq üçün bu linkə klikləyin (48 saat etibarlıdır): ${link}`;
      await sendMail({ to: email, subject, text, html: verificationEmailHtml(link, base) });
    } catch (e) {
      console.error('Failed to send verification email:', e);
      // Do not fail registration if email fails; user can request resend later
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(201).json({
      message: 'Qeydiyyat uğurludur! Zəhmət olmasa e-poçtunuzu təsdiqləyin (poçtunuza link göndərdik).',
      user: {
        id: user.id,
        email: user.email,
        username: user.displayName,
        plan: user.plan
      }
    });
  } catch (e) {
    console.error('User registration error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}