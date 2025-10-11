import { getSessionFromRequest } from '../lib/auth.js';

export default async function handler(req, res) {
  try {
    const session = await getSessionFromRequest(req);
    
    if (!session || !session.user) {
      return res.json({ 
        authenticated: false, 
        message: 'Not authenticated' 
      });
    }

    const user = session.user;
    const isAdmin = user.role === 'admin' || 
                   user.isAdmin === true || 
                   user.email === process.env.ADMIN_EMAIL;

    return res.json({
      authenticated: true,
      user: {
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        id: user.id
      },
      adminCheck: {
        roleIsAdmin: user.role === 'admin',
        isAdminFlag: user.isAdmin === true,
        emailMatchesAdmin: user.email === process.env.ADMIN_EMAIL,
        adminEmail: process.env.ADMIN_EMAIL,
        isAdmin: isAdmin
      }
    });
    
  } catch (error) {
    console.error('Debug user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
