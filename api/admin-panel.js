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
      // Redirect to admin login page if not authenticated
      return res.redirect(302, '/admin-login.html');
    }

    // Check if user is admin
    const user = session.user;
    const isAdmin = user.role === 'admin' || 
                   user.isAdmin === true || 
                   user.email === process.env.ADMIN_EMAIL;

    if (!isAdmin) {
      // Redirect to admin login with error message
      return res.redirect(302, '/admin-login.html?error=access_denied');
    }

    // User is authenticated and is admin, serve the admin panel
    const fs = await import('fs');
    const path = await import('path');
    
    const adminPanelPath = path.join(process.cwd(), 'admin-panel.html');
    const adminPanelContent = fs.readFileSync(adminPanelPath, 'utf8');
    
    // Set content type and serve the HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(adminPanelContent);
    
  } catch (error) {
    console.error('Error serving admin panel:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
