# Stripe Setup Guide

## Required Environment Variables

Set these in your Vercel dashboard under Settings → Environment Variables:

### Stripe Keys (You already have these)
```bash
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_MCP_KEY=...
```

### Stripe Price IDs (Create these in Stripe Dashboard)
```bash
# Optional: Create a $0/month recurring plan for free tier
STRIPE_FREE_PRICE_ID=price_...

# Required: Create $9.99/month recurring plan
STRIPE_BASIC_PRICE_ID=price_...

# Required: Create $49.99/month recurring plan  
STRIPE_PRO_PRICE_ID=price_...

# Required: Create $199.99/month recurring plan
STRIPE_ENTERPRISE_PRICE_ID=price_...
```

### Stripe Webhook Secret
```bash
# Required: Get this from Stripe Dashboard → Webhooks
STRIPE_WEBHOOK_SECRET=whsec_...
```

## How to Create Stripe Products & Prices

1. **Go to Stripe Dashboard** → Products
2. **Create Products** for each plan:
   - Free Plan: $0.00/month (recurring)
   - Basic Plan: $9.99/month (recurring)
   - Pro Plan: $49.99/month (recurring)
   - Enterprise Plan: $199.99/month (recurring)
3. **Copy Price IDs** and add them to Vercel environment variables

## How to Set Up Webhooks

1. **Go to Stripe Dashboard** → Webhooks
2. **Add endpoint**: `https://your-domain.vercel.app/api/billing/webhook`
3. **Select events**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. **Copy webhook secret** and add to Vercel environment variables

## Testing

1. **Visit** `/admin` → Billing Management
2. **Click "Load Plans"** to see available plans
3. **Click "Manage Billing"** to test Stripe portal
4. **Use Stripe test cards** for testing payments

## Free Plan Handling

The free plan can be handled in two ways:

### Option 1: Stripe Integration (Recommended)
- Create a $0/month recurring subscription in Stripe
- Set `STRIPE_FREE_PRICE_ID` environment variable
- Allows for consistent webhook handling and easy upgrades

### Option 2: Direct Database Update (Current)
- Free plan changes are handled directly in the database
- No Stripe integration needed for free plan
- Simpler but less consistent with other plans

Both approaches work, but Option 1 provides better analytics and consistency.
