import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

function normalizeHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  if (h === 'abzas.info' || h === 'abzas.net' || h === 'abzas.org') return 'abzas.org';
  return h;
}

async function calculateSiteAveragesForHost(targetHost) {
  try {
    // Get all analysis hashes from the recent_hashes list
    const hashes = await kv.lrange('recent_hashes', 0, 499);
    
    if (!hashes || hashes.length === 0) {
      return { host: targetHost, count: 0, avg_rel: 0, avg_bias: 0 };
    }

    // Deduplicate by URL - keep only most recent analysis per URL
    const urlToAnalysis = new Map();
    
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
        
        if (host !== targetHost) continue;

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
          reliability: rel,
          bias: bias,
          analyzed_at: analysis.analyzed_at
        });
      } catch (e) {
        console.error(`Error processing analysis ${hash}:`, e);
      }
    }

    // Calculate averages from deduplicated analyses
    let count = 0;
    let sumRel = 0;
    let sumBias = 0;
    let mostRecentDate = null;

    for (const [url, analysis] of urlToAnalysis) {
      count += 1;
      sumRel += analysis.reliability;
      sumBias += analysis.bias;

      // Track most recent analysis date
      const analysisDate = new Date(analysis.analyzed_at);
      if (!mostRecentDate || analysisDate > mostRecentDate) {
        mostRecentDate = analysisDate;
      }
    }

    const avgRel = count > 0 ? sumRel / count : 0;
    const avgBias = count > 0 ? sumBias / count : 0;

    return {
      host: targetHost,
      count,
      avg_rel: Number(avgRel.toFixed(2)),
      avg_bias: Number(avgBias.toFixed(2)),
      updated_at: mostRecentDate ? mostRecentDate.toISOString() : new Date().toISOString()
    };
  } catch (e) {
    console.error('calculateSiteAveragesForHost error:', e);
    return { host: targetHost, count: 0, avg_rel: 0, avg_bias: 0 };
  }
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const hostParam = (url.searchParams.get('host') || '').trim();
    const urlParam = (url.searchParams.get('url') || '').trim();

    let host = hostParam;
    if (!host && urlParam) {
      try { host = new URL(urlParam).hostname.replace(/^www\./, ''); } catch {}
    }
    host = normalizeHost(host);

    if (!host) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Missing host or url' });
    }

    // Calculate site averages dynamically from existing analyses
    const stats = await calculateSiteAveragesForHost(host);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(stats);
  } catch (e) {
    console.error('site-averages error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

// Export without authentication - site averages are public data
export default handler;


