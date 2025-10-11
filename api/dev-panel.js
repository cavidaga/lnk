import { getSessionFromRequest } from '../lib/auth.js';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check if user is authenticated
    const session = await getSessionFromRequest(req);
    
    if (!session || !session.user) {
      // Redirect to login page if not authenticated
      return res.redirect(302, '/dev-login.html');
    }

    // User is authenticated, serve the dev panel
    const fs = await import('fs');
    const path = await import('path');
    
    const devPanelPath = path.join(process.cwd(), 'public', 'dev-panel.html');
    const devPanelContent = fs.readFileSync(devPanelPath, 'utf8');
    
    // Set content type and serve the HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(devPanelContent);
    
  } catch (error) {
    console.error('Error serving dev panel:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
