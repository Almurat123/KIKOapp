const CHAIN_ID_TO_SLUG: Record<number, string> = {
    1: 'eth',
    10: 'optimism',
    56: 'bsc',
    137: 'polygon',
    900: 'solana',
    8453: 'base',
    42161: 'arbitrum',
    43114: 'avalanche',
};

type GrokToolContextBase = Record<string, any> | undefined;

type BuildGrokToolContextOpts = {
    detectedChainId?: number;
    detectedChainName?: string;
    contractAddress?: string;
    tokenInfo?: { address?: string; chainId?: number; chainName?: string } | null;
    detectedLaunchpadInfo?: { chainId: number; address: string } | null;
};

export function buildGrokToolContext(base: GrokToolContextBase, opts: BuildGrokToolContextOpts): Record<string, any> | undefined {
    const next = base ? { ...base } : {};

    const resolvedChainId =
        opts.detectedLaunchpadInfo?.chainId
        || opts.detectedChainId
        || opts.tokenInfo?.chainId;
    const resolvedTokenAddress =
        opts.contractAddress
        || opts.detectedLaunchpadInfo?.address
        || opts.tokenInfo?.address;
    const resolvedChainSlug =
        (resolvedChainId ? CHAIN_ID_TO_SLUG[resolvedChainId] : undefined)
        || normalizeChainSlug(opts.detectedChainName)
        || normalizeChainSlug(opts.tokenInfo?.chainName);

    if (resolvedChainId) {
        next.analysisChainId = resolvedChainId;
    }
    if (resolvedChainSlug) {
        next.analysisChain = resolvedChainSlug;
    }
    if (opts.detectedChainName) {
        next.analysisChainName = opts.detectedChainName;
    }
    if (resolvedTokenAddress) {
        next.analysisTokenAddress = resolvedTokenAddress;
    }

    return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeChainSlug(value?: string): string | undefined {
    if (!value) return undefined;
    const normalized = String(value).trim().toLowerCase();
    const aliases: Record<string, string> = {
        ethereum: 'eth',
        mainnet: 'eth',
        bnb: 'bsc',
        'bnb smart chain': 'bsc',
        polygonpos: 'polygon',
        polygon_pos: 'polygon',
        matic: 'polygon',
        arb: 'arbitrum',
        op: 'optimism',
    };
    return aliases[normalized] || normalized;
}
