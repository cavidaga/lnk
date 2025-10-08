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
    
    const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
    const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
    const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || 'lnk_analyses';
    
    if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
      return new Response(JSON.stringify({ 
        error: true, 
        message: 'Algolia not configured. Set ALGOLIA_APP_ID and ALGOLIA_API_KEY environment variables.' 
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    
    const searchParams = new URLSearchParams({
      query: query || '*',
      hitsPerPage: limit.toString(),
      attributesToRetrieve: 'objectID,title,publication,url,published_at,reliability,political_bias,is_advertisement'
    });
    
    if (host) {
      searchParams.append('filters', `publication:"${host}"`);
    }
    
    const response = await fetch(`https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX_NAME}/query`, {
      method: 'POST',
      headers: {
        'X-Algolia-API-Key': ALGOLIA_API_KEY,
        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        params: searchParams.toString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Algolia search failed: ${response.status}`);
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
      total: data.nbHits,
      source: 'algolia'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60'
      }
    });
    
  } catch (e) {
    console.error('Algolia search error:', e);
    return new Response(JSON.stringify({ error: true, message: 'Search error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}
