import { getSessionFromRequest } from '../lib/auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    // Check if user is authenticated
    const session = getSessionFromRequest(req);
    
    if (!session?.sub) {
      // Not authenticated - serve login page
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Location', '/dev-login.html');
      res.status(302).end();
      return;
    }

    // User is authenticated - redirect to the protected dev panel
    res.setHeader('Location', '/dev');
    res.status(302).end();
    
  } catch (error) {
    console.error('Dev auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
