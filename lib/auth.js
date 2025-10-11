import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import crypto from 'crypto';

// Env configuration
const RAW_JWT_SECRET = process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET;
const ADMIN_REGISTRATION_TOKEN = process.env.ADMIN_REGISTRATION_TOKEN || '';
const SESSION_COOKIE_NAME = 'lnk_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const IS_PROD = (process.env.NODE_ENV === 'production') || Boolean(process.env.VERCEL) || (process.env.VERCEL_ENV === 'production');

// In development, fall back to an insecure default to avoid breaking local login
const JWT_SECRET = RAW_JWT_SECRET || (!((process.env.NODE_ENV === 'production') || Boolean(process.env.VERCEL) || (process.env.VERCEL_ENV === 'production')) ? 'dev-insecure-secret' : '');

if (!RAW_JWT_SECRET) {
  console.warn('[auth] AUTH_JWT_SECRET is not set. Using a fallback in development; set a strong secret in production.');
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
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_TTL_SECONDS;
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify({ ...payload, iat: now, exp })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function buildSessionCookie(token) {
  const maxAge = SESSION_TTL_SECONDS;
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=/`,
    `HttpOnly`,
    // Only mark Secure in production to allow localhost/http during development
    ...(IS_PROD ? ['Secure'] : []),
    `SameSite=Strict`,
    `Max-Age=${maxAge}`,
  ];
  return attrs.join('; ');
}

export function clearSessionCookie() {
  const attrs = [
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; ${IS_PROD ? 'Secure; ' : ''}SameSite=Strict; Max-Age=0`,
  ];
  return attrs.join('; ');
}

export function getSessionFromRequest(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) return null;
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) return null;
    
    // Parse payload
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (data.exp && data.exp < now) return null;
    
    return data;
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


