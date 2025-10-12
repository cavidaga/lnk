import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const hashParam = url.searchParams.get('hash');
    const urlParam = url.searchParams.get('url');

    if (!hashParam && !urlParam) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Missing hash or url parameter' });
    }

    let targetUrl = '';
    let currentHash = '';

    if (hashParam) {
      // Get the analysis by hash to find its URL
      const analysis = await kv.get(hashParam);
      if (!analysis || !analysis.meta || !analysis.meta.original_url) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({ error: true, message: 'Analysis not found' });
      }
      targetUrl = analysis.meta.original_url;
      currentHash = hashParam;
    } else {
      targetUrl = urlParam;
    }

    // Get all recent hashes to search through
    const hashes = await kv.lrange('recent_hashes', 0, 499);
    
    // Find all analyses for the same URL
    const sameUrlAnalyses = [];
    
    for (const hash of hashes) {
      try {
        const analysis = await kv.get(hash);
        if (analysis && 
            analysis.meta && 
            analysis.meta.original_url === targetUrl && 
            !analysis.is_advertisement) {
          sameUrlAnalyses.push({
            hash: analysis.hash || hash,
            modelUsed: analysis.modelUsed || 'unknown',
            analyzed_at: analysis.analyzed_at,
            reliability: analysis.scores?.reliability?.value || 0,
            political_bias: analysis.scores?.political_establishment_bias?.value || 0,
            title: analysis.meta?.title || 'Başlıq yoxdur'
          });
        }
      } catch (e) {
        console.error(`Error fetching analysis ${hash}:`, e);
      }
    }

    // Sort by analyzed_at (most recent first)
    sameUrlAnalyses.sort((a, b) => new Date(b.analyzed_at) - new Date(a.analyzed_at));

    // Filter out the current analysis if we have a current hash
    const alternativeVersions = currentHash 
      ? sameUrlAnalyses.filter(a => a.hash !== currentHash)
      : sameUrlAnalyses;

    // Group by model type for better organization
    const versionsByModel = {};
    alternativeVersions.forEach(version => {
      const model = version.modelUsed;
      if (!versionsByModel[model]) {
        versionsByModel[model] = [];
      }
      versionsByModel[model].push(version);
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    
    return res.status(200).json({
      url: targetUrl,
      currentHash: currentHash,
      totalVersions: sameUrlAnalyses.length,
      alternativeVersions: alternativeVersions,
      versionsByModel: versionsByModel,
      hasAlternatives: alternativeVersions.length > 0
    });

  } catch (e) {
    console.error('analysis-versions error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

export default handler;
