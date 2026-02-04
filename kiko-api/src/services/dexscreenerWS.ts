/**
 * DexScreener WebSocket Service
 * 
 * Fetches real-time trending token addresses from DexScreener via WebSocket.
 * This provides more accurate trending data than the HTTP API search/boost methods.
 * 
 * Supported chains: base, ethereum, bsc
 * Supported time frames: m5 (5 min), h1 (1 hour), h6 (6 hours), h24 (24 hours)
 * 
 * NOTE: Uses Chrome TLS fingerprint simulation to bypass Cloudflare Bot detection.
 */

import WebSocket from 'ws';
import * as https from 'https';
import * as tls from 'tls';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

/**
 * Chrome 122 TLS Cipher Suites (JA3 fingerprint simulation)
 * These are ordered to match Chrome's TLS handshake signature.
 * Reference: https://engineering.salesforce.com/tls-fingerprinting-with-ja3-and-ja3s-247362855967
 */
const CHROME_CIPHERS = [
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    'ECDHE-RSA-AES128-SHA',
    'ECDHE-RSA-AES256-SHA',
    'AES128-GCM-SHA256',
    'AES256-GCM-SHA384',
    'AES128-SHA',
    'AES256-SHA',
].join(':');

/**
 * Create HTTPS Agent with Chrome-like TLS fingerprint
 */
function createChromeAgent(): https.Agent {
    return new https.Agent({
        // TLS 1.2 and 1.3 (Chrome default)
        minVersion: 'TLSv1.2' as tls.SecureVersion,
        maxVersion: 'TLSv1.3' as tls.SecureVersion,
        // Chrome cipher order
        ciphers: CHROME_CIPHERS,
        // Chrome elliptic curves order
        ecdhCurve: 'X25519:P-256:P-384',
        // Enable session tickets (Chrome behavior)
        sessionTimeout: 300,
        // Keep connections alive
        keepAlive: true,
        keepAliveMsecs: 10000,
    });
}

// ============== FLARESOLVERR CLOUDFLARE BYPASS ==============

/**
 * FlareSolverr session cache
 * Stores the cf_clearance cookie and user-agent to reuse across connections
 */
interface CloudflareSession {
    cookies: string;         // cf_clearance cookie string
    userAgent: string;       // User-agent from FlareSolverr browser
    expiresAt: number;       // Session expiry timestamp
}

let cfSession: CloudflareSession | null = null;
const CF_SESSION_TTL = 10 * 60 * 1000; // 10 minutes (Cloudflare cookies last ~15 min)

/**
 * Get or refresh Cloudflare session via FlareSolverr
 * 
 * FlareSolverr runs a headless browser to solve Cloudflare challenges
 * and returns the session cookies needed for subsequent requests.
 * 
 * @returns CloudflareSession or null if unavailable
 */
async function getCloudflareSession(): Promise<CloudflareSession | null> {
    // Check if FlareSolverr is configured
    const flareSolverrUrl = process.env.FLARESOLVERR_URL;
    if (!flareSolverrUrl) {
        return null;
    }

    // Return cached session if still valid
    if (cfSession && Date.now() < cfSession.expiresAt) {
        return cfSession;
    }

    try {
        logger.debug(LogCode.SYS_INFO, 'FlareSolverr: Requesting new Cloudflare session...');

        const response = await fetch(flareSolverrUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cmd: 'request.get',
                url: 'https://dexscreener.com/',
                maxTimeout: 60000,
            }),
            signal: AbortSignal.timeout(65000),
        });

        if (!response.ok) {
            logger.warn(LogCode.API_FETCH_FAILED, 'FlareSolverr: HTTP error', { status: response.status });
            return null;
        }

        const data = await response.json() as {
            status: string;
            solution?: {
                cookies: Array<{ name: string; value: string }>;
                userAgent: string;
            };
        };

        if (data.status !== 'ok' || !data.solution) {
            logger.warn(LogCode.API_FETCH_FAILED, 'FlareSolverr: Challenge failed', { status: data.status });
            return null;
        }

        // Extract cf_clearance cookie
        const cookies = data.solution.cookies
            .map(c => `${c.name}=${c.value}`)
            .join('; ');

        cfSession = {
            cookies: cookies,
            userAgent: data.solution.userAgent,
            expiresAt: Date.now() + CF_SESSION_TTL,
        };

        logger.debug(LogCode.SYS_INFO, 'FlareSolverr: Session obtained', {
            cookieCount: data.solution.cookies.length,
            userAgent: cfSession.userAgent.substring(0, 50) + '...'
        });

        return cfSession;
    } catch (error: any) {
        logger.warn(LogCode.API_FETCH_FAILED, 'FlareSolverr: Request failed', { error: error.message });
        return null;
    }
}

