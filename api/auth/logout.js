import { clearSessionCookie } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler() {
  const headers = new Headers();
  headers.set('Set-Cookie', clearSessionCookie());
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers
  });
}


