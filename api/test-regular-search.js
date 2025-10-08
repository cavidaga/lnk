export const config = { runtime: 'nodejs', maxDuration: 10 };

export default async function handler(req) {
  return new Response(JSON.stringify({ 
    message: 'To fix your search, you need to:',
    steps: [
      '1. Create a regular Upstash Search database (not Vector Search)',
      '2. Get the new REST URL and token',
      '3. Update environment variables:',
      '   - UPSTASH_SEARCH_REST_URL (should NOT contain "-search")',
      '   - UPSTASH_SEARCH_REST_TOKEN',
      '4. Re-import your CSV data using the correct format',
      '5. Test with: curl "https://lnk.az/api/search?q=Azadlıq"'
    ],
    currentIssue: 'You have Vector Search but need regular Search for text queries',
    correctUrlFormat: 'https://your-db-name.upstash.io (not -search.upstash.io)',
    correctQueryFormat: {
      url: 'https://your-db-name.upstash.io/query',
      body: {
        index: 'lnk',
        query: 'Azadlıq',
        limit: 10
      }
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
