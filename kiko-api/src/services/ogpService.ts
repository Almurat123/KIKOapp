
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import redis from '../cache/redis.js';
import { logger } from '../utils/logger.js';
import { LogCode, LogRole } from '../config/logRegistry.js';

let browserInstance: any = null;
let requestCount = 0;
const MAX_REQUESTS_PER_BROWSER = 100;

async function getBrowser() {
    if (browserInstance && requestCount >= MAX_REQUESTS_PER_BROWSER) {
        logger.info(LogCode.SYS_INFO, `[OGPService] Browser reached limit. Restarting...`, {
            requestCount,
            role: LogRole.EVENT
        });
        await closeBrowser();
    }

    if (!browserInstance) {
        logger.info(LogCode.SYS_INFO, '[OGPService] Launching Singleton Browser...', { role: LogRole.EVENT });
        browserInstance = await (puppeteer as any).launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--memory-pressure-off'
            ]
        });

        browserInstance.on('disconnected', () => {
            logger.warn(LogCode.SYS_INFO, '[OGPService] Browser disconnected', { role: LogRole.EVENT });
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
        } catch (e: any) {
            logger.error(LogCode.SYS_ERROR, '[OGPService] Error closing browser', {
                error: e.message,
                role: LogRole.EVENT
            });
        }
        browserInstance = null;
        requestCount = 0;
    }
}

// Ensure cleanup on process exit
process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);

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
    originalImage?: string;
}

/**
 * Sanitizes and prepares metadata for the frontend
 */
function sanitizeMetadata(metadata: OGPMetadata, origin?: string): OGPMetadata {
    const PROXY_BASE_URL = origin || process.env.API_URL || '';

    // [FIX]: Capture original image before any processing
    if (metadata.image && !metadata.originalImage) {
        metadata.originalImage = metadata.image;
    }

    // 1. Skip generic X/Twitter placeholders
    if (metadata.image && (
        metadata.image.includes('og/image.png') ||
        metadata.image.includes('twitter_logo') ||
        metadata.image.includes('abs.twimg.com/rweb/ssr/default/v2/og/image.png') ||
        metadata.image.includes('twitter-card')
    )) {
        metadata.image = undefined;
    }

    // 2. Proxify image if it exists
    if (metadata.image && !metadata.image.startsWith('data:')) {
        const encodedUrl = encodeURIComponent(metadata.image);
        metadata.image = PROXY_BASE_URL
            ? `${PROXY_BASE_URL}/api/images/token?url=${encodedUrl}`
            : `/api/images/token?url=${encodedUrl}`;
    }

    return metadata;
}

