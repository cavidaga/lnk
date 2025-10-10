import { registerUser } from '../../lib/auth.js';

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
      // fallback parse if bodyParser not active
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
    const registrationToken = String(body.registrationToken || '');

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: true, message: 'Valid email required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: true, message: 'Password must be at least 8 characters' });
    }

    try {
      const user = await registerUser({ email, password, registrationToken });
      return res.status(201).json({ id: user.id, email: user.email });
    } catch (e) {
      if (e.code === 'REG_DISABLED') {
        return res.status(403).json({ error: true, message: 'Registration is disabled' });
      }
      if (e.code === 'EMAIL_EXISTS') {
        return res.status(409).json({ error: true, message: 'Email already registered' });
      }
      return res.status(500).json({ error: true, message: 'Internal error' });
    }
  } catch (e) {
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}


