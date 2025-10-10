import { withAuth } from '../lib/middleware.js';

export const config = { runtime: 'nodejs' };

// Example handler that requires authentication
async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  // Access auth info from req.auth (added by middleware)
  const authInfo = req.auth;
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    success: true,
    message: 'This is a protected endpoint',
    auth: {
      method: authInfo.authMethod,
      userId: authInfo.userId,
      userEmail: authInfo.userEmail,
      userPlan: authInfo.userPlan,
      keyId: authInfo.keyId || null,
      permissions: authInfo.permissions || null
    },
    timestamp: new Date().toISOString()
  });
}

// Export with authentication middleware
export default withAuth(handler, { 
  require: 'any', // Accepts both session and API key
  permission: null, // No specific permission required
  rateLimit: true // Apply rate limiting
});
