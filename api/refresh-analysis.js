import { kv } from '@vercel/kv';
import { withAuth } from '../lib/middleware.js';

export const config = { runtime: 'nodejs' };

async function refreshAnalysisHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(405).json({ error: true, message: 'Method not allowed' });
  }

  try {
    const { hash, url } = req.body;

    if (!hash && !url) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({ error: true, message: 'Hash or URL is required' });
    }

    let analysisHash = hash;

    // If URL is provided instead of hash, find the analysis by URL
    if (!hash && url) {
      // Get all recent hashes to search through
      const hashes = await kv.lrange('recent_hashes', 0, 9999);
      
      for (const h of hashes) {
        try {
          const analysis = await kv.get(h);
          if (analysis && analysis.meta && analysis.meta.original_url === url) {
            analysisHash = h;
            break;
          }
        } catch (e) {
          // Continue searching
        }
      }
      
      if (!analysisHash) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(404).json({ error: true, message: 'Analysis not found for this URL' });
      }
    }

    // Get the existing analysis
    const existingAnalysis = await kv.get(analysisHash);
    if (!existingAnalysis) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(404).json({ error: true, message: 'Analysis not found' });
    }

    // Mark the analysis as needing refresh instead of deleting it
    const updatedAnalysis = {
      ...existingAnalysis,
      needs_refresh: true,
      refresh_requested_at: new Date().toISOString(),
      refresh_requested_by: req.authUser?.id || 'anonymous'
    };

    // Update the analysis in the database
    await kv.set(analysisHash, updatedAnalysis);

    console.log(`Marked analysis for refresh: ${analysisHash}`);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      message: 'Analysis marked for refresh. Please re-analyze the URL to get updated results.',
      hash: analysisHash,
      refresh_url: existingAnalysis?.meta?.original_url || url
    });

  } catch (e) {
    console.error('refresh-analysis error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

// Export with authentication - only authenticated users can refresh analyses
export default withAuth(refreshAnalysisHandler, {
  require: 'optional', // Optional authentication - can be used by both authenticated and anonymous users
  trackUsage: false // Don't track usage for refresh requests
});
