import { getSessionFromRequest } from '../../lib/auth.js';
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { developerId, action } = req.body; // action: 'approve' or 'reject'

    if (!developerId || !action) {
      return res.status(400).json({ message: 'Developer ID and action are required' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be approve or reject' });
    }

    // Get the pending request
    const pendingKey = `pending_dev:${developerId}`;
    const pendingRequest = await kv.get(pendingKey);
    
    if (!pendingRequest) {
      return res.status(404).json({ message: 'Pending request not found' });
    }

    if (action === 'approve') {
      // Update user status to approved
      const userKey = `user:id:${developerId}`;
      const userData = await kv.get(userKey);
      
      if (userData) {
        const updatedUser = {
          ...userData,
          status: 'approved',
          approvedAt: new Date().toISOString(),
          approvedBy: user.email
        };
        
        await kv.set(userKey, updatedUser);
      }

      // Remove from pending list
      const pendingListKey = 'pending_dev_requests';
      const pendingIds = await kv.get(pendingListKey) || [];
      const updatedPendingIds = pendingIds.filter(id => id !== developerId);
      await kv.set(pendingListKey, updatedPendingIds);

      // Remove pending request
      await kv.del(pendingKey);

      return res.json({ 
        message: 'Developer approved successfully',
        developerId,
        email: pendingRequest.email
      });
    } else {
      // Reject the request
      const userKey = `user:id:${developerId}`;
      const userData = await kv.get(userKey);
      
      if (userData) {
        const updatedUser = {
          ...userData,
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectedBy: user.email
        };
        
        await kv.set(userKey, updatedUser);
      }

      // Remove from pending list
      const pendingListKey = 'pending_dev_requests';
      const pendingIds = await kv.get(pendingListKey) || [];
      const updatedPendingIds = pendingIds.filter(id => id !== developerId);
      await kv.set(pendingListKey, updatedPendingIds);

      // Remove pending request
      await kv.del(pendingKey);

      return res.json({ 
        message: 'Developer request rejected',
        developerId,
        email: pendingRequest.email
      });
    }
    
  } catch (error) {
    console.error('Error processing developer request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
