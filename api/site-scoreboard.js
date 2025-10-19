import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const sortBy = url.searchParams.get('sort') || 'reliability'; // reliability, bias, count
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const minCount = parseInt(url.searchParams.get('min_count') || '1');

    // Get all site stats keys
    const siteStatsKeys = await kv.keys('site_stats:*');
    
    if (!siteStatsKeys || siteStatsKeys.length === 0) {
      return res.status(200).json({
        sites: [],
        total: 0,
        sort_by: sortBy,
        limit: limit,
        min_count: minCount
      });
    }

    // Fetch all site statistics
    const sites = [];
    for (const key of siteStatsKeys) {
      try {
        const stats = await kv.get(key);
        if (stats && stats.count >= minCount) {
          sites.push({
            host: stats.host,
            count: stats.count || 0,
            avg_reliability: Number(stats.avg_rel || 0),
            avg_bias: Number(stats.avg_bias || 0),
            updated_at: stats.updated_at
          });
        }
      } catch (e) {
        console.error(`Error fetching stats for key ${key}:`, e);
      }
    }

    // Sort sites based on sortBy parameter
    sites.sort((a, b) => {
      switch (sortBy) {
        case 'reliability':
          return b.avg_reliability - a.avg_reliability;
        case 'bias':
          return Math.abs(b.avg_bias) - Math.abs(a.avg_bias);
        case 'count':
          return b.count - a.count;
        default:
          return b.avg_reliability - a.avg_reliability;
      }
    });

    // Apply limit
    const limitedSites = sites.slice(0, limit);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      sites: limitedSites,
      total: sites.length,
      sort_by: sortBy,
      limit: limit,
      min_count: minCount,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error('site-scoreboard error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

// Export without authentication - site scoreboard is public data
export default handler;
