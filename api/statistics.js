// /api/statistics.js
import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    console.log('Statistics API called');
    
    // Try to get the total count from a dedicated counter
    let totalCount = await kv.get('total_analyses_count');
    
    // If no counter exists, initialize it with a reasonable estimate
    // Based on the database having 375+ analyses
    if (totalCount === null) {
      console.log('No total_analyses_count found, initializing with estimated count');
      const recentCount = await kv.llen('recent_hashes');
      // Use a higher estimate since we know there are more analyses than just recent ones
      const estimatedTotal = Math.max(recentCount, 375);
      await kv.set('total_analyses_count', estimatedTotal);
      totalCount = estimatedTotal;
      console.log('Initialized counter with estimated count:', totalCount);
    }
    
    console.log('Total analyses count:', totalCount);
    
    // Since the tool was launched this week and we don't have time-based tracking,
    // we'll show a simple estimate for today's activity
    // This is a rough estimate based on the assumption that activity is distributed across the week
    const recentCount = Math.max(1, Math.floor(totalCount / 7)); // Rough estimate: total divided by 7 days
    
    const stats = {
      total_analyses: totalCount,
      recent_analyses: recentCount, // Estimated analyses from today
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
