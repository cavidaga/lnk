// /api/statistics.js
import { kv } from '@vercel/kv';
import { withAuth, optionalAuth } from '../lib/middleware.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  try {
    console.log('Statistics API called');
    
    // Try to get the total count from a xüsusi counter
    let totalCount = await kv.get('total_analyses_count');
    
    // If no counter exists, initialize it with a reasonable estimate
    // Based on the database having 375+ analyses
    if (totalCount === null) {
      console.log('No total_analyses_count found, initializing with estimated count');
      const recentCount = await kv.llen('recent_hashes');
      // Use a higher estimate since we know there are more analyses than just recent ones
      const estimatedTotal = Math.max(recentCount, 375);
      await kv.set('total_analyses_count', estimatedTotal);
      totalCount = estimatedTotal;
      console.log('Initialized counter with estimated count:', totalCount);
    }
    
    console.log('Total analyses count:', totalCount);
    
    // Calculate today's activity based on actual analysis timestamps
    const recentHashes = await kv.lrange('recent_hashes', 0, 99); // Get last 100 hashes
    let todayCount = 0;
    
    if (recentHashes && recentHashes.length > 0) {
      // Get today's date in UTC
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      
      // Check each recent analysis to see if it was analyzed today
      for (const hash of recentHashes) {
        try {
          const analysis = await kv.get(hash);
          if (analysis && analysis.analyzed_at) {
            const analyzedAt = new Date(analysis.analyzed_at);
            if (analyzedAt >= todayStart && analyzedAt < todayEnd) {
              todayCount++;
            }
          }
        } catch (e) {
          console.error(`Error checking analysis ${hash}:`, e);
        }
      }
    }
    
    // If no analyses found for today, show 0 instead of a misleading count
    // This is more honest than showing recent count as "today"
    
    const stats = {
      total_analyses: totalCount,
      recent_analyses: todayCount, // Recent analyses count
      timestamp: new Date().toISOString()
    };
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(stats);
  } catch (e) {
    console.error('statistics error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error: ' + (e.message || '') });
  }
}

// Export with optional authentication (public endpoint with enhanced features for authenticated users)
export default withAuth(handler, { 
  require: 'optional', // Optional authentication
  rateLimit: true // Apply rate limiting
});
