import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';

// Env configuration
const JWT_SECRET = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET;
const ADMIN_REGISTRATION_TOKEN = process.env.ADMIN_REGISTRATION_TOKEN || '';
const SESSION_COOKIE_NAME = 'lnk_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

if (!JWT_SECRET) {
  console.warn('[auth] AUTH_JWT_SECRET is not set. Generate a strong random secret and set it in env.');
}

function parseCookies(req) {
  const hdr = req.headers?.cookie || req.headers?.Cookie || '';
  const out = {};
  hdr.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i === -1) return;
    const k = p.slice(0, i).trim();
    const v = decodeURIComponent(p.slice(i + 1).trim());
    if (k) out[k] = v;
  });
  return out;
}

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

export async function registerUser({ email, password, registrationToken }) {
  if (!ADMIN_REGISTRATION_TOKEN || registrationToken !== ADMIN_REGISTRATION_TOKEN) {
    const err = new Error('Registration disabled');
    err.code = 'REG_DISABLED';
    throw err;
  }
  const key = `user:email:${String(email).toLowerCase()}`;
  const existing = await kv.get(key);
  if (existing) {
    const err = new Error('Email already registered');
    err.code = 'EMAIL_EXISTS';
    throw err;
  }
  const id = `u_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const passwordHash = await hashPassword(password);
  const user = {
    id,
    email: String(email).toLowerCase(),
    passwordHash,
    plan: 'free',
    createdAt: new Date().toISOString(),
  };
  await kv.set(`user:id:${id}`, user);
  await kv.set(key, { id, email: user.email });
  return { id, email: user.email };
}

export async function findUserByEmail(email) {
  const idx = await kv.get(`user:email:${String(email).toLowerCase()}`);
  if (!idx?.id) return null;
  return await kv.get(`user:id:${idx.id}`);
}

export function issueJwt(user) {
  const payload = { sub: user.id, email: user.email, plan: user.plan || 'free' };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
  return token;
}

export function buildSessionCookie(token) {
  const maxAge = SESSION_TTL_SECONDS;
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Strict`,
    `Max-Age=${maxAge}`,
  ];
  return attrs.join('; ');
}

export function clearSessionCookie() {
  const attrs = [
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  ];
  return attrs.join('; ');
}

export function getSessionFromRequest(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) return null;
    const data = jwt.verify(token, JWT_SECRET);
    return data || null;
  } catch {
    return null;
  }
}

export async function requireAuth(req, res) {
  const session = getSessionFromRequest(req);
  if (!session?.sub) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(401).json({ error: true, message: 'Unauthorized' });
    return null;
  }
  const user = await kv.get(`user:id:${session.sub}`);
  if (!user) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(401).json({ error: true, message: 'Unauthorized' });
    return null;
  }
  return user;
}


