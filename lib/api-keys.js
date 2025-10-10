import crypto from 'crypto';
import { kv } from '@vercel/kv';

// API Key configuration
const API_KEY_PREFIX = 'lnk_';
const API_KEY_LENGTH = 32; // Length of the random part
const API_KEY_TTL = 60 * 60 * 24 * 365; // 1 year in seconds

/**
 * Generate a new API key
 * Format: lnk_[32 random characters]
 */
export function generateApiKey() {
  const randomPart = crypto.randomBytes(API_KEY_LENGTH).toString('hex');
  return `${API_KEY_PREFIX}${randomPart}`;
}

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(userId, name, permissions = ['analyze', 'get-analysis']) {
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const keyId = `key_${crypto.randomBytes(16).toString('hex')}`;
  
  const keyData = {
    id: keyId,
    userId,
    name: String(name || 'Unnamed Key'),
    keyHash,
    permissions: Array.isArray(permissions) ? permissions : ['analyze', 'get-analysis'],
    createdAt: new Date().toISOString(),
    lastUsed: null,
    isActive: true
  };
  
  // Store the key data
  await kv.set(`apikey:${keyId}`, keyData, { ex: API_KEY_TTL });
  
  // Store lookup by hash
  await kv.set(`apikey_hash:${keyHash}`, keyId, { ex: API_KEY_TTL });
  
  // Add to user's key list
  await kv.lpush(`user_keys:${userId}`, keyId);
  
  return {
    id: keyId,
    key: apiKey, // Only returned on creation
    name: keyData.name,
    permissions: keyData.permissions,
    createdAt: keyData.createdAt
  };
}

/**
 * Find API key by hash
 */
export async function findApiKeyByHash(keyHash) {
  const keyId = await kv.get(`apikey_hash:${keyHash}`);
  if (!keyId) return null;
  
  return await kv.get(`apikey:${keyId}`);
}

/**
 * Get all API keys for a user
 */
export async function getUserApiKeys(userId) {
  const keyIds = await kv.lrange(`user_keys:${userId}`, 0, -1);
  if (!keyIds || keyIds.length === 0) return [];
  
  const keys = await Promise.all(
    keyIds.map(async (keyId) => {
      const keyData = await kv.get(`apikey:${keyId}`);
      if (!keyData) return null;
      
      return {
        id: keyData.id,
        name: keyData.name,
        permissions: keyData.permissions,
        createdAt: keyData.createdAt,
        lastUsed: keyData.lastUsed,
        isActive: keyData.isActive
      };
    })
  );
  
  return keys.filter(Boolean);
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId, userId) {
  const keyData = await kv.get(`apikey:${keyId}`);
  if (!keyData || keyData.userId !== userId) {
    return false;
  }
  
  // Mark as inactive
  keyData.isActive = false;
  await kv.set(`apikey:${keyId}`, keyData, { ex: API_KEY_TTL });
  
  // Remove from user's key list
  await kv.lrem(`user_keys:${userId}`, 1, keyId);
  
  return true;
}

/**
 * Validate API key and get user info
 */
export async function validateApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }
  
  const keyHash = hashApiKey(apiKey);
  const keyData = await findApiKeyByHash(keyHash);
  
  if (!keyData || !keyData.isActive) {
    return null;
  }
  
  // Update last used timestamp
  keyData.lastUsed = new Date().toISOString();
  await kv.set(`apikey:${keyData.id}`, keyData, { ex: API_KEY_TTL });
  
  // Get user data
  const user = await kv.get(`user:id:${keyData.userId}`);
  if (!user) return null;
  
  return {
    userId: keyData.userId,
    keyId: keyData.id,
    permissions: keyData.permissions,
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan || 'free'
    }
  };
}

/**
 * Check if API key has permission for an action
 */
export function hasPermission(apiKeyData, action) {
  if (!apiKeyData || !apiKeyData.permissions) return false;
  return apiKeyData.permissions.includes(action);
}

/**
 * Extract API key from request headers
 */
export function extractApiKeyFromRequest(req) {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  // Check X-API-Key header
  const apiKeyHeader = req.headers?.['x-api-key'] || req.headers?.['X-API-Key'];
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  
  return null;
}

/**
 * Middleware to require API key authentication
 */
export async function requireApiKey(req, res, requiredPermission = null) {
  const apiKey = extractApiKeyFromRequest(req);
  
  if (!apiKey) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(401).json({ 
      error: true, 
      message: 'API key required. Provide via Authorization: Bearer <key> or X-API-Key header.' 
    });
  }
  
  const keyData = await validateApiKey(apiKey);
  if (!keyData) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(401).json({ 
      error: true, 
      message: 'Invalid or expired API key.' 
    });
  }
  
  if (requiredPermission && !hasPermission(keyData, requiredPermission)) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(403).json({ 
      error: true, 
      message: `API key does not have permission for: ${requiredPermission}` 
    });
  }
  
  return keyData;
}
