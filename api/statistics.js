// /api/statistics.js
import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    console.log('Statistics API called');
    
    // Get the total count of analyses from recent_hashes list
    const totalCount = await kv.llen('recent_hashes');
    console.log('Total analyses count:', totalCount);
    
    // Get some additional statistics if needed
    const stats = {
      total_analyses: totalCount,
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'
      }
    });
  } catch (e) {
    console.error('statistics error:', e);
    return new Response(JSON.stringify({ error: true, message: 'Internal error: ' + (e.message || '') }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  }
}
