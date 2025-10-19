import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const domain = url.searchParams.get('domain');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!domain) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Domain parameter is required' });
    }

    // Normalize domain (remove www, convert to lowercase)
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
    
    // Get all recent hashes
    const hashes = await kv.lrange('recent_hashes', 0, -1); // Get all hashes
    
    if (!hashes || hashes.length === 0) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
      return res.status(200).json({
        analyses: [],
        total: 0,
        domain: normalizedDomain,
        limit: limit,
        offset: offset
      });
    }

    // Fetch analyses and filter by domain
    const domainAnalyses = [];
    
    for (const hash of hashes) {
      try {
        const analysis = await kv.get(hash);
        if (analysis && analysis.meta && analysis.meta.original_url) {
          const analysisDomain = new URL(analysis.meta.original_url).hostname.toLowerCase().replace(/^www\./, '');
          
          if (analysisDomain === normalizedDomain && !analysis.is_advertisement) {
            domainAnalyses.push({
              hash: analysis.hash || hash,
              title: analysis.meta.title || 'Başlıq yoxdur',
              publication: analysis.meta.publication || '',
              url: analysis.meta.original_url || '',
              published_at: analysis.meta.published_at || '',
              analyzed_at: analysis.analyzed_at || '',
              reliability: analysis.scores?.reliability?.value || 0,
              political_bias: analysis.scores?.political_establishment_bias?.value || 0,
              is_advertisement: analysis.is_advertisement || false,
              human_summary: analysis.human_summary || '',
              warnings: analysis.warnings || []
            });
          }
        }
      } catch (e) {
        console.error(`Error processing analysis ${hash}:`, e);
      }
    }

    // Sort by analyzed_at (most recent first)
    domainAnalyses.sort((a, b) => {
      const dateA = new Date(a.analyzed_at || 0);
      const dateB = new Date(b.analyzed_at || 0);
      return dateB - dateA;
    });

    // Apply pagination
    const paginatedAnalyses = domainAnalyses.slice(offset, offset + limit);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      analyses: paginatedAnalyses,
      total: domainAnalyses.length,
      domain: normalizedDomain,
      limit: limit,
      offset: offset,
      hasMore: (offset + limit) < domainAnalyses.length,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error('analyses-by-domain error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

// Export without authentication - public data
export default handler;
