
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import redis from '../cache/cacheClient.js';
import { logger } from '../utils/logger.js';
import { LogCode, LogRole } from '../config/logRegistry.js';

let browserInstance: any = null;
let requestCount = 0;
const MAX_REQUESTS_PER_BROWSER = 100;
const OGP_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const OGP_NEGATIVE_CACHE_TTL_SECONDS = 10 * 60;
const OGP_HTML_TIMEOUT_MS = 5000;
const OGP_MICROLINK_TIMEOUT_MS = 5000;
const OGP_PUPPETEER_TIMEOUT_MS = 9000;
const inFlightFetches = new Map<string, Promise<OGPMetadata | null>>();

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

interface MiniAppAction {
    type?: string;
    url?: string;
    name?: string;
    splashImageUrl?: string;
    splashBackgroundColor?: string;
}

interface MiniAppEmbed {
    name?: string;
    version?: string;
    imageUrl?: string;
    splashImageUrl?: string;
    button?: {
        title?: string;
        action?: MiniAppAction;
    };
}

const DIRECT_IMAGE_HOSTS = new Set([
    'cdn.dexscreener.com',
    'raw.githubusercontent.com',
    'assets.coingecko.com',
    'coin-images.coingecko.com',
    'wrpcd.net',
    'imagedelivery.net',
    'vxtwitter.com',
    'pbs.twimg.com',
    'i.imgur.com',
]);

function shouldProxyImage(imageUrl: string): boolean {
    try {
        const host = new URL(imageUrl).hostname.toLowerCase();
        return !DIRECT_IMAGE_HOSTS.has(host);
    } catch {
        return true;
    }
}

/**
 * Sanitizes and prepares metadata for the frontend
 */
function sanitizeMetadata(metadata: OGPMetadata, origin?: string): OGPMetadata {
    const PROXY_BASE_URL = process.env.API_URL || origin || '';

    // [FIX]: Capture original image before any processing
    if (metadata.image && !metadata.originalImage) {
        metadata.originalImage = metadata.image;
    }

    // 1. Skip generic X/Twitter placeholders and generic missing frame images
    const sourceUrl = metadata.url || '';
    const sourceIsX = /(^https?:\/\/)?([^/]+\.)?(x\.com|twitter\.com|fxtwitter\.com|vxtwitter\.com)\//i.test(sourceUrl);

    if (metadata.image) {
        const isGenericXPlaceholder = sourceIsX && (
            metadata.image.includes('twitter_logo') ||
            metadata.image.includes('abs.twimg.com/rweb/ssr/default/v2/og/image.png') ||
            metadata.image.includes('twitter-card')
        );

        const isGenericFramePlaceholder = (
            metadata.image.includes('farcaster.xyz/miniapps') && metadata.image.includes('default') ||
            metadata.image.endsWith('.svg') // Many generic grey boxes are actually fast-loading SVG frames
        )

        // Prevent rendering grey generic placeholder boxes
        if (isGenericXPlaceholder || isGenericFramePlaceholder) {
            metadata.image = undefined;
        }
    }

    // 2. Proxify image if it exists
    if (metadata.image && !metadata.image.startsWith('data:')) {
        if (!shouldProxyImage(metadata.image)) {
            return metadata;
        }
        // Already proxied absolute URL: normalize to current API_URL if configured.
        const proxiedAbsoluteMatch = metadata.image.match(/^https?:\/\/[^/]+(\/api\/images\/token\?url=.*)$/i);
        if (proxiedAbsoluteMatch) {
            if (PROXY_BASE_URL) {
                metadata.image = `${PROXY_BASE_URL}${proxiedAbsoluteMatch[1]}`;
            }
            return metadata;
        }
        // Already proxied relative URL: only absolutize if possible
        if (metadata.image.startsWith('/api/images/token?url=')) {
            metadata.image = PROXY_BASE_URL
                ? `${PROXY_BASE_URL}${metadata.image}`
                : metadata.image;
            return metadata;
        }

        const encodedUrl = encodeURIComponent(metadata.image);
        metadata.image = PROXY_BASE_URL
            ? `${PROXY_BASE_URL}/api/images/token?url=${encodedUrl}`
            : `/api/images/token?url=${encodedUrl}`;
    }

    return metadata;
}

