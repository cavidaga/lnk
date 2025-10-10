import { requireAuth } from '../../lib/auth.js';
import { createApiKey } from '../../lib/api-keys.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    // Require user authentication
    const user = await requireAuth(req, res);
    if (!user) return; // Response already sent

    let body = {};
    try { body = req.body || {}; } catch {}
    if (!body || Object.keys(body).length === 0) {
      body = await new Promise((resolve) => {
        try {
          let buf = '';
          req.on('data', (ch) => buf += ch);
          req.on('end', () => {
            try { resolve(JSON.parse(buf || '{}')); } catch { resolve({}); }
          });
        } catch { resolve({}); }
      });
    }

    const name = String(body.name || '').trim();
    const permissions = Array.isArray(body.permissions) ? body.permissions : ['analyze', 'get-analysis'];

    if (!name) {
      return res.status(400).json({ error: true, message: 'API key name is required' });
    }

    // Validate permissions
    const validPermissions = ['analyze', 'get-analysis', 'statistics', 'site-averages', 'recent-analyses'];
    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({ 
        error: true, 
        message: `Invalid permissions: ${invalidPermissions.join(', ')}. Valid permissions: ${validPermissions.join(', ')}` 
      });
    }

    try {
      const apiKey = await createApiKey(user.id, name, permissions);
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(201).json({
        success: true,
        apiKey: {
          id: apiKey.id,
          key: apiKey.key, // Only returned on creation
          name: apiKey.name,
          permissions: apiKey.permissions,
          createdAt: apiKey.createdAt
        },
        message: 'API key created successfully. Store it securely - it will not be shown again.'
      });
    } catch (error) {
      console.error('API key creation error:', error);
      return res.status(500).json({ error: true, message: 'Failed to create API key' });
    }
  } catch (e) {
    console.error('Create API key error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}
