import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs', maxDuration: 30 };

// Simple text normalization for search
function normalizeText(text) {
  return String(text || '').toLowerCase()
    .replace(/[ə]/g, 'e')
    .replace(/[ç]/g, 'c')
    .replace(/[ş]/g, 's')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ü]/g, 'u')
    .replace(/[ğ]/g, 'g')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Create search index for a single analysis
async function indexAnalysis(hash, analysis) {
  if (!analysis || analysis.is_advertisement) return;
  
  const searchableText = [
    analysis.meta?.title || '',
    analysis.meta?.publication || '',
    analysis.human_summary || '',
    analysis.meta?.original_url || ''
  ].join(' ').toLowerCase();
  
  const normalized = normalizeText(searchableText);
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  
  // Store word mappings
  for (const word of words) {
    await kv.sadd(`search:${word}`, hash);
  }
  
  // Store analysis metadata for quick retrieval
  await kv.hset(`analysis:${hash}`, {
    title: analysis.meta?.title || '',
    publication: analysis.meta?.publication || '',
    url: analysis.meta?.original_url || '',
    published_at: analysis.meta?.published_at || '',
    reliability: analysis.scores?.reliability?.value || 0,
    political_bias: analysis.scores?.political_establishment_bias?.value || 0,
    is_advertisement: analysis.is_advertisement || false
  });
}

export default async function handler(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const query = (url.searchParams.get('q') || '').trim();
    const host = (url.searchParams.get('host') || '').trim();
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
    
    if (!query && !host) {
      return new Response(JSON.stringify({ error: true, message: 'Missing q or host' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    
    let resultHashes = new Set();
    
    if (query) {
      const normalizedQuery = normalizeText(query);
      const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
      
      // Get hashes for each word
      for (const word of queryWords) {
        const hashes = await kv.smembers(`search:${word}`);
        if (hashes.length > 0) {
          if (resultHashes.size === 0) {
            // First word - add all hashes
            hashes.forEach(h => resultHashes.add(h));
          } else {
            // Intersection with existing results
            resultHashes = new Set([...resultHashes].filter(h => hashes.includes(h)));
          }
        }
      }
    }
    
    // If host filter is specified, get all hashes and filter by host
    if (host) {
      const allHashes = await kv.lrange('recent_hashes', 0, 1000);
      const hostHashes = new Set();
      
      for (const hash of allHashes) {
        const analysis = await kv.hgetall(`analysis:${hash}`);
        if (analysis && analysis.publication) {
          const pubHost = analysis.publication.toLowerCase().replace(/^www\./, '');
          if (pubHost.includes(host.toLowerCase())) {
            hostHashes.add(hash);
          }
        }
      }
      
      if (resultHashes.size === 0) {
        resultHashes = hostHashes;
      } else {
        resultHashes = new Set([...resultHashes].filter(h => hostHashes.has(h)));
      }
    }
    
    // Convert to array and limit results
    const hashes = Array.from(resultHashes).slice(0, limit);
    const results = [];
    
    // Get analysis data for each hash
    for (const hash of hashes) {
      const analysis = await kv.hgetall(`analysis:${hash}`);
      if (analysis) {
        results.push({
          hash,
          title: analysis.title || '',
          publication: analysis.publication || '',
          url: analysis.url || '',
          published_at: analysis.published_at || '',
          reliability: Number(analysis.reliability) || 0,
          political_bias: Number(analysis.political_bias) || 0,
          is_advertisement: Boolean(analysis.is_advertisement)
        });
      }
    }
    
    return new Response(JSON.stringify({ 
      results,
      total: results.length,
      source: 'kv_optimized'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60'
      }
    });
    
  } catch (e) {
    console.error('Search error:', e);
    return new Response(JSON.stringify({ error: true, message: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
