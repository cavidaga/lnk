import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

function normalizeHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  if (h === 'abzas.info' || h === 'abzas.net' || h === 'abzas.org') return 'abzas.org';
  return h;
}

async function calculateSiteAverages() {
  try {
    // Get all analysis hashes from the recent_hashes list
    const hashes = await kv.lrange('recent_hashes', 0, 499);
    
    if (!hashes || hashes.length === 0) {
      return [];
    }

    // Group analyses by host, deduplicating by URL (keep most recent per URL)
    const siteData = new Map();
    const urlToAnalysis = new Map(); // Track most recent analysis per URL
    
    for (const hash of hashes) {
      try {
        const analysis = await kv.get(hash);
        if (!analysis || analysis.is_advertisement) continue;

        const originalUrl = analysis?.meta?.original_url || '';
        let host = '';
        try { 
          host = normalizeHost(new URL(originalUrl).hostname); 
        } catch { 
          continue; 
        }
        
        if (!host) continue;

        const rel = analysis?.scores?.reliability?.value;
        const bias = analysis?.scores?.political_establishment_bias?.value;
        if (typeof rel !== 'number' || typeof bias !== 'number') continue;

        // Check if we already have a more recent analysis for this URL
        const existingAnalysis = urlToAnalysis.get(originalUrl);
        if (existingAnalysis) {
          const existingDate = new Date(existingAnalysis.analyzed_at);
          const currentDate = new Date(analysis.analyzed_at);
          if (currentDate <= existingDate) {
            continue; // Skip older analysis
          }
        }

        // Store this analysis as the most recent for this URL
        urlToAnalysis.set(originalUrl, {
          hash: hash,
          reliability: rel,
          bias: bias,
          analyzed_at: analysis.analyzed_at,
          host: host
        });
      } catch (e) {
        console.error(`Error processing analysis ${hash}:`, e);
      }
    }

    // Now process only the most recent analysis per URL
    for (const [url, analysis] of urlToAnalysis) {
      const host = analysis.host;
      
      if (!siteData.has(host)) {
        siteData.set(host, {
          host,
          count: 0,
          sum_rel: 0,
          sum_bias: 0,
          analyses: []
        });
      }

      const site = siteData.get(host);
      site.count += 1;
      site.sum_rel += analysis.reliability;
      site.sum_bias += analysis.bias;
      site.analyses.push({
        hash: analysis.hash,
        reliability: analysis.reliability,
        bias: analysis.bias,
        analyzed_at: analysis.analyzed_at
      });
    }

    // Calculate averages and return results
    const sites = [];
    for (const [host, data] of siteData) {
      const avg_rel = data.sum_rel / data.count;
      const avg_bias = data.sum_bias / data.count;
      
      // Find the most recent analysis date
      const mostRecent = data.analyses.reduce((latest, analysis) => {
        return !latest || new Date(analysis.analyzed_at) > new Date(latest.analyzed_at) 
          ? analysis : latest;
      }, null);

      sites.push({
        host: data.host,
        count: data.count,
        avg_reliability: Number(avg_rel.toFixed(2)),
        avg_bias: Number(avg_bias.toFixed(2)),
        updated_at: mostRecent?.analyzed_at || new Date().toISOString()
      });
    }

    return sites;
  } catch (e) {
    console.error('calculateSiteAverages error:', e);
    return [];
  }
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const sortBy = url.searchParams.get('sort') || 'reliability'; // reliability, bias, count
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const minCount = parseInt(url.searchParams.get('min_count') || '1');

    // Calculate site averages dynamically from existing analyses
    const sites = await calculateSiteAverages();
    
    if (sites.length === 0) {
      return res.status(200).json({
        sites: [],
        total: 0,
        sort_by: sortBy,
        limit: limit,
        min_count: minCount
      });
    }

    // Filter by minimum count
    const filteredSites = sites.filter(site => site.count >= minCount);

    // Sort sites based on sortBy parameter
    filteredSites.sort((a, b) => {
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
    const limitedSites = filteredSites.slice(0, limit);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      sites: limitedSites,
      total: filteredSites.length,
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