function cloneMetadata<T extends OGPMetadata>(metadata: T): T {
    return { ...metadata };
}

function normalizeUrl(input: string): string {
    try {
        const parsed = new URL(input.trim());
        parsed.hash = '';
        return parsed.toString();
    } catch {
        return input.trim();
    }
}

function buildCacheKey(url: string): string {
    return `ogp:v2:${normalizeUrl(url)}`;
}

function absolutizeUrl(maybeUrl: string | undefined, baseUrl: string): string | undefined {
    if (!maybeUrl) return maybeUrl;
    try {
        return new URL(maybeUrl, baseUrl).toString();
    } catch {
        return maybeUrl;
    }
}

function tryParseMiniAppEmbed(raw?: string): MiniAppEmbed | null {
    if (!raw || typeof raw !== 'string') return null;
    const candidates = [
        raw.trim(),
        raw.replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, '&').trim(),
        raw.replace(/\\"/g, '"').trim(),
    ];

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') return parsed as MiniAppEmbed;
        } catch {
            // try next candidate
        }
    }
    return null;
}

function extractMiniAppMetadataFromCheerio($: cheerio.CheerioAPI, url: string): OGPMetadata | null {
    const miniRaw = $('meta[name="fc:miniapp"]').attr('content')
        || $('meta[property="fc:miniapp"]').attr('content')
        || $('meta[name="fc:frame"]').attr('content')
        || $('meta[property="fc:frame"]').attr('content');

    const mini = tryParseMiniAppEmbed(miniRaw);

    // Exhaustive search for any valid Farcaster/OG image representation
    const frameImage = $('meta[name="fc:frame:image"]').attr('content')
        || $('meta[property="fc:frame:image"]').attr('content');

    const splashImage = mini?.splashImageUrl;

    const ogImage = $('meta[property="og:image"]').attr('content')
        || $('meta[name="twitter:image"]').attr('content');

    const legacyButton = $('meta[name="fc:frame:button:1"]').attr('content')
        || $('meta[property="fc:frame:button:1"]').attr('content');

    const isFrameApp = !!frameImage || !!legacyButton || !!miniRaw;

    if (!mini && !isFrameApp) return null;

    // Fallback chain for the best visual representation of the mini app
    const image = mini?.imageUrl || frameImage || splashImage || ogImage;

    // Fallback chain for titles
    const title = mini?.name || mini?.button?.title || mini?.button?.action?.name || legacyButton || $('title').text() || 'Farcaster Mini App';

    const actionUrl = mini?.button?.action?.url || url;
    const actionType = mini?.button?.action?.type || (frameImage ? 'frame' : 'miniapp');

    return {
        url: actionUrl,
        title,
        description: `Farcaster ${actionType === 'frame' ? 'Frame' : 'Mini App'}`,
        image,
        siteName: title !== 'Farcaster Mini App' ? title : 'Farcaster Mini App',
        type: 'miniapp',
    };
}

export const ogpService = {
    /**
     * Fetch OGP metadata for a given URL
     * Tries simple fetch first, then fallback services
     */
    async fetchOGP(url: string, origin?: string): Promise<OGPMetadata | null> {
        const normalizedUrl = normalizeUrl(url);
        const cacheKey = buildCacheKey(normalizedUrl);

        const existingRequest = inFlightFetches.get(cacheKey);
        if (existingRequest) {
            return existingRequest;
        }

        const task = fetchOGPInternal(normalizedUrl, origin, cacheKey);
        inFlightFetches.set(cacheKey, task);
        try {
            return await task;
        } finally {
            inFlightFetches.delete(cacheKey);
        }
    },
};

