import { kv } from '@vercel/kv';

export const config = { runtime: 'nodejs', maxDuration: 15 };

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
    
    // Get recent hashes (limited to prevent timeout)
    const hashes = await kv.lrange('recent_hashes', 0, 200);
    const results = [];
    
    const normalizedQuery = normalizeText(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);
    
    for (const hash of hashes) {
      if (results.length >= limit) break;
      
      try {
        const analysis = await kv.get(hash);
        if (!analysis || analysis.is_advertisement) continue;
        
        // Host filtering
        if (host) {
          const pubHost = (analysis.meta?.publication || '').toLowerCase().replace(/^www\./, '');
          if (!pubHost.includes(host.toLowerCase())) continue;
        }
        
        // Text search
        if (query) {
          const searchableText = [
            analysis.meta?.title || '',
            analysis.meta?.publication || '',
            analysis.human_summary || '',
            analysis.meta?.original_url || ''
          ].join(' ').toLowerCase();
          
          const normalizedText = normalizeText(searchableText);
          const hasAllWords = queryWords.every(word => normalizedText.includes(word));
          
          if (!hasAllWords) continue;
        }
        
        results.push({
          hash,
          title: analysis.meta?.title || '',
          publication: analysis.meta?.publication || '',
          url: analysis.meta?.original_url || '',
          published_at: analysis.meta?.published_at || '',
          reliability: analysis.scores?.reliability?.value || 0,
          political_bias: analysis.scores?.political_establishment_bias?.value || 0,
          is_advertisement: Boolean(analysis.is_advertisement)
        });
        
      } catch (e) {
        // Skip invalid analyses
        continue;
      }
    }
    
    return new Response(JSON.stringify({ 
      results,
      total: results.length,
      source: 'simple_kv'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60'
      }
    });
    
  } catch (e) {
    console.error('Simple search error:', e);
    return new Response(JSON.stringify({ error: true, message: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
