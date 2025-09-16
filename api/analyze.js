import { kv } from '@vercel/kv';
import crypto from 'crypto';
import chromium from '@sparticuz/chromium';
import { addExtra } from 'puppeteer-extra';
import dns from 'node:dns/promises';
import puppeteerCore from 'puppeteer-core';

// 🔒 policy helpers
import {
  isBlockedHost,
  isBlockedPath,
  isAllowedMime,
  MAX_CONTENT_LENGTH_HEAD,
} from '../lib/url-policy.js';

const puppeteer = addExtra(puppeteerCore);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Config ---
const MAX_ARTICLE_CHARS = 30000;
const BLOCK_KEYWORDS = ['cloudflare', 'checking your browser', 'ddos protection', 'verifying you are human'];
const PRIMARY_MODEL = 'gemini-2.5-pro';
const FALLBACK_MODEL = 'gemini-2.5-flash';
const RETRY_ATTEMPTS = 3;          // attempts per model
const INITIAL_BACKOFF_MS = 600;    // starting backoff for retries
const MAX_TIMEOUT_MS = 45000;      // HTTP timeout per call to Gemini

// --- Helpers ---
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Prevent duplicate concurrent work on the same URL/hash
async function withLock(cacheKey, fn) {
  const lockKey = `lock:${cacheKey}`;
  // Try to acquire a short lock (30s). Upstash/Vercel KV supports NX + EX.
  const acquired = await kv.set(lockKey, '1', { ex: 30, nx: true });
  if (!acquired) {
    // Someone else is computing; wait and re-check cache
    await new Promise(r => setTimeout(r, 600));
    const ready = await kv.get(cacheKey);
    if (ready) return ready;
    await new Promise(r => setTimeout(r, 1000));
    const ready2 = await kv.get(cacheKey);
    if (ready2) return ready2;
    const err = new Error('BUSY_TRY_AGAIN');
    err.code = 'BUSY_TRY_AGAIN';
    throw err;
  }
  try {
    return await fn();
  } finally {
    try { await kv.del(lockKey); } catch (e) {}
  }
}

function extractJsonLoose(text) {
  if (!text) throw new Error('Empty model response');
  const stripped = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(stripped); } catch (e) {}
  const first = stripped.indexOf('{'); const last = stripped.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('No JSON object found in model response');
  const candidate = stripped.slice(first, last + 1);
  for (let i = candidate.length; i >= 2; i--) {
    try { return JSON.parse(candidate.slice(0, i)); } catch (e) {}
  }
  throw new Error('Failed to parse JSON from model response');
}

async function callGeminiOnce({ model, prompt, signal }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    })
  });
  if (!res.ok) {
    let payload = {};
    try { payload = await res.json(); } catch (e) {}
    const statusText = payload?.error?.status || res.statusText || 'UNKNOWN_ERROR';
    const code = payload?.error?.code || res.status;
    const message = payload?.error?.message || `HTTP ${res.status}`;
    const err = new Error(message);
    err.code = code; err.statusText = statusText; err.httpStatus = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data?.candidates?.[0]?.finishReason;
  const promptFeedback = data?.promptFeedback;
  return { text, finishReason, promptFeedback, raw: data };
}

function isUnavailableError(e) {
  return (
    e?.httpStatus === 503 ||
    e?.code === 503 ||
    e?.statusText === 'UNAVAILABLE' ||
    /unavailable/i.test(e?.message || '')
  );
}

async function callGeminiWithRetryAndFallback({ primaryModel, fallbackModel, prompt }) {
  const models = [primaryModel, fallbackModel];
  let lastError = null;
  for (const model of models) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), MAX_TIMEOUT_MS);
      try {
        const { text, finishReason } = await callGeminiOnce({ model, prompt, signal: controller.signal });
        const parsed = extractJsonLoose(text);
        return { parsed, modelUsed: model, finishReason };
      } catch (err) {
        lastError = err;
        const transient = isUnavailableError(err) || err.name === 'AbortError';
        if (attempt < RETRY_ATTEMPTS && transient) {
          const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
          await sleep(backoff);
          continue;
        }
        break;
      } finally { clearTimeout(timeout); }
    }
  }
  throw lastError || new Error('Model call failed without a specific error');
}

