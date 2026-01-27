
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fetchJson } from '../config/unifiedApiService.js';

// Add stealth plugin
(puppeteer as any).use(StealthPlugin());

export interface OGPMetadata {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    url?: string;
    type?: string;
    twitterCard?: string;
    video?: string;
}

export const ogpService = {
    /**
     * Fetch OGP metadata for a given URL
     * Tries simple fetch first, then falls back to Puppeteer
     */
    async fetchOGP(url: string): Promise<OGPMetadata | null> {
        // 1. Try simple fetch first (fast)
        try {
            const html = await fetchJson({
                url,
                headers: {
                    // Use a real browser User-Agent
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 8000
            }) as string;
            const $ = cheerio.load(html);

            const getMeta = (property: string) => {
                return $(`meta[property="${property}"]`).attr('content') ||
                    $(`meta[name="${property}"]`).attr('content');
            };

            const metadata: OGPMetadata = {
                url: url
            };

            metadata.title = getMeta('og:title') || $('title').text();
            metadata.description = getMeta('og:description') || getMeta('description');
            metadata.image = getMeta('og:image');
            metadata.siteName = getMeta('og:site_name');
            metadata.type = getMeta('og:type');
            metadata.twitterCard = getMeta('twitter:card');
            metadata.video = getMeta('og:video');

            // If we got good data, return it
            if (metadata.title && metadata.image) {
                return metadata;
            }

            // If we got partial data but it looks like a bot challenge/SPA, fallback
        } catch (error) {
            console.warn(`[OGPService] Simple fetch failed for ${url}, trying Puppeteer...`);
        }

        // 2. Fallback to Puppeteer (slow but robust)
        try {
            console.log(`[OGPService] Launching Puppeteer for ${url}`);
            const browser = await (puppeteer as any).launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                ]
            });

            try {
                const page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                // Block resources to speed up
                await page.setRequestInterception(true);
                page.on('request', (req: any) => {
                    if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait a tiny bit for JS to populate meta tags
                await new Promise(r => setTimeout(r, 1000));

                /* 
                   Use completely unrolled logic to avoid esbuild injecting helpers for internal functions.
                   This is verbose but robust against transpilation artifacts in page.evaluate context.
                */
                const metadata = await page.evaluate((targetUrl: string) => {
                    return {
                        url: targetUrl,
                        title: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                            document.querySelector('meta[name="og:title"]')?.getAttribute('content') ||
                            document.title,
                        description: document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                            document.querySelector('meta[name="og:description"]')?.getAttribute('content') ||
                            document.querySelector('meta[name="description"]')?.getAttribute('content'),
                        image: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                            document.querySelector('meta[name="og:image"]')?.getAttribute('content'),
                        siteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
                            document.querySelector('meta[name="og:site_name"]')?.getAttribute('content'),
                        type: document.querySelector('meta[property="og:type"]')?.getAttribute('content') ||
                            document.querySelector('meta[name="og:type"]')?.getAttribute('content'),
                        twitterCard: document.querySelector('meta[property="twitter:card"]')?.getAttribute('content') ||
                            document.querySelector('meta[name="twitter:card"]')?.getAttribute('content'),
                        video: document.querySelector('meta[property="og:video"]')?.getAttribute('content') ||
                            document.querySelector('meta[name="og:video"]')?.getAttribute('content')
                    };
                }, url);

                return metadata as OGPMetadata;

            } finally {
                await browser.close();
            }

        } catch (pupError) {
            console.error(`[OGPService] Puppeteer failed for ${url}:`, pupError);
            return null;
        }
    }
};
