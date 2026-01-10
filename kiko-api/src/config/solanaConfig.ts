import { Connection } from '@solana/web3.js';

export const SOLANA_CONFIG = {
    // Chain ID for Solana (internal mapping, not on-chain ID)
    CHAIN_ID: 900,

    // RPC Endpoints - Prioritized for reliability
    RPC_URLS: {
        // Primary: Alchemy (from env) - Most reliable for production
        ALCHEMY: process.env.ALCHEMY_API_KEY
            ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
            : undefined,
        // Secondary: Helius (from env)
        HELIUS: process.env.HELIUS_API_KEY
            ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
            : undefined,
        // MAINNET uses first available: Alchemy -> Helius -> Env -> Public
        MAINNET: process.env.ALCHEMY_API_KEY
            ? `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
            : (process.env.HELIUS_API_KEY
                ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
                : (process.env.SOLANA_RPC_URL || 'https://solana-rpc.publicnode.com')),
        // Public fallbacks (no auth required)
        PUBLIC: 'https://solana-rpc.publicnode.com',
        BACKUP_1: 'https://solana.drpc.org',
        BACKUP_2: 'https://api.mainnet-beta.solana.com'
    },

    // Jupiter Aggregator API
    // Official API URL: https://api.jup.ag
    // Note: Ultra API requires API key from portal.jup.ag (optional for now, use Legacy API for dev)
    // Legacy API (v6): /v6/quote and /v6/swap
    // Ultra API (new): /ultra/v1/order and /ultra/v1/execute (requires API key)
    JUPITER_API_URL: process.env.JUPITER_API_URL || 'https://api.jup.ag/v6',
    JUPITER_API_KEY: process.env.JUPITER_API_KEY || '',

    // Token Addresses
    TOKENS: {
        SOL: 'So11111111111111111111111111111111111111112',
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    },

    // Program IDs
    PROGRAMS: {
        PUMP_FUN: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
        RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
        JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    }
};

/**
 * Get a fresh Solana Connection
 */
export function getSolanaConnection(url?: string): Connection {
    return new Connection(url || SOLANA_CONFIG.RPC_URLS.MAINNET, 'confirmed');
}
