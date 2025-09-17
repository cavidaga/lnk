// api/analyze.js — 2025-09-16 LNK.az
export const config = { runtime: 'nodejs', maxDuration: 60 };

import { kv } from '@vercel/kv';
import crypto from 'crypto';
import chromium from '@sparticuz/chromium';
import { addExtra } from 'puppeteer-extra';
import dns from 'node:dns/promises';
import puppeteerCore from 'puppeteer-core';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { gatedFetch } from '../lib/gated-fetch.js';
import { findArchiveForUrl } from '../lib/known-archives.js';

// 🔒 policy helpers
import {
  isBlockedHost,
  isBlockedPath,
  isAllowedMime,
  MAX_CONTENT_LENGTH_HEAD,
  isIpLiteral,
  isPrivateIpLiteral,
} from '../lib/url-policy.js';

const puppeteer = addExtra(puppeteerCore);
// Configure stealth to avoid requiring deprecated/removed evasions in some versions
const stealth = StealthPlugin();
try {
  if (stealth?.enabledEvasions?.clear) {
    // Disable all evasions to avoid requiring deprecated/missing modules in serverless
    stealth.enabledEvasions.clear();
  }
} catch {}
puppeteer.use(stealth); // ✅ important for CF/anti-bot

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Config ---
const MAX_ARTICLE_CHARS = 30000;
const BLOCK_KEYWORDS = [
  'cloudflare', 'checking your browser', 'ddos protection', 'verifying you are human',
  'enable javascript and cookies to continue', 'challenge-error-text', 'cf-chl-opt',
  'attention required', 'just a moment', 'please wait', 'verifying you are human'
];

// ⬇️ Models: smart selection based on content characteristics
const FLASH_LITE_MODEL = 'gemini-2.5-flash-lite';
const PRO_MODEL = 'gemini-2.5-pro';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

const RETRY_ATTEMPTS = 1;          // single attempt per model (kept conservative)
const INITIAL_BACKOFF_MS = 600;    // starting backoff for retries
const MAX_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 20000); // 20s default

// --- Helpers ---
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Check if archive.md has a mirror for the given URL
async function getArchiveMdUrl(originalUrl) {
  try {
    // First, check if we have a known archive for this URL
    const knownArchive = findArchiveForUrl(originalUrl);
    if (knownArchive) {
      console.log(`Using known archive.md for ${originalUrl}: ${knownArchive}`);
      return knownArchive;
    }
    
    // For other URLs, try to create a new archive using archive.md's API
    // Note: This is a simplified approach - archive.md's actual API is more complex
    try {
      const archiveCreateUrl = `https://archive.md/?run=1&url=${encodeURIComponent(originalUrl)}`;
      console.log(`Attempting to create archive.md for: ${originalUrl}`);
      
      // Make a request to create an archive
      const response = await fetch(archiveCreateUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        // Look for archive URL in the response
        const archiveMatch = html.match(/https:\/\/archive\.md\/[A-Za-z0-9]+/);
        if (archiveMatch) {
          console.log(`Created archive.md: ${archiveMatch[0]}`);
          return archiveMatch[0];
        }
      }
    } catch (createError) {
      console.warn('Failed to create archive.md:', createError?.message || createError);
    }
    
    return null;
    
  } catch (error) {
    console.warn('Archive.md check failed:', error?.message || error);
    return null;
  }
}

// Map user model selection to actual models and timeouts
function getUserModelSelection(userModelType) {
  const modelMap = {
    'auto': { 
      model: null, // Will use smart selection
      timeout: 60000, // 60s default
      description: 'Avtomatik seçim'
    },
    'flash-lite': { 
      model: FLASH_LITE_MODEL, 
      timeout: 30000, // 30s for fast model
      description: 'Qısa xəbər (sürətli)'
    },
    'flash': { 
      model: 'gemini-2.5-flash', 
      timeout: 45000, // 45s for balanced model
      description: 'Orta uzunluq (balanslı)'
    },
    'pro': { 
      model: PRO_MODEL, 
      timeout: 90000, // 90s for complex analysis
      description: 'Analitika (dərin təhlil)'
    }
  };
  
  return modelMap[userModelType] || modelMap['auto'];
}

