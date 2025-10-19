import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs' };

async function handler(req, res) {
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

    // Delete the analysis
    await kv.del(analysisHash);
    
    // Remove from recent_hashes list
    try {
      await kv.lrem('recent_hashes', 1, analysisHash);
    } catch (e) {
      console.error('Error removing from recent_hashes:', e);
    }

    // Remove from search_hashes list
    try {
      await kv.lrem('search_hashes', 1, analysisHash);
    } catch (e) {
      console.error('Error removing from search_hashes:', e);
    }

    console.log(`Deleted analysis: ${analysisHash}`);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      success: true,
      message: 'Analysis deleted successfully',
      hash: analysisHash
    });

  } catch (e) {
    console.error('delete-analysis error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

// Export without authentication - this is a public endpoint for refreshing analyses
export default handler;
