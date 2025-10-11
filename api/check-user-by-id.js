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

    // Get user by email first
    const userEmailKey = `user:email:${email}`;
    const userByEmail = await kv.get(userEmailKey);

    if (!userByEmail || !userByEmail.id) {
      return res.status(404).json({ message: 'User not found by email' });
    }

    // Get user by ID
    const userIdKey = `user:id:${userByEmail.id}`;
    const userById = await kv.get(userIdKey);

    return res.json({
      email,
      userByEmail,
      userById,
      keys: {
        emailKey: userEmailKey,
        idKey: userIdKey
      },
      // Test the findUserByEmail function
      findUserByEmailResult: userById
    });
    
  } catch (error) {
    console.error('Check user by ID error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
