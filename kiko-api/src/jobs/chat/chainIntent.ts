import type { CanonicalIntent } from './canonicalIntent.js';

export interface CanonicalChainRef {
    chainId: number;
    chainName: string;
    source: 'normalized_intent' | 'entity_hint' | 'wallet_context';
}

interface ChainDefinition {
    chainId: number;
    chainName: string;
    aliases: string[];
    nativeSymbols: string[];
    chainSymbols: string[];
}

const CHAIN_DEFINITIONS: ChainDefinition[] = [
    { chainId: 1, chainName: 'Ethereum', aliases: ['ethereum', 'eth'], nativeSymbols: ['ETH', 'WETH'], chainSymbols: [] },
    { chainId: 8453, chainName: 'Base', aliases: ['base'], nativeSymbols: ['ETH', 'WETH'], chainSymbols: ['BASE'] },
    { chainId: 56, chainName: 'BNB Chain', aliases: ['bnb', 'bsc', 'bnb chain', 'binance smart chain', 'bep20', 'bep-20'], nativeSymbols: ['BNB', 'WBNB'], chainSymbols: ['BSC', 'BNBCHAIN'] },
    { chainId: 137, chainName: 'Polygon', aliases: ['polygon', 'matic', 'pol'], nativeSymbols: ['POL', 'MATIC', 'WMATIC'], chainSymbols: [] },
    { chainId: 42161, chainName: 'Arbitrum', aliases: ['arbitrum', 'arb', 'arbitrum one'], nativeSymbols: ['ETH', 'WETH'], chainSymbols: [] },
    { chainId: 10, chainName: 'Optimism', aliases: ['optimism', 'op mainnet'], nativeSymbols: ['ETH', 'WETH'], chainSymbols: ['OP'] },
    { chainId: 900, chainName: 'Solana', aliases: ['solana', 'sol'], nativeSymbols: ['SOL', 'WSOL'], chainSymbols: [] },
];

const CHAIN_ALIAS_INDEX = new Map<string, ChainDefinition>();
const NATIVE_SYMBOL_COUNTS = new Map<string, number>();
for (const definition of CHAIN_DEFINITIONS) {
    for (const symbol of definition.nativeSymbols) {
        const key = symbol.toLowerCase();
        NATIVE_SYMBOL_COUNTS.set(key, (NATIVE_SYMBOL_COUNTS.get(key) || 0) + 1);
    }
}
for (const definition of CHAIN_DEFINITIONS) {
    const uniqueNativeSymbols = definition.nativeSymbols.filter((symbol) => (NATIVE_SYMBOL_COUNTS.get(symbol.toLowerCase()) || 0) === 1);
    for (const alias of [...definition.aliases, ...uniqueNativeSymbols, ...definition.chainSymbols]) {
        CHAIN_ALIAS_INDEX.set(alias.toLowerCase(), definition);
    }
}

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function normalizeChainAlias(value: string | null | undefined): CanonicalChainRef | null {
    const alias = String(value || '').trim().toLowerCase();
    if (!alias) return null;
    const definition = CHAIN_ALIAS_INDEX.get(alias);
    if (!definition) return null;
    return {
        chainId: definition.chainId,
        chainName: definition.chainName,
        source: 'entity_hint',
    };
}

export function resolveCanonicalChainRef(params: {
    canonicalIntent?: CanonicalIntent | null;
    requestedTokenAddresses?: string[];
    requestedTokenSymbols?: string[];
    runtimeChainId?: number | null;
    runtimeChainName?: string | null;
}): CanonicalChainRef | null {
    const canonicalIntent = params.canonicalIntent || null;
    if (canonicalIntent?.requestedChain) {
        return {
            chainId: canonicalIntent.requestedChain.chainId,
            chainName: canonicalIntent.requestedChain.chainName,
            source: 'normalized_intent',
        };
    }

    for (const address of params.requestedTokenAddresses || []) {
        const value = String(address || '').trim();
        if (value && !EVM_ADDRESS_RE.test(value) && SOLANA_ADDRESS_RE.test(value)) {
            return {
                chainId: 900,
                chainName: 'Solana',
                source: 'entity_hint',
            };
        }
    }

    for (const symbol of params.requestedTokenSymbols || []) {
        const normalized = normalizeChainAlias(symbol);
        if (normalized) return normalized;
    }

    const runtimeChainId = Number(params.runtimeChainId || 0) || null;
    if (runtimeChainId) {
        const byId = CHAIN_DEFINITIONS.find((definition) => definition.chainId === runtimeChainId);
        return {
            chainId: runtimeChainId,
            chainName: byId?.chainName || String(params.runtimeChainName || runtimeChainId),
            source: 'wallet_context',
        };
    }

    const runtimeAlias = normalizeChainAlias(params.runtimeChainName || '');
    if (runtimeAlias) {
        return {
            ...runtimeAlias,
            source: 'wallet_context',
        };
    }

    return null;
}

export function resolveRequestedChainHint(params: {
    text?: string;
    requestedTokenAddresses?: string[];
    requestedTokenSymbols?: string[];
    canonicalIntent?: CanonicalIntent | null;
    runtimeChainId?: number | null;
    runtimeChainName?: string | null;
}): CanonicalChainRef | null {
    return resolveCanonicalChainRef({
        canonicalIntent: params.canonicalIntent,
        requestedTokenAddresses: params.requestedTokenAddresses,
        requestedTokenSymbols: params.requestedTokenSymbols,
        runtimeChainId: params.runtimeChainId,
        runtimeChainName: params.runtimeChainName,
    });
}

export function isExplicitChainSwitchRequest(text: string, canonicalIntent?: CanonicalIntent | null): boolean {
    if (canonicalIntent?.intent === 'swap' || canonicalIntent?.intent === 'cross_chain_swap') {
        return false;
    }
    const normalized = String(text || '').trim().toLowerCase();
    if (!normalized) return false;
    return [
        'switch chain',
        'switch wallet chain',
        'change chain',
        'change wallet chain',
    ].some((phrase) => normalized.includes(phrase));
}
