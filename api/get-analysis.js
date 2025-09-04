import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id') || url.searchParams.get('hash') || '';
    if (!id) return res.status(400).json({ error: true, message: 'Missing id/hash' });

    const data = await kv.get(id);
    if (!data) return res.status(404).json({ error: true, message: 'Not found' });

    if (!data.hash) data.hash = id;
    res.status(200).json(data);
  } catch (e) {
    console.error('get-analysis error:', e);
    res.status(500).json({ error: true, message: 'Internal error' });
  }
}