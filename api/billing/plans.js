import { withAuth } from '../../lib/middleware.js';
import { STRIPE_PLANS } from '../../lib/stripe.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  try {
    // Return all available plans
    const plans = Object.values(STRIPE_PLANS).map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      priceDollars: (plan.price / 100).toFixed(2),
      maxRequestsPerMonth: plan.maxRequestsPerMonth,
      maxCostPerMonth: plan.maxCostPerMonth,
      costPerRequest: plan.costPerRequest,
      features: plan.features,
      isFree: plan.price === 0
    }));

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      success: true,
      plans,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Plans API error:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ 
      error: true, 
      message: 'Failed to retrieve plans' 
    });
  }
}

// Export with optional authentication (public endpoint)
export default withAuth(handler, { 
  require: 'optional',
  rateLimit: true,
  trackUsage: false // Don't track usage for plans endpoint
});
