import { requireAuth } from '../../lib/auth.js';
import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    // Require authentication
    const user = await requireAuth(req, res);
    if (!user) return;

    // Check if user is a regular user (not developer/admin)
    if (user.role && user.role !== 'user') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(403).json({ error: true, message: 'Access denied. This endpoint is for regular users only.' });
    }

    if (req.method === 'GET') {
      // Get user's analysis history
      const limit = parseInt(req.query.limit) || 50; // Default to 50, max 100
      const maxLimit = Math.min(limit, 100);
      
      const userAnalysesKey = `user:analyses:${user.id}`;
      const analyses = await kv.get(userAnalysesKey) || [];
      
      // Return limited number of analyses
      const limitedAnalyses = analyses.slice(0, maxLimit);
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        analyses: limitedAnalyses,
        total: analyses.length,
        limit: maxLimit
      });
    }

    if (req.method === 'DELETE') {
      // Clear user's analysis history
      const userAnalysesKey = `user:analyses:${user.id}`;
      await kv.del(userAnalysesKey);
      
      // Reset analysis count
      const userKey = `user:id:${user.id}`;
      const userData = await kv.get(userKey);
      if (userData) {
        userData.analysisCount = 0;
        await kv.set(userKey, userData);
      }
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ 
        message: 'Analysis history cleared successfully',
        analyses: [],
        total: 0
      });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  } catch (e) {
    console.error('User analyses API error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}
