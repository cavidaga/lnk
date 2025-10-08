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
    console.log('[info] Testing Upstash Search with correct format...');
    console.log('[info] URL:', S_URL);
    
    // Test 1: Simple query with correct Upstash Search format
    const body = {
      index: 'lnk',
      query: '*',
      limit: 1
    };
    
    console.log('[info] Request body:', JSON.stringify(body));
    console.log('[info] Request URL:', `${S_URL}/query`);
    
    const res = await fetch(`${S_URL}/query`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${S_TOKEN}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(body)
    });
    
    console.log('[info] Response status:', res.status);
    const responseText = await res.text();
    console.log('[info] Response body:', responseText);
    
    return new Response(JSON.stringify({
      success: true,
      status: res.status,
      response: responseText,
      url: S_URL,
      body: body
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (e) {
    console.error('[error] Test failed:', e);
    return new Response(JSON.stringify({ 
      error: true, 
      message: 'Test failed', 
      detail: String(e?.message || e) 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
