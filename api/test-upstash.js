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
    
    // Simple test query - try different formats
    const testBody = {
      index: 'lnk',
      query: '*',
      limit: 1
    };
    
    console.log('[info] Request body:', JSON.stringify(testBody));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[info] Aborting request after 5 seconds');
      controller.abort();
    }, 5000);
    
    const startTime = Date.now();
    const res = await fetch(`${S_URL}/query`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${S_TOKEN}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(testBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    
    console.log(`[info] Request completed in ${duration}ms, status: ${res.status}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.log('[error] Upstash response:', res.status, errorText);
      return new Response(JSON.stringify({ 
        error: true, 
        message: `Upstash Search failed: ${res.status}`,
        status: res.status,
        statusText: res.statusText,
        errorText,
        duration,
        requestBody: testBody
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const data = await res.json();
    return new Response(JSON.stringify({ 
      success: true, 
      duration,
      status: res.status,
      dataKeys: Object.keys(data || {}),
      resultsCount: Array.isArray(data?.results) ? data.results.length : 'not array',
      hasResults: Array.isArray(data?.results) && data.results.length > 0
    }), {
      status: 200,
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
