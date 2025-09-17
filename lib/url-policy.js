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
  "x.com","twitter.com","mobile.twitter.com","www.twitter.com",
  "t.me","telegram.me","telegram.org"
];

// Adult content (blocked by default)
export const DEFAULT_BLOCKED_ADULT = [
  "pornhub.com","www.pornhub.com","m.pornhub.com",
  "xvideos.com","www.xvideos.com","m.xvideos.com",
  "redtube.com","www.redtube.com","m.redtube.com",
  "youporn.com","www.youporn.com","m.youporn.com",
  "xtube.com","www.xtube.com","m.xtube.com",
  "xhamster.com","www.xhamster.com","m.xhamster.com",
  "beeg.com","www.beeg.com","m.beeg.com",
  "tube8.com","www.tube8.com","m.tube8.com",
  "tnaflix.com","www.tnaflix.com","m.tnaflix.com",
  "empflix.com","www.empflix.com","m.empflix.com",
  "slutload.com","www.slutload.com","m.slutload.com",
  "nuvid.com","www.nuvid.com","m.nuvid.com",
  "keezmovies.com","www.keezmovies.com","m.keezmovies.com",
  "drtuber.com","www.drtuber.com","m.drtuber.com",
  "porn.com","www.porn.com","m.porn.com",
  "adult.com","www.adult.com","m.adult.com",
  "adultfriendfinder.com","www.adultfriendfinder.com",
  "ashleymadison.com","www.ashleymadison.com",
  "onlyfans.com","www.onlyfans.com","m.onlyfans.com",
  "chaturbate.com","www.chaturbate.com","m.chaturbate.com",
  "livejasmin.com","www.livejasmin.com","m.livejasmin.com",
  "stripchat.com","www.stripchat.com","m.stripchat.com",
  "camsoda.com","www.camsoda.com","m.camsoda.com",
  "myfreecams.com","www.myfreecams.com","m.myfreecams.com",
  "bongacams.com","www.bongacams.com","m.bongacams.com",
  "cam4.com","www.cam4.com","m.cam4.com",
  "liveleak.com","www.liveleak.com","m.liveleak.com",
  "motherless.com","www.motherless.com","m.motherless.com",
  "imagefap.com","www.imagefap.com","m.imagefap.com",
  "flickr.com","www.flickr.com","m.flickr.com",
  "deviantart.com","www.deviantart.com","m.deviantart.com",
  "tumblr.com","www.tumblr.com","m.tumblr.com",
  "reddit.com","www.reddit.com","m.reddit.com","old.reddit.com",
  "4chan.org","www.4chan.org","m.4chan.org",
  "8chan.co","www.8chan.co","m.8chan.co",
  "bitchute.com","www.bitchute.com","m.bitchute.com",
  "rumble.com","www.rumble.com","m.rumble.com",
  "dailymotion.com","www.dailymotion.com","m.dailymotion.com",
  "vimeo.com","www.vimeo.com","m.vimeo.com",
  "twitch.tv","www.twitch.tv","m.twitch.tv",
  "discord.com","www.discord.com","m.discord.com",
  "discordapp.com","www.discordapp.com","m.discordapp.com",
  "snapchat.com","www.snapchat.com","m.snapchat.com",
  "tinder.com","www.tinder.com","m.tinder.com",
  "bumble.com","www.bumble.com","m.bumble.com",
  "grindr.com","www.grindr.com","m.grindr.com",
  "fetlife.com","www.fetlife.com","m.fetlife.com",
  "adultwork.com","www.adultwork.com","m.adultwork.com",
  "backpage.com","www.backpage.com","m.backpage.com",
  "craigslist.org","www.craigslist.org","m.craigslist.org",
  "doublelist.com","www.doublelist.com","m.doublelist.com"
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
  ...DEFAULT_BLOCKED_ADULT,
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

    // X / TWITTER — fully blocked regardless of path
    if (/(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(h)) {
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

// Block docs routes, exported files, downloads
const PATH_RE   = /(\/document\/d\/|\/spreadsheets\/d\/|\/presentation\/d\/|\/file\/d\/|\/uc\?export=)/i;
const PARAM_RE  = /([?&](export|download|usp|id)=|pub\?embedded=true)/i;

// Prompt injection detection patterns
const PROMPT_INJECTION_RE = /(ignore\s+previous\s+instructions?|forget\s+previous\s+instructions?|disregard\s+previous\s+instructions?|override\s+previous\s+instructions?|ignore\s+all\s+previous\s+instructions?|you\s+are\s+now\s+a\s+different\s+ai|act\s+as\s+if\s+you\s+are|pretend\s+to\s+be|roleplay\s+as|system\s+prompt|jailbreak|prompt\s+injection)/i;

// Obvious non-HTML assets
const FILE_EXT_RE = /\.(?:pdf|mp4|webm|mov|mkv|avi|zip|rar|7z|tar|gz|bz2|xz|exe|apk|dmg|iso|docx?|xlsx?|pptx?|csv|tsv|svg|ps|eps|ai)(?:[?#]|$)/i;

// Homepage / non-article heuristics (optional strict mode)
function looksLikeHomepage(u) {
  const path = u.pathname || "";
  const search = u.search || "";
  
  // Exact homepage patterns
  if ((path === "" || path === "/") && !search) return true;
  
  // Common homepage patterns
  if (path === "/index.html" || path === "/index.php") return true;
  
  // Language-specific homepage patterns
  if (/^\/[a-z]{2}\/?$/.test(path)) return true; // /en/, /az/, /fr/, etc.
  
  // News site specific patterns
  const hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  
  // Known news sites that should be blocked at homepage level
  const newsHomepagePatterns = {
    'lemonde.fr': true,
    'musavat.com': true,
    'bbc.com': true,
    'cnn.com': true,
    'nytimes.com': true,
    'guardian.com': true,
    'reuters.com': true,
    'ap.org': true,
    'bloomberg.com': true,
    'wsj.com': true,
    'foxnews.com': true,
    'msnbc.com': true,
    'npr.org': true,
    'abcnews.go.com': true,
    'cbsnews.com': true,
    'nbcnews.com': true,
    'usatoday.com': true,
    'latimes.com': true,
    'washingtonpost.com': true,
    'chicagotribune.com': true,
    'nypost.com': true,
    'dailymail.co.uk': true,
    'independent.co.uk': true,
    'telegraph.co.uk': true,
    'times.co.uk': true,
    'ft.com': true,
    'economist.com': true,
    'spiegel.de': true,
    'faz.net': true,
    'welt.de': true,
    'lefigaro.fr': true,
    'liberation.fr': true,
    'figaro.fr': true,
    '20minutes.fr': true,
    'france24.com': true,
    'rfi.fr': true,
    'rt.com': true,
    'sputniknews.com': true,
    'tass.ru': true,
    'interfax.ru': true,
    'ria.ru': true,
    'gazeta.ru': true,
    'kommersant.ru': true,
    'vedomosti.ru': true,
    'rbth.com': true,
    'aljazeera.com': true,
    'middleeasteye.net': true,
    'haaretz.com': true,
    'timesofisrael.com': true,
    'jpost.com': true,
    'ynetnews.com': true,
    'xinhuanet.com': true,
    'chinadaily.com.cn': true,
    'scmp.com': true,
    'japantimes.co.jp': true,
    'koreatimes.co.kr': true,
    'straitstimes.com': true,
    'channelnewsasia.com': true,
    'thehindu.com': true,
    'timesofindia.indiatimes.com': true,
    'hindustantimes.com': true,
    'indianexpress.com': true,
    'deccanherald.com': true,
    'thequint.com': true,
    'scroll.in': true,
    'wire.in': true,
    'opindia.com': true,
    'swarajyamag.com': true,
    'theprint.in': true,
    'news18.com': true,
    'ndtv.com': true,
    'zeenews.india.com': true,
    'timesnownews.com': true,
    'republicworld.com': true,
    'wionews.com': true,
    'oneindia.com': true,
    'firstpost.com': true,
    'business-standard.com': true,
    'livemint.com': true,
    'moneycontrol.com': true,
    'financialexpress.com': true,
    'businesstoday.in': true,
    'outlookindia.com': true,
    'telegraphindia.com': true,
    'tribuneindia.com': true,
    'punjabkesari.in': true,
    'amarujala.com': true,
    'dainikbhaskar.com': true,
    'patrika.com': true,
    'navbharattimes.indiatimes.com': true,
    'jagran.com': true,
    'dainikjagran.com': true,
    'prabhatkhabar.com': true,
    'bartamanpatrika.com': true,
    'anandabazar.com': true,
    'eisamay.indiatimes.com': true,
    'sangbadpratidin.in': true,
    'aajkaal.in': true,
    'ganashakti.com': true,
    'uttarbangasambad.in': true,
    'kalom.in': true
  };
  
  // If it's a known news site and looks like homepage, block it
  if (newsHomepagePatterns[hostname] && (path === "" || path === "/")) {
    return true;
  }
  
  return false;
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
    const host = normalizeHost(u.host);
    if (FILE_EXT_RE.test(u.pathname)) return true;
    if (PATH_RE.test(u.pathname)) return true;
    if (PARAM_RE.test(u.search)) return true;

    // Block prompt injection attempts in URLs
    const fullUrl = u.href.toLowerCase();
    if (PROMPT_INJECTION_RE.test(fullUrl)) return true;

    // Site-specific: block APA TV video pages
    if (host === "apa.az" && /^\/apa-tv\//i.test(u.pathname)) return true;

    // If this is a permitted FB/X pattern, don't block here
    if (isAllowedSocialException(urlLike)) return false;

    // Always block homepages (not just in strict mode)
    if (looksLikeHomepage(u) && !isAllowedSocialException(urlLike)) return true;
    
    // In strict mode, also block non-article paths
    if (STRICT_ARTICLE_MODE && !looksLikeArticlePath(u) && !isAllowedSocialException(urlLike)) return true;
    return false;
  } catch {
    return true; // bad URL → treat as blocked
  }
}

export function isAllowedMime(contentType = "") {
  const base = String(contentType).split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME.includes(base);
}

// --- Private network guards (string-only; no DNS here) ---
export function isIpLiteral(hostname = "") {
  const h = String(hostname).trim();
  // IPv6 literal like ::1 or fc00::/7
  if (h.includes(":")) return true;
  // IPv4 literal X.X.X.X
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
}

export function isPrivateIpLiteral(hostname = "") {
  const h = String(hostname).trim().toLowerCase();
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    if (h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("127.") || h.startsWith("169.254.")) return true;
    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
    // 100.64.0.0/10 (CGNAT)
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return true;
    // Cloud metadata well-known
    if (h === "169.254.169.254") return true;
    return false;
  }
  // IPv6
  const v6 = h;
  if (v6.includes(":")) {
    if (v6 === "::1") return true;               // loopback
    if (v6.startsWith("fe80:")) return true;     // link-local
    if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // ULA fc00::/7
    if (v6.startsWith("::ffff:")) {
      // IPv4-mapped ::ffff:a.b.c.d → check a.b.c.d
      const last = v6.split(":").pop() || "";
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(last)) return isPrivateIpLiteral(last);
    }
    return false;
  }
  return false;
}

export function isPrivateHostnameQuick(hostname = "") {
  const h = String(hostname).toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".lan") ||
    h.endsWith(".internal")
  );
}

export function whyBlockedQuick(urlLike) {
  try {
    const u = new URL(urlLike);
    const host = normalizeHost(u.host);
    // 0) Hard safety gates (cannot be bypassed by social exceptions)
// 0) Hard safety gates (cannot be bypassed by social exceptions)
    if (!/^https?:$/.test(u.protocol)) return { blocked: true, reason: "BAD_SCHEME" };
    if (u.port && !["", "80", "443"].includes(u.port)) return { blocked: true, reason: "BAD_PORT" };
    if (isIpLiteral(u.hostname) && isPrivateIpLiteral(u.hostname)) return { blocked: true, reason: "PRIVATE_IP" };
    if (isPrivateHostnameQuick(u.hostname)) return { blocked: true, reason: "PRIVATE_HOST" };

    if (ALLOWLIST_ONLY && (!ALLOWED_HOSTS.length || !ALLOWED_HOSTS.some(p => hostMatches(host, p))))
      return isAllowedSocialException(urlLike) ? { blocked:false, reason:null } : { blocked:true, reason:"ALLOWLIST_ONLY" };

    if (BLOCKED_HOSTS.some(p => hostMatches(host, p)) && !isAllowedSocialException(urlLike))
      return { blocked:true, reason:"BLOCKED_HOST" };

    if (FILE_EXT_RE.test(u.pathname)) return { blocked:true, reason:"BLOCKED_FILE_EXT" };
    if (PATH_RE.test(u.pathname) || PARAM_RE.test(u.search)) return { blocked:true, reason:"BLOCKED_PATH" };
    
    // Block prompt injection attempts in URLs
    const fullUrl = u.href.toLowerCase();
    if (PROMPT_INJECTION_RE.test(fullUrl)) return { blocked:true, reason:"PROMPT_INJECTION" };
    
    // Always block homepages for news sites (not just in strict mode)
    if (looksLikeHomepage(u) && !isAllowedSocialException(urlLike))
      return { blocked:true, reason:"NON_ARTICLE" };
    
    // In strict mode, also block non-article paths
    if (STRICT_ARTICLE_MODE && !looksLikeArticlePath(u) && !isAllowedSocialException(urlLike))
      return { blocked:true, reason:"NON_ARTICLE" };

    return { blocked:false, reason:null };
  } catch {
    return { blocked:true, reason:"BAD_URL" };
  }
}
