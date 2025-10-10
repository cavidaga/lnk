import { withAuth } from '../../lib/middleware.js';
import { getApiKeyUsage } from '../../lib/usage-tracking.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const keyId = url.searchParams.get('keyId');
    const period = url.searchParams.get('period') || 'month'; // day, week, month

    if (!keyId) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ 
        error: true, 
        message: 'keyId parameter is required' 
      });
    }

    const authInfo = req.auth;
    const userId = authInfo.userId;

    // Verify the API key belongs to the authenticated user
    const { kv } = await import('@vercel/kv');
    const keyData = await kv.get(`api_key:${keyId}`);
    
    if (!keyData || keyData.userId !== userId) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).json({ 
        error: true, 
        message: 'API key not found or access denied' 
      });
    }

    // Get usage statistics for the API key
    const usage = await getApiKeyUsage(keyId, period);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-cache');
    return res.status(200).json({
      success: true,
      keyId,
      usage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API key usage error:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ 
      error: true, 
      message: 'Failed to retrieve API key usage data' 
    });
  }
}

// Export with authentication required
export default withAuth(handler, { 
  require: 'any', // Accepts both session and API key
  permission: 'usage', // Requires usage permission for API keys
  rateLimit: true,
  trackUsage: false // Don't track usage for usage endpoints
});
