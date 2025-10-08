export const config = { runtime: 'nodejs', maxDuration: 10 };

export default async function handler(req) {
  const S_URL = process.env.UPSTASH_SEARCH_REST_URL;
  const S_TOKEN = process.env.UPSTASH_SEARCH_REST_TOKEN;
  
  if (!S_URL || !S_TOKEN) {
    return new Response(JSON.stringify({ 
      error: true, 
      message: 'Upstash Search not configured',
      hasUrl: !!S_URL,
      hasToken: !!S_TOKEN
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('[info] Testing Upstash Search connection...');
    
    // Check if this is Vector Search or regular Search
    console.log('[info] Checking service type...');
    console.log('[info] URL:', S_URL);
    
    // Try regular Search API format first
    const searchUrl = S_URL.replace('-search.upstash.io', '.upstash.io');
    console.log('[info] Trying regular Search URL:', searchUrl);
    
    const searchRes = await fetch(`${searchUrl}/query`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${S_TOKEN}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        index: 'lnk',
        query: '*',
        limit: 1
      })
    });
    
    console.log('[info] Regular Search response:', searchRes.status);
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      return new Response(JSON.stringify({ 
        success: true, 
        serviceType: 'regular_search',
        searchUrl,
        data: searchData
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const errorText = await searchRes.text();
      console.log('[info] Regular Search error:', errorText);
    }
    
    // If regular search fails, try vector search with text query
    console.log('[info] Trying vector search with text query...');
    const vectorRes = await fetch(`${S_URL}/query/lnk`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${S_TOKEN}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        query: 'test',
        limit: 1
      })
    });
    
    console.log('[info] Vector search response:', vectorRes.status);
    if (vectorRes.ok) {
      const vectorData = await vectorRes.json();
      return new Response(JSON.stringify({ 
        success: true, 
        serviceType: 'vector_search',
        data: vectorData
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      const errorText = await vectorRes.text();
      console.log('[info] Vector search error:', errorText);
    }
    
    // Try different index names
    const possibleIndexes = ['lnk', 'default', 'main', 'analyses'];
    
    for (const indexName of possibleIndexes) {
      console.log(`[info] Trying index: ${indexName}`);
      const testBody = {
        query: '*',
        limit: 1
      };
      
      console.log('[info] Request body:', JSON.stringify(testBody));
      console.log('[info] Request URL:', `${S_URL}/query/${indexName}`);
      
      const testRes = await fetch(`${S_URL}/query/${indexName}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${S_TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(testBody)
      });
      
      console.log(`[info] Index ${indexName} response:`, testRes.status);
      if (testRes.ok) {
        const testData = await testRes.json();
        return new Response(JSON.stringify({ 
          success: true, 
          workingIndex: indexName,
          data: testData
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        const errorText = await testRes.text();
        console.log(`[info] Index ${indexName} error:`, errorText);
      }
    }
    
    return new Response(JSON.stringify({ 
      error: true, 
      message: 'No working index found',
      triedIndexes: possibleIndexes
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (e) {
    console.error('[error] Upstash test failed:', e);
    
    if (e.name === 'AbortError') {
      return new Response(JSON.stringify({ 
        error: true, 
        message: 'Request aborted after 5 seconds - Upstash Search is not responding',
        errorType: 'timeout'
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      error: true, 
      message: 'Upstash Search test failed',
      errorType: e.name,
      errorMessage: e.message,
      stack: e.stack
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
