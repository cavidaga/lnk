// /lib/url-policy.js
// Pure helpers & constants for URL gating. No network, no Node-only APIs.

const env = (globalThis?.process && process.env) || {};

// CSV helpers (BLOCKED_HOSTS="docs.google.com, drive.google.com")
function readCsv(name) {
  const raw = env[name];
  if (!raw) return [];
  return String(raw)
    .split(/[,\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

// ---------- POLICY DEFAULTS ----------
export const DEFAULT_BLOCKED_HOSTS = [
  // Google Docs/Drive
  "docs.google.com",
  "drive.google.com",
  "drive-usercontent.google.com",
  "storage.googleapis.com",
  "lh3.googleusercontent.com",
  // Common file hosts (expand as you like)
  "dropbox.com",
  "dl.dropboxusercontent.com",
  "onedrive.live.com",
  "*.sharepoint.com",
  "box.com",
  "mega.nz",
  "wetransfer.com",
  "scribd.com",
  "researchgate.net",
  "academia.edu",
  // Large PDFs direct
  "arxiv.org",
];

export const DEFAULT_ALLOWED_MIME = [
  "text/html",
  "text/plain",
  "application/xhtml+xml",
];

// Size & timeout thresholds
export const MAX_CONTENT_LENGTH_HEAD = Number(env.MAX_CONTENT_LENGTH_HEAD || 2_000_000); // 2 MB
export const MAX_GET_BYTES           = Number(env.MAX_GET_BYTES           || 1_000_000); // 1 MB streamed cap
export const CONNECT_TIMEOUT_MS      = Number(env.CONNECT_TIMEOUT_MS      || 3000);
export const TOTAL_TIMEOUT_MS        = Number(env.TOTAL_TIMEOUT_MS        || 10000);

// Allow ENV overrides
export const BLOCKED_HOSTS = [
  ...DEFAULT_BLOCKED_HOSTS,
  ...readCsv("BLOCKED_HOSTS"),
];
export const ALLOWED_HOSTS = readCsv("ALLOWED_HOSTS"); // optional allowlist
export const ALLOWED_MIME  = [
  ...DEFAULT_ALLOWED_MIME,
  ...readCsv("ALLOWED_MIME"),
];

// ---------- HELPERS ----------
function normalizeHost(h) {
  return String(h || "").toLowerCase().replace(/^www\./, "");
}

// Wildcard match: "*.sharepoint.com"
function hostMatches(host, pattern) {
  host = normalizeHost(host);
  pattern = pattern.toLowerCase();

  if (pattern.startsWith("*.")) {
    const base = pattern.slice(2);
    return host === base || host.endsWith("." + base);
  }
  return host === normalizeHost(pattern);
}

export function isBlockedHost(urlOrHost) {
  const host = typeof urlOrHost === "string" && urlOrHost.includes("://")
    ? new URL(urlOrHost).host
    : urlOrHost;

  const h = normalizeHost(host);
  if (ALLOWED_HOSTS.length && ALLOWED_HOSTS.some(p => hostMatches(h, p))) return false;
  return BLOCKED_HOSTS.some(p => hostMatches(h, p));
}

// Block common Docs/Drive routes, exported files, downloads
const PATH_RE = /(\/document\/d\/|\/spreadsheets\/d\/|\/presentation\/d\/|\/file\/d\/|\/uc\?export=)/i;
const PARAM_RE = /([?&](export|download|usp|id)=|pub\?embedded=true)/i;

export function isBlockedPath(urlLike) {
  try {
    const u = new URL(urlLike);
    return PATH_RE.test(u.pathname) || PARAM_RE.test(u.search);
  } catch {
    return false;
  }
}

export function isAllowedMime(contentType = "") {
  const base = String(contentType).split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME.includes(base);
}

// Quick client-side check helper
export function whyBlockedQuick(urlLike) {
  try {
    const u = new URL(urlLike);
    if (isBlockedHost(u.host)) return { blocked: true, reason: "BLOCKED_HOST" };
    if (isBlockedPath(urlLike)) return { blocked: true, reason: "BLOCKED_PATH" };
    return { blocked: false, reason: null };
  } catch {
    return { blocked: true, reason: "BAD_URL" };
  }
}
