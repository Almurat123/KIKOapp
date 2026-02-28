import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

export type GmgnChain = 'base' | 'eth' | 'bsc' | 'sol';
export type GmgnWindow = '1d' | '7d' | '30d';

export type GmgnAttemptMetric = {
    route: 'http' | 'browser';
    ok: boolean;
    latencyMs: number;
    statusCode?: number;
    reasonCode?: string;
};

export type GmgnRankFetchResult = {
    url: string;
    rows: Record<string, unknown>[];
    route: 'http' | 'browser';
    fallbackUsed: boolean;
    latencyMs: number;
    attempts: GmgnAttemptMetric[];
};

type FetchArgs = {
    chain: GmgnChain;
    window: GmgnWindow;
    tag: string;
    orderby: string;
    direction: 'asc' | 'desc';
    timeoutMs: number;
    cookie?: string;
};

type RawFetchResult = {
    statusCode?: number;
    text: string;
};

const DEFAULT_GMGN_QUERY_PARAMS: Record<string, string> = {
    from_app: 'gmgn',
    app_lang: 'zh-CN',
    os: 'web',
    worker: '0',
    tz_name: 'Asia/Shanghai',
    tz_offset: '28800',
};

const GMGN_BROWSER_MAX_REQUESTS = 25;
const GMGN_BROWSER_WAIT_MS = 2500;

let browserInstance: any = null;
let browserRequestCount = 0;
let stealthReady = false;

function ensureStealth() {
    if (!stealthReady) {
        (puppeteer as any).use(StealthPlugin());
        stealthReady = true;
    }
}

async function closeBrowser() {
    if (!browserInstance) return;
    try {
        await browserInstance.close();
    } catch {
        // Best-effort cleanup only.
    } finally {
        browserInstance = null;
        browserRequestCount = 0;
    }
}

async function getBrowser() {
    ensureStealth();
    if (browserInstance && browserRequestCount >= GMGN_BROWSER_MAX_REQUESTS) {
        await closeBrowser();
    }

    if (!browserInstance) {
        browserInstance = await (puppeteer as any).launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1440,900'
            ]
        });
        browserInstance.on('disconnected', () => {
            browserInstance = null;
            browserRequestCount = 0;
        });
    }

    browserRequestCount += 1;
    return browserInstance;
}

process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);

function buildQueryUrl(args: FetchArgs): string {
    const qp = new URLSearchParams({
        tag: args.tag,
        orderby: args.orderby,
        direction: args.direction,
        ...DEFAULT_GMGN_QUERY_PARAMS
    });
    return `https://gmgn.ai/defi/quotation/v1/rank/${args.chain}/wallets/${args.window}?${qp.toString()}`;
}

function classifyFetchError(error: unknown): string {
    const message = String((error as any)?.message || error || 'gmgn_fetch_failed');
    if (message.includes('AbortError')) return 'gmgn_timeout';
    return message;
}

function parseRankRows(text: string): Record<string, unknown>[] {
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        throw new Error('gmgn_html_blocked');
    }
    let json: any;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error('gmgn_invalid_json');
    }
    return Array.isArray(json?.data?.rank) ? json.data.rank : [];
}

async function fetchViaHttp(url: string, args: FetchArgs): Promise<RawFetchResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), args.timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                accept: 'application/json, text/plain, */*',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                referer: `https://gmgn.ai/trade?chain=${args.chain}&tab=${encodeURIComponent(args.tag)}`,
                ...(args.cookie ? { cookie: args.cookie } : {})
            },
            signal: controller.signal
        });
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`gmgn_http_${res.status}`);
        }
        return { statusCode: res.status, text };
    } finally {
        clearTimeout(timer);
    }
}

async function fetchViaBrowser(url: string, args: FetchArgs): Promise<RawFetchResult> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 1440, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36');
        await page.goto(`https://gmgn.ai/trade?chain=${args.chain}&tab=${encodeURIComponent(args.tag)}`, {
            waitUntil: 'domcontentloaded',
            timeout: Math.max(args.timeoutMs, 15000)
        });
        await new Promise((resolve) => setTimeout(resolve, GMGN_BROWSER_WAIT_MS));

        const result = await page.evaluate(async (requestUrl: string) => {
            const response = await fetch(requestUrl, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    accept: 'application/json, text/plain, */*'
                }
            });
            const text = await response.text();
            return {
                statusCode: response.status,
                text
            };
        }, url);

        if (!result?.statusCode || result.statusCode >= 400) {
            throw new Error(`gmgn_browser_http_${result?.statusCode || 0}`);
        }
        return {
            statusCode: result.statusCode,
            text: String(result.text || '')
        };
    } finally {
        await page.close().catch(() => undefined);
    }
}

function shouldFallbackToBrowser(reasonCode: string): boolean {
    return reasonCode === 'gmgn_html_blocked'
        || reasonCode === 'gmgn_invalid_json'
        || reasonCode === 'gmgn_timeout'
        || reasonCode.startsWith('gmgn_http_')
        || reasonCode.startsWith('gmgn_browser_http_');
}

export async function fetchGmgnRankWithFallback(args: FetchArgs): Promise<GmgnRankFetchResult> {
    const url = buildQueryUrl(args);
    const attempts: GmgnAttemptMetric[] = [];

    const httpStartedAt = Date.now();
    try {
        const httpResult = await fetchViaHttp(url, args);
        const rows = parseRankRows(httpResult.text);
        const latencyMs = Date.now() - httpStartedAt;
        attempts.push({
            route: 'http',
            ok: true,
            latencyMs,
            statusCode: httpResult.statusCode
        });
        return {
            url,
            rows,
            route: 'http',
            fallbackUsed: false,
            latencyMs,
            attempts
        };
    } catch (error) {
        const reasonCode = classifyFetchError(error);
        attempts.push({
            route: 'http',
            ok: false,
            latencyMs: Date.now() - httpStartedAt,
            reasonCode
        });

        if (!shouldFallbackToBrowser(reasonCode)) {
            throw Object.assign(new Error(reasonCode), { attempts });
        }
    }

    const browserStartedAt = Date.now();
    try {
        const browserResult = await fetchViaBrowser(url, args);
        const rows = parseRankRows(browserResult.text);
        const latencyMs = Date.now() - browserStartedAt;
        attempts.push({
            route: 'browser',
            ok: true,
            latencyMs,
            statusCode: browserResult.statusCode
        });
        return {
            url,
            rows,
            route: 'browser',
            fallbackUsed: true,
            latencyMs: attempts.reduce((sum, item) => sum + item.latencyMs, 0),
            attempts
        };
    } catch (error) {
        const reasonCode = classifyFetchError(error);
        attempts.push({
            route: 'browser',
            ok: false,
            latencyMs: Date.now() - browserStartedAt,
            reasonCode
        });
        throw Object.assign(new Error(reasonCode), { attempts });
    }
}
