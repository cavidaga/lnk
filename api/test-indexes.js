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
    console.log('Testing Upstash Search indexes...');
    console.log('URL:', S_URL);
    
    // Try to list indexes
    const listRes = await fetch(`${S_URL}/indexes`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${S_TOKEN}` }
    });
    
    console.log('List indexes response:', listRes.status);
    const listData = await listRes.text();
    console.log('List indexes data:', listData);
    
    // Try different index names
    const testIndexes = ['lnk', 'default', 'main', 'analyses'];
    
    for (const indexName of testIndexes) {
      console.log(`Testing index: ${indexName}`);
      
      const testRes = await fetch(`${S_URL}/query/${indexName}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${S_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '*', limit: 1 })
      });
      
      console.log(`Index ${indexName} response:`, testRes.status);
      const testData = await testRes.text();
      console.log(`Index ${indexName} data:`, testData);
    }
    
    return new Response(JSON.stringify({
      success: true,
      url: S_URL,
      listStatus: listRes.status,
      listData: listData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (e) {
    console.error('Test failed:', e);
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