// Smart model selection based on content characteristics
function selectOptimalModel({ articleText, url, title, contentLength }) {
  const text = articleText || '';
  const length = contentLength || text.length;
  const hostname = url ? new URL(url).hostname.toLowerCase().replace(/^www\./, '') : '';
  
  // Short news indicators (Flash Lite is better)
  const shortNewsIndicators = {
    // Length thresholds
    isShort: length < 2000,
    isVeryShort: length < 1000,
    
    // Content type indicators
    hasNewsKeywords: /\b(xəbər|news|report|bildirir|açıqlayır|məlumat|hadisə|olay)\b/i.test(text),
    hasBreakingNews: /\b(sondakı|son|breaking|təcili|urgent|son dəqiqə)\b/i.test(text),
    hasEventKeywords: /\b(keçirilib|təşkil|mərasim|toplantı|görüş|iclas)\b/i.test(text),
    
    // Structural indicators
    hasShortParagraphs: (text.match(/\n\s*\n/g) || []).length > 3 && length < 3000,
    hasBulletPoints: /^[\s]*[•\-\*]\s/m.test(text),
    hasDateTime: /\b(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}|\d{4}-\d{2}-\d{2})\b/.test(text),
    
    // URL patterns for news sites
    isNewsSite: /\.(az|com|net|org)$/.test(hostname) && 
      (hostname.includes('news') || hostname.includes('media') || 
       hostname.includes('crossmedia') || hostname.includes('report') ||
       hostname.includes('xəbər') || hostname.includes('az')),
    
    // Title patterns
    hasNewsTitle: title && (
      /^(tələbə|şagird|məktəb|universitet|təhsil|iş|işçi|əmək|maaş|əhali|vətəndaş|prezident|hökumət|parlament|deputat)/i.test(title) ||
      /(keçirilib|açıqlanıb|bildirilib|qeyd edilib|deyilib|təşkil edilib)/i.test(title)
    )
  };
  
  // Complex analysis indicators (Pro is better)
  const complexAnalysisIndicators = {
    // Length thresholds
    isLong: length > 5000,
    isVeryLong: length > 10000,
    
    // Content complexity indicators
    hasAnalysisKeywords: /\b(təhlil|analiz|araşdırma|tədqiqat|müzakirə|münasibət|məsələ|problemin|həll|təklif|görüş|məqam)\b/i.test(text),
    hasOpinionKeywords: /\b(rəy|fikir|mülahizə|nəzər|baxış|yanaşma|münasibət|qənaət|nəticə|nəticələr)\b/i.test(text),
    hasResearchKeywords: /\b(araşdırma|tədqiqat|ekspert|professor|doktor|mütəxəssis|təcrübə|nəticə|statistika|məlumat)\b/i.test(text),
    
    // Structural complexity
    hasMultipleSections: (text.match(/\n\s*[A-ZĞƏÖÇŞÜ][^.]{20,}\n/g) || []).length > 2,
    hasQuotes: (text.match(/"[^"]{20,}"/g) || []).length > 2,
    hasReferences: (text.match(/\[[^\]]+\]|\([^)]+\)/g) || []).length > 3,
    hasNumbers: (text.match(/\b\d+[%\.\,]\d*\b/g) || []).length > 5,
    
    // URL patterns for analysis sites
    isAnalysisSite: hostname.includes('research') || hostname.includes('institute') || 
                   hostname.includes('center') || hostname.includes('think') ||
                   hostname.includes('analiz') || hostname.includes('təhlil'),
    
    // Title patterns
    hasAnalysisTitle: title && (
      /^(təhlil|analiz|araşdırma|müzakirə|problemin|məsələ|görüş|məqam)/i.test(title) ||
      /(şikayət|complaint|problem|məsələ|sual|sualın|cavab|həll)/i.test(title)
    )
  };
  
  // Scoring system
  let flashLiteScore = 0;
  let proScore = 0;
  
  // Flash Lite scoring (short news)
  if (shortNewsIndicators.isVeryShort) flashLiteScore += 3;
  if (shortNewsIndicators.isShort) flashLiteScore += 2;
  if (shortNewsIndicators.hasNewsKeywords) flashLiteScore += 2;
  if (shortNewsIndicators.hasBreakingNews) flashLiteScore += 2;
  if (shortNewsIndicators.hasEventKeywords) flashLiteScore += 1;
  if (shortNewsIndicators.hasShortParagraphs) flashLiteScore += 1;
  if (shortNewsIndicators.hasBulletPoints) flashLiteScore += 1;
  if (shortNewsIndicators.hasDateTime) flashLiteScore += 1;
  if (shortNewsIndicators.isNewsSite) flashLiteScore += 2;
  if (shortNewsIndicators.hasNewsTitle) flashLiteScore += 2;
  
  // Pro scoring (complex analysis)
  if (complexAnalysisIndicators.isVeryLong) proScore += 3;
  if (complexAnalysisIndicators.isLong) proScore += 2;
  if (complexAnalysisIndicators.hasAnalysisKeywords) proScore += 2;
  if (complexAnalysisIndicators.hasOpinionKeywords) proScore += 2;
  if (complexAnalysisIndicators.hasResearchKeywords) proScore += 2;
  if (complexAnalysisIndicators.hasMultipleSections) proScore += 1;
  if (complexAnalysisIndicators.hasQuotes) proScore += 1;
  if (complexAnalysisIndicators.hasReferences) proScore += 1;
  if (complexAnalysisIndicators.hasNumbers) proScore += 1;
  if (complexAnalysisIndicators.isAnalysisSite) proScore += 2;
  if (complexAnalysisIndicators.hasAnalysisTitle) proScore += 2;
  
  // Decision logic
  const scoreDifference = proScore - flashLiteScore;
  
  // If Pro has significantly higher score, use Pro
  if (scoreDifference >= 3) {
    return {
      model: PRO_MODEL,
      reason: `Complex analysis content (Pro score: ${proScore}, Flash Lite score: ${flashLiteScore})`,
      confidence: 'high'
    };
  }
  
  // If Flash Lite has higher score or scores are close, use Flash Lite for efficiency
  if (flashLiteScore >= proScore) {
    return {
      model: FLASH_LITE_MODEL,
      reason: `Short news content (Flash Lite score: ${flashLiteScore}, Pro score: ${proScore})`,
      confidence: flashLiteScore > proScore ? 'high' : 'medium'
    };
  }
  
  // Default to Flash Lite for efficiency unless Pro is clearly better
  return {
    model: FLASH_LITE_MODEL,
    reason: `Default to Flash Lite for efficiency (Pro score: ${proScore}, Flash Lite score: ${flashLiteScore})`,
    confidence: 'low'
  };
}

