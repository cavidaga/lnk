import { requireAuth, getSessionFromRequest } from './auth.js';
import { requireApiKey, extractApiKeyFromRequest, validateApiKey } from './api-keys.js';
import { trackUsage, checkUsageLimits } from './usage-tracking.js';
import { kv } from '@vercel/kv';

/**
 * Authentication middleware factory
 * Creates middleware functions for different authentication requirements
 */

/**
 * Require session-based authentication (cookie-based)
 */
export async function requireSession(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null; // Response already sent
  
  return {
    user,
    authMethod: 'session',
    userId: user.id,
    userEmail: user.email,
    userPlan: user.plan || 'free'
  };
}

/**
 * Require API key authentication
 */
export async function requireApiKeyAuth(req, res, requiredPermission = null) {
  const keyData = await requireApiKey(req, res, requiredPermission);
  if (!keyData) return null; // Response already sent
  
  return {
    user: keyData.user,
    authMethod: 'api_key',
    userId: keyData.userId,
    userEmail: keyData.user.email,
    userPlan: keyData.user.plan || 'free',
    keyId: keyData.keyId,
    permissions: keyData.permissions
  };
}

/**
 * Require either session OR API key authentication
 * Tries API key first, then falls back to session
 */
export async function requireAnyAuth(req, res, requiredPermission = null) {
  // Try API key first
  const apiKey = extractApiKeyFromRequest(req);
  if (apiKey) {
    const keyData = await validateApiKey(apiKey);
    if (keyData) {
      // Check permission if required
      if (requiredPermission && !keyData.permissions.includes(requiredPermission)) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(403).json({ 
          error: true, 
          message: `API key does not have permission for: ${requiredPermission}` 
        });
      }
      
      return {
        user: keyData.user,
        authMethod: 'api_key',
        userId: keyData.userId,
        userEmail: keyData.user.email,
        userPlan: keyData.user.plan || 'free',
        keyId: keyData.keyId,
        permissions: keyData.permissions
      };
    }
  }
  
  // Fall back to session
  const session = getSessionFromRequest(req);
  if (session?.sub) {
    try {
      const user = await kv.get(`user:id:${session.sub}`);
      if (user) {
        return {
          user,
          authMethod: 'session',
          userId: user.id,
          userEmail: user.email,
          userPlan: user.plan || 'free'
        };
      }
    } catch (e) {
      console.warn('Session validation failed:', e);
    }
  }
  
  // No valid authentication found
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(401).json({ 
    error: true, 
    message: 'Authentication required. Provide API key via Authorization: Bearer <key> or X-API-Key header, or login via session.' 
  });
}

/**
 * Optional authentication - returns auth info if present, null if not
 * Useful for endpoints that work with or without authentication
 */
export async function optionalAuth(req, res) {
  // Try API key first
  const apiKey = extractApiKeyFromRequest(req);
  if (apiKey) {
    const keyData = await validateApiKey(apiKey);
    if (keyData) {
      return {
        user: keyData.user,
        authMethod: 'api_key',
        userId: keyData.userId,
        userEmail: keyData.user.email,
        userPlan: keyData.user.plan || 'free',
        keyId: keyData.keyId,
        permissions: keyData.permissions
      };
    }
  }
  
  // Try session
  const session = getSessionFromRequest(req);
  if (session?.sub) {
    try {
      const user = await kv.get(`user:id:${session.sub}`);
      if (user) {
        return {
          user,
          authMethod: 'session',
          userId: user.id,
          userEmail: user.email,
          userPlan: user.plan || 'free'
        };
      }
    } catch (e) {
      console.warn('Session validation failed:', e);
    }
  }
  
  return null; // No authentication
}

/**
 * Rate limiting middleware
 * Different limits based on authentication status
 */
export async function applyRateLimit(req, res, authInfo = null) {
  // Prefer trusted proxy header format; take first IP only
  let clientIP = req.connection?.remoteAddress || 'unknown';
  const xff = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'];
  if (typeof xff === 'string' && xff.length) {
    // X-Forwarded-For: client, proxy1, proxy2
    clientIP = xff.split(',')[0].trim() || clientIP;
  }
  
  // Different rate limits based on auth status
  let rateLimitKey, rateLimit;
  
  if (authInfo) {
    // Authenticated users get higher limits
    rateLimitKey = `rate_limit_user:${authInfo.userId}`;
    rateLimit = 100; // 100 requests per minute for authenticated users
  } else {
    // Public users get lower limits
    rateLimitKey = `rate_limit:${clientIP}`;
    rateLimit = 10; // 10 requests per minute for public users
  }
  
  try {
    const currentRequests = await kv.get(rateLimitKey) || 0;
    if (currentRequests > rateLimit) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(429).json({ 
        error: true, 
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 60
      });
    }
    
    await kv.incr(rateLimitKey);
    await kv.expire(rateLimitKey, 60); // 1 minute expiry
    
    return true; // Rate limit check passed
  } catch (error) {
    console.warn('Rate limiting check failed:', error);
    return true; // Continue on error
  }
}

