import { withAuth } from '../../lib/middleware.js';
import { createCheckoutSession, STRIPE_PLANS } from '../../lib/stripe.js';

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

    const { planId, successUrl, cancelUrl } = req.body;

    if (!planId) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Plan ID is required' });
    }

    // Validate plan exists
    if (!STRIPE_PLANS[planId]) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Invalid plan ID' });
    }

    // Handle free plan differently
    if (planId === 'free') {
      // For free plan, just update the user's plan directly
      const { kv } = await import('@vercel/kv');
      const user = await kv.get(`user:id:${authInfo.userId}`);
      if (!user) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({ error: true, message: 'User not found' });
      }

      // Update user to free plan
      const updatedUser = {
        ...user,
        plan: 'free',
        stripeSubscriptionId: null,
        planUpdatedAt: new Date().toISOString()
      };
      
      await kv.set(`user:id:${authInfo.userId}`, updatedUser);
      await kv.set(`user:email:${user.email}`, updatedUser);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        message: 'Successfully switched to free plan',
        plan: 'free',
        timestamp: new Date().toISOString()
      });
    }

    // Get user data
    const { kv } = await import('@vercel/kv');
    const user = await kv.get(`user:id:${authInfo.userId}`);
    if (!user) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).json({ error: true, message: 'User not found' });
    }

    // Create checkout session
    const session = await createCheckoutSession(
      user,
      planId,
      successUrl || `${process.env.VERCEL_URL || 'http://localhost:3000'}/admin?success=true`,
      cancelUrl || `${process.env.VERCEL_URL || 'http://localhost:3000'}/admin?canceled=true`
    );

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Checkout API error:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ 
      error: true, 
      message: 'Failed to create checkout session' 
    });
  }
}

// Export with authentication required
export default withAuth(handler, { 
  require: 'any',
  permission: 'billing',
  rateLimit: true,
  trackUsage: false // Don't track usage for checkout endpoint
});
