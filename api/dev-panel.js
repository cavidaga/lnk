import { getSessionFromRequest } from '../lib/auth.js';
import { kv } from '@vercel/kv';
import { fileURLToPath } from 'url';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check if user is authenticated
    const session = getSessionFromRequest(req);
    if (!session?.sub) {
      res.statusCode = 302;
      res.setHeader('Location', '/dev-login.html');
      res.end();
      return;
    }

    // Get full user data from database
    const user = await kv.get(`user:id:${session.sub}`);
    if (!user) {
      res.statusCode = 302;
      res.setHeader('Location', '/dev-login.html');
      res.end();
      return;
    }

    // User is authenticated, serve the dev panel
    const fs = await import('fs');
    const devPanelPath = fileURLToPath(new URL('../dev-panel.html', import.meta.url));
    const devPanelContent = fs.readFileSync(devPanelPath, 'utf8');
    
    // Set content type and serve the HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(devPanelContent);
    
  } catch (error) {
    console.error('Error serving dev panel:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
