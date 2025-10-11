import { requireAuth } from '../../lib/auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }
    const user = await requireAuth(req, res);
    if (!user) return; // response already sent
    
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.displayName || user.username,
        plan: user.plan || 'free',
        role: user.role || (user.isAdmin ? 'admin' : 'user'),
        isAdmin: user.isAdmin === true,
        twoFactorEnabled: user.twoFactorEnabled || false
      }
    });
  } catch (e) {
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}


