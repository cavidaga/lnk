# LNK - AI Media Bias Analyzer

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/cavidaga/lnk)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A web app that uses Google's Gemini models and a headless browser to analyze the potential bias and reliability of a news article from a URL. It is optimized for Azerbaijani media but can be adapted to other locales. Designed for serverless deployment on Vercel and relies on Vercel KV for caching/results storage.

***

## Screenshot

![Tool Screenshot](https://i.imgur.com/vK3nYoM.png)
***

## Features

-   **Intelligent analysis:** Analyze public news articles by URL with Azerbaijani-language outputs.
-   **Headless rendering:** Puppeteer Core + `@sparticuz/chromium` to render JS-heavy sites and improve success behind basic bot checks.
-   **AI-powered:** Calls Gemini models (primary: `gemini-2.5-flash-lite`, fallbacks: `gemini-2.5-flash`, `gemini-2.5-pro`) with retries and backoff.
-   **Caching & sharing:** Results are cached in Vercel KV and retrievable by hash; pretty HTML view available at `/analysis/:hash`.
-   **Resilience:** Heuristics for Cloudflare/anti-bot, Archive.org fallback when live fetch is blocked, and URL/content-type safety policy.
-   **Serverless-ready:** Deployed on Vercel Functions; no persistent servers to manage.

***

## Tech Stack

-   **Frontend:** Static site in `public/` (HTML/CSS/Vanilla JS)
-   **Backend:** Node.js Vercel Functions in `api/`
-   **Scraping:** [Puppeteer Core](https://pptr.dev/) + [`@sparticuz/chromium`](https://github.com/Sparticuz/chromium)
-   **AI:** Google Gemini API (models noted above)
-   **Storage/Cache:** Vercel KV via `@vercel/kv`
-   **Platform:** [Vercel](https://vercel.com)

***

## Setup and Deployment

Follow these steps to deploy your own instance.

### 1. Fork/Clone the Repository

First, get a copy of this project on your own GitHub account by forking or cloning it.

### 2. Configure environment and KV

This app requires a Gemini API key and Vercel KV. Set up both:

-   Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/).
-   In Vercel, add the following in your project settings → Environment Variables:
    -   `GEMINI_API_KEY` (Required): your Gemini key
    -   `GEMINI_TIMEOUT_MS` (Optional): request timeout in ms (default 70000)
-   Provision Vercel KV for the project (Integrations → Vercel KV). This automatically injects the required `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables used by `@vercel/kv`.

Without Vercel KV, analysis requests will fail (locking and result storage depend on KV).

### 3. Deploy to Vercel

Click the "Deploy with Vercel" button above, or import the repo in your Vercel dashboard. The project uses `vercel.json` for routing and serverless settings and will deploy automatically.

After the first deployment, verify:
-   KV is connected and environment variables are present for all environments you use (Preview/Production).
-   The rewrite `/analysis/:hash → /api/analysis-html` works as expected.

***

## API and Routes

-   `POST /api/analyze` — Body: `{ url: string }`. Triggers fetch, render, AI call, normalize, cache. Returns JSON with a stable `hash` and metadata. Response headers include `X-Model-Used` and `X-Content-Source` when available.
-   `GET /api/get-analysis?id|hash=...` — Returns a previously cached result from Vercel KV.
-   `GET /analysis/:hash` — Pretty HTML view, mapped by `vercel.json` to `api/analysis-html`.

Notes:
-   Some hosts/paths and content types are blocked per URL policy (see `lib/url-policy.js`).
-   If live fetch is blocked by bot protection, the app may fall back to Archive.org snapshots when available.

## Local Development

This project targets Vercel’s serverless runtime (with `@sparticuz/chromium`). For the smoothest experience, deploy to Vercel. If you run locally, you’ll need Node 18+ and compatible Chromium binaries; behavior may differ from the serverless environment.

## Privacy

Analysis requests send page content or metadata to Google’s Gemini API. Results are cached in Vercel KV by URL hash. Review `public/privacy.html` for details and update as needed for your deployment.
