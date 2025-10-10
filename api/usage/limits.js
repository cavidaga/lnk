import { withAuth } from '../../lib/middleware.js';
import { checkUsageLimits, getPlanLimits } from '../../lib/usage-tracking.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  try {
    const authInfo = req.auth;
    const userId = authInfo.userId;
    const userPlan = authInfo.userPlan || 'free';

    // Check current usage against limits
    const limitsCheck = await checkUsageLimits(userId, userPlan);
    
    // Get plan details
    const planDetails = getPlanLimits(userPlan);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-cache');
    return res.status(200).json({
      success: true,
      plan: {
        name: planDetails.name,
        limits: planDetails
      },
      current: limitsCheck.current,
      exceeded: limitsCheck.exceeded,
      canMakeRequest: limitsCheck.canMakeRequest,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Limits API error:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ 
      error: true, 
      message: 'Failed to retrieve usage limits' 
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
