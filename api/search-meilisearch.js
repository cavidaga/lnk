export const config = { runtime: 'nodejs', maxDuration: 30 };

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
    
    const MEILI_URL = process.env.MEILI_URL;
    const MEILI_API_KEY = process.env.MEILI_API_KEY;
    const MEILI_INDEX = process.env.MEILI_INDEX || 'analyses';
    
    if (!MEILI_URL) {
      return new Response(JSON.stringify({ 
        error: true, 
        message: 'Meilisearch not configured. Set MEILI_URL environment variable.' 
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    
    const searchBody = {
      q: query || '',
      limit: limit,
      attributesToRetrieve: ['objectID', 'title', 'publication', 'url', 'published_at', 'reliability', 'political_bias', 'is_advertisement']
    };
    
    if (host) {
      searchBody.filter = `publication = "${host}"`;
    }
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (MEILI_API_KEY) {
      headers['Authorization'] = `Bearer ${MEILI_API_KEY}`;
    }
    
    const response = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(searchBody)
    });
    
    if (!response.ok) {
      throw new Error(`Meilisearch failed: ${response.status}`);
    }
    
    const data = await response.json();
    const results = data.hits.map(hit => ({
      hash: hit.objectID,
      title: hit.title || '',
      publication: hit.publication || '',
      url: hit.url || '',
      published_at: hit.published_at || '',
      reliability: Number(hit.reliability) || 0,
      political_bias: Number(hit.political_bias) || 0,
      is_advertisement: Boolean(hit.is_advertisement)
    }));
    
    return new Response(JSON.stringify({ 
      results,
      total: data.estimatedTotalHits,
      source: 'meilisearch'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60'
      }
    });
    
  } catch (e) {
    console.error('Meilisearch error:', e);
    return new Response(JSON.stringify({ error: true, message: 'Search error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
