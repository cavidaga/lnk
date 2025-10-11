import { requireAuth } from '../lib/auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }
    
    const user = await requireAuth(req, res);
    if (!user) return;
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        twoFactorEnabled: user.twoFactorEnabled,
        hasTwoFactorSecret: !!user.twoFactorSecret,
        twoFactorBackupCodes: user.twoFactorBackupCodes ? user.twoFactorBackupCodes.length : 0,
        twoFactorEnabledAt: user.twoFactorEnabledAt,
        fullUser: user // Include full user object for debugging
      }
    });
  } catch (e) {
    console.error('Debug user 2FA error:', e);
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}
