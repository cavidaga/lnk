// /api/init-stats.js - One-time initialization of statistics counter
import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    // Only allow POST requests for security
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Initializing statistics counter...');
    
    // Check if counter already exists
    const existingCount = await kv.get('total_analyses_count');
    if (existingCount !== null) {
      console.log('Counter already exists:', existingCount);
      return new Response(JSON.stringify({ 
        message: 'Counter already initialized', 
        current_count: existingCount 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get current count from recent_hashes as a starting point
    const recentCount = await kv.llen('recent_hashes');
    console.log('Recent hashes count:', recentCount);
    
    // Set the counter to the current count
    // Note: This is a rough estimate. The actual count might be higher
    // since some analyses might have expired from recent_hashes but still exist in the database
    await kv.set('total_analyses_count', recentCount);
    
    console.log('Initialized counter with:', recentCount);
    
    return new Response(JSON.stringify({ 
      message: 'Counter initialized', 
      initial_count: recentCount 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('init-stats error:', e);
    return new Response(JSON.stringify({ error: true, message: 'Internal error: ' + (e.message || '') }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
