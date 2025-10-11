import { getSessionFromRequest } from '../lib/auth.js';
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const session = await getSessionFromRequest(req);
    
    if (!session || !session.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Check if current user is admin (for security)
    const currentUser = session.user;
    const isCurrentUserAdmin = currentUser.role === 'admin' || 
                              currentUser.isAdmin === true || 
                              currentUser.email === process.env.ADMIN_EMAIL;

    if (!isCurrentUserAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Get user from database
    const userKey = `user:${email}`;
    const user = await kv.get(userKey);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user to admin
    const updatedUser = {
      ...user,
      role: 'admin',
      isAdmin: true
    };

    await kv.set(userKey, updatedUser);

    return res.json({ 
      message: 'User promoted to admin successfully',
      user: {
        email: updatedUser.email,
        role: updatedUser.role,
        isAdmin: updatedUser.isAdmin
      }
    });
    
  } catch (error) {
    console.error('Promote to admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