// ============== FREE ROTATING PROXY POOL ==============

/**
 * Free proxy sources (no registration required)
 */
const FREE_PROXY_SOURCES = [
    // ProxyScrape - SOCKS5 proxies, updated frequently
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=5000&country=all&ssl=all&anonymity=all',
    // ProxyScrape - SOCKS4 proxies (fallback)
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=5000&country=all&ssl=all&anonymity=all',
];

// Proxy pool cache
let proxyPool: string[] = [];
let lastProxyFetch = 0;
let currentProxyIndex = 0;
const PROXY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch fresh proxies from free sources
 */
async function fetchFreeProxies(): Promise<string[]> {
    const proxies: string[] = [];

    for (const sourceUrl of FREE_PROXY_SOURCES) {
        try {
            const response = await fetch(sourceUrl, {
                signal: AbortSignal.timeout(10000)
            });
            if (!response.ok) continue;

            const text = await response.text();
            const lines = text.split('\n').filter(line => line.trim());

            for (const line of lines) {
                const trimmed = line.trim();
                // Format: IP:PORT
                if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(trimmed)) {
                    // Determine protocol based on source URL
                    const protocol = sourceUrl.includes('socks5') ? 'socks5' : 'socks4';
                    proxies.push(`${protocol}://${trimmed}`);
                }
            }
        } catch (error) {
            // Silently continue to next source
        }
    }

    // Shuffle to randomize
    for (let i = proxies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
    }

    return proxies;
}

/**
 * Get a proxy from the rotating pool
 * Returns null if pool is empty or disabled
 */
