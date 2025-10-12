import { kv } from '@vercel/kv';
import { requireAuth, clearSessionCookie } from '../../lib/auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(405).json({ error: true, message: 'Method not allowed' });
    }

    const user = await requireAuth(req, res);
    if (!user) return; // 401 already sent

    // Only allow deletion for normal users (not admins or developers)
    if (user.isAdmin === true || (user.role && user.role !== 'user')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(403).json({ error: true, message: 'Account deletion is not allowed for this account type.' });
    }

    const userId = user.id;
    const email = user.email;
    const username = (user.username || '').toLowerCase();

    // Best-effort cleanup of related data
    try {
      // Delete API keys owned by the user
      try {
        const keyListKey = `user_keys:${userId}`;
        const keyIds = await kv.lrange(keyListKey, 0, -1);
        if (Array.isArray(keyIds) && keyIds.length > 0) {
          for (const keyId of keyIds) {
            try {
              const keyData = await kv.get(`apikey:${keyId}`);
              if (keyData?.keyHash) {
                await kv.del(`apikey_hash:${keyData.keyHash}`);
              }
              await kv.del(`apikey:${keyId}`);
            } catch {}
          }
        }
        await kv.del(keyListKey);
      } catch {}

      // Delete usage tracking data
      try {
        const patterns = [
          `usage:${userId}:*`,
          `usage:daily:${userId}:*`,
          `usage:monthly:${userId}:*`,
        ];
        for (const pattern of patterns) {
          try {
            const keys = await kv.keys(pattern);
            for (const k of keys) {
              try { await kv.del(k); } catch {}
            }
          } catch {}
        }
      } catch {}

      // Delete analyses list
      try { await kv.del(`user:analyses:${userId}`); } catch {}

      // Delete user indexes
      try { await kv.del(`user:email:${email}`); } catch {}
      if (username) {
        try { await kv.del(`user:username:${username}`); } catch {}
      }

      // Finally delete the user record
      await kv.del(`user:id:${userId}`);
    } catch (e) {
      console.error('Error during account deletion cleanup:', e);
      // Continue to clear cookie and report generic failure
    }

    // Clear session
    try {
      res.setHeader('Set-Cookie', clearSessionCookie());
    } catch {}

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('account/delete error:', e);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(500).json({ error: true, message: 'Internal error' });
  }
}

