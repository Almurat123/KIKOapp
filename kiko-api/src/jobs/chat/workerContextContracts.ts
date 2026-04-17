// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: chat context-read tools were returning mixed camelCase runtime
//         fields and raw wallet objects. That format made the model infer
//         operational meaning from vague summaries instead of reading a stable
//         worker-facing contract.
// Goal: expose session and wallet context as compact operation fields that a
//       model worker can use directly for chain, wallet, entity, and balance decisions.
// Owns: model-facing normalization of session context and wallet state.
// Does Not Own: wallet hydration, chain switching, balance fetching, or execution gating.
// Design Language:
// - context tool payloads use stable snake_case operation fields
// - session context answers who/where/what-chain, wallet state answers what funds exist
// - effective task chain must be explicit so requested chain beats connected chain
// - raw provider/cache objects should be compacted before reaching the model
// - summaries should be short data contracts, not prose descriptions
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: on-demand worker-readable context contracts
// - Verification: inferred from plan and verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-context-contracts.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: normalized read_user_context and read_wallet_state payloads
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-context-contracts.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { resolveCanonicalChainRef } from './chainIntent.js';
import type { ChatContextSnapshot } from './contracts.js';

type CompactChain = {
    chain_id?: string | number;
    name?: string;
    source?: string;
};

type CompactTokenBalance = {
    symbol?: string;
    contract_address?: string;
    balance?: string | number | boolean;
    decimals?: string | number | boolean;
};

export function buildSessionContextContract(snapshot: ChatContextSnapshot) {
    const runtime = snapshot.runtime || {};
    const walletAddress = normalizePrimitive(runtime.walletAddress || runtime.userAddress);
    const connectedChain = buildChain(runtime.chainId, runtime.chainName);
    const requestedChainRef = resolveCanonicalChainRef({
        canonicalIntent: snapshot.normalizedIntent || null,
        requestedTokenAddresses: snapshot.requestedTokenAddresses,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
        runtimeChainId: runtime.chainId,
        runtimeChainName: runtime.chainName,
    });
    const requestedChain = requestedChainRef && requestedChainRef.source !== 'wallet_context'
        ? buildChain(requestedChainRef.chainId, requestedChainRef.chainName, requestedChainRef.source)
        : undefined;
    const effectiveChain = requestedChain || connectedChain;

    return stripEmptyEntries({
        context_kind: 'session_context',
        wallet: stripEmptyEntries({
            connected: Boolean(walletAddress),
            address: walletAddress,
        }),
        chain: stripEmptyEntries({
            connected: connectedChain,
            requested: requestedChain,
            effective: effectiveChain,
            effective_source: requestedChain ? 'user_request' : connectedChain ? 'connected_wallet' : undefined,
        }),
        surface: stripEmptyEntries({
            page: normalizePrimitive(runtime.currentPage),
            page_context: truncateText(runtime.pageContext, 500),
            farcaster_profile: summarizeFarcaster(runtime.farcaster),
        }),
        request_entities: stripEmptyEntries({
            token_symbols: limitArray(snapshot.requestedTokenSymbols, 8),
            token_addresses: limitArray(snapshot.requestedTokenAddresses, 6),
            address_classifications: summarizeAddressClassifications(snapshot.requestedAddressClassifications),
        }),
    });
}

export function buildWalletStateContract(snapshot: ChatContextSnapshot, prefetchedWallet: Record<string, any> | null | undefined) {
    const runtime = snapshot.runtime || {};
    const walletAddress = normalizePrimitive(runtime.walletAddress || runtime.userAddress);
    const activeChain = buildChain(runtime.chainId, runtime.chainName);
    const activeChainBalance = buildActiveChainBalance({
        balance: runtime.balance,
        nativeBalance: runtime.nativeBalance,
        prefetchedWallet,
    });
    const allChainBalances = summarizeAllChainBalances(runtime.allChainBalances);

    return stripEmptyEntries({
        context_kind: 'wallet_state',
        wallet: stripEmptyEntries({
            connected: Boolean(walletAddress),
            address: walletAddress,
        }),
        active_chain: activeChain,
        balances: stripEmptyEntries({
            active_chain: activeChainBalance,
            all_chains: allChainBalances,
        }),
        snapshots: stripEmptyEntries({
            active_chain_at: normalizePrimitive(runtime.balanceSnapshotAt),
            all_chains_at: normalizePrimitive(runtime.allChainBalancesSnapshotAt),
        }),
    });
}

function buildChain(chainId: unknown, chainName: unknown, source?: string): CompactChain | undefined {
    const chain = stripEmptyEntries({
        chain_id: normalizePrimitive(chainId),
        name: normalizePrimitive(chainName),
        source: normalizePrimitive(source),
    });
    return Object.keys(chain).length > 0 ? chain : undefined;
}

function buildActiveChainBalance(params: {
    balance: unknown;
    nativeBalance: unknown;
    prefetchedWallet: Record<string, any> | null | undefined;
}) {
    const native = normalizePrimitive(
        params.nativeBalance
        ?? params.prefetchedWallet?.ethBalanceFormatted
        ?? params.prefetchedWallet?.ethBalance
        ?? params.prefetchedWallet?.nativeBalance,
    );
    const balanceTokens = summarizeBalanceTokens(params.balance);
    const prefetchedTokens = summarizeTokenArray(params.prefetchedWallet?.tokens);
    const active = stripEmptyEntries({
        native,
        tokens: balanceTokens.length > 0 ? balanceTokens : prefetchedTokens,
    });
    return Object.keys(active).length > 0 ? active : undefined;
}