function buildPrompt({ url, articleText }) {
  return `
You are "LNK Evaluator", a sophisticated, neutral analysis AI developed for LNK.az. Analyze the provided ARTICLE TEXT and generate a single, valid JSON object with a comprehensive media reliability and bias report.

## CONTEXT ##
Original URL: ${url}

## ARTICLE TEXT TO ANALYZE ##
${articleText}

## JSON SCHEMA & METHODOLOGY INSTRUCTIONS ##
Your entire output must be a single, valid JSON object. All free-text rationales and summaries must be in Azerbaijani. In the 'human_summary' and all 'rationale' fields, write natural, flowing paragraphs. Do NOT place commas between full sentences.

The JSON object must contain "meta", "scores", "diagnostics", "cited_sources", and "human_summary". In all string fields—including meta.title, scores.*.rationale, cited_sources[*].name, cited_sources[*].role, cited_sources[*].stance, diagnostics.socio_cultural_descriptions[*].*, and diagnostics.language_flags[*].category—use Azerbaijani.

### META
"meta": {
  "article_type": "xəbər | rəy | analitika | reportaj | .",
  "title": "Məqalənin qısa Azərbaycandilli başlığı (mətn yoxdursa, məzmundan çıxar)",
  "original_url": "https://.. (məqalənin əsas URL-i)",
  "publication": "saytın və ya nəşrin adı (məs. abzas.org)",
  "published_at": "YYYY-MM-DDTHH:MM:SSZ (tapıla bilirsə; yoxdursa burax)"
},

### SCORES
"scores": {
  "reliability": {
    "value": 0-100,
    "rationale": "Məqalənin faktlara söykənməsi, mənbələrin göstərilməsi və dilin obyektivliyi barədə aydın izah. Rəy və bioqrafik yazılarda istinadların azlığı səbəbindən bal texniki olaraq aşağı görünə bilər—bunu izah et."
  },
  "political_establishment_bias": {
    "value": -5.0 ... +5.0,
    "rationale": "Məqalənin hakimiyyət institutlarına (prezident, hökumət, parlament, dövlət qurumları) münasibətini izah et."
  }
},

### DIAGNOSTICS
"diagnostics": {
  "socio_cultural_descriptions": [
    { "group": "...", "stance": "müsbət | mənfi | neytral | qarışıq", "rationale": "Qısa izah və ya sitat." }
  ],
  "language_flags": [
    { "term": "...", "category": "yüklü söz | qeyri-müəyyən | spekulyativ", "evidence": "Terminin göründüyü cümlədən fraqa." }
  ]
},
- Aydınlaşdırmalar:
  - Emosional dil ≠ manipulyasiya; manipulyasiya yalnız faktlar gizlədiləndə və ya təhrif olunanda qeyd edilir.
  - “Mütləq” sözlər (“həmişə”, “heç vaxt”) yalnız kontekstə görə problemli ola bilər; ayrıca kateqoriya vermə.
  - Spekulyativ sözlər (“ola bilər”, “ehtimal ki”) proqnozlarda normaldır, lakin həddən artıq olarsa aydınlığı azalda bilər.
  - Framing siyasi meylə təsir edir, etibarlılıq isə fakt/mənbə/dil obyektivliyinin ayrılıqda qiymətləndirilməsidir.

### CITED SOURCES
"cited_sources": [
  { "name": "...", "role": "rəsmi qurum | media | ekspert | QHT | şəxsi blog | ...", "stance": "müsbət | mənfi | neytral | qarışıq" }
],

### HUMAN SUMMARY
"human_summary": "Məqalənin əsas məzmununu və nəticələrini aydın, axıcı Azərbaycan dilində 2–4 cümlə ilə xülasə et."
`.trim();
}

