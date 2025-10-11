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

    // If we found a user by email but it's incomplete, try to find the full user record by ID
    if (user && user.id && (!user.role || !user.isAdmin)) {
      const userByIdKey = `user:id:${user.id}`;
      const userById = await kv.get(userByIdKey);
      if (userById && (userById.role || userById.isAdmin)) {
        // Use the more complete user record
        user = userById;
        userKey = userByIdKey;
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register first.' });
    }

    // Update user to admin
    const updatedUser = {
      ...user,
      role: 'admin',
      isAdmin: true,
      // Ensure we have all required fields
      email: user.email || email,
      id: user.id
    };

    await kv.set(userKey, updatedUser);

    // Also try to update by user ID if we have it
    if (user.id) {
      const userByIdKey = `user:id:${user.id}`;
      const userById = await kv.get(userByIdKey);
      if (userById) {
        const updatedUserById = {
          ...userById,
          role: 'admin',
          isAdmin: true,
          email: userById.email || email
        };
        await kv.set(userByIdKey, updatedUserById);
      }
    }

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
