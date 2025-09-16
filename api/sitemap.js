// /api/sitemap.js
import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler() {
  const base = 'https://lnk.az';

  // assuming you push hash IDs into a "recent_hashes" list when saving analysis
  let hashes = [];
  try {
    hashes = await kv.lrange('recent_hashes', 0, 499); // 500 latest
  } catch (e) {
    console.error('KV read error in sitemap:', e);
  }

  // static URLs you always want listed
  const staticUrls = [
    `${base}/`,
    `${base}/about.html`,
    `${base}/methodology.html`,
    `${base}/privacy.html`
  ];

  let urls = staticUrls.map(u => `<url><loc>${u}</loc></url>`).join('\n');

  if (hashes?.length) {
    urls += '\n' + hashes.map(h =>
      `<url><loc>${base}/analysis/${h}</loc></url>`
    ).join('\n');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
  </urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
