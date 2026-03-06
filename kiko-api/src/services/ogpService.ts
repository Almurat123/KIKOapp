import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import redis from '../cache/cacheClient.js';
import { logger } from '../utils/logger.js';
import { LogCode, LogRole } from '../config/logRegistry.js';

let browserInstance: any = null;
let requestCount = 0;

const MAX_REQUESTS_PER_BROWSER = 100;
const PREVIEW_CACHE_TTL_SECONDS = 6 * 60 * 60;
const PREVIEW_NEGATIVE_CACHE_TTL_SECONDS = 15 * 60;
const OGP_HTML_TIMEOUT_MS = 5000;
const OGP_MICROLINK_TIMEOUT_MS = 5000;
const OGP_PUPPETEER_TIMEOUT_MS = 9000;
const inFlightFetches = new Map<string, Promise<OGPPreview>>();

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

const PUPPETEER_FALLBACK_HOSTS = new Set([
    'app.tomorrow.fun',
]);

const GENERIC_SITE_NAMES = new Set([
    'farcaster',
    'x',
    'twitter',
]);

export type PreviewKind = 'rich' | 'compact' | 'miniapp' | 'quote' | 'unavailable';
export type PreviewStatus = 'ready' | 'degraded' | 'unavailable';
export type PreviewSource = 'html' | 'fc-meta' | 'oembed' | 'microlink' | 'puppeteer' | 'none';
export type PreviewTarget = 'miniapp' | 'x' | 'media' | 'web';

export interface OGPPreview {
    kind: PreviewKind;
    status: PreviewStatus;
    source: PreviewSource;
    destinationUrl: string;
    canonicalUrl: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    type?: string;
    video?: string;
    originalImage?: string;
    url?: string;
}

