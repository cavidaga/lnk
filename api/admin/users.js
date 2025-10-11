import { kv } from '@vercel/kv';
import { requireAuth } from '../../lib/auth.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  try {
    // Require authentication
    const user = await requireAuth(req, res);
    if (!user) return;

    // Check if user is admin (you can implement your own admin check logic)
    if (user.email !== process.env.ADMIN_EMAIL) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(403).json({ error: true, message: 'Admin access required' });
    }

    if (req.method === 'GET') {
      // List all users
      const users = [];
      const keys = await kv.keys('user:id:*');
      
      for (const key of keys) {
        const userData = await kv.get(key);
        if (userData) {
          // Remove sensitive data
          const { passwordHash, ...safeUser } = userData;
          users.push(safeUser);
        }
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ users });
    }

    if (req.method === 'POST') {
      // Create new user
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

      const { email, password, plan = 'free' } = body;
      
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: true, message: 'Valid email required' });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ error: true, message: 'Password must be at least 8 characters' });
      }

      // Check if user already exists
      const existing = await kv.get(`user:email:${email.toLowerCase()}`);
      if (existing) {
        return res.status(409).json({ error: true, message: 'User already exists' });
      }

      // Create new user
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);
      const id = `u_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      
      const newUser = {
        id,
        email: email.toLowerCase(),
        passwordHash,
        plan,
        createdAt: new Date().toISOString(),
        createdBy: user.id
      };

      await kv.set(`user:id:${id}`, newUser);
      await kv.set(`user:email:${email.toLowerCase()}`, { id, email: email.toLowerCase() });

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(201).json({ 
        id: newUser.id, 
        email: newUser.email, 
        plan: newUser.plan,
        createdAt: newUser.createdAt
      });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  } catch (e) {
    console.error('Admin users API error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

export default handler;
