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

    // Try different key formats
    const possibleKeys = [
      `user:email:${email}`,
      `user:${email}`,
      `user:email:${email.toLowerCase()}`,
      `user:${email.toLowerCase()}`,
      `user:email:${email.toUpperCase()}`,
      `user:${email.toUpperCase()}`,
      email,
      email.toLowerCase(),
      email.toUpperCase()
    ];

    const results = {};

    for (const key of possibleKeys) {
      try {
        const user = await kv.get(key);
        if (user) {
          results[key] = {
            found: true,
            data: user,
            keys: Object.keys(user),
            role: user.role,
            isAdmin: user.isAdmin,
            email: user.email
          };
        } else {
          results[key] = { found: false };
        }
      } catch (error) {
        results[key] = `Error: ${error.message}`;
      }
    }

    // Also try to list all user keys
    let allUserKeys = [];
    try {
      // This might not work on all KV implementations, but worth trying
      const pattern = 'user:*';
      allUserKeys = await kv.keys(pattern);
    } catch (error) {
      allUserKeys = [`Error listing keys: ${error.message}`];
    }

    return res.json({
      email,
      possibleKeys,
      results,
      allUserKeys: allUserKeys.slice(0, 10), // Limit to first 10 keys
      adminEmail: process.env.ADMIN_EMAIL,
      adminToken: process.env.ADMIN_REGISTRATION_TOKEN ? 'Set' : 'Not set'
    });
    
  } catch (error) {
    console.error('Debug database error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