interface RawMetadata {
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    url?: string;
    type?: string;
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

interface HtmlSnapshot {
    metadata: RawMetadata;
    miniApp?: RawMetadata | null;
    oEmbedUrl?: string;
}

async function getBrowser() {
    if (browserInstance && requestCount >= MAX_REQUESTS_PER_BROWSER) {
        logger.info(LogCode.SYS_INFO, '[OGPService] Browser reached limit. Restarting...', {
            requestCount,
            role: LogRole.EVENT,
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
                '--memory-pressure-off',
            ],
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
    if (!browserInstance) return;

    try {
        await browserInstance.close();
    } catch (e: any) {
        logger.error(LogCode.SYS_ERROR, '[OGPService] Error closing browser', {
            error: e.message,
            role: LogRole.EVENT,
        });
    }

    browserInstance = null;
    requestCount = 0;
}

process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);
(puppeteer as any).use(StealthPlugin());

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
    return `ogp:v3:${normalizeUrl(url)}`;
}

function clonePreview<T extends OGPPreview>(preview: T): T {
    return { ...preview };
}

function compactText(value?: string, max = 280): string | undefined {
    if (!value) return undefined;
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return undefined;
    return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function absolutizeUrl(maybeUrl: string | undefined, baseUrl: string): string | undefined {
    if (!maybeUrl) return undefined;
    try {
        return new URL(maybeUrl, baseUrl).toString();
    } catch {
        return maybeUrl;
    }
}

function normalizePreviewImageUrl(imageUrl?: string): { image?: string; originalImage?: string } {
    if (!imageUrl || imageUrl.startsWith('data:')) {
        return { image: imageUrl, originalImage: imageUrl };
    }

    const originalImage = imageUrl;
    const proxyBaseUrl = (process.env.API_URL || '').replace(/\/$/, '');

    try {
        const host = new URL(imageUrl).hostname.toLowerCase();
        if (DIRECT_IMAGE_HOSTS.has(host)) {
            return { image: imageUrl, originalImage };
        }
    } catch {
        return { image: undefined, originalImage: undefined };
    }

    const encodedUrl = encodeURIComponent(imageUrl);
    const path = `/api/images/token?url=${encodedUrl}&mode=preview`;
    return {
        image: proxyBaseUrl ? `${proxyBaseUrl}${path}` : path,
        originalImage,
    };
}

function isFarcasterMiniAppUrl(input: string): boolean {
    try {
        const parsed = new URL(input);
        return parsed.hostname.toLowerCase() === 'farcaster.xyz' && parsed.pathname.startsWith('/miniapps/');
    } catch {
        return false;
    }
}

function isXUrl(input: string): boolean {
    try {
        const host = new URL(input).hostname.toLowerCase();
        return host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com');
    } catch {
        return false;
    }
}

function parseDirectMedia(input: string): { type: 'image' | 'video'; url: string } | null {
    const match = input.match(/\.(m3u8|mp4|mov|webm|jpg|jpeg|png|gif|webp|avif)(\?|$)/i);
    if (!match) return null;
    const ext = match[1].toLowerCase();
    const isVideo = ['m3u8', 'mp4', 'mov', 'webm'].includes(ext);
    return {
        type: isVideo ? 'video' : 'image',
        url: input,
    };
}

export function classifyPreviewTarget(input: string): PreviewTarget {
    if (isFarcasterMiniAppUrl(input)) return 'miniapp';
    if (isXUrl(input)) return 'x';
    if (parseDirectMedia(input)) return 'media';
    return 'web';
}

function shouldUsePuppeteer(input: string): boolean {
    try {
        const host = new URL(input).hostname.toLowerCase();
        return PUPPETEER_FALLBACK_HOSTS.has(host);
    } catch {
        return false;
    }
}

function isGenericPlaceholderImage(imageUrl: string | undefined, sourceUrl: string): boolean {
    if (!imageUrl) return false;

    const sourceIsX = /(^https?:\/\/)?([^/]+\.)?(x\.com|twitter\.com|fxtwitter\.com|vxtwitter\.com)\//i.test(sourceUrl);
    const isGenericXPlaceholder = sourceIsX && (
        imageUrl.includes('twitter_logo') ||
        imageUrl.includes('abs.twimg.com/rweb/ssr/default/v2/og/image.png') ||
        imageUrl.includes('twitter-card')
    );

    const isGenericFramePlaceholder = (
        imageUrl.includes('farcaster.xyz/miniapps') && imageUrl.includes('default')
    ) || imageUrl.endsWith('.svg');

    return isGenericXPlaceholder || isGenericFramePlaceholder;
}

export function isGenericShellPreview(raw: RawMetadata, fallbackSiteName?: string): boolean {
    const normalizedTitle = (raw.title || '').trim().toLowerCase();
    const normalizedSiteName = (raw.siteName || fallbackSiteName || '').trim().toLowerCase();
    const hasOnlyGenericBrand = (!raw.description && !raw.image) && (
        GENERIC_SITE_NAMES.has(normalizedTitle) ||
        GENERIC_SITE_NAMES.has(normalizedSiteName)
    );
    return hasOnlyGenericBrand;
}

export function buildPreview(params: {
    canonicalUrl: string;
    destinationUrl?: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    video?: string;
    type?: string;
    kind?: PreviewKind;
    status?: PreviewStatus;
    source: PreviewSource;
}): OGPPreview {
    const destinationUrl = params.destinationUrl || params.canonicalUrl;
    const title = compactText(params.title, 180);
    const description = compactText(params.description, 260);
    const siteName = compactText(params.siteName, 80);

    let image = params.image;
    if (image && isGenericPlaceholderImage(image, destinationUrl)) {
        image = undefined;
    }

    const normalizedImage = normalizePreviewImageUrl(image);
    const hasImage = Boolean(normalizedImage.image);
    const hasCoreText = Boolean(title || description || siteName);

    let kind = params.kind;
    if (!kind) {
        if (params.type === 'miniapp') {
            kind = 'miniapp';
        } else if (hasImage && hasCoreText) {
            kind = 'rich';
        } else if (hasCoreText) {
            kind = 'compact';
        } else {
            kind = 'unavailable';
        }
    }

    let status = params.status;
    if (!status) {
        status = kind === 'unavailable' ? 'unavailable' : hasImage || params.video ? 'ready' : 'degraded';
    }

    return {
        kind,
        status,
        source: params.source,
        canonicalUrl: params.canonicalUrl,
        destinationUrl,
        title,
        description,
        image: normalizedImage.image,
        originalImage: normalizedImage.originalImage,
        siteName,
        type: params.type,
        video: params.video,
        url: destinationUrl,
    };
}

export function buildUnavailablePreview(url: string): OGPPreview {
    return {
        kind: 'unavailable',
        status: 'unavailable',
        source: 'none',
        canonicalUrl: url,
        destinationUrl: url,
        url,
    };
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
            if (parsed && typeof parsed === 'object') {
                return parsed as MiniAppEmbed;
            }
        } catch {
            // try next candidate
        }
    }

