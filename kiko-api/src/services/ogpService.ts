
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fetchJson } from '../config/unifiedApiService.js';
import redis from '../cache/redis.js';

let browserInstance: any = null;
let requestCount = 0;
const MAX_REQUESTS_PER_BROWSER = 100;
const PROXY_BASE_URL = process.env.API_URL || 'http://localhost:3001';

async function getBrowser() {
    if (browserInstance && requestCount >= MAX_REQUESTS_PER_BROWSER) {
        console.log(`[OGPService] Browser reached ${requestCount} requests. Restarting...`);
        await closeBrowser();
    }

    if (!browserInstance) {
        console.log('[OGPService] Launching Singleton Browser...');
        browserInstance = await (puppeteer as any).launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--memory-pressure-off' // Helpful for long running processes
            ]
        });

        browserInstance.on('disconnected', () => {
            console.log('[OGPService] Browser disconnected, resetting singleton.');
            browserInstance = null;
            requestCount = 0;
        });

        requestCount = 0;
    }

    requestCount++;
    return browserInstance;
}

async function closeBrowser() {
    if (browserInstance) {
        try {
            await browserInstance.close();
        } catch (e) {
            console.error('[OGPService] Error closing browser:', e);
        }
        browserInstance = null;
        requestCount = 0;
    }
}

// Ensure cleanup on process exit
process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);

function proxifyImage(url?: string): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('data:')) return url; // Don't proxy data URIs

    // Simple encoding
    return `${PROXY_BASE_URL}/api/images/token?url=${encodeURIComponent(url)}`;
}

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
        // 0. Check Cache First (Instant)
        // 0. Check Cache First (Persistent)
        const cached = await redis.get(`ogp:${url}`);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                // Invalid JSON, ignore
            }
        }

        // 1. Try simple fetch first (fast)
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            try {
                const response = await fetch(url, {
                    headers: {
                        // Use a real browser User-Agent to avoid bot blocking
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (response.status === 403 || response.status === 429) {
                    console.warn(`[OGPService] Blocked by target (${response.status}): ${url}`);
                    // Fallthrough to Puppeteer might help if it's a JS challenge
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const html = await response.text();
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

                // If we got good data (at least title), return it
                // [FIX]: Many sites don't have og:image, so only require title
                if (metadata.title) {
                    if (metadata.image) {
                        metadata.image = proxifyImage(metadata.image);
                    }
                    await redis.set(`ogp:${url}`, JSON.stringify(metadata), 7 * 24 * 60 * 60); // 7 days
                    return metadata;
                }
            } finally {
                clearTimeout(timeout);
            }
        } catch (error: any) {
            console.warn(`[OGPService] Simple fetch failed for ${url}: ${error.message}, trying microlink.io...`);
        }

        // 2. SECOND FALLBACK: microlink.io API (fast, reliable)
        try {
            console.log(`[OGPService] Trying microlink.io for ${url}`);
            const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
            const response = await fetch(microlinkUrl, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(8000)
            });

            if (response.ok) {
                const json = await response.json();
                if (json.status === 'success' && json.data) {
                    const metadata: OGPMetadata = {
                        title: json.data.title,
                        description: json.data.description,
                        image: json.data.image?.url,
                        siteName: json.data.publisher,
                        url: json.data.url || url
                    };

                    if (metadata.title) {
                        if (metadata.image) metadata.image = proxifyImage(metadata.image);
                        await redis.set(`ogp:${url}`, JSON.stringify(metadata), 7 * 24 * 60 * 60);
                        console.log(`[OGPService] ✅ microlink.io success for ${url}`);
                        return metadata;
                    }
                }
            }
        } catch (extError) {
            console.warn(`[OGPService] microlink.io failed for ${url}, trying Puppeteer...`);
        }

        // 3. LAST RESORT: Puppeteer (slow, may not work on Railway)
        try {
            // console.log(`[OGPService] Using Puppeteer for ${url}`);
            const browser = await getBrowser();

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

                // Cache result
                if (metadata && (metadata.title || metadata.image)) {
                    metadata.image = proxifyImage(metadata.image);
                    await redis.set(`ogp:${url}`, JSON.stringify(metadata), 7 * 24 * 60 * 60); // 7 days
                }

                return metadata as OGPMetadata;

            } catch (pageError) {
                // If page crashes, we might want to close the page but keep browser
                throw pageError;
            }
            // Do NOT close browser here, reusing it.
            // finally { await browser.close(); } logic removed.

        } catch (pupError) {
            console.error(`[OGPService] Puppeteer failed for ${url}:`, pupError);
            return null;
        }
    }
}
