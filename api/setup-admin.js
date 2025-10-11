import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email, adminToken } = req.body;

    if (!email || !adminToken) {
      return res.status(400).json({ message: 'Email and admin token are required' });
    }

    // Check if admin token matches environment variable
    if (adminToken !== process.env.ADMIN_REGISTRATION_TOKEN) {
      return res.status(403).json({ message: 'Invalid admin token' });
    }

    // Get user from database - try different key formats
    const possibleKeys = [
      `user:email:${email}`,
      `user:${email}`,
      `user:email:${email.toLowerCase()}`,
      `user:${email.toLowerCase()}`,
      email
    ];

    let user = null;
    let userKey = null;

    for (const key of possibleKeys) {
      user = await kv.get(key);
      if (user) {
        userKey = key;
        break;
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register first.' });
    }

    // Update user to admin
    const updatedUser = {
      ...user,
      role: 'admin',
      isAdmin: true
    };

    await kv.set(userKey, updatedUser);

    return res.json({ 
      message: 'User promoted to admin successfully',
      user: {
        email: updatedUser.email,
        role: updatedUser.role,
        isAdmin: updatedUser.isAdmin
      }
    });
    
  } catch (error) {
    console.error('Setup admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
