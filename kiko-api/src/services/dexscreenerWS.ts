/**
 * DexScreener WebSocket Service
 * 
 * Fetches real-time trending token addresses from DexScreener via WebSocket.
 * This provides more accurate trending data than the HTTP API search/boost methods.
 * 
 * Supported chains: base, ethereum, bsc
 * Supported time frames: m5 (5 min), h1 (1 hour), h6 (6 hours), h24 (24 hours)
 */

import WebSocket from 'ws';

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
        console.warn(`[DexScreener WS] Chain ${chain} not supported for WebSocket, returning empty`);
        return [];
    }

    // Build WebSocket URL
    const url = `${WS_BASE_URL}/${timeFrame}/1?rankBy[key]=${rankBy}&rankBy[order]=desc&filters[chainIds][0]=${normalizedChain}`;

    console.log(`[DexScreener WS] Connecting to: ${url}`);

    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        let resolved = false;

        const ws = new WebSocket(url, {
            headers: {
                'Origin': 'https://dexscreener.com',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        // Timeout handler
        const timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.warn(`[DexScreener WS] Timeout after ${timeout}ms`);
                ws.close();
                resolve([]); // Return empty on timeout, don't reject
            }
        }, timeout);

        ws.on('open', () => {
            console.log(`[DexScreener WS] Connected to ${normalizedChain}`);
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

                            // Valid Solana address - add it (including pump.fun addresses ending with 'pump')
                            solAddresses.push(match);
                        }
                    }


                    // Deduplicate and normalize
                    const allAddresses = [...ethAddresses.map(a => a.toLowerCase()), ...solAddresses];
                    const uniqueAddresses = [...new Set(allAddresses)];

                    const duration = Date.now() - startTime;
                    console.log(`[DexScreener WS] Received ${uniqueAddresses.length} unique addresses for ${normalizedChain} in ${duration}ms`);

                    resolved = true;
                    clearTimeout(timeoutId);
                    ws.close();
                    resolve(uniqueAddresses);
                }
            } catch (error) {
                console.error(`[DexScreener WS] Error parsing message:`, error);
            }
        });

        ws.on('error', (error) => {
            if (!resolved) {
                console.error(`[DexScreener WS] Connection error:`, error.message);
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

    console.log(`[DexScreener WS] Fetching trending for chains: ${wsChains.join(', ')}`);

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
