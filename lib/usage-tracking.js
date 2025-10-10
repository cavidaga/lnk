import { kv } from '@vercel/kv';

/**
 * Usage tracking and billing system
 * Tracks API calls, costs, and usage limits per API key and user
 */

// Cost per request by model type (in cents)
const MODEL_COSTS = {
  'gemini-1.5-flash-lite': 0.1,  // $0.0001 per request
  'gemini-1.5-flash': 0.5,       // $0.005 per request
  'gemini-1.5-pro': 2.0,         // $0.02 per request
  'auto': 0.5,                    // Average cost for auto-selection
  'default': 0.5                  // Default cost for unknown models
};

// Plan limits and pricing
const PLAN_LIMITS = {
  free: {
    maxRequestsPerMonth: 100,
    maxCostPerMonth: 100, // 100 cents = $1
    costPerRequest: 0.5,  // 0.5 cents per request
    name: 'Free'
  },
  basic: {
    maxRequestsPerMonth: 1000,
    maxCostPerMonth: 1000, // 1000 cents = $10
    costPerRequest: 0.3,   // 0.3 cents per request
    name: 'Basic'
  },
  pro: {
    maxRequestsPerMonth: 10000,
    maxCostPerMonth: 5000, // 5000 cents = $50
    costPerRequest: 0.2,   // 0.2 cents per request
    name: 'Pro'
  },
  enterprise: {
    maxRequestsPerMonth: 100000,
    maxCostPerMonth: 50000, // 50000 cents = $500
    costPerRequest: 0.1,    // 0.1 cents per request
    name: 'Enterprise'
  }
};

/**
 * Get cost for a specific model
 */
export function getModelCost(modelType) {
  return MODEL_COSTS[modelType] || MODEL_COSTS.default;
}

/**
 * Get plan limits for a user
 */
export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

/**
 * Track API usage for a request
 */
