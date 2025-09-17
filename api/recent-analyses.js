// /api/recent-analyses.js
import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(req, res) {
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    console.log('Recent analyses API called');
    
    // Get last 5 analysis hashes
    const hashes = await kv.lrange('recent_hashes', 0, 4); // Last 5
    console.log('Found hashes:', hashes);
    
    if (!hashes || hashes.length === 0) {
      console.log('No hashes found, returning empty array');
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
              political_bias: data.scores?.political_establishment_bias?.value || 0
            };
          }
          return null;
        } catch (e) {
          console.error(`Error fetching analysis ${hash}:`, e);
          return null;
        }
      })
    );

    // Filter out null results and return
    const validAnalyses = analyses.filter(Boolean);
    console.log('Valid analyses:', validAnalyses.length);
    
    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    
    res.status(200).json(validAnalyses);
  } catch (e) {
    console.error('recent-analyses error:', e);
    res.status(500).json({ error: true, message: 'Internal error: ' + (e.message || '') });
  }
}
