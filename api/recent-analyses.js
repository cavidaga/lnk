// /api/recent-analyses.js
import { kv } from '@vercel/kv';
import { withAuth } from '../lib/middleware.js';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  try {
    console.log('Recent analyses API called');
    
    // Get more hashes initially to account for filtering out advertisements
    // We'll fetch up to 20 hashes to ensure we get 5 non-advertisement analyses
    const hashes = await kv.lrange('recent_hashes', 0, 19); // Last 20
    console.log('Found hashes:', hashes);
    
    if (!hashes || hashes.length === 0) {
      console.log('No hashes found, returning empty array');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
      return res.status(200).json([]);
    }

    // Fetch the actual analysis data for each hash
    const analyses = await Promise.all(
      hashes.map(async (hash) => {
        try {
          const data = await kv.get(hash);
          if (data && data.meta) {
            return {
              hash: data.hash || hash,
              title: data.meta.title || 'Başlıq yoxdur',
              publication: data.meta.publication || '',
              url: data.meta.original_url || '',
              published_at: data.meta.published_at || '',
              reliability: data.scores?.reliability?.value || 0,
              political_bias: data.scores?.political_establishment_bias?.value || 0,
              is_advertisement: data.is_advertisement || false
            };
          }
          return null;
        } catch (e) {
          console.error(`Error fetching analysis ${hash}:`, e);
          return null;
        }
      })
    );

    // Filter out null results and advertisements, then limit to 5
    const validAnalyses = analyses
      .filter(analysis => analysis && !analysis.is_advertisement)
      .slice(0, 5); // Limit to 5 analyses
    console.log('Valid analyses after filtering:', validAnalyses.length);
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(validAnalyses);
  } catch (e) {
    console.error('recent-analyses error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error: ' + (e.message || '') });
  }
}

// Export with authentication required
export default withAuth(handler, { 
  require: 'any', // Accepts both session and API key
  permission: 'recent-analyses', // Requires recent-analyses permission for API keys
  rateLimit: true // Apply rate limiting
});
