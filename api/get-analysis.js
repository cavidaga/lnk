import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id') || url.searchParams.get('hash') || '';
    if (!id) {
      return res.status(400).json({ error: true, message: 'Missing id/hash' });
    }

    const data = await kv.get(id);
    if (!data) {
      return res.status(404).json({ error: true, message: 'Not found' });
    }

    if (!data.hash) data.hash = id;

    // Nice caching: 1 day CDN, 1h stale-while-revalidate
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=86400, stale-while-revalidate=3600'
    );

    if (data.schema_version) {
      res.setHeader('X-Schema-Version', data.schema_version);
    }
    if (data.modelUsed) {
      res.setHeader('X-Model-Used', data.modelUsed);
    }
    if (data.contentSource) {
      res.setHeader('X-Content-Source', data.contentSource);
    }

    res.status(200).json(data);
  } catch (e) {
    console.error('get-analysis error:', e);
    res
      .status(500)
      .json({ error: true, message: 'Internal error: ' + (e.message || '') });
  }
}