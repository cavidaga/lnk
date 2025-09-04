import { kv } from '@vercel/kv';
import crypto from 'crypto';
import chromium from '@sparticuz/chromium';
import { addExtra } from 'puppeteer-extra';
import puppeteerCore from 'puppeteer-core';

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

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
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJsonLoose(text) {
  // Tries to extract the first valid JSON object from a text blob (handles code fences/stray text)
  // Strategy: find the first '{' and last '}' and attempt to parse progressively.
  if (!text) throw new Error('Empty model response');

  // Remove code fences if present
  const stripped = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

  // Fast path
  try { return JSON.parse(stripped); } catch (_) { /* continue */ }

  // Loose scan
  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('No JSON object found in model response');
  }
  const candidate = stripped.slice(first, last + 1);

  // Try full, then shrink from the end if needed
  for (let i = candidate.length; i >= 2; i--) {
    const slice = candidate.slice(0, i);
    try { return JSON.parse(slice); } catch (_) { /* keep shrinking */ }
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

  // Non-OK? Try to bubble useful errors up
  if (!res.ok) {
    let payload = {};
    try { payload = await res.json(); } catch (_) { /* ignore */ }
    const statusText = payload?.error?.status || res.statusText || 'UNKNOWN_ERROR';
    const code = payload?.error?.code || res.status;
    const message = payload?.error?.message || `HTTP ${res.status}`;
    const err = new Error(message);
    err.code = code;
    err.statusText = statusText;
    err.httpStatus = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data?.candidates?.[0]?.finishReason;
  const promptFeedback = data?.promptFeedback;

  return { text, finishReason, promptFeedback, raw: data };
}

function isUnavailableError(e) {
  // Gemini uses { error: { code: 503, status: "UNAVAILABLE" } }
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

        // Sometimes "finishReason" can indicate a truncation or safety stop; we still try to parse.
        const parsed = extractJsonLoose(text);
        return { parsed, modelUsed: model, finishReason };
      } catch (err) {
        lastError = err;

        // Backoff only if it's a transient condition (UNAVAILABLE/503 or aborted)
        const transient = isUnavailableError(err) || err.name === 'AbortError';
        if (attempt < RETRY_ATTEMPTS && transient) {
          const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
          await sleep(backoff);
          continue;
        }

        // Non-transient or last attempt => break to next model
        break;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw lastError || new Error('Model call failed without a specific error');
}

function buildPrompt({ url, articleText }) {
  return `
You are "MediaBiasEvaluator", a sophisticated, neutral analyst AI. Analyze the provided ARTICLE TEXT and generate a single, valid JSON object with a comprehensive media bias and reliability report.
## CONTEXT ##
Original URL: ${url}
## ARTICLE TEXT TO ANALYZE ##
${articleText}
## JSON SCHEMA & METHODOLOGY INSTRUCTIONS ##
Your entire output must be a single, valid JSON object. All free-text rationales and summaries must be in Azerbaijani. In the 'human_summary' and 'rationale' fields, write natural, flowing paragraphs. Do NOT place commas between full sentences.
The JSON object must contain "meta", "scores", "diagnostics", "cited_sources", and "human_summary". In all string fields—including meta.title, scores.*.rationale, cited_sources[*].name, cited_sources[*].role, cited_sources[*].stance, and diagnostics.language_flags[*].category—use Azerbaijani.
"meta": { 
  "article_type": "...",
  "title": "<if missing in the text, infer a concise Azerbaijani title>",
  "original_url": "<the original canonical/primary URL of the article (absolute URL)>",
  "publication": "<domain or outlet name, e.g., abzas.org>",
  "published_at": "<ISO date or human-readable date if detectable, else omit>" 
},
"scores": { 
  "reliability": { "value": 0-100, "rationale": "..." }, 
  "socio_cultural_bias": { "value": -5.0 to +5.0, "rationale": "..." }, 
  "political_establishment_bias": { "value": -5.0 to +5.0, "rationale": "..." } 
},
"diagnostics": { 
  "language_loadedness": 0-100, 
  "sourcing_transparency": 0-100, 
  "headline_accuracy": 0-100, 
  "language_flags": [{ "term": "...", "category": "..." }] 
},
"cited_sources": [{ "name": "...", "role": "...", "stance": "..." }],
"human_summary": "..."
}
`.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;
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

    // Browser
    let browser = null;
    let contentSource = 'Live';
    try {
      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();
      // Slightly less bot-ish UA
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      await page.setRequestInterception(false);

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 500));

      let articleText = await page.evaluate(() => document.body.innerText || '');
      const lower = articleText.toLowerCase();

      // Blocked? Try Archive.org snapshot
      if (BLOCK_KEYWORDS.some((kw) => lower.includes(kw))) {
        console.log(`Initial fetch for ${url} was blocked. Checking Archive.org...`);
        const archiveApiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
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

      // Build prompt
      const prompt = buildPrompt({ url, articleText });

      // Call Gemini with retry + fallback
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
      console.log(`SAVED TO CACHE for URL: ${url}`);

      res.setHeader('X-Model-Used', modelUsed);
      res.setHeader('X-Content-Source', contentSource);
      return res.status(200).json(parsed);
    } catch (error) {
      console.error('Analyze error:', error);
      if (error.isBlockError) {
        const geminiPrompt = `Analyze this article for media bias in Azerbaijani: ${url}`;
        const message = 'Bu veb-sayt qabaqcıl bot mühafizəsi ilə qorunur və heç bir arxiv nüsxəsi tapılmadı.';
        return res.status(500).json({ error: true, isBlockError: true, message, prompt: geminiPrompt });
      }
      // Non-block errors
      return res.status(500).json({ error: true, message: `Təhlil zamanı xəta baş verdi: ${error.message}` });
    } finally {
      // Close browser if open
      if (browser) {
            try { await browser.close(); } catch (e) { /* noop */ }
        }
      // Prefer the instance we launched:
      // (guard in case it wasn't created)
      // eslint-disable-next-line no-unsafe-finally
      // NOTE: Keep original pattern:
      // if (browser) await browser.close();
    }
  } catch (e) {
    console.error('Top-level error:', e);
    return res.status(500).json({ error: true, message: `Gözlənilməz xəta: ${e.message}` });
  }
}