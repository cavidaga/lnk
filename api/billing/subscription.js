import { withAuth } from '../../lib/middleware.js';
import { getCustomerSubscriptions, getOrCreateStripeCustomer } from '../../lib/stripe.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  try {
    const authInfo = req.auth;
    if (!authInfo) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(401).json({ error: true, message: 'Authentication required' });
    }

    // Get user data
    const { kv } = await import('@vercel/kv');
    const user = await kv.get(`user:id:${authInfo.userId}`);
    if (!user) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).json({ error: true, message: 'User not found' });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user);
    
    // Get customer's subscriptions
    const subscriptions = await getCustomerSubscriptions(customer.id);

    // Format subscription data
    const formattedSubscriptions = subscriptions.map(sub => ({
      id: sub.id,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      planId: sub.metadata?.planId || 'unknown',
      priceId: sub.items.data[0]?.price?.id || null,
      amount: sub.items.data[0]?.price?.unit_amount || 0,
      currency: sub.items.data[0]?.price?.currency || 'usd'
    }));

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-cache');
    return res.status(200).json({
      success: true,
      customerId: customer.id,
      subscriptions: formattedSubscriptions,
      currentPlan: user.plan || 'free',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Subscription API error:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ 
      error: true, 
      message: 'Failed to retrieve subscription data' 
    });
  }
}

// Export with authentication required
export default withAuth(handler, { 
  require: 'any',
  permission: 'billing',
  rateLimit: true,
  trackUsage: false // Don't track usage for subscription endpoint
});
