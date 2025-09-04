// api/get-analysis.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    // Accept either ?id=... or ?hash=...
    const id = url.searchParams.get('id') || url.searchParams.get('hash') || '';

    if (!id) {
      return res.status(400).json({ error: true, message: 'Missing id/hash' });
    }

    const data = await kv.get(id);
    if (!data) {
      return res.status(404).json({ error: true, message: 'Not found' });
    }

    // Return exactly what analyze.js stored (plus hash convenience)
    if (!data.hash) data.hash = id;
    return res.status(200).json(data);
  } catch (e) {
    console.error('get-analysis error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}