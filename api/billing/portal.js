import { withAuth } from '../../lib/middleware.js';
import { createBillingPortalSession } from '../../lib/stripe.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  try {
    const authInfo = req.auth;
    if (!authInfo) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(401).json({ error: true, message: 'Authentication required' });
    }

    const { returnUrl } = req.body;

    // Get user data
    const { kv } = await import('@vercel/kv');
    const user = await kv.get(`user:id:${authInfo.userId}`);
    if (!user) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).json({ error: true, message: 'User not found' });
    }

    // Create billing portal session
    const session = await createBillingPortalSession(
      user,
      returnUrl || `${process.env.VERCEL_URL || 'http://localhost:3000'}/admin`
    );

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      url: session.url,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Billing portal API error:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ 
      error: true, 
      message: 'Failed to create billing portal session' 
    });
  }
}

// Export with authentication required
export default withAuth(handler, { 
  require: 'any',
  permission: 'billing',
  rateLimit: true,
  trackUsage: false // Don't track usage for billing portal endpoint
});