export async function trackUsage(authInfo, endpoint, modelType = 'default', success = true) {
  if (!authInfo) return;

  const timestamp = Date.now();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const month = new Date().toISOString().substring(0, 7); // YYYY-MM
  
  const cost = getModelCost(modelType);
  const usageRecord = {
    timestamp,
    date,
    month,
    endpoint,
    modelType,
    cost,
    success,
    userId: authInfo.userId,
    keyId: authInfo.keyId || null,
    authMethod: authInfo.authMethod
  };

  try {
    // Store individual usage record
    const usageId = `usage:${authInfo.userId}:${timestamp}:${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(usageId, usageRecord, { ex: 60 * 60 * 24 * 90 }); // 90 days TTL

    // Update daily counters
    await updateDailyCounters(authInfo, date, cost, success);
    
    // Update monthly counters
    await updateMonthlyCounters(authInfo, month, cost, success);
    
    // Update API key specific counters (if using API key)
    if (authInfo.keyId) {
      await updateApiKeyCounters(authInfo.keyId, date, month, cost, success);
    }

    console.log(`Usage tracked: ${authInfo.userId} - ${endpoint} - ${modelType} - ${cost} cents`);
  } catch (error) {
    console.error('Failed to track usage:', error);
    // Don't throw - usage tracking shouldn't break the main request
  }
}

/**
 * Update daily usage counters
 */
async function updateDailyCounters(authInfo, date, cost, success) {
  const dailyKey = `usage:daily:${authInfo.userId}:${date}`;
  
  await kv.hincrby(dailyKey, 'requests', 1);
  await kv.hincrby(dailyKey, 'cost', Math.round(cost));
  if (success) {
    await kv.hincrby(dailyKey, 'successful_requests', 1);
  }
  await kv.hincrby(dailyKey, 'failed_requests', success ? 0 : 1);
  
  // Set TTL to 90 days
  await kv.expire(dailyKey, 60 * 60 * 24 * 90);
}

/**
 * Update monthly usage counters
 */
async function updateMonthlyCounters(authInfo, month, cost, success) {
  const monthlyKey = `usage:monthly:${authInfo.userId}:${month}`;
  
  await kv.hincrby(monthlyKey, 'requests', 1);
  await kv.hincrby(monthlyKey, 'cost', Math.round(cost));
  if (success) {
    await kv.hincrby(monthlyKey, 'successful_requests', 1);
  }
  await kv.hincrby(monthlyKey, 'failed_requests', success ? 0 : 1);
  
  // Set TTL to 1 year
  await kv.expire(monthlyKey, 60 * 60 * 24 * 365);
}

/**
 * Update API key specific counters
 */
async function updateApiKeyCounters(keyId, date, month, cost, success) {
  const dailyKey = `usage:key:daily:${keyId}:${date}`;
  const monthlyKey = `usage:key:monthly:${keyId}:${month}`;
  
  // Daily counters
  await kv.hincrby(dailyKey, 'requests', 1);
  await kv.hincrby(dailyKey, 'cost', Math.round(cost));
  if (success) {
    await kv.hincrby(dailyKey, 'successful_requests', 1);
  }
  await kv.hincrby(dailyKey, 'failed_requests', success ? 0 : 1);
  await kv.expire(dailyKey, 60 * 60 * 24 * 90);
  
  // Monthly counters
  await kv.hincrby(monthlyKey, 'requests', 1);
  await kv.hincrby(monthlyKey, 'cost', Math.round(cost));
  if (success) {
    await kv.hincrby(monthlyKey, 'successful_requests', 1);
  }
  await kv.hincrby(monthlyKey, 'failed_requests', success ? 0 : 1);
  await kv.expire(monthlyKey, 60 * 60 * 24 * 365);
}

/**
 * Get usage statistics for a user
 */
export async function getUserUsage(userId, period = 'month') {
  const now = new Date();
  let startDate, endDate, keyPattern;
  
  if (period === 'day') {
    const today = now.toISOString().split('T')[0];
    startDate = today;
    endDate = today;
    keyPattern = `usage:daily:${userId}:${today}`;
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startDate = weekAgo.toISOString().split('T')[0];
    endDate = now.toISOString().split('T')[0];
    keyPattern = `usage:daily:${userId}:*`;
  } else { // month
    const month = now.toISOString().substring(0, 7);
    startDate = `${month}-01`;
    endDate = now.toISOString().split('T')[0];
    keyPattern = `usage:monthly:${userId}:${month}`;
  }

  try {
    if (period === 'month') {
      // Get monthly data directly
      const monthlyData = await kv.hgetall(keyPattern);
      return {
        period,
        startDate,
        endDate,
        requests: parseInt(monthlyData.requests || 0),
        successfulRequests: parseInt(monthlyData.successful_requests || 0),
        failedRequests: parseInt(monthlyData.failed_requests || 0),
        cost: parseInt(monthlyData.cost || 0),
        costDollars: (parseInt(monthlyData.cost || 0) / 100).toFixed(4)
      };
    } else {
      // Get daily data and aggregate
      const keys = await kv.keys(keyPattern);
      let totalRequests = 0;
      let totalSuccessful = 0;
      let totalFailed = 0;
      let totalCost = 0;

      for (const key of keys) {
        const data = await kv.hgetall(key);
        totalRequests += parseInt(data.requests || 0);
        totalSuccessful += parseInt(data.successful_requests || 0);
        totalFailed += parseInt(data.failed_requests || 0);
        totalCost += parseInt(data.cost || 0);
      }

      return {
        period,
        startDate,
        endDate,
        requests: totalRequests,
        successfulRequests: totalSuccessful,
        failedRequests: totalFailed,
        cost: totalCost,
        costDollars: (totalCost / 100).toFixed(4)
      };
    }
  } catch (error) {
    console.error('Failed to get user usage:', error);
    return {
      period,
      startDate,
      endDate,
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cost: 0,
      costDollars: '0.0000'
    };
  }
}

/**
 * Get usage statistics for an API key
 */
export async function getApiKeyUsage(keyId, period = 'month') {
  const now = new Date();
  let startDate, endDate, keyPattern;
  
  if (period === 'day') {
    const today = now.toISOString().split('T')[0];
    startDate = today;
    endDate = today;
    keyPattern = `usage:key:daily:${keyId}:${today}`;
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startDate = weekAgo.toISOString().split('T')[0];
    endDate = now.toISOString().split('T')[0];
    keyPattern = `usage:key:daily:${keyId}:*`;
  } else { // month
    const month = now.toISOString().substring(0, 7);
    startDate = `${month}-01`;
    endDate = now.toISOString().split('T')[0];
    keyPattern = `usage:key:monthly:${keyId}:${month}`;
  }

  try {
    if (period === 'month') {
      // Get monthly data directly
      const monthlyData = await kv.hgetall(keyPattern);
      return {
        keyId,
        period,
        startDate,
        endDate,
        requests: parseInt(monthlyData.requests || 0),
        successfulRequests: parseInt(monthlyData.successful_requests || 0),
        failedRequests: parseInt(monthlyData.failed_requests || 0),
        cost: parseInt(monthlyData.cost || 0),
        costDollars: (parseInt(monthlyData.cost || 0) / 100).toFixed(4)
      };
    } else {
      // Get daily data and aggregate
      const keys = await kv.keys(keyPattern);
      let totalRequests = 0;
      let totalSuccessful = 0;
      let totalFailed = 0;
      let totalCost = 0;

      for (const key of keys) {
        const data = await kv.hgetall(key);
        totalRequests += parseInt(data.requests || 0);
        totalSuccessful += parseInt(data.successful_requests || 0);
        totalFailed += parseInt(data.failed_requests || 0);
        totalCost += parseInt(data.cost || 0);
      }

      return {
        keyId,
        period,
        startDate,
        endDate,
        requests: totalRequests,
        successfulRequests: totalSuccessful,
        failedRequests: totalFailed,
        cost: totalCost,
        costDollars: (totalCost / 100).toFixed(4)
      };
    }
  } catch (error) {
    console.error('Failed to get API key usage:', error);
    return {
      keyId,
      period,
      startDate,
      endDate,
      requests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cost: 0,
      costDollars: '0.0000'
    };
  }
}

/**
 * Check if user has exceeded their plan limits
 */
export async function checkUsageLimits(userId, userPlan = 'free') {
  const planLimits = getPlanLimits(userPlan);
  const currentUsage = await getUserUsage(userId, 'month');
  
  const exceeded = {
    requests: currentUsage.requests >= planLimits.maxRequestsPerMonth,
    cost: currentUsage.cost >= planLimits.maxCostPerMonth
  };
  
  return {
    plan: userPlan,
    limits: planLimits,
    current: currentUsage,
    exceeded,
    canMakeRequest: !exceeded.requests && !exceeded.cost
  };
}

/**
 * Get recent usage history for a user
 */
export async function getUsageHistory(userId, limit = 50) {
  try {
    const pattern = `usage:${userId}:*`;
    const keys = await kv.keys(pattern);
    
    // Sort by timestamp (newest first) and limit
    const sortedKeys = keys
      .sort((a, b) => {
        const timestampA = parseInt(a.split(':')[2]);
        const timestampB = parseInt(b.split(':')[2]);
        return timestampB - timestampA;
      })
      .slice(0, limit);
    
    const history = [];
    for (const key of sortedKeys) {
      const record = await kv.get(key);
      if (record) {
        history.push(record);
      }
    }
    
    return history;
  } catch (error) {
    console.error('Failed to get usage history:', error);
    return [];
  }
}

/**
 * Get usage statistics for all users (admin function)
 */
export async function getAllUsersUsage(limit = 100) {
  try {
    const pattern = 'usage:monthly:*';
    const keys = await kv.keys(pattern);
    
    const usageData = [];
    for (const key of keys.slice(0, limit)) {
      const parts = key.split(':');
      const userId = parts[2];
      const month = parts[3];
      
      const data = await kv.hgetall(key);
      if (data && data.requests > 0) {
        usageData.push({
          userId,
          month,
          requests: parseInt(data.requests || 0),
          cost: parseInt(data.cost || 0),
          costDollars: (parseInt(data.cost || 0) / 100).toFixed(4)
        });
      }
    }
    
    return usageData.sort((a, b) => b.requests - a.requests);
  } catch (error) {
    console.error('Failed to get all users usage:', error);
    return [];
  }
}
