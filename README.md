# LNK - AI Media Bias Analyzer

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/YOUR_REPO)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A web-based tool that uses Google's Gemini AI and headless browser technology to analyze the potential bias of a news article from a given URL. This project is designed to be deployed easily on serverless platforms like Vercel.

***

## Screenshot

![Tool Screenshot](https://i.imgur.com/your-screenshot.png)
*(To add a screenshot: take a picture of your running application, upload it to a service like [Imgur](https://imgur.com/), and replace the link above.)*

***

## Features

-   **Intelligent Analysis:** Analyzes any public news article via its URL.
-   **Robust Scraping:** Uses a headless browser (Puppeteer) to correctly render JavaScript-heavy sites and bypass most bot-blockers, ensuring the full article text is analyzed.
-   **AI-Powered Insights:** Leverages the Google Gemini API for nuanced language, tone, and media bias analysis.
-   **Clean Reporting:** Presents a clear, readable report formatted with Markdown.
-   **Secure & Scalable:** The frontend is decoupled from the backend, with API keys securely stored as environment variables and the application deployed on Vercel for speed and scalability.

***

## Tech Stack

-   **Frontend:** HTML5, CSS3, Vanilla JavaScript, [marked.js](https://github.com/markedjs/marked)
-   **Backend:** Node.js Serverless Functions
-   **Scraping:** [Puppeteer-Core](https://pptr.dev/) + [@sparticuz/chromium](https://github.com/Sparticuz/chromium) (for serverless environments)
-   **AI:** Google Gemini API
-   **Platform:** [Vercel](https://vercel.com)

***

## Setup and Deployment

Follow these steps to deploy your own instance of the Media Bias Analyzer.

### 1. Fork/Clone the Repository

First, get a copy of this project on your own GitHub account by forking or cloning it.

### 2. Set Up Your Environment Variable

This application requires a Google Gemini API key to function.

-   Go to [Google AI Studio](https://aistudio.google.com/) to get your API key.
-   When deploying to Vercel, you must set this key as an **Environment Variable**.
    -   In your Vercel project dashboard, go to **Settings > Environment Variables**.
    -   Create a new variable with the name `GEMINI_API_KEY`.
    -   Paste your secret key into the value field and save.

### 3. Deploy to Vercel

Click the "Deploy with Vercel" button at the top of this README, or connect your forked GitHub repository to a new project in your Vercel dashboard. Vercel will automatically detect the configuration from the `package.json` and `vercel.json` files and deploy the application.

***

## A Note on `.gitignore`

For best practice, you should also add a `.gitignore` file to your repository to prevent uploading unnecessary files (like the `node_modules` directory). A standard Node.js `.gitignore` is recommended.

**File: `.gitignore`**
