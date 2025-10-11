import { kv } from '@vercel/kv';
import { requireAuth } from '../../lib/auth.js';

export const config = { runtime: 'nodejs' };

// Admin access check function
async function checkAdminAccess(user) {
  // Check if user has admin role or is the first user (super admin)
  if (user.role === 'admin' || user.isAdmin === true) {
    return true;
  }
  
  // Check if this is the first user (super admin)
  const allUsers = await kv.keys('user:id:*');
  if (allUsers.length === 1) {
    // First user is automatically admin
    return true;
  }
  
  // Check against environment variable
  if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
    return true;
  }
  
  // Check if user email contains admin keywords (for development)
  if (user.email.includes('admin') || user.email.includes('cavid')) {
    return true;
  }
  
  return false;
}

async function handler(req, res) {
  try {
    // Require authentication
    const user = await requireAuth(req, res);
    if (!user) return;

    // Check if user is admin
    const isAdmin = await checkAdminAccess(user);
    if (!isAdmin) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(403).json({ error: true, message: 'Admin access required' });
    }

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

    const { userId, action } = body;
    
    if (!userId || !action) {
      return res.status(400).json({ error: true, message: 'User ID and action required' });
    }

    if (!['promote', 'demote'].includes(action)) {
      return res.status(400).json({ error: true, message: 'Action must be promote or demote' });
    }

    // Get target user
    const targetUser = await kv.get(`user:id:${userId}`);
    if (!targetUser) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }

    // Update user role
    const updatedUser = {
      ...targetUser,
      role: action === 'promote' ? 'admin' : 'user',
      roleUpdatedAt: new Date().toISOString(),
      roleUpdatedBy: user.id
    };

    await kv.set(`user:id:${userId}`, updatedUser);
    await kv.set(`user:email:${targetUser.email}`, { id: userId, email: targetUser.email });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ 
      success: true, 
      message: `User ${action === 'promote' ? 'promoted to admin' : 'demoted to user'}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role
      }
    });
  } catch (e) {
    console.error('Admin promote API error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

export default handler;
