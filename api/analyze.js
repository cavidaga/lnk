import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL daxil edilməyib.' });
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

        // --- NEW, AD FONTES-INSPIRED PROMPT ---
        const prompt = `
            You are "MediaBiasEvaluator", a sophisticated, neutral analyst AI. Your task is to analyze the provided ARTICLE TEXT based on a two-axis methodology (Reliability and Bias) and generate a single, valid JSON object.

            ## CONTEXT ##
            Original URL: ${url}

            ## ARTICLE TEXT TO ANALYZE ##
            ${articleText}

            ## JSON SCHEMA & METHODOLOGY INSTRUCTIONS ##
            Your entire output must be a single, valid JSON object. All free-text rationales and summaries must be in Azerbaijani.

            The JSON must contain a "scores" object with three main keys: "reliability", "socio_cultural_bias", and "political_establishment_bias".
            Each key must map to an object containing:
            1.  "value": A numerical score (decimals are allowed).
            2.  "rationale": A brief explanation for the score in Azerbaijani.

            Analyze and score based on these definitions:

            1.  "reliability" (Score: 0-100):
                - 100: Original, factual, neutral reporting with high-quality sources.
                - 50: Mix of fact and opinion, some analysis, decent sourcing.
                - 0: Inaccurate, fabricated, or propaganda with no reliable sources.
                - Rationale should explain sourcing, factuality, and expression (how it presents info).

            2.  "socio_cultural_bias" (Score: -5.0 to +5.0):
                - -5.0: Strongly Conservative (Mühafizəkar).
                - 0.0: Neutral/Balanced.
                - +5.0: Strongly Liberal.
                - Rationale should explain why, based on stances on social/cultural issues.

            3.  "political_establishment_bias" (Score: -5.0 to +5.0):
                - -5.0: Strongly Critical/Opposition (Müxalif).
                - 0.0: Neutral/Balanced.
                - +5.0: Strongly Pro-Government (Hökumətyönümlü).
                - Rationale should explain why, based on its stance towards government policies and officials.
            
            Additionally, include a top-level key "human_summary" containing a 4-5 line summary of your findings in Azerbaijani.
        `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        
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