async function getRotatingProxy(): Promise<string | null> {
    // Check if free proxy pool is disabled
    if (process.env.DISABLE_FREE_PROXY_POOL === 'true') {
        return null;
    }

    // Check if we have a static proxy configured (takes priority)
    const staticProxy = process.env.DEXSCREENER_PROXY ||
        process.env.HTTPS_PROXY ||
        process.env.HTTP_PROXY;
    if (staticProxy) {
        return staticProxy;
    }

    // Refresh proxy pool if expired
    const now = Date.now();
    if (proxyPool.length === 0 || now - lastProxyFetch > PROXY_CACHE_TTL) {
        logger.debug(LogCode.SYS_INFO, 'Refreshing free proxy pool...');
        proxyPool = await fetchFreeProxies();
        lastProxyFetch = now;
        currentProxyIndex = 0;
        logger.debug(LogCode.SYS_INFO, 'Free proxy pool refreshed', { count: proxyPool.length });

        if (proxyPool.length === 0) {
            logger.warn(LogCode.SYS_ERROR, 'No free proxies available');
            return null;
        }
    }

    // Round-robin selection
    const proxy = proxyPool[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % proxyPool.length;

    return proxy;
}

/**
 * Mark a proxy as bad (remove from pool)
 */
function markProxyBad(proxyUrl: string): void {
    const index = proxyPool.indexOf(proxyUrl);
    if (index > -1) {
        proxyPool.splice(index, 1);
        logger.debug(LogCode.SYS_INFO, 'Removed bad proxy from pool', { remaining: proxyPool.length });
    }
}

/**
 * Create proxy agent for WebSocket connection
 * Supports HTTP/HTTPS and SOCKS5 proxies
 */
async function createProxyAgent(proxyUrl: string): Promise<https.Agent | null> {
    try {
        // Dynamically import proxy agent based on protocol
        if (proxyUrl.startsWith('socks')) {
            const { SocksProxyAgent } = await import('socks-proxy-agent');
            // SocksProxyAgent doesn't support TLS options directly, but it handles TLS internally
            return new SocksProxyAgent(proxyUrl);
        } else {
            const { HttpsProxyAgent } = await import('https-proxy-agent');
            return new HttpsProxyAgent(proxyUrl);
        }
    } catch (error: any) {
        logger.warn(LogCode.SYS_ERROR, 'Failed to create proxy agent', { error: error.message });
        return null;
    }
}

// DexScreener WebSocket base URL
const WS_BASE_URL = 'wss://io.dexscreener.com/dex/screener/v5/pairs';

// Supported chains for WebSocket trending
export const WS_SUPPORTED_CHAINS = ['base', 'solana', 'ethereum', 'bsc'] as const;
export type WSSupportedChain = typeof WS_SUPPORTED_CHAINS[number];

// Time frames
export type WSTimeFrame = 'm5' | 'h1' | 'h6' | 'h24';

// Ranking options
export type WSRankBy = 'trendingScoreM5' | 'trendingScoreH1' | 'trendingScoreH6' | 'trendingScoreH24' | 'volume' | 'liquidity' | 'txns';

// Chain ID mapping for WebSocket filter
const CHAIN_ID_MAP: Record<string, string> = {
    'base': 'base',
    'solana': 'solana',
    'ethereum': 'ethereum',
    'eth': 'ethereum',
    'bsc': 'bsc',
};

interface WSOptions {
    chain: string;
    timeFrame?: WSTimeFrame;
    rankBy?: WSRankBy;
    timeout?: number;
}

/**
 * Fetch trending token addresses from DexScreener WebSocket
 * 
 * Strategy:
 * 1. First attempt: Direct connection with Chrome TLS fingerprint
 * 2. Fallback: If proxy is configured and direct fails, retry via proxy
 * 
 * @param options - WebSocket options (chain, timeFrame, rankBy)
 * @returns Promise<string[]> - Array of token addresses (lowercase)
 */
export async function fetchTrendingAddresses(options: WSOptions): Promise<string[]> {
    const {
        chain,
        timeFrame = 'm5',
        rankBy = 'trendingScoreM5',
        timeout = 10000,
    } = options;

    // Normalize chain ID
    const normalizedChain = CHAIN_ID_MAP[chain.toLowerCase()] || chain.toLowerCase();

    // Check if chain is supported
    if (!WS_SUPPORTED_CHAINS.includes(normalizedChain as WSSupportedChain)) {
        logger.debug(LogCode.SYS_INFO, 'DexScreener WS: Chain not supported', { chain, normalizedChain });
        return [];
    }

    // Build WebSocket URL
    const url = `${WS_BASE_URL}/${timeFrame}/1?rankBy[key]=${rankBy}&rankBy[order]=desc&filters[chainIds][0]=${normalizedChain}`;

    // Attempt 1: Direct connection with Chrome TLS fingerprint
    logger.debug(LogCode.SYS_INFO, 'DexScreener WS: Trying direct connection', { chain: normalizedChain });
    const directResult = await attemptWSConnection(url, normalizedChain, timeout, createChromeAgent());

    if (directResult.length > 0) {
        logger.debug(LogCode.SYS_INFO, 'DexScreener WS: Direct connection succeeded', { count: directResult.length });
        return directResult;
    }

    // Attempt 2: Try with FlareSolverr Cloudflare cookies (if configured)
    const cfSession = await getCloudflareSession();
    if (cfSession) {
        logger.debug(LogCode.SYS_INFO, 'DexScreener WS: Trying with FlareSolverr cookies', { chain: normalizedChain });
        const cfResult = await attemptWSConnectionWithCookies(url, normalizedChain, timeout, cfSession);
        if (cfResult.length > 0) {
            logger.debug(LogCode.SYS_INFO, 'DexScreener WS: FlareSolverr connection succeeded', { count: cfResult.length });
            return cfResult;
        }
    }

    // Attempt 3-5: Retry via rotating proxy pool (up to 3 proxies)
    const MAX_PROXY_RETRIES = 3;
    for (let i = 0; i < MAX_PROXY_RETRIES; i++) {
        const proxyUrl = await getRotatingProxy();
        if (!proxyUrl) {
            logger.debug(LogCode.SYS_INFO, 'DexScreener WS: No proxy available, skipping proxy retry');
            break;
        }

        logger.debug(LogCode.SYS_INFO, `DexScreener WS: Trying proxy ${i + 1}/${MAX_PROXY_RETRIES}`, { chain: normalizedChain });
        const proxyAgent = await createProxyAgent(proxyUrl);
        if (proxyAgent) {
            const proxyResult = await attemptWSConnection(url, normalizedChain, Math.min(timeout, 8000), proxyAgent);
            if (proxyResult.length > 0) {
                logger.debug(LogCode.SYS_INFO, 'DexScreener WS: Proxy connection succeeded', { count: proxyResult.length, proxyIndex: i + 1 });
                return proxyResult;
            }
            // Mark this proxy as bad
            markProxyBad(proxyUrl);
        }
    }

    // All attempts failed
    logger.warn(LogCode.API_FETCH_FAILED, 'DexScreener WS: All connection attempts failed', { chain: normalizedChain });
    return [];
}

/**
 * Attempt WebSocket connection with FlareSolverr cookies
 * Uses the cf_clearance cookie to bypass Cloudflare
 */
function attemptWSConnectionWithCookies(
    url: string,
    normalizedChain: string,
    timeout: number,
    session: CloudflareSession
): Promise<string[]> {
    return new Promise((resolve) => {
        const startTime = Date.now();
        let resolved = false;

        const agent = createChromeAgent();

        const ws = new WebSocket(url, {
            agent: agent,
            headers: {
                'Host': 'io.dexscreener.com',
                'Origin': 'https://dexscreener.com',
                'Referer': 'https://dexscreener.com/',
                'User-Agent': session.userAgent, // Use FlareSolverr's user-agent
                'Cookie': session.cookies,        // Include cf_clearance cookie
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
                'Sec-WebSocket-Version': '13',
            },
        });

        const timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                logger.debug(LogCode.API_FETCH_FAILED, 'DexScreener WS: FlareSolverr timeout', { chain: normalizedChain });
                ws.close();
                resolve([]);
            }
        }, timeout);

        ws.on('open', () => {
            logger.debug(LogCode.SYS_INFO, 'DexScreener WS: FlareSolverr connected', { chain: normalizedChain });
        });

        ws.on('message', (data: Buffer) => {
            if (resolved) return;

            try {
                const text = data.toString('utf8');

                if (text.length > 1000) {
                    const ethAddresses = text.match(/0x[0-9a-fA-F]{40}/g) || [];
                    const solAddresses: string[] = [];

                    if (normalizedChain === 'solana') {
                        const solMatches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
                        for (const match of solMatches) {
                            if (match.length >= 32 && match.length <= 44) {
                                const repeatedCharRatio = (match.match(/(.)\1{2,}/g) || []).length / match.length;
                                if (repeatedCharRatio < 0.1) {
                                    solAddresses.push(match);
                                }
                            }
                        }
                    }

                    const allAddresses = [...ethAddresses.map(a => a.toLowerCase()), ...solAddresses];
                    const uniqueAddresses = [...new Set(allAddresses)];

                    const duration = Date.now() - startTime;
                    logger.debug(LogCode.SYS_INFO, 'DexScreener WS: FlareSolverr received addresses', {
                        chain: normalizedChain,
                        count: uniqueAddresses.length,
                        durationMs: duration
                    });

                    resolved = true;
                    clearTimeout(timeoutId);
                    ws.close();
                    resolve(uniqueAddresses);
                }
            } catch (error: any) {
                logger.error(LogCode.SYS_ERROR, 'DexScreener WS: FlareSolverr parse error', { error: error.message });
            }
        });

        ws.on('error', (error) => {
            if (!resolved) {
                logger.error(LogCode.SYS_ERROR, 'DexScreener WS: FlareSolverr connection error', { error: error.message, chain: normalizedChain });
                resolved = true;
                clearTimeout(timeoutId);
                resolve([]);
            }
        });

        ws.on('close', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                resolve([]);
            }
        });
    });
}

