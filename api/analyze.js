import { kv } from '@vercel/kv';
import crypto from 'crypto';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

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
        const cachedResult = await kv.get(cacheKey);
        if (cachedResult) {
            console.log(`CACHE HIT for URL: ${url}`);
            res.setHeader('X-Vercel-Cache', 'HIT');
            return res.status(200).json(cachedResult);
        }
        console.log(`CACHE MISS for URL: ${url}`);
        res.setHeader('X-Vercel-Cache', 'MISS');
    } catch (error) {
        console.error("KV Error:", error);
    }
    
    let browser = null;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        let articleText = await page.evaluate(() => document.body.innerText);
        
        const blockKeywords = ['cloudflare', 'checking your browser', 'ddos protection', 'verifying you are human'];
        
        // --- Archive.org fallback logic ---
        if (blockKeywords.some(keyword => articleText.toLowerCase().includes(keyword))) {
            console.log(`Initial fetch for ${url} was blocked. Checking Archive.org...`);
            
            const archiveApiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
            const archiveResponse = await fetch(archiveApiUrl);
            const archiveData = await archiveResponse.json();

            if (archiveData.archived_snapshots?.closest?.url) {
                const snapshotUrl = archiveData.archived_snapshots.closest.url;
                console.log(`Archive found. Fetching from: ${snapshotUrl}`);
                // Inform the user that we are using an archived version
                res.setHeader('X-Content-Source', 'Archive.org'); 
                await page.goto(snapshotUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                articleText = await page.evaluate(() => document.body.innerText);
            } else {
                 // If no archive is found, then we throw the error
                const blockError = new Error('This website is protected by advanced bot detection.');
                blockError.isBlockError = true;
                throw blockError;
            }
        }
        
        articleText = articleText.replace(/\s\s+/g, ' ').substring(0, 30000);
        
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const prompt = `
            You are "MediaBiasEvaluator", a sophisticated, neutral analyst AI. Analyze the provided ARTICLE TEXT and generate a single, valid JSON object with a comprehensive media bias and reliability report.
            ## CONTEXT ##
            Original URL: ${url}
            ## ARTICLE TEXT TO ANALYZE ##
            ${articleText}
            ## JSON SCHEMA & METHODOLOGY INSTRUCTIONS ##
            Your entire output must be a single, valid JSON object. All free-text rationales and summaries must be in Azerbaijani. In the 'human_summary' and 'rationale' fields, write natural, flowing paragraphs. Do NOT place commas between full sentences.
            The JSON object must contain "meta", "scores", "diagnostics", "cited_sources", and "human_summary".
            "meta": { 
                "article_type": "...",
                "title": "<if missing in the text, infer a concise Azerbaijani title>",
                "original_url": "<the original canonical/primary URL of the article (absolute URL)>",
                "publication": "<domain or outlet name, e.g., abzas.org>",
                "published_at": "<ISO date or human-readable date if detectable, else omit>" 
                },
            "scores": { "reliability": { "value": 0-100, "rationale": "..." }, "socio_cultural_bias": { "value": -5.0 to +5.0, "rationale": "..." }, "political_establishment_bias": { "value": -5.0 to +5.0, "rationale": "..." } },
            "diagnostics": { "language_loadedness": 0-100, "sourcing_transparency": 0-100, "headline_accuracy": 0-100, "language_flags": [{ "term": "...", "category": "..." }] },
            "cited_sources": [{ "name": "...", "role": "...", "stance": "..." }],
            "human_summary": "..."
        `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
        
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { "responseMimeType": "application/json" }
            })
        });

        if (!geminiResponse.ok) throw new Error(`Süni intellekt modelindən cavab alınarkən xəta baş verdi (Status: ${geminiResponse.status})`);
        
        const geminiData = await geminiResponse.json();
        const analysisText = geminiData.candidates[0].content.parts[0].text;
        const finalData = JSON.parse(analysisText);

        finalData.hash = cacheKey;
        await kv.set(cacheKey, finalData, { ex: 2592000 });
        console.log(`SAVED TO CACHE for URL: ${url}`);
        
        res.status(200).json(finalData);

    } catch (error) {
        console.error('An error occurred:', error);
        
        let errorMessage;
        if (error.isBlockError) {
            const geminiPrompt = `Analyze this article for media bias in Azerbaijani: ${url}`;
            // Updated error message for clarity
            errorMessage = 'Bu veb-sayt qabaqcıl bot mühafizəsi ilə qorunur və heç bir arxiv nüsxəsi tapılmadı.';
            return res.status(500).json({ error: true, isBlockError: true, message: errorMessage, prompt: geminiPrompt });
        }
        
        res.status(500).json({ error: true, message: `Təhlil zamanı xəta baş verdi: ${error.message}` });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
