import { hashPassword } from '../../lib/auth.js';
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
    const password = String(body.password || '');
    const company = String(body.company || '').trim();
    const reason = String(body.reason || '').trim();

    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'Email and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: true, message: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const emailKey = `user:email:${email}`;
    const existing = await kv.get(emailKey);
    if (existing) {
      return res.status(400).json({ error: true, message: 'Email already registered' });
    }

    // Create user with pending status
    const id = `u_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const passwordHash = await hashPassword(password);
    
    const user = {
      id,
      email,
      passwordHash,
      role: 'developer',
      isAdmin: false,
      status: 'pending', // Pending approval
      plan: 'free',
      company: company || '',
      reason: reason || '',
      createdAt: new Date().toISOString(),
      requestedAt: new Date().toISOString()
    };

    // Store user data
    await kv.set(`user:id:${id}`, user);
    await kv.set(emailKey, { id, email: user.email });

    // Store in pending requests for admin review
    const pendingKey = `pending_dev:${id}`;
    await kv.set(pendingKey, {
      id,
      email,
      company,
      reason,
      requestedAt: user.requestedAt,
      status: 'pending'
    });

    // Add to pending requests list
    const pendingListKey = 'pending_dev_requests';
    const pendingList = await kv.get(pendingListKey) || [];
    pendingList.push(id);
    await kv.set(pendingListKey, pendingList);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ 
      message: 'Registration successful! Your developer account is pending approval. You will receive an email when approved.',
      id,
      email: user.email,
      status: 'pending'
    });
  } catch (e) {
    console.error('Dev registration error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}
