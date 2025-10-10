import { withAuth } from '../../lib/middleware.js';
import { getUserUsage, getUsageHistory } from '../../lib/usage-tracking.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const period = url.searchParams.get('period') || 'month'; // day, week, month
    const includeHistory = url.searchParams.get('history') === 'true';
    const historyLimit = parseInt(url.searchParams.get('historyLimit') || '50');

    const authInfo = req.auth;
    const userId = authInfo.userId;

    // Get usage statistics
    const usage = await getUserUsage(userId, period);
    
    // Get usage history if requested
    let history = [];
    if (includeHistory) {
      history = await getUsageHistory(userId, historyLimit);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-cache');
    return res.status(200).json({
      success: true,
      usage,
      history: includeHistory ? history : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Usage API error:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ 
      error: true, 
      message: 'Failed to retrieve usage data' 
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