// --- NEW: light preflight policy before launching Chromium ---
async function preflightPolicy(targetUrl) {
  let finalUrl = targetUrl;
  try {
    const head = await fetch(targetUrl, { method: 'HEAD', redirect: 'follow' });
    if (head?.url) finalUrl = head.url;
// Host & path + scheme/port/credentials + DNS/IP blocks (final URL)
    const u = new URL(finalUrl);
    // scheme
    if (!/^https?:$/.test(u.protocol)) {
      const err = new Error('Only HTTP/HTTPS are allowed');
      err.code = 'BAD_SCHEME'; throw err;
    }
    // auth in URL
    if (u.username || u.password) {
      const err = new Error('Credentials in URL are not allowed');
      err.code = 'BAD_AUTH'; throw err;
    }
    // ports (limit surface)
    if (u.port && !['80','443'].includes(u.port)) {
      const err = new Error('Port not allowed');
      err.code = 'BAD_PORT'; throw err;
    }
    // quick string-level guards
    if (isBlockedHost(finalUrl)) {
      const err = new Error('Hosted/large document source blocked');
      err.code = 'BLOCKED_HOST'; throw err;
    }
    if (isBlockedPath(finalUrl)) {
      const err = new Error('Document path indicates hosted/large file');
      err.code = 'BLOCKED_PATH'; throw err;
    }

    // DNS resolution → block private/link-local/loopback/CGNAT
    try {
      const addrs = await dns.lookup(u.hostname, { all: true, verbatim: true });
      const isPrivate = (addr) => {
        const ip = addr.address.toLowerCase();
        // v4
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
          if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.') || ip.startsWith('169.254.')) return true;
          if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
          if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true; // CGNAT
          if (ip === '169.254.169.254') return true; // metadata
          return false;
        }
        // v6
        if (ip === '::1') return true;
        if (ip.startsWith('fe80:')) return true;   // link-local
        if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // ULA
        if (ip.startsWith('::ffff:')) {
          const last = ip.split(':').pop() || '';
          if (/^\d{1,3}(\.\d{1,3}){3}$/.test(last)) return isPrivate({ address: last });
        }
        return false;
      };
      if (Array.isArray(addrs) && addrs.some(isPrivate)) {
        const err = new Error('Target resolves to a private or link-local address');
        err.code = 'PRIVATE_IP'; throw err;
      }
    } catch (dnsErr) {
      // If DNS fails completely, keep going (some hosts block lookups),
      // we’ll still rely on other guards and platform egress rules.
    }

    // Headers check
    const ct = head.headers.get('content-type') || '';
    const cl = Number(head.headers.get('content-length') || 0);
    const cd = (head.headers.get('content-disposition') || '').toLowerCase();
    if (cd.includes('attachment')) {
      const err = new Error('Direct attachments are not analyzed');
      err.code = 'ATTACHMENT'; throw err;
    }
    if (ct && !isAllowedMime(ct)) {
      const err = new Error(`Unsupported content type: ${ct}`);
      err.code = 'DISALLOWED_MIME'; throw err;
    }
    if (cl && cl > MAX_CONTENT_LENGTH_HEAD) {
      const err = new Error(`Content-Length ${cl} exceeds limit`);
      err.code = 'TOO_LARGE'; err.contentLength = cl; throw err;
    }
  } catch (e) {
    // If HEAD fails (some hosts), still enforce host/path blocks on the original URL
    try {
      const u0 = new URL(targetUrl);
      if (!/^https?:$/.test(u0.protocol)) { const err = new Error('Only HTTP/HTTPS are allowed'); err.code='BAD_SCHEME'; throw err; }
      if (u0.username || u0.password) { const err = new Error('Credentials in URL are not allowed'); err.code='BAD_AUTH'; throw err; }
      if (u0.port && !['80','443'].includes(u0.port)) { const err = new Error('Port not allowed'); err.code='BAD_PORT'; throw err; }
      if (isBlockedHost(targetUrl)) { const err = new Error('Hosted/large document source blocked'); err.code='BLOCKED_HOST'; throw err; }
      if (isBlockedPath(targetUrl)) { const err = new Error('Document path indicates hosted/large file'); err.code='BLOCKED_PATH'; throw err; }
      // Also block obvious private IP literals quickly
      // (DNS not attempted in this fallback)
      if (u0.hostname && isIpLiteral(u0.hostname) && isPrivateIpLiteral(u0.hostname)) {
        const err = new Error('Target is private-network address'); err.code='PRIVATE_IP'; throw err;
      }
    } catch (inner) {
      throw inner;
    }
    // If we set a policy code above, bubble it; else allow Chromium to try
    if (e && e.code) throw e;
  }
  return finalUrl;
}

