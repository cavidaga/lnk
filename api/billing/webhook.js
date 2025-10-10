import { verifyWebhookSignature, updateUserPlan, getPlanByPriceId } from '../../lib/stripe.js';
import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  try {
    const body = await req.text();
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Missing Stripe signature' });
    }

    // Verify webhook signature
    const event = verifyWebhookSignature(body, signature);

    console.log('Stripe webhook received:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(400).json({ error: true, message: 'Webhook error' });
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session) {
  try {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    
    if (!userId || !planId) {
      console.error('Missing metadata in checkout session:', session.id);
      return;
    }

    console.log(`Checkout completed for user ${userId}, plan ${planId}`);
    
    // Update user plan
    await updateUserPlan(userId, planId, session.subscription);
    
  } catch (error) {
    console.error('Error handling checkout completed:', error);
  }
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscription) {
  try {
    const userId = subscription.metadata?.userId;
    const planId = subscription.metadata?.planId;
    
    if (!userId || !planId) {
      console.error('Missing metadata in subscription:', subscription.id);
      return;
    }

    console.log(`Subscription created for user ${userId}, plan ${planId}`);
    
    // Update user plan
    await updateUserPlan(userId, planId, subscription.id);
    
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription) {
  try {
    const userId = subscription.metadata?.userId;
    const planId = subscription.metadata?.planId;
    
    if (!userId || !planId) {
      console.error('Missing metadata in subscription update:', subscription.id);
      return;
    }

    console.log(`Subscription updated for user ${userId}, plan ${planId}, status: ${subscription.status}`);
    
    // Update user plan based on subscription status
    if (subscription.status === 'active') {
      await updateUserPlan(userId, planId, subscription.id);
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      await updateUserPlan(userId, 'free', null);
    }
    
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription) {
  try {
    const userId = subscription.metadata?.userId;
    
    if (!userId) {
      console.error('Missing userId in subscription deletion:', subscription.id);
      return;
    }

    console.log(`Subscription deleted for user ${userId}`);
    
    // Downgrade user to free plan
    await updateUserPlan(userId, 'free', null);
    
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    
    if (!subscriptionId) {
      console.log('Payment succeeded but no subscription found');
      return;
    }

    // Get subscription details
    const { stripe } = await import('../../lib/stripe.js');
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const userId = subscription.metadata?.userId;
    const planId = subscription.metadata?.planId;
    
    if (userId && planId) {
      console.log(`Payment succeeded for user ${userId}, plan ${planId}`);
      await updateUserPlan(userId, planId, subscriptionId);
    }
    
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
  try {
    const subscriptionId = invoice.subscription;
    
    if (!subscriptionId) {
      console.log('Payment failed but no subscription found');
      return;
    }

    // Get subscription details
    const { stripe } = await import('../../lib/stripe.js');
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const userId = subscription.metadata?.userId;
    
    if (userId) {
      console.log(`Payment failed for user ${userId}`);
      // Optionally downgrade to free plan or send notification
      // await updateUserPlan(userId, 'free', null);
    }
    
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}