/**
 * Add authentication headers to response
 */
export function addAuthHeaders(res, authInfo) {
  if (authInfo) {
    // Minimize information exposure
    res.setHeader('X-Auth-Method', authInfo.authMethod);
    // Avoid leaking identifiers in production
    const isProd = (process.env.NODE_ENV === 'production') || Boolean(process.env.VERCEL) || (process.env.VERCEL_ENV === 'production');
    if (!isProd) {
      res.setHeader('X-User-ID', authInfo.userId);
      if (authInfo.keyId) {
        res.setHeader('X-API-Key-ID', authInfo.keyId);
      }
    }
  }
}

/**
 * Higher-order function to wrap API handlers with authentication
 * Usage: export default withAuth(handler, { require: 'any', permission: 'analyze' })
 */
export function withAuth(handler, options = {}) {
  const {
    require = 'any', // 'session', 'api_key', 'any', 'optional'
    permission = null,
    rateLimit = true,
    trackUsage: shouldTrackUsage = true,
    modelType = 'default'
  } = options;
  
  return async (req, res) => {
    try {
      let authInfo = null;
      
      // Apply authentication based on requirements
      switch (require) {
        case 'session':
          authInfo = await requireSession(req, res);
          break;
        case 'api_key':
          authInfo = await requireApiKeyAuth(req, res, permission);
          break;
        case 'any':
          authInfo = await requireAnyAuth(req, res, permission);
          break;
        case 'optional':
          authInfo = await optionalAuth(req, res);
          break;
        default:
          throw new Error(`Invalid auth requirement: ${require}`);
      }
      
      if (require !== 'optional' && !authInfo) {
        return; // Response already sent by auth function
      }
      
      // Check usage limits for authenticated users
      if (authInfo && shouldTrackUsage) {
        try {
          const usageCheck = await checkUsageLimits(authInfo.userId, authInfo.userPlan);
          if (!usageCheck.canMakeRequest) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(429).json({
              error: true,
              message: 'Usage limit exceeded',
              details: {
                plan: usageCheck.plan,
                limits: usageCheck.limits,
                current: usageCheck.current,
                exceeded: usageCheck.exceeded
              }
            });
          }
        } catch (error) {
          console.warn('Usage limit check failed, allowing request:', error);
          // Continue with request if usage check fails
        }
      }
      
      // Apply rate limiting
      if (rateLimit) {
        const rateLimitPassed = await applyRateLimit(req, res, authInfo);
        if (!rateLimitPassed) {
          return; // Response already sent by rate limiter
        }
      }
      
      // Add auth info to request object for use in handler
      req.auth = authInfo;
      
      // Add auth headers to response
      addAuthHeaders(res, authInfo);
      
      // Call the original handler
      const result = await handler(req, res);
      
      // Track usage after successful request
      if (authInfo && shouldTrackUsage) {
        try {
          const endpoint = req.url.split('?')[0]; // Remove query params
          const success = res.statusCode < 400;
          const actualModelType = req.modelType || modelType; // Use model type from request if available
          await trackUsage(authInfo, endpoint, actualModelType, success);
        } catch (error) {
          console.warn('Usage tracking failed:', error);
          // Don't fail the request if usage tracking fails
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({ 
        error: true, 
        message: 'Authentication middleware error' 
      });
    }
  };
}

/**
 * Utility function to check if user has specific permission
 */
export function hasPermission(authInfo, permission) {
  if (!authInfo) return false;
  if (authInfo.authMethod === 'session') return true; // Sessions have all permissions
  if (authInfo.authMethod === 'api_key') {
    return authInfo.permissions && authInfo.permissions.includes(permission);
  }
  return false;
}

/**
 * Utility function to get user plan limits
 */
export function getUserLimits(authInfo) {
  if (!authInfo) {
    return {
      plan: 'free',
      maxRequestsPerMinute: 10,
      maxRequestsPerDay: 100
    };
  }
  
  const plan = authInfo.userPlan || 'free';
  
  switch (plan) {
    case 'free':
      return {
        plan: 'free',
        maxRequestsPerMinute: 10,
        maxRequestsPerDay: 100
      };
    case 'basic':
      return {
        plan: 'basic',
        maxRequestsPerMinute: 50,
        maxRequestsPerDay: 1000
      };
    case 'pro':
      return {
        plan: 'pro',
        maxRequestsPerMinute: 100,
        maxRequestsPerDay: 5000
      };
    case 'enterprise':
      return {
        plan: 'enterprise',
        maxRequestsPerMinute: 500,
        maxRequestsPerDay: 50000
      };
    default:
      return {
        plan: 'free',
        maxRequestsPerMinute: 10,
        maxRequestsPerDay: 100
      };
  }
}
