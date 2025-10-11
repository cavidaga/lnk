import { getSessionFromRequest } from '../lib/auth.js';
import { kv } from '@vercel/kv';
import { fileURLToPath } from 'url';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    // Only allow GET
    if (req.method !== 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ message: 'Method not allowed' });
    }

    // Auth check
    const session = getSessionFromRequest(req);
    if (!session?.sub) {
      res.statusCode = 302;
      res.setHeader('Location', '/user-login.html?login=required');
      res.end();
      return;
    }

    const user = await kv.get(`user:id:${session.sub}`);
    if (!user) {
      res.statusCode = 302;
      res.setHeader('Location', '/user-login.html');
      res.end();
      return;
    }

    const fs = await import('fs');
    const dashboardPath = fileURLToPath(new URL('../public/user-dashboard.html', import.meta.url));
    let html = fs.readFileSync(dashboardPath, 'utf8');

    // For regular users (non-admin, non-developer), remove the Plan card SSR-side
    const role = user.role || (user.isAdmin ? 'admin' : 'user');
    const isBasicUser = role === 'user' && (user.plan === 'free' || !user.plan);
    if (isBasicUser) {
      try {
        // Remove the stat card that contains id="user-plan"
        const planCardRegex = /<div\s+class=["']stat-card["'][\s\S]*?id=["']user-plan["'][\s\S]*?<\/div>\s*/i;
        html = html.replace(planCardRegex, '');
      } catch {}
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('User dashboard render error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