    return null;
}

function extractMiniAppMetadataFromCheerio($: cheerio.CheerioAPI, url: string): RawMetadata | null {
    const miniRaw = $('meta[name="fc:miniapp"]').attr('content')
        || $('meta[property="fc:miniapp"]').attr('content')
        || $('meta[name="fc:frame"]').attr('content')
        || $('meta[property="fc:frame"]').attr('content');

    const mini = tryParseMiniAppEmbed(miniRaw);
    const frameImage = $('meta[name="fc:frame:image"]').attr('content')
        || $('meta[property="fc:frame:image"]').attr('content');
    const legacyButton = $('meta[name="fc:frame:button:1"]').attr('content')
        || $('meta[property="fc:frame:button:1"]').attr('content');

    const isFrameApp = Boolean(frameImage || legacyButton || miniRaw);
    if (!mini && !isFrameApp) return null;

    const actionUrl = mini?.button?.action?.url || url;
    const actionType = mini?.button?.action?.type || (frameImage ? 'frame' : 'miniapp');
    const title = mini?.name || mini?.button?.title || mini?.button?.action?.name || legacyButton || 'Farcaster Mini App';
    const image = mini?.imageUrl || frameImage || mini?.splashImageUrl;

    return {
        url: actionUrl,
        title,
        description: `Open this Farcaster ${actionType === 'frame' ? 'Frame' : 'Mini App'}`,
        image,
        siteName: 'Farcaster Mini App',
        type: 'miniapp',
    };
}

function extractHtmlSnapshot(html: string, requestedUrl: string, baseUrl: string): HtmlSnapshot {
    const $ = cheerio.load(html);

    const getMeta = (prop: string) =>
        $(`meta[property="${prop}"]`).attr('content') ||
        $(`meta[name="${prop}"]`).attr('content') ||
        $(`meta[property="twitter:${prop.replace('og:', '')}"]`).attr('content') ||
        $(`meta[name="twitter:${prop.replace('og:', '')}"]`).attr('content');

    const metadata: RawMetadata = {
        url: requestedUrl,
        title: getMeta('og:title') || $('meta[name="twitter:title"]').attr('content') || $('title').text(),
        description: getMeta('og:description') || $('meta[name="twitter:description"]').attr('content') || getMeta('description'),
        image: getMeta('og:image') || $('meta[name="twitter:image"]').attr('content'),
        siteName: getMeta('og:site_name') || $('meta[name="twitter:site"]').attr('content'),
    };

    metadata.url = absolutizeUrl(metadata.url, baseUrl) || requestedUrl;
    metadata.image = absolutizeUrl(metadata.image, baseUrl);
    const miniApp = extractMiniAppMetadataFromCheerio($, requestedUrl);

    if (miniApp) {
        miniApp.url = absolutizeUrl(miniApp.url, baseUrl) || requestedUrl;
        miniApp.image = absolutizeUrl(miniApp.image, baseUrl);
    }

    const oEmbedUrl = $('link[type="application/json+oembed"]').attr('href')
        || $('link[rel="alternate"][type="application/json+oembed"]').attr('href');

    return {
        metadata,
        miniApp,
        oEmbedUrl: absolutizeUrl(oEmbedUrl, baseUrl),
    };
}

