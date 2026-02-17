import { normalizeChainSlug } from '../config/apiEndpoints.js';

const CHAIN_ID_TO_SLUG: Record<number, string> = {
    1: 'eth',
    10: 'optimism',
    56: 'bsc',
    137: 'polygon',
    250: 'fantom',
    900: 'solana',
    8453: 'base',
    42161: 'arbitrum',
    43114: 'avalanche',
};

const CHAIN_SLUG_TO_ID: Record<string, number> = Object.entries(CHAIN_ID_TO_SLUG)
    .reduce((acc, [id, slug]) => {
        acc[slug] = Number(id);
        return acc;
    }, {} as Record<string, number>);

export function parseChainId(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) return Math.trunc(parsed);
    }
    return undefined;
}

export function canonicalizeChain(chain?: string): string | undefined {
    if (!chain) return undefined;
    const normalized = normalizeChainSlug(String(chain).trim().toLowerCase());
    if (normalized === 'matic') return 'polygon';
    return normalized;
}

export function chainIdToSlug(chainId?: number): string | undefined {
    if (!chainId) return undefined;
    return CHAIN_ID_TO_SLUG[chainId];
}

export function chainSlugToId(chain?: string): number | undefined {
    const slug = canonicalizeChain(chain);
    if (!slug) return undefined;
    return CHAIN_SLUG_TO_ID[slug];
}

export function resolveChainInput(
    args: { chain?: string; chain_id?: number | string },
    opts?: { contextChainId?: number; defaultChain?: string }
): { chain: string; chainId?: number; invalidChainId?: boolean } {
    const parsedChainId = parseChainId(args.chain_id);
    if (args.chain_id !== undefined && parsedChainId === undefined) {
        return {
            chain: canonicalizeChain(opts?.defaultChain || 'eth') || 'eth',
            chainId: undefined,
            invalidChainId: true,
        };
    }

    if (parsedChainId !== undefined) {
        const chainFromId = chainIdToSlug(parsedChainId);
        if (chainFromId) {
            return { chain: chainFromId, chainId: parsedChainId };
        }
        return {
            chain: canonicalizeChain(opts?.defaultChain || 'eth') || 'eth',
            chainId: parsedChainId,
            invalidChainId: true,
        };
    }

    const fromChainArg = canonicalizeChain(args.chain);
    if (fromChainArg) {
        return { chain: fromChainArg, chainId: chainSlugToId(fromChainArg) };
    }

    const fromContext = chainIdToSlug(opts?.contextChainId);
    if (fromContext) {
        return { chain: fromContext, chainId: opts?.contextChainId };
    }

    const fallback = canonicalizeChain(opts?.defaultChain || 'eth') || 'eth';
    return { chain: fallback, chainId: chainSlugToId(fallback) };
}
