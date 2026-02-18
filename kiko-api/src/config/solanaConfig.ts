import { getSolanaConnection as getManagedSolanaConnection } from '../services/rpcManager.js';

export const SOLANA_CONFIG = {
    // Chain ID for Solana (internal mapping, not on-chain ID)
    CHAIN_ID: 900,

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
        // Pump.fun AMM / PumpSwap
        // [Ref]: Jupiter station program-id labels (Pump.fun AMM)
        PUMP_SWAP: 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
        RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
        JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    }
};

/**
 * Get a fresh Solana Connection
 */
export function getSolanaConnection(
    strategy: 'fast' | 'cheap' = 'cheap',
    importance: 'normal' | 'critical' = 'normal'
) {
    return getManagedSolanaConnection(strategy, importance);
}
