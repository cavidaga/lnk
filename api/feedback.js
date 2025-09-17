// api/feedback.js — Store user feedback for analysis accuracy
import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { hash, feedback } = await req.json();
    
    if (!hash || !feedback) {
      return new Response(JSON.stringify({ error: 'Missing hash or feedback' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!['up', 'down'].includes(feedback)) {
      return new Response(JSON.stringify({ error: 'Invalid feedback value' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Store feedback in Vercel KV
    const feedbackKey = `feedback:${hash}`;
    const currentFeedback = await kv.hget(feedbackKey, feedback) || 0;
    
    await kv.hset(feedbackKey, {
      [feedback]: Number(currentFeedback) + 1,
      updated: Date.now()
    });

    // Also store in a list for recent feedback tracking
    await kv.lpush('recent_feedback', JSON.stringify({
      hash,
      feedback,
      timestamp: Date.now()
    }));

    // Keep only last 100 feedback entries
    await kv.ltrim('recent_feedback', 0, 99);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
