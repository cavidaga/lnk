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
    // --- CACHING LOGIC: Create a key and check for a cached result ---
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
        if (blockKeywords.some(keyword => articleText.toLowerCase().includes(keyword))) {
            const blockError = new Error('This website is protected by advanced bot detection.');
            blockError.isBlockError = true;
            throw blockError;
        }

        articleText = articleText.replace(/\s\s+/g, ' ').substring(0, 30000);
        
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        // --- THE ULTIMATE PROMPT ---
        const prompt = `
            You are "MediaBiasEvaluator", a sophisticated, neutral analyst AI. Analyze the provided ARTICLE TEXT and generate a single, valid JSON object with a comprehensive media bias and reliability report.

            ## CONTEXT ##
            Original URL: ${url}

            ## ARTICLE TEXT TO ANALYZE ##
            ${articleText}

            ## JSON SCHEMA & METHODOLOGY INSTRUCTIONS ##
            Your entire output must be a single, valid JSON object. All free-text values (rationales, summaries, etc.) must be in Azerbaijani. In the 'human_summary' and 'rationale' fields, write natural, flowing paragraphs. Do NOT place commas between full sentences.

            The JSON object must contain the following top-level keys: "meta", "scores", "diagnostics", "cited_sources", and "human_summary".

            1.  "meta": An object containing:
                - "article_type": Classify the article as one of: "Xəbər" (News), "Rəy" (Opinion), "Analiz" (Analysis), "İstintaq Jurnalistikası" (Investigative), "Müsahibə" (Interview), or "Press-reliz" (Press Release).

            2.  "scores": An object for the main two-axis scores. Each key must map to an object with a "value" (number, decimals allowed) and a "rationale" (string, Azerbaijani):
                - "reliability" (Score: 0-100): 100 for original, factual reporting; 0 for fabricated propaganda.
                - "socio_cultural_bias" (Score: -5.0 to +5.0): -5.0 for Strongly Conservative; +5.0 for Strongly Liberal.
                - "political_establishment_bias" (Score: -5.0 to +5.0): -5.0 for Strongly Critical/Opposition; +5.0 for Strongly Pro-Government.

            3.  "diagnostics": An object for granular scores (0-100, integers only):
                - "language_loadedness": How much it relies on emotionally charged language.
                - "sourcing_transparency": How clearly it identifies and cites its sources.
                - "headline_accuracy": How well the headline reflects the article's content.
                - "language_flags": A list of specific examples of problematic language. Each item should be an object with "term" and "category" (e.g., "Yüklü dil", "Spekulyativ dil").

            4.  "cited_sources": An array of objects for key people/organizations quoted. Each object must have:
                - "name": The name of the person or organization.
                - "role": Their title or role (e.g., "Aktivist", "Siyasətçi").
                - "stance": Their apparent stance within the article: "Dəstəkləyici" (Supportive), "Tənqidi" (Critical), or "Neytral" (Neutral).

            5.  "human_summary": A concise 4-5 line summary of your findings in Azerbaijani.
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

        res.status(200).json(finalData);

    } catch (error) {
        console.error('An error occurred:', error);
        
        let errorMessage;
        if (error.isBlockError) {
            const geminiPrompt = `Analyze this article for media bias in Azerbaijani: ${url}`;
            errorMessage = 'Bu veb-sayt qabaqcıl bot mühafizəsi ilə qorunur və avtomatik təhlil edilə bilmir.';
            return res.status(500).json({ error: true, isBlockError: true, message: errorMessage, prompt: geminiPrompt });
        }
        
        res.status(500).json({ error: true, message: `Təhlil zamanı xəta baş verdi: ${error.message}` });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