/**
 * Internal: Attempt a single WebSocket connection
 */
function attemptWSConnection(
    url: string,
    normalizedChain: string,
    timeout: number,
    agent: https.Agent
): Promise<string[]> {
    return new Promise((resolve) => {
        const startTime = Date.now();
        let resolved = false;

        const ws = new WebSocket(url, {
            agent: agent,
            headers: {
                // Full browser-like headers to bypass Cloudflare Bot detection
                'Host': 'io.dexscreener.com',
                'Origin': 'https://dexscreener.com',
                'Referer': 'https://dexscreener.com/',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
                'Sec-WebSocket-Version': '13',
            },
        });

        // Timeout handler
        const timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                logger.debug(LogCode.API_FETCH_FAILED, 'DexScreener WS: Timeout', { chain: normalizedChain, timeout });
                ws.close();
                resolve([]);
            }
        }, timeout);

        ws.on('open', () => {
            logger.debug(LogCode.SYS_INFO, 'DexScreener WS: Connected', { chain: normalizedChain });
        });

        ws.on('message', (data: Buffer) => {
            if (resolved) return;

            try {
                const text = data.toString('utf8');

                // Check if we received pair data
                if (text.length > 1000) {
                    // Extract Ethereum-style addresses (0x...)
                    const ethAddresses = text.match(/0x[0-9a-fA-F]{40}/g) || [];

                    // Extract Solana-style addresses (base58, 32-44 chars, no 0x)
                    // Solana addresses are alphanumeric, typically 43-44 chars
                    const solAddresses: string[] = [];
                    if (normalizedChain === 'solana') {
                        // Match potential Solana addresses (base58 encoded)
                        // Many pump.fun tokens end with 'pump' - DO include these
                        const solMatches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];

                        // Known addresses to skip (wrappers, native tokens)
                        const SKIP_ADDRESSES = new Set([
                            'So11111111111111111111111111111111111111111',  // Native SOL
                            'So11111111111111111111111111111111111111112',  // wsol variant
                            'VSo11111111111111111111111111111111111111112', // Display variant
                        ]);

                        for (const match of solMatches) {
                            // Validate length (Solana addresses are exactly 32-44 chars)
                            if (match.length < 32 || match.length > 44) continue;

                            // Skip known wrapper/native tokens
                            if (SKIP_ADDRESSES.has(match)) continue;

                            // Skip if contains http (part of URL)
                            if (match.includes('http')) continue;

                            // Filter out common false positives
                            // Valid Solana addresses typically don't have repeated patterns
                            if (match.length >= 32 && match.length <= 44) {
                                // Skip if it looks like a hash or has too many repeated chars
                                const repeatedCharRatio = (match.match(/(.)\1{2,}/g) || []).length / match.length;
                                if (repeatedCharRatio < 0.1) {
                                    solAddresses.push(match);
                                }
                            }
                        }
                    }


                    // Deduplicate and normalize
                    const allAddresses = [...ethAddresses.map(a => a.toLowerCase()), ...solAddresses];
                    const uniqueAddresses = [...new Set(allAddresses)];

                    const duration = Date.now() - startTime;
                    logger.debug(LogCode.SYS_INFO, 'DexScreener WS: Received trending addresses', { chain: normalizedChain, count: uniqueAddresses.length, durationMs: duration });

                    resolved = true;
                    clearTimeout(timeoutId);
                    ws.close();
                    resolve(uniqueAddresses);
                }
            } catch (error: any) {
                logger.error(LogCode.SYS_ERROR, 'DexScreener WS: Error parsing message', { error: error.message });
            }
        });

        ws.on('error', (error) => {
            if (!resolved) {
                logger.error(LogCode.SYS_ERROR, 'DexScreener WS: Connection error', { error: error.message, chain: normalizedChain });
                resolved = true;
                clearTimeout(timeoutId);
                resolve([]); // Return empty on error, don't reject
            }
        });

        ws.on('close', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                resolve([]);
            }
        });
    });
}