function summarizeAllChainBalances(allChainBalances: unknown) {
    if (!allChainBalances || typeof allChainBalances !== 'object') return undefined;
    const chains = Object.entries(allChainBalances as Record<string, any>)
        .slice(0, 8)
        .map(([chainKey, snapshot]) => {
            if (!snapshot || typeof snapshot !== 'object') return null;
            const tokens = Array.isArray(snapshot.tokens)
                ? summarizeTokenArray(snapshot.tokens)
                : summarizeBalanceTokens(snapshot.tokens);
            return stripEmptyEntries({
                chain: normalizePrimitive(chainKey),
                native: normalizePrimitive(snapshot.ethBalanceFormatted ?? snapshot.ethBalance ?? snapshot.nativeBalance),
                tokens,
            });
        })
        .filter((item): item is Record<string, any> => Boolean(item && Object.keys(item).length > 0));
    return chains.length > 0 ? chains : undefined;
}

function summarizeTokenArray(tokens: unknown): CompactTokenBalance[] | undefined {
    if (!Array.isArray(tokens)) return undefined;
    const compact = tokens
        .slice(0, 8)
        .map((token) => {
            if (!token || typeof token !== 'object') return null;
            const item = token as Record<string, any>;
            return stripEmptyEntries({
                symbol: normalizePrimitive(item.symbol),
                contract_address: normalizePrimitive(item.contractAddress || item.contract_address || item.address),
                balance: normalizePrimitive(item.balance ?? item.tokenBalance ?? item.token_balance ?? item.formatted ?? item.amount),
                decimals: normalizePrimitive(item.decimals),
            });
        })
        .filter((item): item is CompactTokenBalance => Boolean(item && Object.keys(item).length > 0));
    return compact.length > 0 ? compact : undefined;
}

function summarizeBalanceTokens(balance: unknown): CompactTokenBalance[] | undefined {
    if (!balance || typeof balance !== 'object') return undefined;
    if (Array.isArray(balance)) return summarizeTokenArray(balance);
    const compact = Object.entries(balance as Record<string, any>)
        .slice(0, 8)
        .map(([key, value]) => {
            if (value && typeof value === 'object') {
                const item = value as Record<string, any>;
                return stripEmptyEntries({
                    symbol: normalizePrimitive(item.symbol || (isLikelyAddress(key) ? undefined : key)),
                    contract_address: normalizePrimitive(item.contractAddress || item.contract_address || item.address || (isLikelyAddress(key) ? key : undefined)),
                    balance: normalizePrimitive(item.balance ?? item.tokenBalance ?? item.token_balance ?? item.formatted ?? item.amount),
                    decimals: normalizePrimitive(item.decimals),
                });
            }
            return stripEmptyEntries({
                symbol: normalizePrimitive(isLikelyAddress(key) ? undefined : key),
                contract_address: normalizePrimitive(isLikelyAddress(key) ? key : undefined),
                balance: normalizePrimitive(value),
            });
        })
        .filter((item): item is CompactTokenBalance => Boolean(item && Object.keys(item).length > 0));
    return compact.length > 0 ? compact : undefined;
}

function summarizeAddressClassifications(classifications: ChatContextSnapshot['requestedAddressClassifications']) {
    if (!Array.isArray(classifications) || classifications.length === 0) return undefined;
    const compact = classifications.slice(0, 6).map((item) => stripEmptyEntries({
        address: normalizePrimitive(item.address),
        kind: normalizePrimitive(item.kind),
        chain_id: normalizePrimitive(item.chainId),
        chain: normalizePrimitive(item.chainName),
        source: normalizePrimitive(item.source),
    }));
    return compact.length > 0 ? compact : undefined;
}

function summarizeFarcaster(farcaster: Record<string, any> | null | undefined) {
    if (!farcaster || typeof farcaster !== 'object') return undefined;
    return stripEmptyEntries({
        handle: normalizePrimitive(farcaster.handle || farcaster.username || farcaster.kikoHandle),
        display_name: normalizePrimitive(farcaster.displayName),
        fid: normalizePrimitive(farcaster.fid),
    });
}

function normalizePrimitive(value: unknown): string | number | boolean | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return undefined;
}

function limitArray(values: string[] | undefined, maxLen: number): string[] | undefined {
    if (!Array.isArray(values) || values.length === 0) return undefined;
    const compact = values.slice(0, maxLen).map((item) => String(item || '').trim()).filter(Boolean);
    return compact.length > 0 ? compact : undefined;
}

function truncateText(value: unknown, maxLen: number): string | undefined {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return undefined;
    return text.length <= maxLen ? text : `${text.slice(0, maxLen)}...`;
}

function isLikelyAddress(value: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function stripEmptyEntries<T extends Record<string, any>>(input: T): T {
    return Object.fromEntries(
        Object.entries(input).filter(([, value]) => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'string' && !value.trim()) return false;
            if (Array.isArray(value) && value.length === 0) return false;
            if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
            return true;
        }),
    ) as T;
}
