const ALCHEMY_WEBHOOK_ENV_KEYS: Record<number, string[]> = {
    1: ['ALCHEMY_WEBHOOK_ID_ETH', 'ALCHEMY_WEBHOOK_ID_ETH_MAINNET'],
    56: ['ALCHEMY_WEBHOOK_ID_BSC'],
    8453: ['ALCHEMY_WEBHOOK_ID_BASE'],
    900: ['ALCHEMY_WEBHOOK_ID_SOL'],
};

const ALCHEMY_WEBHOOK_CHAIN_LABELS: Record<number, string> = {
    1: 'ethereum',
    56: 'bsc',
    8453: 'base',
    900: 'solana',
};

export type SupportedAlchemyWebhookChainId = 1 | 56 | 8453 | 900;

export function getSupportedAlchemyWebhookChains(): SupportedAlchemyWebhookChainId[] {
    return [1, 56, 8453, 900];
}

export function getAlchemyWebhookChainLabel(chainId: number): string {
    return ALCHEMY_WEBHOOK_CHAIN_LABELS[chainId] || `chain_${chainId}`;
}

export function getAlchemyWebhookId(chainId: number): string {
    const keys = ALCHEMY_WEBHOOK_ENV_KEYS[chainId] || [];
    for (const key of keys) {
        const value = process.env[key];
        if (value) return value;
    }
    return '';
}

export function hasAlchemyWebhookConfigured(chainId: number): boolean {
    return Boolean(getAlchemyWebhookId(chainId));
}

export function getAlchemyWebhookEnvKeys(chainId: number): string[] {
    return [...(ALCHEMY_WEBHOOK_ENV_KEYS[chainId] || [])];
}

