import { clearSessionCookie } from '../../lib/auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({ ok: true });
}


