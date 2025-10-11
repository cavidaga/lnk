import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Plan configurations
export const STRIPE_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for developers and small projects getting started with media analysis. Includes basic reliability and bias scoring with limited monthly usage.',
    price: 0,
    priceId: process.env.STRIPE_FREE_PRICE_ID || null, // Optional: Create $0/month plan in Stripe
    maxRequestsPerMonth: 100,
    maxCostPerMonth: 100, // 100 cents = $1
    costPerRequest: 0.5,  // 0.5 cents per request
    features: [
      '100 requests/month',
      'Basic reliability & bias scoring',
      'Community support',
      'Standard response times'
    ],
    billing: 'Free forever'
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'Ideal for small businesses, bloggers, and content creators who need regular media analysis. Includes priority support and higher usage limits for growing projects.',
    price: 0, // Free for now
    priceId: null, // No Stripe integration yet
    maxRequestsPerMonth: 1000,
    maxCostPerMonth: 1000, // 1000 cents = $10
    costPerRequest: 0.3,   // 0.3 cents per request
    features: [
      '1,000 requests/month',
      'Priority support',
      'API access',
      'Faster response times',
      'Usage analytics'
    ],
    billing: 'Coming Soon',
    status: 'coming-soon'
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Perfect for media companies, news organizations, and agencies requiring high-volume analysis. Includes advanced features, webhooks, and xüsusi support for professional workflows.',
    price: 0, // Free for now
    priceId: null, // No Stripe integration yet
    maxRequestsPerMonth: 10000,
    maxCostPerMonth: 5000, // 5000 cents = $50
    costPerRequest: 0.2,   // 0.2 cents per request
    features: [
      '10,000 requests/month',
      'Priority support',
      'API access',
      'Webhooks',
      'Advanced analytics',
      'Custom integrations',
      'SLA guarantee'
    ],
    billing: 'Coming Soon',
    status: 'coming-soon'
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Designed for large organizations with enterprise needs. Includes custom integrations, SLA guarantees, and xüsusi support for mission-critical media analysis at scale.',
    price: 0, // Free for now
    priceId: null, // No Stripe integration yet
    maxRequestsPerMonth: 100000,
    maxCostPerMonth: 50000, // 50000 cents = $500
    costPerRequest: 0.1,    // 0.1 cents per request
    features: [
      '100,000 requests/month',
      'Xüsusi dəstək',
      'Custom integrations',
      'SLA guarantee',
      'Webhooks',
      'Advanced analytics',
      'White-label options',
      'Custom pricing available'
    ],
    billing: 'Coming Soon',
    status: 'coming-soon'
  }
};

/**
 * Create a Stripe customer
 */
export async function createStripeCustomer(user) {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || user.email,
      metadata: {
        userId: user.id,
        plan: user.plan || 'free'
      }
    });
    
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw new Error('Failed to create customer');
  }
}

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(user) {
  try {
    // First, try to find existing customer
    const existingCustomers = await stripe.customers.list({
      email: user.email,
      limit: 1
    });
    
    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }
    
    // Create new customer if not found
    return await createStripeCustomer(user);
  } catch (error) {
    console.error('Error getting/creating Stripe customer:', error);
    throw new Error('Failed to get or create customer');
  }
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(user, planId, successUrl, cancelUrl) {
  try {
    const plan = STRIPE_PLANS[planId];
    if (!plan || !plan.priceId) {
      throw new Error('Invalid plan or plan not configured');
    }
    
    const customer = await getOrCreateStripeCustomer(user);
    
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        planId: planId
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planId: planId
        }
      }
    });
    
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new Error('Failed to create checkout session');
  }
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession(user, returnUrl) {
  try {
    const customer = await getOrCreateStripeCustomer(user);
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: returnUrl,
    });
    
    return session;
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    throw new Error('Failed to create billing portal session');
  }
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error getting subscription:', error);
    throw new Error('Failed to get subscription');
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId) {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw new Error('Failed to cancel subscription');
  }
}

/**
 * Get customer's subscriptions
 */
export async function getCustomerSubscriptions(customerId) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10
    });
    
    return subscriptions.data;
  } catch (error) {
    console.error('Error getting customer subscriptions:', error);
    throw new Error('Failed to get subscriptions');
  }
}

/**
 * Update customer's plan in our database
 */
export async function updateUserPlan(userId, planId, subscriptionId = null) {
  try {
    const { kv } = await import('@vercel/kv');
    
    // Get current user data
    const user = await kv.get(`user:id:${userId}`);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Update user plan
    const updatedUser = {
      ...user,
      plan: planId,
      stripeSubscriptionId: subscriptionId,
      planUpdatedAt: new Date().toISOString()
    };
    
    // Save updated user
    await kv.set(`user:id:${userId}`, updatedUser);
    await kv.set(`user:email:${user.email}`, updatedUser);
    
    return updatedUser;
  } catch (error) {
    console.error('Error updating user plan:', error);
    throw new Error('Failed to update user plan');
  }
}

/**
 * Get plan by Stripe price ID
 */
export function getPlanByPriceId(priceId) {
  for (const [planId, plan] of Object.entries(STRIPE_PLANS)) {
    if (plan.priceId === priceId) {
      return { planId, ...plan };
    }
  }
  return null;
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(payload, signature) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }
    
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return event;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    throw new Error('Invalid webhook signature');
  }
}

export { stripe };
