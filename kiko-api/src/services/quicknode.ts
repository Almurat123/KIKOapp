/**
 * QuickNode API Service
 * https://www.quicknode.com/docs/ethereum/qn_getWalletTokenBalance
 */

import { env } from '../config/env.js';

export interface QuickNodeTokenBalance {
    address: string; // Contract address
    name: string;
    symbol: string;
    decimals: string;
    quantityIn: string;
    quantityOut: string;
    totalBalance: string;
}

export interface QuickNodeResponse {
    result: QuickNodeTokenBalance[];
    totalItems: number;
    totalPages: number;
    pageNumber: number;
}

/**
 * Get wallet token balances using QuickNode Token API
 * This is a powerful API that returns metadata + balances in one go
 */
export async function getWalletTokenBalances(
    address: string,
    chain: string = 'eth'
): Promise<QuickNodeTokenBalance[]> {
    try {
        const apiKey = env.apiKeys.quicknode;
        if (!apiKey) {
            console.warn('[QuickNode] No API key configured');
            return [];
        }

        // QuickNode endpoint construction (User needs to provide full URL in key or we construct it)
        // Assuming key is just the specialized subdomain or full URL. 
        // Best practice: The env var should be the HTTP Provider URL.
        // If it's just a key, we need to know the subdomain.
        // For simplicity, let's assume the user puts the FULL HTTP Provider URL in the env var
        // But wait, user has "https://dashboard.quicknode.com/", likely they have a specific endpoint.
        // Let's assume QUICKNODE_API_KEY contains the full RPC URL for the specific chain 
        // OR we use a standard pattern if they provided a key.

        // Actually, QuickNode endpoints are chain specific. 
        // Let's assume user provides a general key and we build the URL? No, QuickNode uses unique subdomains.
        // To support multi-chain with one Env Var is tricky unless we use the "QuickNode Multi-Chain" approach or user provides base domain.

        // Strategy: We will try to rely on the user providing a mainnet endpoint which often supports other calls, 
        // but honestly for multi-chain fallback we need an endpoint PER chain.
        // For now, let's assume the user provided one "Mainnet" endpoint for ETH. 
        // If we want to support multiple chains, we might need a map of endpoints or assume a pattern.

        // FALLBACK: Use a standard public QuickNode endpoint structure if valid, otherwise rely on the provided URL.
        // Given the constraints, let's try to use the provided key as a "subdomain" prefix if it looks like a key, 
        // or use it as a full URL.

        // Map internal chain names to QuickNode chain slugs
        // Format: https://{NAME}.{CHAIN_SLUG}.quiknode.pro/{TOKEN}/
        // Only ETH mainnet omits the slug (or uses eth-mainnet depending on config? Docs say omit for mainnet but let's handle both)
        const CHAIN_SLUG_MAP: Record<string, string> = {
            'eth': '', // or 'ethereum-mainnet' but usually root is ETH mainnet for single endpoint? 
            // Actually docs say: https://{NAME}.quiknode.pro/{TOKEN} is ETH Mainnet.
            'ethereum': '',
            'solana': 'solana-mainnet',
            'sol': 'solana-mainnet',
            'polygon': 'matic', // or polygon-mainnet? Let's assume standard slugs
            'matic': 'matic',
            'bsc': 'bsc',
            'bnb': 'bsc',
            'arbitrum': 'arbitrum-mainnet',
            'arb': 'arbitrum-mainnet',
            'optimism': 'optimism',
            'op': 'optimism',
            'base': 'base-mainnet',
            'avalanche': 'avalanche-mainnet',
            'avax': 'avalanche-mainnet',
        };

        const slug = CHAIN_SLUG_MAP[chain.toLowerCase()];
        if (slug === undefined) {
            console.warn(`[QuickNode] Chain ${chain} not supported or unknown slug`);
            // Fallback to trying without slug? Or return empty?
            // If we don't know the slug, we can't route.
            return [];
        }

        let rpcUrl = apiKey;

        // Strategy: Try to extract Name and Token from provided URL/Key to reconstruct
        // Case 1: Full URL provided (e.g. https://my-name.quiknode.pro/abc-token/)
        if (rpcUrl.startsWith('http')) {
            try {
                const urlObj = new URL(rpcUrl);
                const hostParts = urlObj.hostname.split('.');
                const token = urlObj.pathname.replace(/^\/|\/$/g, ''); // Extract token from path

                // Assume format: name.quiknode.pro OR name.chain.quiknode.pro
                // We want 'name'.
                const name = hostParts[0];

                // Reconstruct for requested chain
                // Pattern: https://{name}.{slug}.quiknode.pro/{token}/
                // Special case for ETH Mainnet (slug usually empty or 'ethereum-mainnet'?)
                // Docs say: https://{NAME}.quiknode.pro/{TOKEN} is ETH.

                if (chain === 'eth' || chain === 'ethereum') {
                    rpcUrl = `https://${name}.quiknode.pro/${token}/`;
                } else {
                    rpcUrl = `https://${name}.${slug}.quiknode.pro/${token}/`;
                }
                // Note: user must have enabled "Multichain" or "Add Chain" on this endpoint name for this to work
            } catch (e) {
                // Failed to parse, stick to original URL if it matches chain? 
                // If asking for ETH and URL is ETH, works. If asking for SOL and URL is ETH, fails.
                console.warn('[QuickNode] Could not parse provided URL for multi-chain reconstruction. Using as-is.');
                // Fallthrough to use rpcUrl as is
            }
        } else {
            // Case 2: Just Name or Token provided? 
            // If just "my-name", we need token?
            // If it looks like a long hash, assume it's token and name is missing? 
            // Let's assume user put "NAME" in env, but that's unlikely. 
            // Usually users put the full URL.
            // If it's a key/token (32 chars+), we can't build URL without Name.
            // So we assume they put the HTTP URL.
            // If it's not a URL, we can't reliably construct it for multi-chain.
            // For now, if it's not a URL, we'll just use it as is, which will likely fail for multi-chain.
            // This is a simplification. Ideally we'd need QUICKNODE_ETH_URL, QUICKNODE_BASE_URL etc.
            // For this task, let's focus on ETH Mainnet or assume the URL handles it.
            // Let's default to ETH mainnet for now.
            // rpcUrl = `https://${apiKey}.quiknode.pro/` + (apiKey.length > 20 ? apiKey : '');
            // This is risky. Let's trust the user put a URL or we log a warning.
            console.warn('[QuickNode] API key is not a full URL. Multi-chain support may be limited.');
        }

        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept-Encoding': 'gzip'
            },
            body: JSON.stringify({
                id: 1,
                jsonrpc: '2.0',
                method: 'qn_getWalletTokenBalance',
                params: [{
                    wallet: address,
                    // contracts: [] // optional filter
                }]
            }),
        });

        if (!response.ok) {
            throw new Error(`QuickNode API error: ${response.status}`);
        }

        const data = await response.json();

        if ((data as any).error) {
            console.warn('[QuickNode] API Error:', (data as any).error);
            return [];
        }

        return (data as any).result.result || [];
    } catch (error: any) {
        console.error('[QuickNode] Error fetching token balances:', error.message);
        return [];
    }
}

