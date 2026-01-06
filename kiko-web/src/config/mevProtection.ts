/**
 * MEV Protection Configuration
 * Multi-chain MEV protection using free providers
 */

export interface MEVProtectionConfig {
    enabled: boolean;
    rpcUrl: string;
    provider: string;
    rebatePercentage: number;
    features: string[];
}

/**
 * MEV Protected RPC endpoints by chain
 */
export const MEV_PROTECTED_RPCS: Record<number, MEVProtectionConfig> = {
    // Ethereum - MEV Blocker (90% rebate)
    1: {
        enabled: true,
        rpcUrl: 'https://rpc.mevblocker.io/noreverts',
        provider: 'MEV Blocker',
        rebatePercentage: 90,
        features: ['MEV Protection', 'Gas Rebate', 'Revert Protection'],
    },

    // BSC - 48 Club
    56: {
        enabled: true,
        rpcUrl: 'https://rpc.48.club',
        provider: '48 Club',
        rebatePercentage: 0,
        features: ['MEV Protection', 'Private Mempool'],
    },

    // Polygon - dRPC
    137: {
        enabled: true,
        rpcUrl: 'https://polygon.drpc.org',
        provider: 'dRPC',
        rebatePercentage: 0,
        features: ['MEV Protection', 'Private Mempool'],
    },

    // Base - dRPC
    8453: {
        enabled: true,
        rpcUrl: 'https://base.drpc.org',
        provider: 'dRPC',
        rebatePercentage: 0,
        features: ['MEV Protection', 'Private Mempool'],
    },

    // Arbitrum - No MEV protection available
    42161: {
        enabled: false,
        rpcUrl: '',
        provider: 'None',
        rebatePercentage: 0,
        features: [],
    },

    // Optimism - No MEV protection available
    10: {
        enabled: false,
        rpcUrl: '',
        provider: 'None',
        rebatePercentage: 0,
        features: [],
    },
};

/**
 * Minimum transaction amount (USD) to enable MEV protection
 * Below this threshold, MEV risk is minimal
 */
export const MEV_PROTECTION_THRESHOLD = 1000; // $1,000

/**
 * Get MEV protection config for a chain
 */
export function getMEVProtectionConfig(
    chainId: number,
    amountUSD: number
): MEVProtectionConfig | null {
    const config = MEV_PROTECTED_RPCS[chainId];

    if (!config || !config.enabled) {
        return null;
    }

    // Only enable for transactions above threshold
    if (amountUSD < MEV_PROTECTION_THRESHOLD) {
        return null;
    }

    return config;
}

/**
 * Check if MEV protection is available for a chain
 */
export function isMEVProtectionAvailable(chainId: number): boolean {
    const config = MEV_PROTECTED_RPCS[chainId];
    return config?.enabled || false;
}

/**
 * Get MEV protection RPC URL
 */
export function getMEVProtectedRPC(
    chainId: number,
    amountUSD: number,
    userEnabled: boolean = true
): string | null {
    if (!userEnabled) {
        return null;
    }

    const config = getMEVProtectionConfig(chainId, amountUSD);
    return config?.rpcUrl || null;
}

/**
 * Estimate potential MEV savings
 */
export function estimateMEVSavings(
    amountUSD: number,
    chainId: number
): number {
    const config = MEV_PROTECTED_RPCS[chainId];

    if (!config || !config.enabled) {
        return 0;
    }

    // Estimate MEV loss as 0.1-0.5% of transaction value
    const estimatedMEVLoss = amountUSD * 0.003; // 0.3% average

    // Calculate savings based on rebate percentage
    const savings = estimatedMEVLoss * (config.rebatePercentage / 100);

    return savings;
}