/**
 * Fetch trending addresses for multiple chains in parallel
 * 
 * @param chains - Array of chain IDs
 * @param timeFrame - Time frame (default: m5)
 * @param rankBy - Ranking method (default: trendingScoreM5)
 * @returns Map of chain -> addresses
 */
export async function fetchTrendingAddressesMultiChain(
    chains: string[],
    timeFrame: WSTimeFrame = 'm5',
    rankBy: WSRankBy = 'trendingScoreM5'
): Promise<Map<string, string[]>> {
    const results = new Map<string, string[]>();

    // Filter to only WebSocket-supported chains
    const wsChains = chains.filter(chain => {
        const normalized = CHAIN_ID_MAP[chain.toLowerCase()] || chain.toLowerCase();
        return WS_SUPPORTED_CHAINS.includes(normalized as WSSupportedChain);
    });

    logger.debug(LogCode.SYS_INFO, 'DexScreener WS: Fetching multi-chain trending', { chains: wsChains });

    // Fetch all chains in parallel
    const promises = wsChains.map(async (chain) => {
        const addresses = await fetchTrendingAddresses({ chain, timeFrame, rankBy });
        return { chain, addresses };
    });

    const chainResults = await Promise.all(promises);

    for (const { chain, addresses } of chainResults) {
        results.set(chain, addresses);
    }

    return results;
}

/**
 * Check if a chain is supported for WebSocket trending
 */
export function isWSSupportedChain(chain: string): boolean {
    const normalized = CHAIN_ID_MAP[chain.toLowerCase()] || chain.toLowerCase();
    return WS_SUPPORTED_CHAINS.includes(normalized as WSSupportedChain);
}
