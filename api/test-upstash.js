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
    
    // First, try to list available indexes
    console.log('[info] Trying to list indexes...');
    const listRes = await fetch(`${S_URL}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${S_TOKEN}`, 
        'Content-Type': 'application/json' 
      }
    });
    
    console.log('[info] List indexes response:', listRes.status);
    if (listRes.ok) {
      const listData = await listRes.json();
      console.log('[info] Available indexes:', listData);
    }
    
    // Try different index names
    const possibleIndexes = ['lnk', 'default', 'main', 'analyses'];
    
    for (const indexName of possibleIndexes) {
      console.log(`[info] Trying index: ${indexName}`);
      const testBody = {
        index: indexName,
        query: '*',
        limit: 1
      };
      
      console.log('[info] Request body:', JSON.stringify(testBody));
      
      const testRes = await fetch(`${S_URL}/query`, {
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
