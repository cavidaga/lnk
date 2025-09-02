// Special version of Chromium for serverless environments
const chromium = require('@sparticuz/chromium');
// Puppeteer-core is a lightweight version of Puppeteer
const puppeteer = require('puppeteer-core');

// This is the main function Vercel will run
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required.' });
    }

    let browser = null;
    try {
        // --- 1. Launch Headless Chrome using the serverless-optimized package ---
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });

        let articleText = await page.evaluate(() => document.body.innerText);
        articleText = articleText.replace(/\s\s+/g, ' ').substring(0, 30000);
        
        // --- 2. Prepare and send to the Gemini API ---
        // IMPORTANT: We use process.env.GEMINI_API_KEY to securely get your key
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        const prompt = `
            You are "MediaBiasEvaluator", a neutral analyst AI. Analyze the article text below.
            ## CONTEXT ##
            Original URL: ${url}
            ## ARTICLE TEXT TO ANALYZE ##
            ${articleText}
            ## INSTRUCTIONS ##
            Generate a media bias report based *only* on the provided text.
            - The entire report must be in Azerbaijani.
            - Use Markdown for formatting (### for headings, - for bullets, ** for bold).
            - Structure the response: ### Ümumi Qiymətləndirmə, ### Əsas Təhlil, ### Məhdudiyyətlər.
        `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!geminiResponse.ok) {
            throw new Error(`Gemini API failed with status: ${geminiResponse.status}`);
        }

        const geminiData = await geminiResponse.json();
        const analysisText = geminiData.candidates[0].content.parts[0].text;

        // --- 3. Send the final report back to the user ---
        res.status(200).json({ analysis_text: analysisText });

    } catch (error) {
        console.error('An error occurred:', error);
        res.status(500).json({ error: `An error occurred during analysis: ${error.message}` });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
