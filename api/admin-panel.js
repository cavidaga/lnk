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
      res.setHeader('Location', '/admin-login.html');
      res.end();
      return;
    }

    // Get full user data from database
    const user = await kv.get(`user:id:${session.sub}`);
    if (!user) {
      res.statusCode = 302;
      res.setHeader('Location', '/admin-login.html');
      res.end();
      return;
    }

    // Check if user is admin
    const isAdmin = user.role === 'admin' || 
                   user.isAdmin === true || 
                   user.email === process.env.ADMIN_EMAIL;

    if (!isAdmin) {
      // Redirect to admin login with error message
      res.statusCode = 302;
      res.setHeader('Location', '/admin-login.html?error=access_denied');
      res.end();
      return;
    }

    // User is authenticated and is admin, serve the admin panel
    const fs = await import('fs');
    const adminPanelPath = fileURLToPath(new URL('../../admin-panel.html', import.meta.url));
    const adminPanelContent = fs.readFileSync(adminPanelPath, 'utf8');
    
    // Set content type and serve the HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(adminPanelContent);
    
  } catch (error) {
    console.error('Error serving admin panel:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