// ultra-light fallback: turn raw HTML into readable text
function htmlToText(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Clean article content to remove sidebar and related content
function cleanArticleContent(text, url) {
  if (!text) return text;
  
  const hostname = new URL(url).hostname.replace(/^www\./, '');
  
  // Common sidebar/related content patterns to remove
  const sidebarPatterns = [
    // oxu.az specific patterns
    /(?:Ən çox oxunan|Ən son xəbərlər|Digər xəbərlər|Əlaqəli xəbərlər|Tövsiyə olunan|Populyar|Trend|Son xəbərlər)[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
    /(?:Facebook|Twitter|Instagram|Telegram|WhatsApp|YouTube)[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
    /(?:Bizi izləyin|Sosial şəbəkələrdə|Paylaş|Şərh|Rəy|Təklif)[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
    /(?:Copyright|©|Müəllif hüquqları|Bütün hüquqlar qorunur)[\s\S]*$/gi,
    /(?:Reklam|Advertisement|Sponsorlu)[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
    /(?:Əlaqə|Contact|Haqqımızda|About|Məqalə|Article)[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
    // Generic patterns
    /(?:Related|Əlaqəli|Similar|Bənzər|More|Daha çox)[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
    /(?:Share|Paylaş|Comment|Şərh|Like|Bəyən)[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
    /(?:Subscribe|Abunə|Newsletter|Xəbər bülleteni)[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi,
  ];
  
  let cleanedText = text;
  
  // Remove sidebar patterns
  sidebarPatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '');
  });
  
  // Remove very short lines that are likely navigation or metadata
  cleanedText = cleanedText
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 20 || // Keep longer lines
             /^[A-ZĞƏÖÇŞÜ][a-zəğıöçşü\s]{10,}$/.test(trimmed) || // Keep proper titles
             /^\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}/.test(trimmed) || // Keep dates
             trimmed.length === 0; // Keep empty lines for spacing
    })
    .join('\n');
  
  // Clean up multiple newlines
  cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return cleanedText.trim();
}

// Prevent duplicate concurrent work on the same URL/hash
async function withLock(cacheKey, fn) {
  const lockKey = `lock:${cacheKey}`;
  const acquired = await kv.set(lockKey, '1', { ex: 30, nx: true });
  if (!acquired) {
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
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map(p => p?.text)
    .filter(Boolean)
    .join('\n') || '';
  const finishReason = candidate?.finishReason;
  const promptFeedback = data?.promptFeedback;
  if (!text.trim()) {
    const err = new Error('Model returned empty content');
    err.code = 'MODEL_EMPTY';
    err.finishReason = finishReason;
    err.promptFeedback = promptFeedback;
    throw err;
  }
  return { text, finishReason, promptFeedback, raw: data };
}

// Treat 429/rate/quota and 503/unavailable as transient so we roll through tiers
function isUnavailableError(e) {
  const msg = String(e?.message || '');
  const statusText = String(e?.statusText || '');
  return (
    e?.httpStatus === 503 ||
    e?.httpStatus === 429 ||
    e?.code === 503 ||
    e?.code === 429 ||
    statusText === 'UNAVAILABLE' ||
    statusText === 'RESOURCE_EXHAUSTED' ||
    /unavailable|exceeded|rate|quota|RESOURCE_EXHAUSTED/i.test(msg)
  );
}

// Multi-tier fallback: primary → fallbacks[]
async function callGeminiWithRetryAndFallback({ primaryModel, fallbackModels = [], prompt, timeout = MAX_TIMEOUT_MS }) {
  const models = [primaryModel, ...fallbackModels];
  let lastError = null;
  for (const model of models) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const { text, finishReason } = await callGeminiOnce({ model, prompt, signal: controller.signal });
        const parsed = extractJsonLoose(text);
        return { parsed, modelUsed: model, finishReason };
      } catch (err) {
        lastError = err;
        const transient = isUnavailableError(err) || err.name === 'AbortError';
        if (attempt < RETRY_ATTEMPTS && transient) {
          const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
          await sleep(backoff + Math.floor(Math.random() * 150)); // jitter
          continue;
        }
        break;
      } finally { clearTimeout(timeoutId); }
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

// --- Safe fallback prompt (English instructions, AZ output) ---
function buildSafePrompt({ url, title, site }) {
  return `
You are "LNK Evaluator" for LNK.az. The linked page may contain sensitive material.
Goal: assess media framing, sourcing transparency, and stance toward political institutions.

SAFETY RULES (must follow):
- Do NOT repeat, paraphrase, or describe any graphic, violent, sexual, or personally identifying details.
- Do NOT invent facts; if uncertain, say so in Azerbaijani.
- Work only from the headline/context below; do not add specifics from memory.

OUTPUT LANGUAGE: Azerbaijani. All free-text fields must be in Azerbaijani.

INPUT
- Link: ${url}
- Headline: ${title || '(no headline)'}
- Publication: ${site || '(unknown)'}

RESPONSE
Return a single valid JSON object with these keys:

meta: {
  article_type,            // "xəbər" | "rəy" | "analitika" | "reportaj" | ...
  title,                   // a short Azerbaijani title
  original_url,            // the link above
  publication,             // site/publication name
  published_at?            // ISO8601 if known, else omit
},
scores: {
  reliability: { value, rationale },                 // 0..100
  political_establishment_bias: { value, rationale } // -5 .. +5
},
diagnostics: {
  socio_cultural_descriptions: [
    { group, stance: "müsbət|mənfi|neytral|qarışıq", rationale }
  ],
  language_flags: [
    { term, category: "yüklü söz|qeyri-müəyyən|spekulyativ", evidence }
  ]
},
cited_sources: [{ name, role, stance }],
human_summary: "2–4 cümləlik AZ xülasə."

Constraints:
- Natural paragraphs (no bullet lists inside rationales).
- Stick to the ranges above (reliability 0–100; political bias –5..+5).
`.trim();
}

// --- Blocked content prompt (very restrictive) ---
function buildBlockedPrompt({ url, title, site }) {
  return `
You are "LNK Evaluator" for LNK.az. The linked page is BLOCKED and cannot be accessed.
You can ONLY work with the title and URL provided below.

CRITICAL RULES:
- You CANNOT access the actual article content
- You CANNOT make assumptions about the article content
- You CANNOT provide detailed analysis based on content you cannot see
- You MUST indicate that analysis is limited due to blocked access
- Reliability score MUST be low (0-30) due to lack of content access
- Political bias score MUST be 0 (cannot assess without content)

OUTPUT LANGUAGE: Azerbaijani. All free-text fields must be in Azerbaijani.

INPUT
- Link: ${url}
- Headline: ${title || '(no headline)'}
- Publication: ${site || '(unknown)'}

RESPONSE
Return a single valid JSON object with these keys:

meta: {
  article_type: "xəbər",
  title: "${title || 'Başlıq yoxdur'}",
  original_url: "${url}",
  publication: "${site || 'naməlum'}",
  published_at: null
},
scores: {
  reliability: { 
    value: 15, 
    rationale: "Məqalənin məzmununa çatmaq mümkün olmadığı üçün etibarlılıq aşağı qiymətləndirilir. Yalnız başlıq əsasında təhlil aparıla bilməz." 
  },
  political_establishment_bias: { 
    value: 0, 
    rationale: "Məqalənin məzmununa çatmaq mümkün olmadığı üçün siyasi meyl qiymətləndirilə bilməz." 
  }
},
diagnostics: {
  socio_cultural_descriptions: [],
  language_flags: [
    {
      term: "${title?.split(' ')[0] || 'başlıq'}",
      category: "qeyri-müəyyən",
      evidence: "Məqalənin məzmunu əlçatan deyil"
    }
  ]
},
cited_sources: [],
human_summary: "Məqalənin məzmununa çatmaq mümkün olmadığı üçün təhlil edilə bilməz. Yalnız başlıq mövcuddur."

IMPORTANT: Keep all analysis minimal and clearly indicate that content access was blocked.
`.trim();
}

// --- NEW: light preflight policy before launching Chromium ---
// --- Relaxed preflight: HEAD is advisory, only 404/410 are hard failures
async function preflightPolicy(targetUrl) {
  let finalUrl = targetUrl;

  let head = null;
  try {
    head = await fetch(targetUrl, { method: 'HEAD', redirect: 'follow' });
    if (head?.url) finalUrl = head.url;

    // Only treat true "not found" as a hard error
    if (head && head.status >= 400) {
      if (head.status === 404 || head.status === 410) {
        const err = new Error(`Target returned ${head.status}`);
        err.code = 'NOT_FOUND';
        throw err;
      }
      // Otherwise (403/405/429/503 etc.) → proceed to GET/Puppeteer
    }
  } catch {
    // If HEAD itself throws (network, CORS-like, CF block), ignore and continue.
  }

  // URL-level policy checks (always enforced)
  const u = new URL(finalUrl);
  if (!/^https?:$/.test(u.protocol)) { const err = new Error('Only HTTP/HTTPS are allowed'); err.code='BAD_SCHEME'; throw err; }
  if (u.username || u.password)     { const err = new Error('Credentials in URL are not allowed'); err.code='BAD_AUTH'; throw err; }
  if (u.port && !['80','443'].includes(u.port)) { const err = new Error('Port not allowed'); err.code='BAD_PORT'; throw err; }

  // Host/path policy (string-level)
  if (isBlockedHost(finalUrl)) { const err = new Error('Hosted/large document source blocked'); err.code='BLOCKED_HOST'; throw err; }
  if (isBlockedPath(finalUrl)) { const err = new Error('Document path indicates hosted/large file'); err.code='BLOCKED_PATH'; throw err; }

  // DNS check to avoid private/link-local targets (best-effort, with timeout)
  try {
    const dnsTimeoutMs = 2000;
    const addrs = await Promise.race([
      dns.lookup(u.hostname, { all: true, verbatim: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('DNS_TIMEOUT')), dnsTimeoutMs))
    ]);
    const isPrivate = (addr) => {
      const ip = addr.address.toLowerCase();
      // v4 ranges
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
        if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.') || ip.startsWith('169.254.')) return true;
        if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
        if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true; // CGNAT
        if (ip === '169.254.169.254') return true; // metadata
        return false;
      }
      // v6 ranges
      if (ip === '::1') return true;
      if (ip.startsWith('fe80:')) return true; // link-local
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
  } catch {
    // DNS lookup failures are not fatal; continue.
  }

  // Header-based checks only if HEAD succeeded with 2xx
  if (head && head.ok) {
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
  }

  return finalUrl;
}

function normalizeOutput(o = {}, { url, contentSource, isBlocked = false, articleText = '' }) {
  const out = { ...o };
  out.schema_version = '2025-09-16';

  // ---- META ----
  out.meta = out.meta && typeof out.meta === 'object' ? out.meta : {};
  const m = out.meta;
  if (!m.original_url) m.original_url = url;
  if (!m.publication && m.original_url) {
    try { m.publication = new URL(m.original_url).hostname.replace(/^www\./,''); } catch {}
  }
  if (m.published_at) {
    const d = new Date(m.published_at);
    if (!isNaN(d)) m.published_at = d.toISOString();
    else delete m.published_at;
  }

  // ---- WARNINGS ----
  out.warnings = out.warnings && Array.isArray(out.warnings) ? out.warnings : [];
  
  // Add content access warnings
  if (isBlocked || contentSource === 'Blocked') {
    out.warnings.push({
      type: 'content_blocked',
      message: 'Bu mənbə bot mühafizəsi ilə qorunur və tam məzmuna çatmaq mümkün olmayıb. Təhlil məhdud məlumat əsasında aparılıb.',
      severity: 'high'
    });
  } else if (contentSource === 'Archive.org') {
    out.warnings.push({
      type: 'archived_content',
      message: 'Mənbə bloklanıb, lakin arxiv nüsxəsi tapılıb. Təhlil arxiv məlumatı əsasında aparılıb.',
      severity: 'medium'
    });
  } else if (contentSource === 'Archive.md') {
    out.warnings.push({
      type: 'archived_content',
      message: 'Mənbə bloklanıb, lakin archive.md nüsxəsi tapılıb. Təhlil arxiv məlumatı əsasında aparılıb.',
      severity: 'medium'
    });
  } else if (contentSource === 'LightFetch' && articleText && articleText.length < 500) {
    out.warnings.push({
      type: 'limited_content',
      message: 'Məqalənin məzmunu qısa olduğu üçün təhlil məhdud məlumat əsasında aparılıb.',
      severity: 'medium'
    });
  }

  // ---- SCORES ----
  out.scores = out.scores && typeof out.scores === 'object' ? out.scores : {};
  const s = out.scores;

  if (!s.reliability || typeof s.reliability !== 'object') s.reliability = {};
  if (typeof s.reliability.value !== 'number') s.reliability.value = 0;
  s.reliability.value = Math.max(0, Math.min(100, s.reliability.value));
  if (typeof s.reliability.rationale !== 'string') s.reliability.rationale = '';

  if (!s.political_establishment_bias || typeof s.political_establishment_bias !== 'object') s.political_establishment_bias = {};
  if (typeof s.political_establishment_bias.value !== 'number') s.political_establishment_bias.value = 0;
  s.political_establishment_bias.value = Math.max(-5, Math.min(5, s.political_establishment_bias.value));
  if (typeof s.political_establishment_bias.rationale !== 'string') s.political_establishment_bias.rationale = '';

  // purge deprecated fields if any model emits them
  if (s.socio_cultural_bias) delete s.socio_cultural_bias;

  // ---- DIAGNOSTICS ----
  out.diagnostics = out.diagnostics && typeof out.diagnostics === 'object' ? out.diagnostics : {};
  const dgn = out.diagnostics;

  if (!Array.isArray(dgn.socio_cultural_descriptions)) dgn.socio_cultural_descriptions = [];
  if (!Array.isArray(dgn.language_flags)) dgn.language_flags = [];

  dgn.socio_cultural_descriptions = dgn.socio_cultural_descriptions.slice(0, 12).map(x => ({
    group: typeof x?.group === 'string' ? x.group : '',
    stance: typeof x?.stance === 'string' ? x.stance : '',
    rationale: typeof x?.rationale === 'string' ? x.rationale : ''
  }));

  const ALLOWED_FLAG_CATS = new Set(['yüklü söz','qeyri-müəyyən','spekulyativ']);
  dgn.language_flags = dgn.language_flags.slice(0, 24).map(x => {
    let cat = typeof x?.category === 'string' ? x.category.trim().toLowerCase() : '';
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

  const { url, modelType = 'auto' } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'URL daxil edilməyib.' });
  }

  // Add version to cache key to invalidate old blocked content results
  const cacheVersion = 'v3-archive-md-fix';
  const cacheKey = crypto.createHash('md5').update(url + cacheVersion).digest('hex');
  console.log(`Cache key for ${url}: ${cacheKey} (version: ${cacheVersion})`);

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
        "BLOCKED_HOST":    "Böyük sənədlər (Google Docs/Drive və s.) analiz edilmir.",
        "BLOCKED_PATH":    "Bu keçid başqa bir hostinqdəki sənədə və ya birbaşa fayl yükləməsinə yönləndirir.",
        "DISALLOWED_MIME": "Analiz üçün dəstəklənməyən məzmun növü.",
        "ATTACHMENT":      "Birbaşa fayl əlavələri analiz edilmir.",
        "TOO_LARGE":       "Sənəd çox böyükdür.",
        "BLOCKED_FILE_EXT":"Fayl növü dəstəklənmir (video/arayış/fayl).",
        "ALLOWLIST_ONLY":  "Hazırda yalnız təsdiqlənmiş saytların linkləri qəbul olunur.",
        "NON_ARTICLE":     "Bu link məqalə kimi görünmür. Xahiş edirik məqalənin konkret səhifəsini göndərin.",
        "BAD_URL":         "Keçid düzgün deyil. Zəhmət olmasa tam URL göndərin (https:// ilə).",
        "BAD_SCHEME":      "Yalnız HTTP/HTTPS linkləri qəbul edilir.",
        "BAD_PORT":        "Bu port icazəli deyil.",
        "BAD_AUTH":        "URL daxilində istifadəçi adı/parol qəbul edilmir.",
        "PRIVATE_IP":      "Daxili və ya məxfi şəbəkə ünvanlarına keçidlər bloklanır.",
        "PRIVATE_HOST":    "Lokal/intranet host adlarına keçidlər bloklanır.",
        "NOT_FOUND":       "Keçid mövcud deyil (404/410). Zəhmət olmasa düzgün məqalə linki göndərin.",
        "BAD_STATUS":      "Hədəf səhifə hazırda əlçatmazdır."
      };
      return res.status(400).json({ error: true, code: polErr.code || 'POLICY', message: messages[polErr.code] || polErr.message });
    }

    // Compute under a KV lock to avoid duplicate token spend
    let result;
    try {
      result = await withLock(cacheKey, async () => {
        const recheck = await kv.get(cacheKey);
        if (recheck) return recheck;

        let browser = null;
        let contentSource = 'Live';
        let articleTextFast = '';
        let headlineFast = '';
        try {
          // Fast path: try gatedFetch first to avoid Chromium for simple pages
          try {
            const light = await gatedFetch(effectiveUrl);
            if (light?.text) {
              const rawText = htmlToText(light.text);
              const isBlockedContent = BLOCK_KEYWORDS.some((kw) => rawText.toLowerCase().includes(kw));
              
              if (isBlockedContent) {
                console.log(`LightFetch detected blocked content for ${effectiveUrl}: ${rawText.substring(0, 200)}...`);
                contentSource = 'Blocked';
              } else {
                articleTextFast = rawText.substring(0, MAX_ARTICLE_CHARS);
                contentSource = 'LightFetch';
                const m = light.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                if (m && m[1]) headlineFast = htmlToText(m[1]);
                console.log(`LightFetch success for ${effectiveUrl}: ${articleTextFast.length} chars`);
              }
            }
          } catch (e) {
            console.log(`LightFetch failed for ${effectiveUrl}: ${e?.message || e}`);
            contentSource = 'Blocked';
          }

          // If content is blocked, try archive.md first before falling back to blocked analysis
          if (contentSource === 'Blocked') {
            console.log(`Content blocked, trying archive.md fallback for ${effectiveUrl}...`);
            let archiveMdSuccess = false;
            
            try {
              const archiveMdUrl = await getArchiveMdUrl(effectiveUrl);
              console.log(`Archive.md lookup for ${effectiveUrl}: ${archiveMdUrl || 'not found'}`);
              if (archiveMdUrl) {
                console.log(`Archive.md found. Fetching from: ${archiveMdUrl}`);
                
                // Use Puppeteer to fetch from archive.md
                console.log(`Launching Puppeteer for archive.md fetch...`);
                const browser = await puppeteer.launch({
                  args: chromium.args,
                  defaultViewport: chromium.defaultViewport,
                  executablePath: await chromium.executablePath(),
                  headless: chromium.headless,
                  ignoreHTTPSErrors: true,
                });
                const page = await browser.newPage();
                await page.setUserAgent(USER_AGENT);
                await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
                
                console.log(`Navigating to archive.md URL: ${archiveMdUrl}`);
                await page.goto(archiveMdUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 2000)); // Wait for content to load
                
                console.log(`Extracting content from archive.md...`);
                const rawText = (await page.evaluate(() => (document.body && document.body.innerText) ? document.body.innerText : ''))
                  .replace(/\s\s+/g, ' ')
                  .trim();
                console.log(`Raw text length from archive.md: ${rawText.length}`);
                
                articleText = cleanArticleContent(rawText, effectiveUrl).substring(0, MAX_ARTICLE_CHARS);
                console.log(`Cleaned article text length: ${articleText.length}`);
                
                await browser.close();
                console.log(`Successfully fetched from archive.md: ${articleText.length} chars`);
                
                // If we got content from archive.md, proceed with normal analysis
                if (articleText && articleText.length > 100) {
                  console.log(`Archive.md content sufficient, proceeding with normal analysis`);
                  contentSource = 'Archive.md';
                  archiveMdSuccess = true;
                } else {
                  console.log(`Archive.md content insufficient, falling back to blocked analysis`);
                }
              } else {
                console.log(`No archive.md mirror found, staying blocked`);
              }
            } catch (e) {
              console.log(`Archive.md fallback failed: ${e?.message || e}`);
            }
            
            // If archive.md failed, use blocked content analysis
            if (!archiveMdSuccess) {
            const siteQuick = new URL(effectiveUrl).hostname.replace(/^www\./,'');
            const userSelection = getUserModelSelection(modelType);
            let blockedModelSelection;
            if (userSelection.model) {
              blockedModelSelection = {
                model: userSelection.model,
                reason: `User selected: ${userSelection.description}`,
                confidence: 'high'
              };
            } else {
              blockedModelSelection = selectOptimalModel({
                articleText: '',
                url: effectiveUrl,
                title: headlineFast,
                contentLength: 0
              });
            }
            console.log(`Blocked content model selection: ${blockedModelSelection.model} - ${blockedModelSelection.reason}`);
            
            const safePrompt = buildBlockedPrompt({ url: effectiveUrl, title: headlineFast, site: siteQuick });
            const r2 = await callGeminiWithRetryAndFallback({
              primaryModel: blockedModelSelection.model,
              fallbackModels: FALLBACK_MODELS,
              prompt: safePrompt,
              timeout: userSelection.timeout
            });
            const normalized = normalizeOutput(r2.parsed, { 
              url: effectiveUrl, 
              contentSource, 
              isBlocked: true,
              articleText: ''
            });
            normalized.hash = cacheKey;
            normalized.modelUsed = r2.modelUsed;
            normalized.contentSource = contentSource;
            await kv.set(cacheKey, normalized, { ex: 2592000 });
            console.log(`SAVED TO CACHE (blocked-safe) for URL: ${effectiveUrl} with hash: ${cacheKey}`);
            try { await kv.lpush('recent_hashes', cacheKey); await kv.ltrim('recent_hashes', 0, 499); } catch {}
            return normalized;
            }
          }

          // If fast path is acceptable, proceed directly to LLM without Chromium.
          // Even if thin, try safe prompt immediately to avoid Chromium unless necessary.
          try {
            const hostQuick = new URL(effectiveUrl).hostname.replace(/^www\./,'');
            if (hostQuick.endsWith('jam-news.net')) {
              const siteQuick = hostQuick;
              // Get user model selection for fast path
              const userSelection = getUserModelSelection(modelType);
              let fastModelSelection;
              if (userSelection.model) {
                fastModelSelection = {
                  model: userSelection.model,
                  reason: `User selected: ${userSelection.description}`,
                  confidence: 'high'
                };
              } else {
                fastModelSelection = selectOptimalModel({
                  articleText: articleTextFast,
                  url: effectiveUrl,
                  title: headlineFast,
                  contentLength: articleTextFast.length
                });
              }
              console.log(`Fast path model selection: ${fastModelSelection.model} - ${fastModelSelection.reason}`);
              
              const safePrompt = buildSafePrompt({ url: effectiveUrl, title: headlineFast, site: siteQuick });
              const r2 = await callGeminiWithRetryAndFallback({
                primaryModel: fastModelSelection.model,
                fallbackModels: FALLBACK_MODELS,
                prompt: safePrompt,
                timeout: userSelection.timeout
              });
              const normalized = normalizeOutput(r2.parsed, { 
                url: effectiveUrl, 
                contentSource, 
                isBlocked: contentSource === 'Blocked',
                articleText: articleTextFast || ''
              });
              normalized.hash = cacheKey;
              normalized.modelUsed = r2.modelUsed;
              normalized.contentSource = contentSource;
              await kv.set(cacheKey, normalized, { ex: 2592000 });
              console.log(`SAVED TO CACHE (jam-news safe) for URL: ${effectiveUrl}`);
              try { await kv.lpush('recent_hashes', cacheKey); await kv.ltrim('recent_hashes', 0, 499); } catch {}
              return normalized;
            }
          } catch {}

          if (articleTextFast && articleTextFast.length >= 400) {
            const siteQuick = new URL(effectiveUrl).hostname.replace(/^www\./,'');
            // Get user model selection for light fetch path
            const userSelection = getUserModelSelection(modelType);
            let lightModelSelection;
            if (userSelection.model) {
              lightModelSelection = {
                model: userSelection.model,
                reason: `User selected: ${userSelection.description}`,
                confidence: 'high'
              };
            } else {
              lightModelSelection = selectOptimalModel({
                articleText: articleTextFast,
                url: effectiveUrl,
                title: headlineFast,
                contentLength: articleTextFast.length
              });
            }
            console.log(`Light fetch model selection: ${lightModelSelection.model} - ${lightModelSelection.reason}`);
            
            const SHRINKS = [0.7, 0.4];
            let parsedQuick = null, modelUsedQuick = null, lastErrQuick = null;
            for (let i = 0; i < SHRINKS.length; i++) {
              const cut = Math.floor(MAX_ARTICLE_CHARS * SHRINKS[i]);
              const slice = articleTextFast.slice(0, cut);
              const prompt = buildPrompt({ url: effectiveUrl, articleText: slice });
              try {
                const r = await callGeminiWithRetryAndFallback({
                  primaryModel: lightModelSelection.model,
                  fallbackModels: FALLBACK_MODELS,
                  prompt,
                  timeout: userSelection.timeout
                });
                parsedQuick = r.parsed; modelUsedQuick = r.modelUsed; break;
              } catch (e) {
                lastErrQuick = e;
              }
            }
            if (!parsedQuick) {
              const safePrompt = buildSafePrompt({ url: effectiveUrl, title: headlineFast, site: siteQuick });
              const r2 = await callGeminiWithRetryAndFallback({
                primaryModel: lightModelSelection.model,
                fallbackModels: FALLBACK_MODELS,
                prompt: safePrompt,
                timeout: userSelection.timeout
              });
              parsedQuick = r2.parsed; modelUsedQuick = r2.modelUsed;
            }
            const normalized = normalizeOutput(parsedQuick, { 
              url: effectiveUrl, 
              contentSource, 
              isBlocked: contentSource === 'Blocked',
              articleText: articleTextFast || ''
            });
            normalized.hash = cacheKey;
            normalized.modelUsed = modelUsedQuick;
            normalized.contentSource = contentSource;
            await kv.set(cacheKey, normalized, { ex: 2592000 });
            console.log(`SAVED TO CACHE (light) for URL: ${effectiveUrl}`);
            try { await kv.lpush('recent_hashes', cacheKey); await kv.ltrim('recent_hashes', 0, 499); } catch {}
            return normalized;
          }

          if (articleTextFast && articleTextFast.length > 0) {
            // Thin content: skip Chromium and do safe prompt quickly
            const siteQuick = new URL(effectiveUrl).hostname.replace(/^www\./,'');
            // Get user model selection for thin content
            const userSelection = getUserModelSelection(modelType);
            let thinModelSelection;
            if (userSelection.model) {
              thinModelSelection = {
                model: userSelection.model,
                reason: `User selected: ${userSelection.description}`,
                confidence: 'high'
              };
            } else {
              thinModelSelection = selectOptimalModel({
                articleText: articleTextFast,
                url: effectiveUrl,
                title: headlineFast,
                contentLength: articleTextFast.length
              });
            }
            console.log(`Thin content model selection: ${thinModelSelection.model} - ${thinModelSelection.reason}`);
            
            const safePrompt = buildSafePrompt({ url: effectiveUrl, title: headlineFast, site: siteQuick });
            const r2 = await callGeminiWithRetryAndFallback({
              primaryModel: thinModelSelection.model,
              fallbackModels: FALLBACK_MODELS,
              prompt: safePrompt,
              timeout: userSelection.timeout
            });
            const normalized = normalizeOutput(r2.parsed, { 
              url: effectiveUrl, 
              contentSource, 
              isBlocked: contentSource === 'Blocked',
              articleText: articleTextFast || ''
            });
            normalized.hash = cacheKey;
            normalized.modelUsed = r2.modelUsed;
            normalized.contentSource = contentSource;
            await kv.set(cacheKey, normalized, { ex: 2592000 });
            console.log(`SAVED TO CACHE (light-safe) for URL: ${effectiveUrl}`);
            try { await kv.lpush('recent_hashes', cacheKey); await kv.ltrim('recent_hashes', 0, 499); } catch {}
            return normalized;
          }

          // ---------- Chromium path ----------
          browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
          });

          const page = await browser.newPage();
          
          // Enhanced user agent and headers for better compatibility
          const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
          await page.setUserAgent(userAgent);
          await page.setExtraHTTPHeaders({ 
            'Accept-Language': 'az,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          });
          
          // Set viewport to look more like a real browser
          await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });

          // Trim heavy resources to speed up/avoid infinite network idles
          const originUrl = new URL(effectiveUrl);
          const siteBase = originUrl.hostname.split('.').slice(-2).join('.'); // rough eTLD+1
          const isOxu = originUrl.hostname === 'oxu.az' || originUrl.hostname.endsWith('.oxu.az');

          await page.setRequestInterception(true);
          page.on('request', (req) => {
            const type = req.resourceType();
            const u = new URL(req.url());
            const sameHost = u.hostname === originUrl.hostname;
            const sameSite = sameHost || u.hostname.endsWith('.' + siteBase);

            // For oxu.az, be a bit less aggressive (keep images/css from same-site).
            if (isOxu) {
              if (type === 'font' || (type === 'image' && !sameSite)) return req.abort();
              if (type === 'stylesheet' && !sameSite) return req.abort();
              if (type === 'websocket' && !sameSite) return req.abort();
              return req.continue();
            }

            // Default behavior for others
            if (type === 'image' || type === 'media' || type === 'font') return req.abort();
            if (type === 'stylesheet' && !sameSite) return req.abort();
            if (type === 'websocket' && !sameSite) return req.abort();
            return req.continue();
          });

          const DOMAIN_SELECTORS = {
            'oxu.az': ['.news-inner .news-text', '.news-detail .news-text', '.news-inner', '.news-detail', 'article .content', 'article'],
            'publika.az': ['.news-content','.news_text','.news-detail','.post-content','article'],
            'jam-news.net': ['article#articleContent', '.wi-single-content', 'main article', 'article', '.content']
          };

          // ---- OXU.AZ OVERRIDE (CF-friendly nav) ----
          let resp = null;
          
          // For oxu.az, add extra stealth measures
          if (isOxu) {
            // Inject some random mouse movements to look more human
            await page.evaluateOnNewDocument(() => {
              // Override navigator.webdriver
              Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
              });
              
              // Override plugins length
              Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
              });
              
              // Override languages
              Object.defineProperty(navigator, 'languages', {
                get: () => ['az-AZ', 'az', 'en-US', 'en'],
              });
            });
          }
          
          try {
            // First attempt: DOM ready (short timeout)
            resp = await page.goto(effectiveUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          } catch (e) {
            console.warn('First nav (domcontentloaded) failed:', e?.message || e);
          }

          // If oxu.az or first nav looked like CF, try networkidle2 and a longer dwell
          const needsDeepWait = isOxu || !resp;
          if (needsDeepWait) {
            try {
              resp = await page.goto(effectiveUrl, { waitUntil: 'networkidle2', timeout: 20000 });
            } catch (e2) {
              console.warn('Second nav (networkidle2) failed:', e2?.message || e2);
            }
            // Wait longer for oxu.az to clear any challenges
            await sleep(isOxu ? 2000 : 800);
          }

          // If title or content suggests Cloudflare, wait a bit more and re-load once
          try {
            const t = (await page.title()) || '';
            const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
            const isCloudflare = /cloudflare|attention required|checking your browser|enable javascript and cookies to continue|challenge-error-text/i.test(t + ' ' + bodyText);
            
            if (isCloudflare) {
              console.log('Cloudflare challenge detected, waiting and retrying...');
              await sleep(2000); // Wait longer for CF challenge to clear
              try {
                await page.goto(effectiveUrl, { waitUntil: 'networkidle2', timeout: 20000 });
                await sleep(1000);
              } catch {}
            }
          } catch {}

          // Try site-specific content selectors first
          let articleText = '';
          try {
            const sels = DOMAIN_SELECTORS[originUrl.hostname.replace(/^www\./,'')] ||
                        (isOxu ? DOMAIN_SELECTORS['oxu.az'] : null);
            if (sels && sels.length) {
              console.log(`Trying selectors for ${originUrl.hostname}: ${sels.join(', ')}`);
              articleText = await page.evaluate((selectors) => {
                for (const sel of selectors) {
                  const el = document.querySelector(sel);
                  if (el) return (el.innerText || '').replace(/\s\s+/g, ' ').trim();
                }
                return '';
              }, sels);
              console.log(`Selector extraction result: ${articleText.length} chars`);
            }
          } catch (e) {
            console.warn('Selector extraction failed:', e?.message || e);
          }

          // Fallback to whole body if selectors failed/empty
          if (!articleText || articleText.length < 200) {
            try {
              const bodyTxt = await page.evaluate(() => (document.body && document.body.innerText) ? document.body.innerText : '');
              const rawText = String(bodyTxt || '').replace(/\s\s+/g, ' ').trim();
              articleText = cleanArticleContent(rawText, effectiveUrl);
            } catch {}
          }

          // If DOM is too empty, do a raw GET fallback and strip tags
          if (!articleText || articleText.length < 200) {
            try {
              const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
              const raw = await fetch(effectiveUrl, { redirect: 'follow', headers: { 'User-Agent': ua, 'Accept': 'text/html,*/*', 'Accept-Language': 'az,en;q=0.9' } });
              const html = await raw.text();
              const rawText = htmlToText(html);
              articleText = cleanArticleContent(rawText, effectiveUrl);
            } catch (fetchFallbackErr) {
              console.warn('Fetch-fallback failed:', fetchFallbackErr?.message || fetchFallbackErr);
            }
          }

          // Special handling for oxu.az if content is still blocked
          if ((!articleText || articleText.length < 400) && isOxu) {
            console.log('oxu.az content still blocked, trying alternative approach...');
            
            // Try to get content from different selectors or raw HTML
            try {
              const alternativeContent = await page.evaluate(() => {
                // Try multiple selectors for oxu.az
                const selectors = [
                  '.news-inner .news-text',
                  '.news-detail .news-text', 
                  '.article-content',
                  '.content-text',
                  'main .content',
                  '.news-body',
                  'article .text'
                ];
                
                for (const sel of selectors) {
                  const el = document.querySelector(sel);
                  if (el && el.innerText && el.innerText.length > 200) {
                    return el.innerText;
                  }
                }
                
                // If no specific selectors work, try to get any text content
                const body = document.body;
                if (body) {
                  // Remove script and style elements
                  const scripts = body.querySelectorAll('script, style, nav, header, footer, .ad, .advertisement');
                  scripts.forEach(el => el.remove());
                  return body.innerText;
                }
                
                return '';
              });
              
              if (alternativeContent && alternativeContent.length > 200) {
                articleText = alternativeContent.replace(/\s\s+/g, ' ').trim();
                console.log(`Got alternative content for oxu.az: ${articleText.length} chars`);
              }
            } catch (e) {
              console.warn('Alternative content extraction failed:', e?.message || e);
            }
          }

          // If still thin and host is jam-news.net, skip deeper waits and proceed to safe prompt to meet 60s budget
          if ((!articleText || articleText.length < 400) && originUrl.hostname.endsWith('jam-news.net')) {
            const siteQuick = originUrl.hostname.replace(/^www\./,'');
            let titleForSafe = '';
            try { titleForSafe = (await page.title()).slice(0, 180); } catch {}
            
            // Get user model selection for jam-news thin content
            const userSelection = getUserModelSelection(modelType);
            let jamNewsModelSelection;
            if (userSelection.model) {
              jamNewsModelSelection = {
                model: userSelection.model,
                reason: `User selected: ${userSelection.description}`,
                confidence: 'high'
              };
            } else {
              jamNewsModelSelection = selectOptimalModel({
                articleText,
                url: effectiveUrl,
                title: titleForSafe,
                contentLength: articleText.length
              });
            }
            console.log(`Jam-news thin content model selection: ${jamNewsModelSelection.model} - ${jamNewsModelSelection.reason}`);
            
            const safePrompt = buildSafePrompt({ url: effectiveUrl, title: titleForSafe, site: siteQuick });
            const r2 = await callGeminiWithRetryAndFallback({
              primaryModel: jamNewsModelSelection.model,
              fallbackModels: FALLBACK_MODELS,
              prompt: safePrompt,
              timeout: userSelection.timeout
            });
            const normalized = normalizeOutput(r2.parsed, { 
              url: effectiveUrl, 
              contentSource, 
              isBlocked: contentSource === 'Blocked',
              articleText: articleText || ''
            });
            normalized.hash = cacheKey;
            normalized.modelUsed = r2.modelUsed;
            normalized.contentSource = contentSource;
            await kv.set(cacheKey, normalized, { ex: 2592000 });
            console.log(`SAVED TO CACHE (jam-news chromium-safe) for URL: ${effectiveUrl}`);
            try { await kv.lpush('recent_hashes', cacheKey); await kv.ltrim('recent_hashes', 0, 499); } catch {}
            return normalized;
          }

          articleText = articleText.substring(0, MAX_ARTICLE_CHARS);
          const lower = articleText.toLowerCase();

          // Soft-404 & non-article heuristics
          const SOFT_404 = [
            /səhifə tapılmadı/i, /sehife tapilmadi/i, /tapılmadı/i, /mövcud deyil/i,
            /page not found/i, /\b404\b/, /not found/i, /content not available/i
          ];
          if (articleText.length < 400 && SOFT_404.some(rx => rx.test(articleText))) {
            const err = new Error('This does not look like an article (soft 404 / placeholder).');
            err.code = 'NON_ARTICLE'; throw err;
          }

          // Anti-bot fallback → Archive.org (only if still looks blocked)
          // Check both article text and full page content for bot detection
          const pageContent = await page.evaluate(() => document.documentElement ? document.documentElement.innerText : '');
          const isBlocked = BLOCK_KEYWORDS.some((kw) => lower.includes(kw) || pageContent.toLowerCase().includes(kw));
          
          // Update contentSource if blocked
          if (isBlocked) {
            contentSource = 'Blocked';
          }
          
          if (isBlocked) {
            console.log(`Initial fetch for ${effectiveUrl} was blocked. Checking Archive.org...`);
            const archiveApiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(effectiveUrl)}`;
            const archiveResponse = await fetch(archiveApiUrl);
            const archiveData = await archiveResponse.json();
            if (archiveData.archived_snapshots?.closest?.url) {
              const snapshotUrl = archiveData.archived_snapshots.closest.url;
              console.log(`Archive found. Fetching from: ${snapshotUrl}`);
              contentSource = 'Archive.org';
              try {
                await page.goto(snapshotUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
              } catch {}
              await new Promise(r => setTimeout(r, 400));
              const rawText = (await page.evaluate(() => (document.body && document.body.innerText) ? document.body.innerText : ''))
                .replace(/\s\s+/g, ' ')
                .trim();
              articleText = cleanArticleContent(rawText, effectiveUrl).substring(0, MAX_ARTICLE_CHARS);
            } else {
              // Try archive.md as final fallback
              console.log(`Archive.org not available. Trying archive.md...`);
              try {
                const archiveMdUrl = await getArchiveMdUrl(effectiveUrl);
                if (archiveMdUrl) {
                  console.log(`Archive.md found. Fetching from: ${archiveMdUrl}`);
                  contentSource = 'Archive.md';
                  await page.goto(archiveMdUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                  await new Promise(r => setTimeout(r, 1000)); // Wait longer for archive.md
                  const rawText = (await page.evaluate(() => (document.body && document.body.innerText) ? document.body.innerText : ''))
                    .replace(/\s\s+/g, ' ')
                    .trim();
                  articleText = cleanArticleContent(rawText, effectiveUrl).substring(0, MAX_ARTICLE_CHARS);
                } else {
                  const blockError = new Error('This website is protected by advanced bot detection and no archives are available.');
                  blockError.isBlockError = true;
                  throw blockError;
                }
              } catch (archiveMdError) {
                console.log(`Archive.md also failed: ${archiveMdError?.message || archiveMdError}`);
                const blockError = new Error('This website is protected by advanced bot detection and no archives are available.');
                blockError.isBlockError = true;
                throw blockError;
              }
            }
          }

          // For fallback prompt
          const site = originUrl.hostname.replace(/^www\./,'');
          let headline = '';
          try { headline = await page.title(); } catch {}
          try {
            const ogt = await page.$eval('meta[property="og:title"]', el => el.getAttribute('content'));
            if (ogt && ogt.length > 5) headline = ogt;
          } catch {}

          // Get user model selection and timeout
          const userSelection = getUserModelSelection(modelType);
          console.log(`User model selection: ${userSelection.description} (timeout: ${userSelection.timeout}ms)`);
          
          // Determine final model selection
          let finalModelSelection;
          if (userSelection.model) {
            // User explicitly selected a model
            finalModelSelection = {
              model: userSelection.model,
              reason: `User selected: ${userSelection.description}`,
              confidence: 'high'
            };
          } else {
            // Use smart selection for 'auto' mode
            finalModelSelection = selectOptimalModel({
              articleText,
              url: effectiveUrl,
              title: headline,
              contentLength: articleText.length
            });
            console.log(`Smart model selection: ${finalModelSelection.model} - ${finalModelSelection.reason} (confidence: ${finalModelSelection.confidence})`);
          }
          
          // Update timeout based on user selection
          const effectiveTimeout = userSelection.timeout;

          // If content is very short/blocked, jump straight to safe prompt to save tokens.
          const tooThin = !articleText || articleText.length < 400;
          const SHRINKS = [0.7, 0.4];
          let parsed, modelUsed, lastErr;

          if (!tooThin) {
            // Try reduced slices first; use smart-selected model but keep within token budget
            for (let i = 0; i < SHRINKS.length; i++) {
              const cut = Math.floor(MAX_ARTICLE_CHARS * SHRINKS[i]);
              const slice = articleText.slice(0, cut);
              const prompt = buildPrompt({ url: effectiveUrl, articleText: slice });
              try {
                const r = await callGeminiWithRetryAndFallback({
                  primaryModel: finalModelSelection.model,
                  fallbackModels: FALLBACK_MODELS,
                  prompt,
                  timeout: effectiveTimeout
                });
                parsed = r.parsed; modelUsed = r.modelUsed;
                break;
              } catch (e) {
                lastErr = e;
                const msg = String(e?.message || '').toLowerCase();
                const isTimeoutish = e?.name === 'AbortError' || e?.httpStatus === 504 || /timeout|timed out|network error/.test(msg);
                if (!isTimeoutish || i === SHRINKS.length - 1) {
                  break;
                }
              }
            }
          }

          // Final safety net (also used for thin pages)
          if (!parsed) {
            const safePrompt = buildSafePrompt({ url: effectiveUrl, title: headline, site });
            const r2 = await callGeminiWithRetryAndFallback({
              primaryModel: finalModelSelection.model,
              fallbackModels: FALLBACK_MODELS,
              prompt: safePrompt,
              timeout: effectiveTimeout
            });
            parsed = r2.parsed; modelUsed = r2.modelUsed;
          }

          const normalized = normalizeOutput(parsed, { 
            url: effectiveUrl, 
            contentSource, 
            isBlocked: contentSource === 'Blocked',
            articleText: articleText || ''
          });

          // Decorate + cache
          normalized.hash = cacheKey;
          normalized.modelUsed = modelUsed;
          normalized.contentSource = contentSource;

          await kv.set(cacheKey, normalized, { ex: 2592000 });
          console.log(`SAVED TO CACHE for URL: ${effectiveUrl}`);

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