async function fetchHtmlSnapshot(url: string, fetchUrl: string, htmlUserAgent: string): Promise<HtmlSnapshot | null> {
    const res = await fetch(fetchUrl, {
        headers: {
            'User-Agent': htmlUserAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(OGP_HTML_TIMEOUT_MS),
    });

    if (!res.ok) return null;
    const html = await res.text();
    return extractHtmlSnapshot(html, url, fetchUrl);
}

async function fetchOEmbedPreview(canonicalUrl: string, oEmbedUrl: string): Promise<OGPPreview | null> {
    try {
        const response = await fetch(oEmbedUrl, { signal: AbortSignal.timeout(3000) });
        if (!response.ok) return null;

        const data: any = await response.json();
        const preview = buildPreview({
            canonicalUrl,
            destinationUrl: canonicalUrl,
            title: data?.title || data?.author_name || 'Embedded Content',
            description: data?.author_name || data?.provider_name,
            image: data?.thumbnail_url,
            siteName: data?.provider_name,
            source: 'oembed',
        });

        return preview.kind === 'unavailable' ? null : preview;
    } catch {
        return null;
    }
}

async function fetchMicrolinkPreview(canonicalUrl: string): Promise<OGPPreview | null> {
    try {
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(canonicalUrl)}`, {
            signal: AbortSignal.timeout(OGP_MICROLINK_TIMEOUT_MS),
        });
        if (!response.ok) return null;

        const json: any = await response.json();
        if (json.status !== 'success' || !json.data) return null;

        const preview = buildPreview({
            canonicalUrl,
            destinationUrl: canonicalUrl,
            title: json.data.title,
            description: json.data.description,
            image: json.data.image?.url,
            siteName: json.data.publisher,
            source: 'microlink',
        });

        return preview.kind === 'unavailable' ? null : preview;
    } catch {
        return null;
    }
}

async function fetchPuppeteerPreview(canonicalUrl: string): Promise<OGPPreview | null> {
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

            await page.goto(canonicalUrl, { waitUntil: 'domcontentloaded', timeout: OGP_PUPPETEER_TIMEOUT_MS });
            await new Promise((resolve) => setTimeout(resolve, 500));

            const metadata = await page.evaluate((targetUrl: string) => {
                const getTag = (sel: string) => document.querySelector(sel)?.getAttribute('content') || undefined;
                return {
                    url: targetUrl,
                    title: getTag('meta[property="og:title"]') || getTag('meta[name="twitter:title"]') || document.title,
                    description: getTag('meta[property="og:description"]') || getTag('meta[name="twitter:description"]') || getTag('meta[name="description"]'),
                    image: getTag('meta[property="og:image"]') || getTag('meta[name="twitter:image"]'),
                    siteName: getTag('meta[property="og:site_name"]') || getTag('meta[name="twitter:site"]'),
                };
            }, canonicalUrl);

            const preview = buildPreview({
                canonicalUrl,
                destinationUrl: absolutizeUrl(metadata.url, canonicalUrl) || canonicalUrl,
                title: metadata.title,
                description: metadata.description,
                image: absolutizeUrl(metadata.image, canonicalUrl),
                siteName: metadata.siteName,
                source: 'puppeteer',
            });

            return preview.kind === 'unavailable' ? null : preview;
        } finally {
            await page.close();
        }
    } catch (e: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[OGPService] Puppeteer failed', {
            url: canonicalUrl,
            error: e.message,
            role: LogRole.METRIC,
        });
        return null;
    }
}

async function resolveMiniAppPreview(canonicalUrl: string, htmlSnapshot: HtmlSnapshot | null): Promise<OGPPreview> {
    if (htmlSnapshot?.miniApp) {
        const miniApp = htmlSnapshot.miniApp;
        return buildPreview({
            canonicalUrl,
            destinationUrl: miniApp.url || canonicalUrl,
            title: miniApp.title,
            description: miniApp.description,
            image: miniApp.image,
            siteName: miniApp.siteName || 'Farcaster Mini App',
            type: 'miniapp',
            kind: 'miniapp',
            status: miniApp.image ? 'ready' : 'degraded',
            source: 'fc-meta',
        });
    }

    if (htmlSnapshot?.metadata && !isGenericShellPreview(htmlSnapshot.metadata, 'Farcaster Mini App')) {
        return buildPreview({
            canonicalUrl,
            destinationUrl: htmlSnapshot.metadata.url || canonicalUrl,
            title: htmlSnapshot.metadata.title || 'Open Mini App',
            description: htmlSnapshot.metadata.description || 'Open this Farcaster Mini App in Farcaster.',
            image: undefined,
            siteName: 'Farcaster Mini App',
            type: 'miniapp',
            kind: 'miniapp',
            status: 'degraded',
            source: 'html',
        });
    }

    return buildPreview({
        canonicalUrl,
        destinationUrl: canonicalUrl,
        title: 'Open Mini App',
        description: 'Open this Farcaster Mini App in Farcaster.',
        siteName: 'Farcaster Mini App',
        type: 'miniapp',
        kind: 'miniapp',
        status: 'degraded',
        source: 'none',
    });
}

async function resolveXPreview(canonicalUrl: string, htmlSnapshot: HtmlSnapshot | null): Promise<OGPPreview> {
    if (htmlSnapshot?.metadata && !isGenericShellPreview(htmlSnapshot.metadata, 'X')) {
        const preview = buildPreview({
            canonicalUrl,
            destinationUrl: htmlSnapshot.metadata.url || canonicalUrl,
            title: htmlSnapshot.metadata.title || 'View post on X',
            description: htmlSnapshot.metadata.description,
            image: htmlSnapshot.metadata.image,
            siteName: htmlSnapshot.metadata.siteName || 'X',
            source: 'html',
        });
        return preview.kind === 'unavailable'
            ? buildPreview({
                canonicalUrl,
                destinationUrl: canonicalUrl,
                title: 'View post on X',
                siteName: 'X',
                kind: 'compact',
                status: 'degraded',
                source: 'none',
            })
            : preview;
    }

    return buildPreview({
        canonicalUrl,
        destinationUrl: canonicalUrl,
        title: 'View post on X',
        siteName: 'X',
        kind: 'compact',
        status: 'degraded',
        source: 'none',
    });
}

async function resolveWebPreview(canonicalUrl: string, htmlSnapshot: HtmlSnapshot | null): Promise<OGPPreview> {
    if (htmlSnapshot?.metadata && !isGenericShellPreview(htmlSnapshot.metadata)) {
        const preview = buildPreview({
            canonicalUrl,
            destinationUrl: htmlSnapshot.metadata.url || canonicalUrl,
            title: htmlSnapshot.metadata.title,
            description: htmlSnapshot.metadata.description,
            image: htmlSnapshot.metadata.image,
            siteName: htmlSnapshot.metadata.siteName,
            source: 'html',
        });

        if (preview.kind !== 'unavailable') {
            return preview;
        }
    }

    if (htmlSnapshot?.oEmbedUrl) {
        const oEmbedPreview = await fetchOEmbedPreview(canonicalUrl, htmlSnapshot.oEmbedUrl);
        if (oEmbedPreview) return oEmbedPreview;
    }

    const microlinkPreview = await fetchMicrolinkPreview(canonicalUrl);
    if (microlinkPreview) return microlinkPreview;

    if (shouldUsePuppeteer(canonicalUrl)) {
        const puppeteerPreview = await fetchPuppeteerPreview(canonicalUrl);
        if (puppeteerPreview) return puppeteerPreview;
    }

    if (htmlSnapshot?.metadata && (htmlSnapshot.metadata.title || htmlSnapshot.metadata.siteName)) {
        return buildPreview({
            canonicalUrl,
            destinationUrl: htmlSnapshot.metadata.url || canonicalUrl,
            title: htmlSnapshot.metadata.title,
            description: htmlSnapshot.metadata.description,
            siteName: htmlSnapshot.metadata.siteName,
            kind: 'compact',
            status: 'degraded',
            source: 'html',
        });
    }

    return buildUnavailablePreview(canonicalUrl);
}

async function resolvePreview(canonicalUrl: string): Promise<OGPPreview> {
    const target = classifyPreviewTarget(canonicalUrl);
    const fetchUrl = isXUrl(canonicalUrl)
        ? canonicalUrl.replace(/(twitter\.com|x\.com)/, 'fxtwitter.com')
        : canonicalUrl;
    const htmlUserAgent = fetchUrl.includes('fxtwitter.com')
        ? 'Discordbot/2.0'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    if (target === 'media') {
        const media = parseDirectMedia(canonicalUrl);
        if (!media) return buildUnavailablePreview(canonicalUrl);

        return buildPreview({
            canonicalUrl,
            destinationUrl: canonicalUrl,
            title: media.type === 'video' ? 'Video Content' : 'Image Content',
            siteName: media.type === 'video' ? 'Media Stream' : 'Direct Image',
            image: media.type === 'image' ? canonicalUrl : undefined,
            video: media.type === 'video' ? canonicalUrl : undefined,
            type: media.type,
            kind: 'rich',
            status: 'ready',
            source: 'none',
        });
    }

    let htmlSnapshot: HtmlSnapshot | null = null;
    try {
        htmlSnapshot = await fetchHtmlSnapshot(canonicalUrl, fetchUrl, htmlUserAgent);
    } catch (e: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[OGPService] Simple fetch failed', {
            url: canonicalUrl,
            error: e.message,
            role: LogRole.METRIC,
        });
    }

    if (target === 'miniapp') {
        return resolveMiniAppPreview(canonicalUrl, htmlSnapshot);
    }

    if (target === 'x') {
        return resolveXPreview(canonicalUrl, htmlSnapshot);
    }

    return resolveWebPreview(canonicalUrl, htmlSnapshot);
}

export const ogpService = {
    async fetchOGP(url: string): Promise<OGPPreview> {
        const canonicalUrl = normalizeUrl(url);
        const cacheKey = buildCacheKey(canonicalUrl);

        const existingRequest = inFlightFetches.get(cacheKey);
        if (existingRequest) {
            return existingRequest;
        }

        const task = (async () => {
            const startedAt = Date.now();

            const cached = await redis.get(cacheKey);
            if (cached) {
                try {
                    return clonePreview(JSON.parse(cached) as OGPPreview);
                } catch {
                    // fall through
                }
            }

            const preview = await resolvePreview(canonicalUrl);
            const ttl = preview.status === 'unavailable'
                ? PREVIEW_NEGATIVE_CACHE_TTL_SECONDS
                : PREVIEW_CACHE_TTL_SECONDS;

            await redis.set(cacheKey, JSON.stringify(preview), ttl);
            logger.info(LogCode.API_FETCH_SUCCESS, '[OGPService] Preview resolved', {
                url: canonicalUrl,
                kind: preview.kind,
                status: preview.status,
                source: preview.source,
                durationMs: Date.now() - startedAt,
                role: LogRole.METRIC,
            });

            return preview;
        })();

        inFlightFetches.set(cacheKey, task);
        try {
            return await task;
        } finally {
            inFlightFetches.delete(cacheKey);
        }
    },
};
