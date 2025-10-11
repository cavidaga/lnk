import { getSessionFromRequest } from '../../lib/auth.js';
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check if user is authenticated
    const session = getSessionFromRequest(req);
    if (!session?.sub) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Get full user data from database
    const user = await kv.get(`user:id:${session.sub}`);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if user is admin
    const isAdmin = user.role === 'admin' || 
                   user.isAdmin === true || 
                   user.email === process.env.ADMIN_EMAIL;

    if (!isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Get pending developer requests
    const pendingListKey = 'pending_dev_requests';
    const pendingIds = await kv.get(pendingListKey) || [];

    const pendingRequests = [];
    for (const id of pendingIds) {
      const pendingKey = `pending_dev:${id}`;
      const request = await kv.get(pendingKey);
      if (request) {
        pendingRequests.push(request);
      }
    }

    // Sort by requested date (newest first)
    pendingRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    return res.json({
      pendingRequests,
      total: pendingRequests.length
    });
    
  } catch (error) {
    console.error('Error fetching pending developers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
