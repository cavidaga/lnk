import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
  try {
    console.log('Starting duplicate cleanup...');
    
    // Get all recent hashes
    const hashes = await kv.lrange('recent_hashes', 0, -1);
    console.log(`Found ${hashes.length} total analyses`);
    
    // Group analyses by URL
    const urlGroups = new Map();
    const analyses = [];
    
    for (const hash of hashes) {
      try {
        const analysis = await kv.get(hash);
        if (analysis && analysis.meta && analysis.meta.original_url) {
          const url = analysis.meta.original_url;
          if (!urlGroups.has(url)) {
            urlGroups.set(url, []);
          }
          urlGroups.get(url).push({ hash, analysis });
          analyses.push({ hash, analysis });
        }
      } catch (e) {
        console.error(`Error fetching analysis ${hash}:`, e);
      }
    }
    
    console.log(`Found ${urlGroups.size} unique URLs`);
    
    // Find duplicates
    const duplicates = [];
    for (const [url, urlAnalyses] of urlGroups) {
      if (urlAnalyses.length > 1) {
        // Sort by analyzed_at (most recent first)
        urlAnalyses.sort((a, b) => {
          const dateA = new Date(a.analysis.analyzed_at || 0);
          const dateB = new Date(b.analysis.analyzed_at || 0);
          return dateB - dateA;
        });
        
        // Keep the most recent, mark others as duplicates
        const [keep, ...dups] = urlAnalyses;
        duplicates.push({
          url,
          keep: keep.hash,
          duplicates: dups.map(d => d.hash)
        });
      }
    }
    
    console.log(`Found ${duplicates.length} URLs with duplicates`);
    
    // Remove duplicates from recent_hashes list
    let removedCount = 0;
    for (const { duplicates: dups } of duplicates) {
      for (const dupHash of dups) {
        try {
          await kv.lrem('recent_hashes', 1, dupHash);
          removedCount++;
        } catch (e) {
          console.error(`Error removing duplicate ${dupHash}:`, e);
        }
      }
    }
    
    console.log(`Removed ${removedCount} duplicate hashes from recent_hashes`);
    
    // Recalculate site averages
    console.log('Recalculating site averages...');
    
    // Clear existing site stats
    const siteStatsKeys = await kv.keys('site_stats:*');
    for (const key of siteStatsKeys) {
      await kv.del(key);
    }
    
    // Clear existing site URL tracking
    const siteUrlKeys = await kv.keys('site_urls:*');
    for (const key of siteUrlKeys) {
      await kv.del(key);
    }
    
    // Recalculate site stats from unique analyses only
    const uniqueAnalyses = [];
    for (const [url, urlAnalyses] of urlGroups) {
      // Take only the most recent analysis for each URL
      const mostRecent = urlAnalyses.sort((a, b) => {
        const dateA = new Date(a.analysis.analyzed_at || 0);
        const dateB = new Date(b.analysis.analyzed_at || 0);
        return dateB - dateA;
      })[0];
      uniqueAnalyses.push(mostRecent);
    }
    
    console.log(`Recalculating stats for ${uniqueAnalyses.length} unique analyses`);
    
    // Update site stats for each unique analysis
    for (const { analysis } of uniqueAnalyses) {
      try {
        await updateSiteStatsFromAnalysis(analysis);
      } catch (e) {
        console.error('Error updating site stats:', e);
      }
    }
    
    return res.status(200).json({
      success: true,
      totalAnalyses: analyses.length,
      uniqueUrls: urlGroups.size,
      duplicatesFound: duplicates.length,
      duplicatesRemoved: removedCount,
      siteStatsRecalculated: true
    });
    
  } catch (e) {
    console.error('Cleanup error:', e);
    return res.status(500).json({ error: true, message: e.message });
  }
}

// Helper function to update site stats (copied from analyze.js)
function normalizeHost(host) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  if (h === 'abzas.info' || h === 'abzas.net' || h === 'abzas.org') return 'abzas.org';
  return h;
}

async function updateSiteStatsFromAnalysis(analysis) {
  try {
    if (!analysis || analysis.is_advertisement) return;

    const originalUrl = analysis?.meta?.original_url || '';
    let host = '';
    try { host = normalizeHost(new URL(originalUrl).hostname); } catch {}
    if (!host) return;

    const rel = analysis?.scores?.reliability?.value;
    const bias = analysis?.scores?.political_establishment_bias?.value;
    if (typeof rel !== 'number' || typeof bias !== 'number') return;

    const key = `site_stats:${host}`;
    const urlKey = `site_urls:${host}`;
    
    // Check if this URL has already been counted for this site
    const existingUrls = await kv.get(urlKey) || [];
    if (existingUrls.includes(originalUrl)) {
      console.log(`URL ${originalUrl} already counted for site ${host}, skipping`);
      return;
    }
    
    // Add this URL to the list of counted URLs
    existingUrls.push(originalUrl);
    await kv.set(urlKey, existingUrls, { ex: 2592000 }); // 30 days expiry
    
    const existing = await kv.get(key) || { count: 0, sum_rel: 0, sum_bias: 0 };

    const count = (existing.count || 0) + 1;
    const sum_rel = (existing.sum_rel || 0) + rel;
    const sum_bias = (existing.sum_bias || 0) + bias;
    const avg_rel = sum_rel / count;
    const avg_bias = sum_bias / count;

    await kv.set(key, {
      host,
      count,
      sum_rel,
      sum_bias,
      avg_rel,
      avg_bias,
      updated_at: new Date().toISOString()
    });
    
    console.log(`Updated site stats for ${host}: count=${count}, avg_rel=${avg_rel.toFixed(1)}, avg_bias=${avg_bias.toFixed(1)}`);
  } catch (e) {
    console.error('updateSiteStatsFromAnalysis error:', e);
  }
}

export default handler;
