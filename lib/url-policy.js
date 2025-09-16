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
  // Docs/Drive & common file hosts
  "docs.google.com","drive.google.com","drive-usercontent.google.com",
  "storage.googleapis.com","lh3.googleusercontent.com",
  "dropbox.com","dl.dropboxusercontent.com","onedrive.live.com","*.sharepoint.com",
  "box.com","mega.nz","wetransfer.com","scribd.com","researchgate.net","academia.edu",
  // Large PDFs direct
  "arxiv.org",
];

// Social/video (blocked by default — exceptions below)
export const DEFAULT_BLOCKED_SOCIAL = [
  "tiktok.com","m.tiktok.com","vt.tiktok.com",
  "youtube.com","m.youtube.com","youtu.be",
  "instagram.com","www.instagram.com",
  "facebook.com","m.facebook.com","fb.com","www.facebook.com",
  "x.com","twitter.com","mobile.twitter.com","www.twitter.com"
];

// Shorteners
export const DEFAULT_BLOCKED_SHORTENERS = [
  "bit.ly","t.co","tinyurl.com","ow.ly","buff.ly","goo.gl","is.gd","t.ly","lnkd.in","rb.gy"
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

// Optional strict modes
export const ALLOWLIST_ONLY      = String(env.ALLOWLIST_ONLY || "").trim() === "1";
export const STRICT_ARTICLE_MODE = String(env.STRICT_ARTICLE_MODE || "").trim() === "1";

// Allow ENV overrides
export const BLOCKED_HOSTS = [
  ...DEFAULT_BLOCKED_HOSTS,
  ...DEFAULT_BLOCKED_SOCIAL,
  ...DEFAULT_BLOCKED_SHORTENERS,
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

// --- FB/X exceptions: allow text posts & X Articles; block video/watch/reels/spaces ---
const FB_ALLOWED_RE = [
  // classic post URLs
  /^\/[^/]+\/posts\/\d+(?:\/)?$/i,                     // /username/posts/1234567890
  /^\/groups\/\d+\/posts\/\d+(?:\/)?$/i,              // /groups/123456/posts/999
  /^\/permalink\.php/i,                                // ?story_fbid=...
  /^\/story\.php/i                                     // ?story_fbid=...
];
const FB_BLOCKED_RE = [
  /^\/watch\/?/i, /^\/reel(s)?\/?/i, /^\/videos?\//i,  // video/reels
  /^\/photo\.php/i, /^\/photos?\//i,                   // image-only
  /^\/events?\//i, /^\/marketplace\//i                 // non-article surfaces
];

const X_ALLOWED_RE = [
  /^\/i\/articles\//i,                                 // X Articles endpoints
  /^\/notes?\//i,                                      // legacy Notes (if present)
  /^\/[^/]+\/status\/\d+(?:\/)?$/i                     // regular tweets (text allowed)
];
const X_BLOCKED_RE = [
  /^\/i\/spaces\//i, /^\/i\/broadcasts?\//i,           // audio/video
  /^\/home\/?$/i, /^\/explore\/?$/i                    // discovery/home
];

function isAllowedSocialException(urlLike) {
  try {
    const u = new URL(urlLike);
    const h = normalizeHost(u.host);
    const p = u.pathname || "";

    // FACEBOOK
    if (/(^|\.)facebook\.com$|(^|\.)fb\.com$/i.test(h)) {
      if (FB_BLOCKED_RE.some(rx => rx.test(p))) return false;      // explicit video/watch blocks
      if (FB_ALLOWED_RE.some(rx => rx.test(p))) return true;       // textual posts ok
      return false;                                                // other FB surfaces blocked
    }

    // X / TWITTER
    if (/(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(h)) {
      if (X_BLOCKED_RE.some(rx => rx.test(p))) return false;       // spaces/broadcasts/home
      if (X_ALLOWED_RE.some(rx => rx.test(p))) return true;        // articles + status
      return false;                                                // other X surfaces blocked
    }

    return false;
  } catch {
    return false;
  }
}

// Block docs routes, exported files, downloads
const PATH_RE   = /(\/document\/d\/|\/spreadsheets\/d\/|\/presentation\/d\/|\/file\/d\/|\/uc\?export=)/i;
const PARAM_RE  = /([?&](export|download|usp|id)=|pub\?embedded=true)/i;

// Obvious non-HTML assets
const FILE_EXT_RE = /\.(?:pdf|mp4|webm|mov|mkv|avi|zip|rar|7z|tar|gz|bz2|xz|exe|apk|dmg|iso|docx?|xlsx?|pptx?|csv|tsv|svg|ps|eps|ai)(?:[?#]|$)/i;

// Homepage / non-article heuristics (optional strict mode)
function looksLikeHomepage(u) {
  return (u.pathname === "" || u.pathname === "/") && !u.search;
}
function looksLikeArticlePath(u) {
  const p = u.pathname || "";
  if (/\/20\d{2}\/(0?[1-9]|1[0-2])\//.test(p)) return true;  // /2025/09/...
  if (p.split("/").some(seg => /[a-zA-ZəğıöçşüİıƏĞÖÇŞÜ-]{6,}/.test(seg) && seg.includes("-"))) return true;
  if (p.split("/").filter(Boolean).length >= 2 && /[a-zA-ZəğıöçşüİıƏĞÖÇŞÜ]/.test(p)) return true;
  return false;
}

export function isBlockedHost(urlOrHost) {
  // Accept either a host or a full URL
  let host = urlOrHost;
  let urlLike = null;
  try {
    if (typeof urlOrHost === "string" && urlOrHost.includes("://")) {
      const u = new URL(urlOrHost);
      host = u.host;
      urlLike = urlOrHost;
    }
  } catch { /* ignore */ }

  const h = normalizeHost(host);

  // Allowlist-only mode
  if (ALLOWLIST_ONLY && (!ALLOWED_HOSTS.length || !ALLOWED_HOSTS.some(p => hostMatches(h, p)))) {
    // but allow FB/X exceptions if explicitly permitted by path
    if (urlLike && isAllowedSocialException(urlLike)) return false;
    return true;
  }

  // If host is allowlisted, allow
  if (ALLOWED_HOSTS.length && ALLOWED_HOSTS.some(p => hostMatches(h, p))) return false;

  // Social exceptions: if host would be blocked but URL matches our allowed patterns, allow
  if (urlLike && isAllowedSocialException(urlLike)) return false;

  // Otherwise apply blocklist
  return BLOCKED_HOSTS.some(p => hostMatches(h, p));
}

export function isBlockedPath(urlLike) {
  try {
    const u = new URL(urlLike);
    if (FILE_EXT_RE.test(u.pathname)) return true;
    if (PATH_RE.test(u.pathname)) return true;
    if (PARAM_RE.test(u.search)) return true;

    // If this is a permitted FB/X pattern, don't block here
    if (isAllowedSocialException(urlLike)) return false;

    // Optional strictness: avoid homepages / non-article URLs
    if (STRICT_ARTICLE_MODE) {
      if (looksLikeHomepage(u)) return true;
      if (!looksLikeArticlePath(u) && !isAllowedSocialException(urlLike)) return true;
    }
    return false;
  } catch {
    return true; // bad URL → treat as blocked
  }
}

export function isAllowedMime(contentType = "") {
  const base = String(contentType).split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME.includes(base);
}

export function whyBlockedQuick(urlLike) {
  try {
    const u = new URL(urlLike);
    const host = normalizeHost(u.host);

    if (ALLOWLIST_ONLY && (!ALLOWED_HOSTS.length || !ALLOWED_HOSTS.some(p => hostMatches(host, p))))
      return isAllowedSocialException(urlLike) ? { blocked:false, reason:null } : { blocked:true, reason:"ALLOWLIST_ONLY" };

    if (BLOCKED_HOSTS.some(p => hostMatches(host, p)) && !isAllowedSocialException(urlLike))
      return { blocked:true, reason:"BLOCKED_HOST" };

    if (FILE_EXT_RE.test(u.pathname)) return { blocked:true, reason:"BLOCKED_FILE_EXT" };
    if (PATH_RE.test(u.pathname) || PARAM_RE.test(u.search)) return { blocked:true, reason:"BLOCKED_PATH" };
    if (STRICT_ARTICLE_MODE && (looksLikeHomepage(u) || !looksLikeArticlePath(u)) && !isAllowedSocialException(urlLike))
      return { blocked:true, reason:"NON_ARTICLE" };

    return { blocked:false, reason:null };
  } catch {
    return { blocked:true, reason:"BAD_URL" };
  }
}
