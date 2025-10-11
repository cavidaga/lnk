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

    // Get user by email
    const userEmailKey = `user:email:${email}`;
    const userByEmail = await kv.get(userEmailKey);

    if (!userByEmail || !userByEmail.id) {
      return res.status(404).json({ message: 'User not found by email' });
    }

    // Get user by ID
    const userIdKey = `user:id:${userByEmail.id}`;
    const userById = await kv.get(userIdKey);

    if (!userById) {
      return res.status(404).json({ message: 'User not found by ID' });
    }

    // Update both records to admin
    const updatedUserByEmail = {
      ...userByEmail,
      role: 'admin',
      isAdmin: true
    };

    const updatedUserById = {
      ...userById,
      role: 'admin',
      isAdmin: true
    };

    // Update both records
    await kv.set(userEmailKey, updatedUserByEmail);
    await kv.set(userIdKey, updatedUserById);

    return res.json({ 
      message: 'User fixed and promoted to admin successfully',
      userByEmail: updatedUserByEmail,
      userById: updatedUserById,
      keys: {
        emailKey: userEmailKey,
        idKey: userIdKey
      }
    });
    
  } catch (error) {
    console.error('Fix user admin error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
