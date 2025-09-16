// pages/api/card.js 
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const to = new URL('/api/card-image', url.origin);
  to.search = url.search; // keep ?hash=&theme=… intact

  return new Response(null, {
    status: 307, // temporary redirect; crawlers follow it
    headers: {
      Location: to.toString(),
      'Cache-Control': 'public, max-age=0, s-maxage=300',
    },
  });
}