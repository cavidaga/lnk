import { requireAuth } from '../../lib/auth.js';
import { getUserApiKeys } from '../../lib/api-keys.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    // Require user authentication
    const user = await requireAuth(req, res);
    if (!user) return; // Response already sent

    try {
      const apiKeys = await getUserApiKeys(user.id);
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        apiKeys: apiKeys.map(key => ({
          id: key.id,
          name: key.name,
          permissions: key.permissions,
          createdAt: key.createdAt,
          lastUsed: key.lastUsed,
          isActive: key.isActive
        }))
      });
    } catch (error) {
      console.error('API key listing error:', error);
      return res.status(500).json({ error: true, message: 'Failed to list API keys' });
    }
  } catch (e) {
    console.error('List API keys error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}