function normalizeOutput(o = {}, { url }) {
  const out = { ...o };

  // schema tag
  out.schema_version = '2025-09-16';

  // ---- META ----
  out.meta = out.meta && typeof out.meta === 'object' ? out.meta : {};
  const m = out.meta;
  if (!m.original_url) m.original_url = url;
  // derive publication from URL if missing
  if (!m.publication && m.original_url) {
    try { m.publication = new URL(m.original_url).hostname.replace(/^www\./,''); } catch (e) {}
  }
  // ISO-ify published_at if it's a parseable date
  if (m.published_at) {
    const d = new Date(m.published_at);
    if (!isNaN(d)) m.published_at = d.toISOString();
    else delete m.published_at; // drop garbage
  }

  // ---- SCORES ----
  out.scores = out.scores && typeof out.scores === 'object' ? out.scores : {};
  const s = out.scores;

  // reliability
  if (!s.reliability || typeof s.reliability !== 'object') s.reliability = {};
  if (typeof s.reliability.value !== 'number') s.reliability.value = 0;
  s.reliability.value = Math.max(0, Math.min(100, s.reliability.value));
  if (typeof s.reliability.rationale !== 'string') s.reliability.rationale = '';

  // political_establishment_bias
  if (!s.political_establishment_bias || typeof s.political_establishment_bias !== 'object') s.political_establishment_bias = {};
  if (typeof s.political_establishment_bias.value !== 'number') s.political_establishment_bias.value = 0;
  s.political_establishment_bias.value = Math.max(-5, Math.min(5, s.political_establishment_bias.value));
  if (typeof s.political_establishment_bias.rationale !== 'string') s.political_establishment_bias.rationale = '';

  // purge deprecated field if model still emits it
  if (s.socio_cultural_bias) delete s.socio_cultural_bias;

  // ---- DIAGNOSTICS ----
  out.diagnostics = out.diagnostics && typeof out.diagnostics === 'object' ? out.diagnostics : {};
  const dgn = out.diagnostics;

  // NEW arrays
  if (!Array.isArray(dgn.socio_cultural_descriptions)) dgn.socio_cultural_descriptions = [];
  if (!Array.isArray(dgn.language_flags)) dgn.language_flags = [];

  // clamp sizes to keep payload tiny
  dgn.socio_cultural_descriptions = dgn.socio_cultural_descriptions.slice(0, 12);
  dgn.language_flags = dgn.language_flags.slice(0, 24);

  // normalize elements
  dgn.socio_cultural_descriptions = dgn.socio_cultural_descriptions.map(x => ({
    group: typeof x?.group === 'string' ? x.group : '',
    stance: typeof x?.stance === 'string' ? x.stance : '',
    rationale: typeof x?.rationale === 'string' ? x.rationale : ''
  }));

  const ALLOWED_FLAG_CATS = new Set(['yüklü söz','qeyri-müəyyən','spekulyativ']);
  dgn.language_flags = dgn.language_flags.map(x => {
    let cat = typeof x?.category === 'string' ? x.category.trim().toLowerCase() : '';
    // try to coerce common variants to allowed set
    if (cat.includes('yükl')) cat = 'yüklü söz';
    else if (cat.includes('qeyri')) cat = 'qeyri-müəyyən';
    else if (cat.includes('spek')) cat = 'spekulyativ';
    if (!ALLOWED_FLAG_CATS.has(cat)) cat = 'qeyri-müəyyən';
    return {
      term: typeof x?.term === 'string' ? x.term : '',
      category: cat,
      evidence: typeof x?.evidence === 'string' ? x.evidence : ''
    };
  });

  // drop old numeric diagnostics if present (no longer public)
  delete dgn.language_loadedness;
  delete dgn.sourcing_transparency;
  delete dgn.headline_accuracy;

  // ---- CITED SOURCES ----
  out.cited_sources = Array.isArray(out.cited_sources) ? out.cited_sources.slice(0, 50) : [];
  out.cited_sources = out.cited_sources.map(x => ({
    name: typeof x?.name === 'string' ? x.name : '',
    role: typeof x?.role === 'string' ? x.role : '',
    stance: typeof x?.stance === 'string' ? x.stance : ''
  }));

  // ---- SUMMARY ----
  if (typeof out.human_summary !== 'string') out.human_summary = '';

  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'URL daxil edilməyib.' });
  }

  const cacheKey = crypto.createHash('md5').update(url).digest('hex');

  try {
    // KV cache
    try {
      const cachedResult = await kv.get(cacheKey);
      if (cachedResult) {
        console.log(`CACHE HIT for URL: ${url}`);
        res.setHeader('X-Vercel-Cache', 'HIT');
        if (cachedResult.modelUsed) res.setHeader('X-Model-Used', cachedResult.modelUsed);
        if (cachedResult.contentSource) res.setHeader('X-Content-Source', cachedResult.contentSource);
        return res.status(200).json(cachedResult);
      }
      console.log(`CACHE MISS for URL: ${url}`);
      res.setHeader('X-Vercel-Cache', 'MISS');
    } catch (error) {
      console.error('KV Error:', error);
    }

    // 🔒 Policy preflight (blocks hosted/large docs, expands short links)
    let effectiveUrl;
    try {
      effectiveUrl = await preflightPolicy(url);
    } catch (polErr) {
      const messages = {
        BLOCKED_HOST:    'Böyük sənədlər (Google Docs/Drive və s.) analiz edilmir.',
        BLOCKED_PATH:    'Bu keçid başqa bir hostinqdəki sənədə və ya birbaşa fayl yükləməsinə yönləndirir.',
        DISALLOWED_MIME: 'Analiz üçün dəstəklənməyən məzmun növü.',
        ATTACHMENT:      'Birbaşa fayl əlavələri analiz edilmir.',
        TOO_LARGE:       'Sənəd çox böyükdür.',
        BLOCKED_FILE_EXT:'Fayl növü dəstəklənmir (video/arayış/fayl).',
        ALLOWLIST_ONLY:  'Hazırda yalnız təsdiqlənmiş saytların linkləri qəbul olunur.',
        NON_ARTICLE:     'Bu link məqalə kimi görünmür. Xahiş edirik məqalənin konkret səhifəsini göndərin.',
        BAD_URL:         'Keçid düzgün deyil. Zəhmət olmasa tam URL göndərin (https:// ilə).'
        BAD_SCHEME:      'Yalnız HTTP/HTTPS linkləri qəbul edilir.',
        BAD_PORT:        'Bu port icazəli deyil.',
        BAD_AUTH:        'URL daxilində istifadəçi adı/parol qəbul edilmir.',
        PRIVATE_IP:      'Daxili və ya məxfi şəbəkə ünvanlarına keçidlər bloklanır.',
      };
      return res.status(400).json({ error: true, code: polErr.code || 'POLICY', message: messages[polErr.code] || polErr.message });
    }

    // Compute under a KV lock to avoid duplicate token spend
    let result;
    try {
      result = await withLock(cacheKey, async () => {
        // Re-check cache in case another instance finished while we waited
        const recheck = await kv.get(cacheKey);
        if (recheck) return recheck;

        let browser = null;
        let contentSource = 'Live';
        try {
          browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
          });

          const page = await browser.newPage();
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
          await page.setRequestInterception(false);

          await page.goto(effectiveUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(r => setTimeout(r, 500));

          // Extract text once, clean & cap
          let articleText = await page.evaluate(() => document.body.innerText || '');
          articleText = articleText.replace(/\s\s+/g, ' ').trim().substring(0, MAX_ARTICLE_CHARS);
          const lower = articleText.toLowerCase();

          // Anti-bot fallback → Archive.org
          if (BLOCK_KEYWORDS.some((kw) => lower.includes(kw))) {
            console.log(`Initial fetch for ${effectiveUrl} was blocked. Checking Archive.org...`);
            const archiveApiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(effectiveUrl)}`;
            const archiveResponse = await fetch(archiveApiUrl);
            const archiveData = await archiveResponse.json();
            if (archiveData.archived_snapshots?.closest?.url) {
              const snapshotUrl = archiveData.archived_snapshots.closest.url;
              console.log(`Archive found. Fetching from: ${snapshotUrl}`);
              contentSource = 'Archive.org';
              await page.goto(snapshotUrl, { waitUntil: 'networkidle2', timeout: 30000 });
              await new Promise(r => setTimeout(r, 500));
              articleText = (await page.evaluate(() => document.body.innerText || '')).replace(/\s\s+/g, ' ').trim().substring(0, MAX_ARTICLE_CHARS);
            } else {
              const blockError = new Error('This website is protected by advanced bot detection.');
              blockError.isBlockError = true;
              throw blockError;
            }
          }

          const prompt = buildPrompt({ url: effectiveUrl, articleText });
          const { parsed, modelUsed } = await callGeminiWithRetryAndFallback({
            primaryModel: PRIMARY_MODEL,
            fallbackModel: FALLBACK_MODEL,
            prompt
          });
          const normalized = normalizeOutput(parsed, { url: effectiveUrl });

          // Decorate + cache
          normalized.hash = cacheKey;
          normalized.modelUsed = modelUsed;
          normalized.contentSource = contentSource;

          await kv.set(cacheKey, normalized, { ex: 2592000 });
          console.log(`SAVED TO CACHE for URL: ${effectiveUrl}`);

          // also push this hash into a rolling "recent_hashes" list for sitemap
          try {
            await kv.lpush('recent_hashes', cacheKey);
            await kv.ltrim('recent_hashes', 0, 499);
          } catch (e) {
            console.error('KV list update error:', e);
          }

          return normalized;
        } finally {
          if (browser) { try { await browser.close(); } catch (e) {} }
        }
      });
    } catch (error) {
      console.error('Analyze error:', error);
      if (error.isBlockError) {
        const geminiPrompt = `Analyze this article for media bias in Azerbaijani: ${effectiveUrl || url}`;
        const message = 'Bu veb-sayt qabaqcıl bot mühafizəsi ilə qorunur və heç bir arxiv nüsxəsi tapılmadı.';
        return res.status(500).json({ error: true, isBlockError: true, message, prompt: geminiPrompt });
      }
      if (error.code === 'BUSY_TRY_AGAIN') {
        return res.status(429).json({ error: true, message: 'Hazırda eyni link işlənir. Bir neçə saniyədən sonra yenidən cəhd edin.' });
      }
      return res.status(500).json({ error: true, message: `Təhlil zamanı xəta baş verdi: ${error.message}` });
    }

    // Success: set headers from the result we got (model/content source live in payload)
    if (result?.modelUsed) res.setHeader('X-Model-Used', result.modelUsed);
    if (result?.contentSource) res.setHeader('X-Content-Source', result.contentSource);
    return res.status(200).json(result);

  } catch (e) {
    console.error('Top-level error:', e);
    return res.status(500).json({ error: true, message: `Gözlənilməz xəta: ${e.message}` });
  }
}