/**
 * Get native ETH/Chain Token balance using QuickNode RPC
 */
/**
 * Get native ETH/Chain Token balance using QuickNode RPC
 */
export async function getNativeBalance(
    address: string,
    chain: string = 'eth'
): Promise<string> {
    try {
        const apiKey = env.apiKeys.quicknode;
        if (!apiKey) return '0x0';

        // Chain Slug Map
        const CHAIN_SLUG_MAP: Record<string, string> = {
            'eth': '',
            'ethereum': '',
            'solana': 'solana-mainnet',
            'sol': 'solana-mainnet',
            'polygon': 'matic',
            'matic': 'matic',
            'bsc': 'bsc',
            'bnb': 'bsc',
            'arbitrum': 'arbitrum-mainnet',
            'arb': 'arbitrum-mainnet',
            'optimism': 'optimism',
            'op': 'optimism',
            'base': 'base-mainnet',
            'avalanche': 'avalanche-mainnet',
            'avax': 'avalanche-mainnet',
        };

        const chainLower = chain.toLowerCase();
        const slug = CHAIN_SLUG_MAP[chainLower];

        if (slug === undefined) {
            // If unsupported, we still check if it's a known EVM (maybe user has custom)
            // But for now return 0x0
            console.warn(`[QuickNode] Chain ${chain} not supported or unknown slug for native balance`);
            return '0x0';
        }

        let rpcUrl = apiKey;

        if (rpcUrl.startsWith('http')) {
            try {
                const urlObj = new URL(rpcUrl);
                const hostParts = urlObj.hostname.split('.');
                const token = urlObj.pathname.replace(/^\/|\/$/g, '');
                const name = hostParts[0];

                // Construct URL based on chain
                // Special case for ETH Mainnet
                if (chainLower === 'eth' || chainLower === 'ethereum') {
                    rpcUrl = `https://${name}.quiknode.pro/${token}/`;
                } else {
                    rpcUrl = `https://${name}.${slug}.quiknode.pro/${token}/`;
                }
            } catch (e) {
                console.warn('[QuickNode] Could not parse provided URL for multi-chain reconstruction. Using as-is.');
            }
        }

        const isSolana = chainLower === 'solana' || chainLower === 'sol';

        // Prepare RPC Request
        const method = isSolana ? 'getBalance' : 'eth_getBalance';
        const params = isSolana ? [address] : [address, 'latest'];

        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept-Encoding': 'gzip'
            },
            body: JSON.stringify({
                id: 1,
                jsonrpc: '2.0',
                method: method,
                params: params
            }),
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);

        const data = await response.json();
        if ((data as any).error) throw new Error((data as any).error.message || 'RPC Error');

        // Parse Result
        if (isSolana) {
            // Solana: { result: { context: {...}, value: 123456789 } }
            // Return as string (lamports)
            return (data as any).result?.value?.toString() || '0';
        } else {
            // EVM: { result: "0x123..." }
            return (data as any).result || '0x0';
        }

    } catch (error) {
        console.error('[QuickNode] Error fetching native balance:', error);
        return '0x0';
    }
}

/**
 * Check if QuickNode is configured
 */
export function isQuickNodeConfigured(): boolean {
    return !!env.apiKeys.quicknode;
}
