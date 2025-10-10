import { requireAuth } from '../../lib/auth.js';
import { revokeApiKey } from '../../lib/api-keys.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'DELETE') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    // Require user authentication
    const user = await requireAuth(req, res);
    if (!user) return; // Response already sent

    // Extract key ID from URL
    const keyId = req.query.id;
    if (!keyId) {
      return res.status(400).json({ error: true, message: 'API key ID is required' });
    }

    try {
      const success = await revokeApiKey(keyId, user.id);
      
      if (!success) {
        return res.status(404).json({ 
          error: true, 
          message: 'API key not found or you do not have permission to revoke it' 
        });
      }
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        message: 'API key revoked successfully'
      });
    } catch (error) {
      console.error('API key revocation error:', error);
      return res.status(500).json({ error: true, message: 'Failed to revoke API key' });
    }
  } catch (e) {
    console.error('Revoke API key error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}