export const ogpService = {
    /**
     * Fetch OGP metadata for a given URL
     * Tries simple fetch first, then fallback services
     */
    async fetchOGP(url: string, origin?: string): Promise<OGPMetadata | null> {
        // [FIX]: Optimize X/Twitter fetching via vxtwitter
        let fetchUrl = url;
        if (url.includes('twitter.com') || url.includes('x.com')) {
            fetchUrl = url.replace(/(twitter\.com|x\.com)/, 'vxtwitter.com');
        }

        const cached = await redis.get(`ogp:${url}`);
        if (cached) {
            try { return JSON.parse(cached); } catch (e) { }
        }

        // [FIX]: Handle direct media links (m3u8, mp4, images)
        // Ensure strictly image extensions are NOT treated as video
        const isMedia = url.match(/\.(m3u8|mp4|mov|webm|jpg|jpeg|png|gif|webp|avif)(\?|$)/i);
        if (isMedia) {
            const ext = isMedia[1].toLowerCase();
            const isVideoExt = ['m3u8', 'mp4', 'mov', 'webm'].includes(ext);
            const type = isVideoExt ? 'video' : 'image';

            const metadata: OGPMetadata = {
                url,
                title: isVideoExt ? 'Video Content' : 'Image Content',
                type: type,
                image: !isVideoExt ? url : undefined,
                video: isVideoExt ? url : undefined,
                siteName: isVideoExt ? 'Media Stream' : 'Direct Image'
            };
            const sanitized = sanitizeMetadata(metadata, origin);
            await redis.set(`ogp:${url}`, JSON.stringify(sanitized), 7 * 24 * 60 * 60);
            return sanitized;
        }

        // 1. Try simple fetch with cheerio (fast)
        try {
            const res = await fetch(fetchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                },
                signal: AbortSignal.timeout(8000)
            });

            if (res.ok) {
                const html = await res.text();
                const $ = cheerio.load(html);

                const getMeta = (prop: string) =>
                    $(`meta[property="${prop}"]`).attr('content') ||
                    $(`meta[name="${prop}"]`).attr('content') ||
                    $(`meta[property="twitter:${prop.replace('og:', '')}"]`).attr('content') ||
                    $(`meta[name="twitter:${prop.replace('og:', '')}"]`).attr('content');

                const metadata: OGPMetadata = {
                    url,
                    title: getMeta('og:title') || $(`meta[name="twitter:title"]`).attr('content') || $('title').text(),
                    description: getMeta('og:description') || $(`meta[name="twitter:description"]`).attr('content') || getMeta('description'),
                    image: getMeta('og:image') || $(`meta[name="twitter:image"]`).attr('content'),
                    siteName: getMeta('og:site_name') || $(`meta[name="twitter:site"]`).attr('content') || (url.includes('x.com') || url.includes('twitter.com') ? 'X' : undefined)
                };

                if (metadata.title) {
                    const sanitized = sanitizeMetadata(metadata, origin);
                    await redis.set(`ogp:${url}`, JSON.stringify(sanitized), 7 * 24 * 60 * 60);
                    return sanitized;
                }
            }
        } catch (e: any) {
            logger.warn(LogCode.API_FETCH_FAILED, `[OGPService] Simple fetch failed`, {
                url,
                error: e.message,
                role: LogRole.METRIC
            });
        }

        // 2. Fallback: microlink.io
        try {
            const mlRes = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {
                signal: AbortSignal.timeout(8000)
            });

            if (mlRes.ok) {
                const json = await mlRes.json();
                if (json.status === 'success' && json.data) {
                    const metadata: OGPMetadata = {
                        url,
                        title: json.data.title,
                        description: json.data.description,
                        image: json.data.image?.url,
                        siteName: json.data.publisher
                    };

                    if (metadata.title) {
                        const sanitized = sanitizeMetadata(metadata, origin);
                        await redis.set(`ogp:${url}`, JSON.stringify(sanitized), 7 * 24 * 60 * 60);
                        return sanitized;
                    }
                }
            }
        } catch (e: any) {
            logger.warn(LogCode.API_FETCH_FAILED, `[OGPService] Microlink fallback failed`, {
                url,
                error: e.message,
                role: LogRole.METRIC
            });
        }

        // 3. Last resort: Puppeteer
        try {
            const browser = await getBrowser();
            const page = await browser.newPage();
            try {
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(r => setTimeout(r, 1000));

                const metadata = await page.evaluate((targetUrl: string) => {
                    const getTag = (sel: string) => document.querySelector(sel)?.getAttribute('content');
                    return {
                        url: targetUrl,
                        title: getTag('meta[property="og:title"]') || getTag('meta[name="twitter:title"]') || document.title,
                        description: getTag('meta[property="og:description"]') || getTag('meta[name="twitter:description"]') || getTag('meta[name="description"]'),
                        image: getTag('meta[property="og:image"]') || getTag('meta[name="twitter:image"]'),
                        siteName: getTag('meta[property="og:site_name"]') || getTag('meta[name="twitter:site"]')
                    };
                }, url);

                if (metadata.title || metadata.image) {
                    const sanitized = sanitizeMetadata(metadata, origin);
                    await redis.set(`ogp:${url}`, JSON.stringify(sanitized), 7 * 24 * 60 * 60);
                    return sanitized;
                }
            } finally {
                await page.close();
            }
        } catch (e: any) {
            logger.error(LogCode.API_FETCH_FAILED, `[OGPService] Puppeteer failed`, {
                url,
                error: e.message,
                role: LogRole.METRIC
            });
        }

        return null;
    }
};
