import { kv } from '@vercel/kv';
import { requireAuth } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check if user is authenticated
    const user = await requireAuth(req, res);
    if (!user) return;

    // Check if user is admin
    const isAdmin = user.role === 'admin' || 
                   user.isAdmin === true || 
                   user.email === process.env.ADMIN_EMAIL;

    if (!isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Get all users
    const keys = await kv.keys('user:id:*');
    const users = [];
    
    for (const key of keys) {
      const userData = await kv.get(key);
      if (userData) {
        users.push(userData);
      }
    }

    // Calculate statistics
    const stats = {
      total: users.length,
      free: users.filter(u => u.plan === 'free').length,
      basic: users.filter(u => u.plan === 'basic').length,
      pro: users.filter(u => u.plan === 'pro').length,
      enterprise: users.filter(u => u.plan === 'enterprise').length,
      admins: users.filter(u => u.role === 'admin' || u.isAdmin === true).length,
      developers: users.filter(u => u.role === 'developer').length,
      approvedDevelopers: users.filter(u => u.role === 'developer' && u.status === 'approved').length,
      pendingDevelopers: users.filter(u => u.role === 'developer' && u.status === 'pending').length,
      rejectedDevelopers: users.filter(u => u.role === 'developer' && u.status === 'rejected').length
    };

    return res.json(stats);
    
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
