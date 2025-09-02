import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required.' });
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
        
        const blockKeywords = [
            'cloudflare', 'checking your browser', 'ddos protection', 'verifying you are human'
        ];
        if (blockKeywords.some(keyword => articleText.toLowerCase().includes(keyword))) {
            throw new Error('This website is protected by advanced bot detection (like Cloudflare) and cannot be analyzed automatically. For this site, please use the Bookmarklet method.');
        }

        articleText = articleText.replace(/\s\s+/g, ' ').substring(0, 30000);
        
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const prompt = `
            You are "MediaBiasEvaluator", a neutral analyst AI. Analyze the article text below.
            ## CONTEXT ##
            Original URL: ${url}
            ## ARTICLE TEXT TO ANALYZE ##
            ${articleText}
            ## INSTRUCTIONS ##
            Generate a media bias report based *only* on the provided text. The entire report must be in Azerbaijani. Use Markdown for formatting.
        `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!geminiResponse.ok) throw new Error(`Gemini API failed with status: ${geminiResponse.status}`);
        
        const geminiData = await geminiResponse.json();
        const analysisText = geminiData.candidates[0].content.parts[0].text;

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