async function fetchOGPInternal(url: string, origin: string | undefined, cacheKey: string): Promise<OGPMetadata | null> {
    const startedAt = Date.now();

    // [FIX]: Optimize X/Twitter fetching via FxTwitter metadata bridge
    let fetchUrl = url;
    if (url.includes('twitter.com') || url.includes('x.com')) {
        fetchUrl = url.replace(/(twitter\.com|x\.com)/, 'fxtwitter.com');
    }
    const isFxTwitter = fetchUrl.includes('fxtwitter.com');
    const htmlUserAgent = isFxTwitter
        ? 'Discordbot/2.0'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const cached = await redis.get(cacheKey) || await redis.get(`ogp:${url}`);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            // Negative cache marker
            if (parsed && parsed.__empty === true) return null;
            return sanitizeMetadata(cloneMetadata(parsed), origin);
        } catch (e) { }
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
        await redis.set(cacheKey, JSON.stringify(metadata), OGP_CACHE_TTL_SECONDS);
        return sanitizeMetadata(cloneMetadata(metadata), origin);
    }

    // 1. Try simple fetch with cheerio (fast)
    try {
        const res = await fetch(fetchUrl, {
            headers: {
                'User-Agent': htmlUserAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(OGP_HTML_TIMEOUT_MS)
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

            const miniAppMeta = extractMiniAppMetadataFromCheerio($, url);
            const resolved: OGPMetadata = {
                ...metadata,
                ...(miniAppMeta || {}),
                // If mini app tags exist, prioritize mini app payload over generic page tags.
                title: miniAppMeta?.title || metadata.title,
                description: miniAppMeta?.description || metadata.description,
                image: miniAppMeta?.image || metadata.image,
                siteName: miniAppMeta?.siteName || metadata.siteName,
                type: miniAppMeta?.type || metadata.type,
                url: miniAppMeta?.url || metadata.url || url,
            };

            resolved.image = absolutizeUrl(resolved.image, fetchUrl);
            resolved.url = absolutizeUrl(resolved.url, fetchUrl) || url;

            if (resolved.title || resolved.image) {
                await redis.set(cacheKey, JSON.stringify(resolved), OGP_CACHE_TTL_SECONDS);
                return sanitizeMetadata(cloneMetadata(resolved), origin);
            }

            // Fallback for pages that expose only oEmbed (common in app-link hubs).
            const oEmbedUrl = $('link[type="application/json+oembed"]').attr('href')
                || $('link[rel="alternate"][type="application/json+oembed"]').attr('href');
            if (oEmbedUrl) {
                try {
                    const absoluteOEmbed = absolutizeUrl(oEmbedUrl, fetchUrl) || oEmbedUrl;
                    const oRes = await fetch(absoluteOEmbed, { signal: AbortSignal.timeout(3000) });
                    if (oRes.ok) {
                        const oJson: any = await oRes.json();
                        const oMeta: OGPMetadata = {
                            url,
                            title: oJson?.title || oJson?.author_name || 'Embedded Content',
                            description: oJson?.author_name || oJson?.provider_name,
                            image: absolutizeUrl(oJson?.thumbnail_url, fetchUrl),
                            siteName: oJson?.provider_name,
                        };
                        if (oMeta.title || oMeta.image) {
                            await redis.set(cacheKey, JSON.stringify(oMeta), OGP_CACHE_TTL_SECONDS);
                            return sanitizeMetadata(cloneMetadata(oMeta), origin);
                        }
                    }
                } catch {
                    // ignore oEmbed fallback errors
                }
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
            signal: AbortSignal.timeout(OGP_MICROLINK_TIMEOUT_MS)
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
                    await redis.set(cacheKey, JSON.stringify(metadata), OGP_CACHE_TTL_SECONDS);
                    return sanitizeMetadata(cloneMetadata(metadata), origin);
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
            await page.setRequestInterception(true);
            page.on('request', (req: any) => {
                const type = req.resourceType();
                if (type === 'image' || type === 'font' || type === 'media') {
                    req.abort();
                } else {
                    req.continue();
                }
            });
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: OGP_PUPPETEER_TIMEOUT_MS });
            await new Promise(r => setTimeout(r, 500));

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
                metadata.image = absolutizeUrl(metadata.image, url);
                metadata.url = absolutizeUrl(metadata.url, url);
                await redis.set(cacheKey, JSON.stringify(metadata), OGP_CACHE_TTL_SECONDS);
                return sanitizeMetadata(cloneMetadata(metadata), origin);
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

    // Negative cache to avoid repeated expensive retries for known-bad URLs.
    await redis.set(cacheKey, JSON.stringify({ __empty: true }), OGP_NEGATIVE_CACHE_TTL_SECONDS);
    logger.info(LogCode.API_FETCH_FAILED, `[OGPService] No metadata resolved`, {
        url,
        durationMs: Date.now() - startedAt,
        role: LogRole.METRIC
    });
    return null;
}
