import { kv } from '@vercel/kv';
import { requireAuth } from '../../../lib/auth.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  try {
    // Require authentication
    const user = await requireAuth(req, res);
    if (!user) return;

    // Check if user is admin
    if (user.email !== process.env.ADMIN_EMAIL) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(403).json({ error: true, message: 'Admin access required' });
    }

    const { id } = req.query;
    if (!id) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'User ID required' });
    }

    if (req.method === 'GET') {
      // Get specific user
      const userData = await kv.get(`user:id:${id}`);
      if (!userData) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({ error: true, message: 'User not found' });
      }

      // Remove sensitive data
      const { passwordHash, ...safeUser } = userData;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(safeUser);
    }

    if (req.method === 'PUT') {
      // Update user
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

      const userData = await kv.get(`user:id:${id}`);
      if (!userData) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({ error: true, message: 'User not found' });
      }

      const { plan, email, password } = body;
      const updates = {};

      if (plan && ['free', 'pro', 'enterprise'].includes(plan)) {
        updates.plan = plan;
        updates.planUpdatedAt = new Date().toISOString();
      }

      if (email && email !== userData.email) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          return res.status(400).json({ error: true, message: 'Valid email required' });
        }
        
        // Check if new email already exists
        const existing = await kv.get(`user:email:${email.toLowerCase()}`);
        if (existing) {
          return res.status(409).json({ error: true, message: 'Email already in use' });
        }

        // Update email references
        await kv.del(`user:email:${userData.email}`);
        await kv.set(`user:email:${email.toLowerCase()}`, { id, email: email.toLowerCase() });
        updates.email = email.toLowerCase();
      }

      if (password && password.length >= 8) {
        const bcrypt = await import('bcryptjs');
        updates.passwordHash = await bcrypt.hash(password, 10);
      }

      const updatedUser = { ...userData, ...updates };
      await kv.set(`user:id:${id}`, updatedUser);
      if (updates.email) {
        await kv.set(`user:email:${updates.email}`, { id, email: updates.email });
      }

      // Remove sensitive data from response
      const { passwordHash, ...safeUser } = updatedUser;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(safeUser);
    }

    if (req.method === 'DELETE') {
      // Delete user
      const userData = await kv.get(`user:id:${id}`);
      if (!userData) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({ error: true, message: 'User not found' });
      }

      // Delete user data
      await kv.del(`user:id:${id}`);
      await kv.del(`user:email:${userData.email}`);

      // Delete user's API keys
      const keyPattern = `api_key:user:${id}:*`;
      const keys = await kv.keys(keyPattern);
      for (const key of keys) {
        await kv.del(key);
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true, message: 'User deleted' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  } catch (e) {
    console.error('Admin user API error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

export default handler;
