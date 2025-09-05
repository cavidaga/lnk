import { kv } from '@vercel/kv';
import crypto from 'crypto';
import chromium from '@sparticuz/chromium';
import { addExtra } from 'puppeteer-extra';
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

function extractJsonLoose(text) {
  if (!text) throw new Error('Empty model response');
  const stripped = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(stripped); } catch {}
  const first = stripped.indexOf('{'); const last = stripped.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('No JSON object found in model response');
  const candidate = stripped.slice(first, last + 1);
  for (let i = candidate.length; i >= 2; i--) {
    try { return JSON.parse(candidate.slice(0, i)); } catch {}
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
    try { payload = await res.json(); } catch {}
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
Your entire output must be a single, valid JSON object. All free-text rationales and summaries must be in Azerbaijani. In the 'human_summary' and 'rationale' fields, write natural, flowing paragraphs. Do NOT place commas between full sentences.

The JSON object must contain "meta", "scores", "diagnostics", "cited_sources", and "human_summary". In all string fields—including meta.title, scores.*.rationale, cited_sources[*].name, cited_sources[*].role, cited_sources[*].stance, and diagnostics.language_flags[*].category—use Azerbaijani.

### META
"meta": { 
  "article_type": "<xəbər | rəy | analitika | reportaj və s.>",
  "title": "<if missing in the text, infer a concise Azerbaijani title>",
  "original_url": "<the original canonical/primary URL of the article (absolute URL)>",
  "publication": "<domain or outlet name, e.g., abzas.org>",
  "published_at": "<ISO date or human-readable date if detectable, else omit>" 
},

### SCORES
"scores": { 
  "reliability": { 
    "value": 0-100, 
    "rationale": "Reliability measures factual accuracy, source quality, and clear separation of fact vs opinion. In rəy or şəxsi esselər, reliability may be lower due to fewer external citations. This does not mean the article is poor — explain this nuance in the rationale if relevant." 
  }, 
  "socio_cultural_bias": { 
    "value": -5.0 to +5.0, 
    "rationale": "Explain how the article treats values, identity, or cultural topics." 
  }, 
  "political_establishment_bias": { 
    "value": -5.0 to +5.0, 
    "rationale": "Explain the article’s orientation toward state institutions and government policy." 
  } 
},

### DIAGNOSTICS
"diagnostics": { 
  "language_loadedness": 0-100, 
  "sourcing_transparency": 0-100, 
  "headline_accuracy": 0-100, 
  "language_flags": [ 
    { "term": "...", "category": "yüklü söz | qeyri-müəyyən ifadə | mütləq ifadə | spekulyativ dil | yüklü sinonim" } 
  ] 
},
- Important clarifications:
  - Emotional language ≠ manipulation. Mark manipulation only if facts are hidden or distorted.
  - Absolute terms ("həmişə", "heç vaxt") are only problematic if misleading in context.
  - Speculative terms ("ola bilər", "ehtimal ki") are normal in forecasts, but excessive use lowers clarity.
  - Framing analysis affects bias scores (political/socio-cultural), not reliability.

### CITED SOURCES
"cited_sources": [ { "name": "...", "role": "...", "stance": "..." } ],

### HUMAN SUMMARY
"human_summary": "Provide a flowing Azerbaijani summary of the article, written in clear prose."
}
`.trim();
}

// --- NEW: light preflight policy before launching Chromium ---
async function preflightPolicy(targetUrl) {
  let finalUrl = targetUrl;
  try {
    const head = await fetch(targetUrl, { method: 'HEAD', redirect: 'follow' });
    if (head?.url) finalUrl = head.url;
    // Host & path blocks (final URL)
    const host = new URL(finalUrl).host;
    if (isBlockedHost(host)) {
      const err = new Error('Hosted/large document source blocked');
      err.code = 'BLOCKED_HOST'; throw err;
    }
    if (isBlockedPath(finalUrl)) {
      const err = new Error('Document path indicates hosted/large file');
      err.code = 'BLOCKED_PATH'; throw err;
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
      const host0 = new URL(targetUrl).host;
      if (isBlockedHost(host0)) { const err = new Error('Hosted/large document source blocked'); err.code='BLOCKED_HOST'; throw err; }
      if (isBlockedPath(targetUrl)) { const err = new Error('Document path indicates hosted/large file'); err.code='BLOCKED_PATH'; throw err; }
    } catch {}
    // If we set a policy code above, bubble it; else allow Chromium to try
    if (e && e.code) throw e;
  }
  return finalUrl;
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
      };
      return res.status(400).json({ error: true, code: polErr.code || 'POLICY', message: messages[polErr.code] || polErr.message });
    }

    // Browser
    let browser = null;
    let contentSource = 'Live';
    try {
      // ✅ Fix: assign to outer 'browser' (no shadowing), so we can close it in finally
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

      let articleText = await page.evaluate(() => document.body.innerText || '');
      const lower = articleText.toLowerCase();

      // Blocked by anti-bot? Try Archive.org snapshot
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
          articleText = await page.evaluate(() => document.body.innerText || '');
        } else {
          const blockError = new Error('This website is protected by advanced bot detection.');
          blockError.isBlockError = true;
          throw blockError;
        }
      }

      articleText = articleText.replace(/\s\s+/g, ' ').substring(0, MAX_ARTICLE_CHARS);

      const prompt = buildPrompt({ url: effectiveUrl, articleText });
      const { parsed, modelUsed } = await callGeminiWithRetryAndFallback({
        primaryModel: PRIMARY_MODEL,
        fallbackModel: FALLBACK_MODEL,
        prompt
      });

      // Decorate + cache
      parsed.hash = cacheKey;
      parsed.modelUsed = modelUsed;
      parsed.contentSource = contentSource;

      await kv.set(cacheKey, parsed, { ex: 2592000 });
      console.log(`SAVED TO CACHE for URL: ${effectiveUrl}`);

      res.setHeader('X-Model-Used', modelUsed);
      res.setHeader('X-Content-Source', contentSource);
      return res.status(200).json(parsed);
    } catch (error) {
      console.error('Analyze error:', error);
      if (error.isBlockError) {
        const geminiPrompt = `Analyze this article for media bias in Azerbaijani: ${effectiveUrl || url}`;
        const message = 'Bu veb-sayt qabaqcıl bot mühafizəsi ilə qorunur və heç bir arxiv nüsxəsi tapılmadı.';
        return res.status(500).json({ error: true, isBlockError: true, message, prompt: geminiPrompt });
      }
      return res.status(500).json({ error: true, message: `Təhlil zamanı xəta baş verdi: ${error.message}` });
    } finally {
      if (browser) { try { await browser.close(); } catch (e) {} }
    }
  } catch (e) {
    console.error('Top-level error:', e);
    return res.status(500).json({ error: true, message: `Gözlənilməz xəta: ${e.message}` });
  }
}