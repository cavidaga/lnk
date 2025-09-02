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
        
        const blockKeywords = [
            'cloudflare', 'checking your browser', 'ddos protection', 'verifying you are human'
        ];
        if (blockKeywords.some(keyword => articleText.toLowerCase().includes(keyword))) {
            // This is a special error. We'll add a flag to it.
            const blockError = new Error('This website is protected by advanced bot detection.');
            blockError.isBlockError = true; // Custom flag
            throw blockError;
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

        if (!geminiResponse.ok) throw new Error(`Süni intellekt modelindən cavab alınarkən xəta baş verdi (Status: ${geminiResponse.status})`);
        
        const geminiData = await geminiResponse.json();
        const analysisText = geminiData.candidates[0].content.parts[0].text;

        res.status(200).json({ analysis_text: analysisText });

    } catch (error) {
        console.error('An error occurred:', error);
        
        if (error.isBlockError) {
            // If it's a block error, send back a special JSON structure
            const geminiPrompt = `Analyze this article for media bias in Azerbaijani: ${url}`;
            const errorMessage = 'Bu veb-sayt qabaqcıl bot mühafizəsi ilə qorunur və avtomatik təhlil edilə bilmir.';
            return res.status(500).json({ 
                error: true,
                isBlockError: true,
                message: errorMessage,
                prompt: geminiPrompt
            });
        }
        
        // For all other errors, send a standard message
        res.status(500).json({ error: true, message: `Təhlil zamanı xəta baş verdi: ${error.message}` });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
